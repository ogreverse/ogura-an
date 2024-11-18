# ogura-an

OpenAIとNotionのElectronアプリ

## Setup

```
$ sh setup.sh
```

生成された .env ファイルに、必要なパラメータを設定する。

## Commands

### アプリを起動する

```
$ npm run build
$ npm run start
```

### appファイルとして出力する (arm64版)

```
$ npm run build
$ npm run make:arm64
```

out ディレクトリに app ファイルが生成される。