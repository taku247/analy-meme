# ミームコイン検知サイト (Meme Coin Tracker)

"狂信的ファンが集まり暴騰するミームコイン／草コイン" を一般投資家より先に検知する Web アプリケーション。

## 概要

PEPE / DOGE / FLOKI などで大化けした "インサイダー並みに早く買っていたアドレス" をウォッチリスト化し、彼らが新たに買い集め始めた銘柄を追跡・可視化します。

## 主要機能

-   **設定画面**: トークンアドレス・期間・Market Cap 条件の管理
-   **ウォレット一覧**: 有望アドレスの表示・管理
-   **分析画面**: チャート表示とウォレット購入ポイントの可視化
-   **設定エクスポート/インポート**: チーム間での設定共有

## 技術スタック

-   **フロントエンド**: React + TypeScript + Vite
-   **UI**: TailwindCSS + Tailwind Forms
-   **データベース**: Firebase Firestore (リアルタイム同期対応)
-   **チャート**: Chart.js + React Chart.js 2
-   **API**: Birdeye API (OHLCV) + QuickNode RPC (ウォレット分析) + Dune Analytics (購入者データ)

## ローカル開発環境のセットアップ

### 前提条件

-   Node.js 18+ がインストールされていること
-   Yarn がインストールされていること

### 起動手順

1. **プロジェクトのクローン**

    ```bash
    git clone <repository-url>
    cd meme-coin-tracker
    ```

2. **依存関係のインストール**

    ```bash
    yarn install
    ```

3. **開発サーバーの起動**

    ```bash
    yarn dev
    ```

4. **ブラウザでアクセス**
    ```
    http://localhost:5173
    ```

### 利用可能なコマンド

```bash
# 開発サーバーの起動
yarn dev

# 本番ビルド
yarn build

# 本番ビルドのプレビュー
yarn preview

# Lintチェック
yarn lint

# 依存関係の追加
yarn add <package-name>

# 依存関係の削除
yarn remove <package-name>
```

## Firebase & API 設定

### 必要な API キー

1. **Firebase プロジェクト**

    - [Firebase Console](https://console.firebase.google.com) でプロジェクトを作成
    - Firestore Database を有効化
    - プロジェクト設定から Web アプリの設定値を取得

2. **Birdeye API Key**

    - [Birdeye](https://birdeye.so) で API キーを取得
    - チャートデータ（OHLCV）の取得に使用

3. **Dune Analytics API Key**

    - [Dune Analytics](https://dune.com) で API キーを取得
    - Ethereum 購入者データの取得に使用

4. **QuickNode API Key** (オプション)
    - [QuickNode](https://www.quicknode.com) で API キーを取得
    - ウォレット取引履歴の詳細分析に使用

### 環境変数設定

プロジェクトルートに `.env` ファイルを作成：

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# API Keys
VITE_BIRDEYE_API_KEY=your-birdeye-api-key
VITE_DUNE_API_KEY=your-dune-api-key
VITE_QUICKNODE_SOLANA_ENDPOINT=your-quicknode-solana-endpoint
VITE_QUICKNODE_ETHEREUM_ENDPOINT=your-quicknode-ethereum-endpoint
```

### Firebase 動作確認方法

1. **開発サーバー起動**

    ```bash
    yarn dev
    ```

2. **ブラウザアクセス**

    - http://localhost:5174/ (ポートは自動選択)

3. **基本動作確認**

    - ブラウザの開発者ツール (F12) → Console タブ
    - `🔥 Firestore: トークンデータ読み込み完了 X件` のログを確認

4. **トークン追加テスト**

    - 「トークンを追加」→ サンプルデータ入力
    - シンボル: `TEST`
    - アドレス: `0x1234567890123456789012345678901234567890`
    - チェーン: `Ethereum`
    - 期間: 「過去 24 時間」プリセット使用
    - Console で `🔥 Firestore: トークン追加成功` を確認

5. **Firebase 管理画面確認**

    - [Firebase Console](https://console.firebase.google.com/)
    - プロジェクト → Firestore Database
    - `tokens` と `promising-addresses` コレクションを確認

6. **複数デバイス同期テスト**
    - 同じ URL を別タブで開く
    - 片方でトークン追加/削除
    - もう片方での反映確認 (現在はページリロード必要)

### API 接続テスト

アプリケーション内の「設定」タブで各 API の「接続テスト」ボタンを使用：

-   **Birdeye API**: 接続状況とサンプルデータ取得確認
-   **Dune API**: 認証とクエリ実行確認
-   **QuickNode API**: Solana/Ethereum エンドポイント確認

## 使用方法

### 1. トークン設定

1. 「設定」タブで「トークンを追加」をクリック
2. 以下の情報を入力：
    - シンボル（例: WIF, PEPE）
    - トークンアドレス
    - 分析期間（開始日時〜終了日時）
    - Market Cap 上限（オプション）
    - チェーン（Solana/Ethereum）

### 2. ウォレット分析

1. 「ウォレット一覧」タブでトークンを選択
2. 該当期間に購入したアドレス一覧を確認
3. 他のトークンも購入しているアドレスをバッジで確認

### 3. 新規トークン分析

1. 「分析」タブで新しいトークンアドレスを入力
2. 登録済み有望アドレスとの照合結果を確認
3. チャート上の購入ポイントを視覚的に確認

## 設定の共有

### エクスポート

1. 「設定」タブの「設定の管理」セクション
2. 「設定をエクスポート」で JSON ファイルをダウンロード

### インポート

1. 「設定をインポート」で JSON ファイルを選択
2. 設定が自動的に読み込まれます

## 開発ロードマップ

-   [x] 基本 UI・設定画面
-   [ ] Birdeye API 接続
-   [ ] チャート表示機能
-   [ ] QuickNode API 接続
-   [ ] ウォレット分析機能
-   [ ] リアルタイム更新
-   [ ] パフォーマンス最適化

## トラブルシューティング

### よくある問題

1. **API 接続エラー**

    - API キーが正しく設定されているか確認
    - CORS 問題の場合はプロキシサーバーを検討

2. **開発サーバーが起動しない**

    - Node.js のバージョンを確認（18+推奨）
    - `yarn install`を再実行

3. **ビルドエラー**
    - TypeScript エラーを確認
    - `yarn lint`でコード品質をチェック

## ライセンス

MIT License
