-- アツメル Supabase テーブル作成SQL
-- Supabaseダッシュボードの SQL Editor で実行してください

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT,
  place TEXT,
  note TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  collecting BOOLEAN DEFAULT FALSE,
  amount INTEGER DEFAULT 0,
  total_amount INTEGER DEFAULT 0,
  split_count INTEGER DEFAULT 0,
  pay_url TEXT DEFAULT ''
);

CREATE TABLE responses (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rsvp TEXT CHECK (rsvp IN ('yes', 'no', 'maybe')),
  paid BOOLEAN DEFAULT FALSE,
  paid_at TEXT,
  amount INTEGER DEFAULT NULL
);

CREATE INDEX idx_responses_event_id ON responses(event_id);

-- RLS有効化 + 全公開ポリシー（認証なしアプリのため）
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_events" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_responses" ON responses FOR ALL USING (true) WITH CHECK (true);
