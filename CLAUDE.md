# CLAUDE.md

このファイルは、このリポジトリで作業する AI/開発者向けの運用メモです。

## 目的

このプロジェクト（atsumeru）は、
「出欠管理 + 集金確認」をシンプルに運用するための Web アプリです。

## 現在の構成（重要）

- フロントエンド: Next.js App Router
- バックエンド: Next.js Route Handlers（`app/api`）
- データベース: Supabase

※ 「バックエンドなし」ではありません。`app/api` がバックエンドです。

## 必須環境変数

ローカル・Vercel ともに以下が必要です。

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

注意:

- `SUPABASE_SERVICE_ROLE_KEY` はサーバー専用。`NEXT_PUBLIC_` を付けない。
- `.env.local` はコミットしない。

## 主要ページ

- `/` ホーム
- `/event/new` イベント作成
- `/event/[eventId]` 参加者ページ（回答用）
- `/event/[eventId]/manage?token=...` 管理ページ
- `/dashboard` 全体ダッシュボード（出席/支払い集計）

## API

- `POST /api/events` イベント作成
- `GET /api/events/[id]` イベント取得
- `PATCH /api/events/[id]/manage?token=...` 集金設定更新
- `GET /api/events/[id]/responses?token=...` 回答一覧取得（管理）
- `POST /api/events/[id]/responses` 回答登録（参加者）
- `PATCH /api/events/[id]/responses/[responseId]?edit=...` 参加者側更新
- `PATCH /api/events/[id]/responses/[responseId]/paid?token=...` 管理側の支払い更新

## スキーマ

基準は `docs/schema.sql`。

主要テーブル:

- `events`
- `responses`

## 作業ルール（このリポジトリ）

- 変更後は `npm run build` で動作確認する。
- ユーザー向け文言は日本語で統一する。
- 文字コードは UTF-8 を維持する。
- 既存仕様を壊す変更は、先に意図を明記してから行う。

## 現在の運用優先事項

- 「簡単に・シンプルに・確実に動く」ことを最優先にする。
- まず壊れない最小機能を守り、装飾や拡張は後回しにする。
