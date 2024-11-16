const wordInput = document.getElementById('word') as HTMLInputElement
const contextInput = document.getElementById('context') as HTMLInputElement
const resultDiv = document.getElementById('result') as HTMLDivElement
const clearButton = document.getElementById('clear') as HTMLButtonElement
const searchButton = document.getElementById('search') as HTMLButtonElement

clearButton.addEventListener('click', () => {
  wordInput.value = ''
  contextInput.value = ''
  resultDiv.textContent = ''
})

searchButton.addEventListener('click', async () => {
  const word = wordInput.value
  const context = contextInput.value
  if (!word) {
    alert('ワードを入力してください')
    return
  }
  resultDiv.textContent = '検索中...'
  try {
    const result = await window.api.fetchWordMeaning(word, context)
    resultDiv.textContent = result

    // 登録ボタンを追加
    const registerButton = document.createElement('button')
    registerButton.textContent = '登録'
    registerButton.addEventListener('click', async () => {
      try {
        await window.api.registerToNotion(result)
        alert('Notionに登録しました')
      } catch (error) {
        alert('Notionへの登録に失敗しました')
      }
    })
    resultDiv.appendChild(registerButton)
  } catch (error) {
    resultDiv.textContent = 'エラーが発生しました'
  }
})
