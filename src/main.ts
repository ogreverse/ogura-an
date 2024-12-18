import { app, BrowserWindow, ipcMain, Tray, Menu } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import axios from 'axios'

// .envファイルをロード
dotenv.config({ path: path.join(__dirname, '.env') })

// 環境変数
const OPENAI_API_MODEL = process.env.OPENAI_API_MODEL || ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const NOTION_SECRET_KEY = process.env.NOTION_SECRET_KEY || ''
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID || ''

let mainWindow: BrowserWindow | null
let tray: Tray | null
let isQuitting = false

app.on('ready', () => {
  // メインウィンドウ作成
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false, // 最初は非表示
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  // システムトレイ設定
  const iconPath = path.resolve(__dirname, './images/icon.png')
  tray = new Tray(iconPath)
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Window', click: () => mainWindow?.show() },
    { label: 'Exit', click: () => {
      isQuitting = true
      app.quit()
    }},
  ])
  tray.setToolTip('Ogura AN')
  tray.setContextMenu(contextMenu)

  // ウィンドウが閉じられたときに隠す
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })
})

// OpenAIに意味を問い合わせる
ipcMain.handle(
  'fetch-word-meaning',
  async (_event, { word, context }: { word: string; context: string }) => {
    const messages = [
      {
        role: 'system',
        content: `
        以下のワードと文脈を参考に、ワード、意味（500文字以下で、である調の詳細な説明、略語の場合は分解した言葉を頭に含める）、タグ（カテゴリ分けしやすいタグを、カンマ区切りで１〜３個記載する）、使い方の4つの項目を含むJSONを返却してください。
        返却値は必ずJSONだけにしてください。
        JSONのキーは例に合わせてください。
        使い方は文脈をそのまま転載せず、ワードを使用した適切な例文を作成してください。
        （例）ワード: GRIT、文脈: 評価においてGRITが重要だと言われている。
        {
          "word": "GRIT",
          "meaning": "Guts Resilience Initiative Tenacity。長期的な目標に対する情熱と忍耐力を指す概念であり、困難や障害に直面しても諦めずに努力を続ける力を表す。心理学者アンジェラ・ダックワースによって提唱され、個人の成功や達成において重要な要素とされている。",
          "tag": "心理学,特性",
          "usage": "彼女のGRITが評価され、厳しいプロジェクトを最後までやり遂げることができた。"
        }
        `,
      },
      { role: 'user', content: `ワード: ${word}\n文脈: ${context}` },
    ]
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: OPENAI_API_MODEL,
          messages,
        },
        {
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        },
      )
      return response.data.choices[0].message.content
    } catch (error) {
      console.error(error)
      throw new Error('OpenAI APIのリクエストに失敗しました')
    }
  },
)

// Notionに登録
ipcMain.handle('register-to-notion', async (_event, resultText: string) => {
  try {
    const resultParams = JSON.parse(resultText)

    // 返却値の形式チェック
    if (!resultParams.word || !resultParams.meaning) {
      throw new Error('返却値が不正です')
    }

    const nowLocal = new Date()
    const diff: number = nowLocal.getTimezoneOffset() * 60 * 1000
    const plusLocal = new Date(nowLocal.getTime() - diff)
    let createdAt = plusLocal.toISOString()
    createdAt = createdAt.slice(0, 19) + '+09:00'

    const tags = resultParams.tag.split(',')

    const response = await axios.post(
      'https://api.notion.com/v1/pages',
      {
        parent: { database_id: NOTION_DATABASE_ID },
        properties: {
          Word: {
            title: [
              {
                text: {
                  content: resultParams.word,
                },
              },
            ],
          },
          Meaning: {
            rich_text: [
              {
                text: {
                  content: resultParams.meaning,
                },
              },
            ],
          },
          Usage: {
            rich_text: [
              {
                text: {
                  content: resultParams.usage || '',
                },
              },
            ],
          },
          Tags: {
            multi_select: tags.map((tag: string) => {
              return {
                name: tag.trim(),
              }
            }),
          },
          CreatedAt: {
            date: { start: createdAt },
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${NOTION_SECRET_KEY}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
      },
    )
    return response.data
  } catch (error) {
    console.error(error)
    throw new Error('Notion APIのリクエストに失敗しました')
  }
})

// エラーログ出力
const logFilePath = path.join(app.getPath('userData'), 'error.log')

const logError = (type: string, message: string) => {
  const logMessage = `[${new Date().toISOString()}] ${type}: ${message}\n`
  fs.appendFileSync(logFilePath, logMessage)
}

process.on('uncaughtException', (error) => {
  console.error('未キャッチの例外が発生しました:', error)
  logError('uncaughtException', error.toString())
})

process.on('unhandledRejection', (reason) => {
  console.error('未処理のPromise拒否が発生しました:', reason)
  if (typeof reason === 'string') {
    logError('unhandledRejection', reason)
  } else if (reason instanceof Error) {
    logError('unhandledRejection', reason.message)
  } else {
    logError('unhandledRejection', JSON.stringify(reason))
  }
})

ipcMain.on('notify-error', (_event, type, message) => {
  console.error(`レンダラープロセスからのエラー通知: ${type}: ${message}`)
  logError(type, message)
})
