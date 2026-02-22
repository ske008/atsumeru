import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; responseId: string } }) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "管理トークンが必要です。" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエストです。" }, { status: 400 });
  }

  if (typeof body.paid !== "boolean") {
    return NextResponse.json({ error: "支払い状態が不正です。" }, { status: 400 });
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .select("owner_token")
    .eq("id", params.id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "イベントが見つかりません。" }, { status: 404 });
  }

  if (event.owner_token !== token) {
    return NextResponse.json({ error: "管理者として認証できませんでした。" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("responses")
    .update({
      paid: body.paid,
      paid_at: body.paid ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.responseId)
    .eq("event_id", params.id)
    .select("id,paid,paid_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "支払い状態を更新できませんでした。" }, { status: 500 });
  }

  return NextResponse.json(data);
}
