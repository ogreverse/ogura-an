export {}

declare global {
  interface Window {
    api: {
      fetchWordMeaning: (word: string, context: string) => Promise<string>
      registerToNotion: (resultText: string) => Promise<void>
    }
  }
}
