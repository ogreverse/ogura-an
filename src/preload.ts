import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  fetchWordMeaning: (word: string, context: string) =>
    ipcRenderer.invoke('fetch-word-meaning', { word, context }),
  registerToNotion: (resultText: string) =>
    ipcRenderer.invoke('register-to-notion', resultText),
})
