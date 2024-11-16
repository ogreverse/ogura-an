import { app, BrowserWindow, ipcMain, Tray, Menu } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import axios from 'axios'

// .envファイルをロード
dotenv.config()

// 環境変数
const OPENAI_API_MODEL = process.env.OPENAI_API_MODEL || ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const NOTION_SECRET_KEY = process.env.NOTION_SECRET_KEY || ''
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID || ''

let mainWindow: BrowserWindow | null
let tray: Tray | null

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
    { label: 'Exit', click: () => app.quit() },
  ])
  tray.setToolTip('Ogura AN')
  tray.setContextMenu(contextMenu)

  // ウィンドウが閉じられたときに隠す
  mainWindow.on('close', (e) => {
    e.preventDefault()
    mainWindow?.hide()
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
        以下のワードと文脈を参考に、ワードの意味を500文字以下で詳しく説明し、ワード、意味、タグ、使い方の4つの項目を含むJSONを返却してください。
        返却値は必ずJSONだけにしてください。
        JSONのキーは例に合わせてください。
        使い方は文脈をそのまま転載せず、ワードを使用した適切な例文を作成してください。
        （例）ワード: りんご、文脈: りんごを食べる
        {
          "word": "りんご",
          "meaning": "赤色か緑色をした丸い形状の果物",
          "tag": "フルーツ",
          "usage": "あの木になっている美味しそうなりんごだ。"
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
            multi_select: [
              {
                name: resultParams.tag || '',
              },
            ],
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
