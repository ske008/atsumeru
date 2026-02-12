# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

**アツメル** — イベントの出欠確認と集金を一括管理するシングルページWebアプリ。ビルドプロセスなし、バックエンドなし。

## 開発・確認方法

```bash
# ローカルサーバー起動（ポート8080）
python3 -m http.server 8080
```

ブラウザで `http://localhost:8080/` を開く。ビルド不要。

## アーキテクチャ

**単一ファイル構成**: `index.html` にすべてが含まれる。

- **React 18** (CDN/UMD) + **Babel standalone** でブラウザ内JSXトランスパイル
- **localStorage** のみ（`atsumeru_events` / `atsumeru_user`）— バックエンド・DB一切なし
- タブ間リアルタイム同期: `storage` イベント + 1秒ポーリング

### データモデル

```js
// atsumeru_events: Event[]
Event {
  id, title, date, place, note,
  createdBy, createdAt,
  members: Member[],
  collecting: boolean, amount: number, payUrl: string
}

Member { id, name, rsvp: "yes"|"no"|"maybe", paid: boolean, paidAt: string|null }
```

### 画面構成（`index.html` 内のコンポーネント）

| コンポーネント | 役割 |
|---|---|
| `Home` | ランディング |
| `Login` | メール入力のみ（認証なし） |
| `Create` | イベント作成フォーム |
| `EventList` | 主催イベント一覧 |
| `Manage` | 幹事管理画面（出欠タブ・集金タブ） |
| `ParticipantPage` | 参加者向け公開ページ（URLパラメータ `?event=<id>`） |

### 参加者ページのステートマシン

```
rsvp → rsvp_done → paying → confirm → done
                 ↘ confirm（payUrl未設定時）→ done
```

「あとから支払う」フロー: `selectedPayName` stateで名前を選択 → `handlePayLaterBySelection()` → 上記フローに合流。

## コーディング規則

- デザイントークンは `C` オブジェクト（色）、共通スタイルは `S` オブジェクト（インラインスタイル）
- 新しいスクリーンはすべて `App` コンポーネントの条件分岐に追加する
- `db.get/set` を経由してlocalStorageを操作する（直接アクセス禁止）
