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

**Supabase設定**: `config.js` に Supabase URL と anon key を記載（.gitignore済み）。

**デプロイ**: `main` を含む全ブランチへの push が GitHub Actions で自動的に GitHub Pages へデプロイされる（`.github/workflows/pages.yml`）。

## アーキテクチャ

**単一ファイル構成**: `index.html` にすべてが含まれる。

- **React 18** (CDN/UMD) + **Babel standalone** でブラウザ内JSXトランスパイル
- **Supabase** でデータ永続化（`events` / `members` テーブル）
- **Supabase Realtime** で変更をリアルタイム検知（ポーリング不要）
- ユーザー識別は `localStorage`（`atsumeru_user`）にメールを保存する簡易方式

### ルーティング

SPA内ルーティングは `App` の `page` / `pageArg` stateで管理。遷移は `go(page, arg)` を呼ぶだけ。

```js
go("manage", ev.id)   // pageArg にイベントIDを渡す
go("home")            // argなし
```

`App.useEffect` 起動時に `?event=<id>` URLパラメータを検出し、自動で `participant` ページに遷移する。

### データモデル（Supabase）

```sql
-- events テーブル
id TEXT PRIMARY KEY
title TEXT NOT NULL
date TEXT
place TEXT
note TEXT
created_by TEXT NOT NULL
created_at TEXT NOT NULL
collecting BOOLEAN DEFAULT FALSE
amount INTEGER DEFAULT 0
pay_url TEXT DEFAULT ''

-- members テーブル
id TEXT PRIMARY KEY
event_id TEXT NOT NULL REFERENCES events(id)
name TEXT NOT NULL
rsvp TEXT ('yes'|'no'|'maybe')
paid BOOLEAN DEFAULT FALSE
paid_at TEXT
```

### コンポーネント構成

| コンポーネント | 役割 |
|---|---|
| `App` | ルートコンポーネント。`page` stateで画面を切り替え |
| `Nav` | 共通ヘッダー（参加者ページでは非表示） |
| `Home` | ランディング |
| `Login` | メール入力のみ（認証なし） |
| `Create` | イベント作成フォーム |
| `EventList` | 主催イベント一覧 |
| `Manage` | 幹事管理画面。`tab` state = `"rsvp"` \| `"collect"` |
| `ParticipantPage` | 参加者向け公開ページ（`?event=<id>`） |
| `Field` | ラベル・ヒント付きフォームフィールドの共通ラッパー |
| `MemberRow` | 出欠タブのメンバー1行（削除ボタン付き） |

### DB操作パターン

`db` オブジェクト経由でSupabaseを操作する（直接 `supabase.from()` しない）：

```js
await db.getEvents(user)          // イベント一覧取得
await db.getEvent(id)             // 単一イベント取得
await db.createEvent(ev)          // イベント作成
await db.updateEvent(id, fields)  // イベント更新
await db.getMembers(eventId)      // メンバー一覧取得
await db.upsertMember(eventId, name, rsvp)  // メンバー追加/更新
await db.removeMember(memberId)   // メンバー削除
await db.setPaid(memberId, paid)  // 支払い状態更新
```

### 参加者ページのステートマシン

```
rsvp → rsvp_done → paying → confirm → done
                 ↘ confirm（payUrl未設定時）→ done
```

## コーディング規則

- デザイントークンは `C` オブジェクト（色・フォント・radius）、共通スタイルは `S` オブジェクト（インラインスタイル）
- 新しい画面はすべて `App` の条件分岐（`page === "xxx"` の羅列）に追加し、`go()` で遷移する
- DB操作は `db` オブジェクト経由で行う
- ユーザー管理は `localUser.get/set` を使用
