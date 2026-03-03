-- eventsテーブルに割り勘用のカラムを追加
ALTER TABLE events ADD COLUMN IF NOT EXISTS total_amount INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS split_count INTEGER DEFAULT 0;

-- responsesテーブルに個別金額用のamountカラムを追加
ALTER TABLE responses ADD COLUMN IF NOT EXISTS amount INTEGER DEFAULT NULL;
