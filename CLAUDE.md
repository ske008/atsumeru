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

### ルーティング

SPA内ルーティングは `App` の `page` / `pageArg` stateで管理。遷移は `go(page, arg)` を呼ぶだけ。

```js
go("manage", ev.id)   // pageArg にイベントIDを渡す
go("home")            // argなし
```

`App.useEffect` 起動時に `?event=<id>` URLパラメータを検出し、自動で `participant` ページに遷移する。

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

### コンポーネント構成

| コンポーネント | 役割 |
|---|---|
| `App` | ルートコンポーネント。`page` stateで画面を切り替え。Nav表示制御も担当 |
| `Nav` | 共通ヘッダー（参加者ページでは非表示） |
| `Home` | ランディング |
| `Login` | メール入力のみ（認証なし） |
| `Create` | イベント作成フォーム |
| `EventList` | 主催イベント一覧 |
| `Manage` | 幹事管理画面。`tab` state = `"rsvp"` \| `"collect"` |
| `ParticipantPage` | 参加者向け公開ページ（`?event=<id>`） |
| `Field` | ラベル・ヒント付きフォームフィールドの共通ラッパー |
| `MemberRow` | 出欠タブのメンバー1行（削除ボタン付き） |

### データ更新パターン（read-modify-write）

localStorageへの書き込みは必ず以下の形で行う（`Manage.save()` が典型例）：

```js
const all = db.get("atsumeru_events") || [];
const idx = all.findIndex((e) => e.id === eventId);
if (idx >= 0) all[idx] = updatedEvent;
db.set("atsumeru_events", all);
```

### 参加者ページのステートマシン

```
rsvp → rsvp_done → paying → confirm → done
                 ↘ confirm（payUrl未設定時）→ done
```

「あとから支払う」フロー（`rsvp` 画面に表示）: `selectedPayName` stateで名前を選択 → `handlePayLaterBySelection()` → payUrlあり: `openPayLink()` → `paying` → `confirm` → `done` / payUrlなし: `confirm` → `done`

`paying` ステップでは `visibilitychange` / `focus` イベントを監視し、送金アプリから戻った時点で自動的に `confirm` へ遷移する。

## コーディング規則

- デザイントークンは `C` オブジェクト（色・フォント・radius）、共通スタイルは `S` オブジェクト（インラインスタイル）
- 新しい画面はすべて `App` の条件分岐（`page === "xxx"` の羅列）に追加し、`go()` で遷移する
- `db.get/set` を経由してlocalStorageを操作する（直接アクセス禁止）
