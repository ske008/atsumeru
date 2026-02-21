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
  pay_url TEXT DEFAULT ''
);

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rsvp TEXT CHECK (rsvp IN ('yes', 'no', 'maybe')),
  paid BOOLEAN DEFAULT FALSE,
  paid_at TEXT
);

CREATE INDEX idx_members_event_id ON members(event_id);

-- RLS有効化 + 全公開ポリシー（認証なしアプリのため）
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_events" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_members" ON members FOR ALL USING (true) WITH CHECK (true);
