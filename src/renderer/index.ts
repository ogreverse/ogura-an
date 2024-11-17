const wordInput = document.getElementById('input__word') as HTMLInputElement
const contextInput = document.getElementById('input__context') as HTMLInputElement
const resultWrapperDiv = document.getElementById('result__wrapper') as HTMLDivElement
const clearButton = document.getElementById('button__clear') as HTMLButtonElement
const searchButton = document.getElementById('button__search') as HTMLButtonElement

clearButton.addEventListener('click', () => {
  wordInput.value = ''
  contextInput.value = ''
  resultWrapperDiv.textContent = ''
})

searchButton.addEventListener('click', async () => {
  const word = wordInput.value
  const context = contextInput.value
  if (!word) {
    alert('ワードを入力してください')
    return
  }
  
  resultWrapperDiv.textContent = '検索中...'

  try {
    const result = await window.api.fetchWordMeaning(word, context)
    const resultText = document.createElement('pre')
    resultText.classList.add('result__text')
    
    // width は div に納まるようにする
    resultText.style.width = '100%'
    resultText.style.whiteSpace = 'pre-wrap'
    resultText.style.fontSize = '12px'

    resultText.textContent = result
    resultWrapperDiv.appendChild(resultText)

    // 登録ボタンを追加
    const registerButtonWrapper = document.createElement('div')
    registerButtonWrapper.style.display = 'flex'

    const registerButton = document.createElement('button')
    registerButton.textContent = '登録'
    registerButton.classList.add('button__register')

    registerButton.style.marginLeft = 'auto'

    registerButton.addEventListener('click', async () => {
      try {
        await window.api.registerToNotion(result)
        alert('Notionに登録しました')
      } catch (error) {
        alert('Notionへの登録に失敗しました')
      }
    })

    registerButtonWrapper.appendChild(registerButton)
    resultWrapperDiv.appendChild(registerButtonWrapper)
  } catch (error) {
    resultWrapperDiv.textContent = 'エラーが発生しました'
  }
})
