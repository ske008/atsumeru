import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("id", params.id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "イベントが見つかりません。" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("responses")
    .select("id,name,rsvp,paid,edit_token,created_at")
    .eq("event_id", params.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "回答一覧の取得に失敗しました。" }, { status: 500 });
  }

  return NextResponse.json({ responses: data || [] });
}
