import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// ビルドエラー回避：URLとKeyが存在する場合のみクライアントを作成
export const supabaseAdmin = url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : null as any; // 型定義のため as any
