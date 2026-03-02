-- responsesテーブルに個別金額用のamountカラムを追加
ALTER TABLE responses ADD COLUMN amount INTEGER DEFAULT NULL;

-- 注: setup.sql の同期
-- 既存の events テーブルと responses テーブルの構成を確認し、
-- 必要に応じて setup.sql も更新してください。
