import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

function randomToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "管理トークンが必要です。" }, { status: 401 });
  }

  const { data: event, error: eventError } = await getSupabaseAdmin()
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

  const { data, error } = await getSupabaseAdmin()
    .from("responses")
    .select("id,name,rsvp,paid,paid_at,created_at,updated_at")
    .eq("event_id", params.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "回答一覧を取得できませんでした。" }, { status: 500 });
  }

  return NextResponse.json({ responses: data || [] });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエストです。" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const rsvp = body.rsvp;

  if (!name) {
    return NextResponse.json({ error: "名前を入力してください。" }, { status: 400 });
  }

  if (rsvp !== "yes" && rsvp !== "maybe" && rsvp !== "no") {
    return NextResponse.json({ error: "出欠の選択が不正です。" }, { status: 400 });
  }

  const { data: eventExists } = await getSupabaseAdmin()
    .from("events")
    .select("id")
    .eq("id", params.id)
    .single();

  if (!eventExists) {
    return NextResponse.json({ error: "イベントが見つかりません。" }, { status: 404 });
  }

  const editToken = randomToken();
  const { data, error } = await getSupabaseAdmin()
    .from("responses")
    .insert({
      event_id: params.id,
      name,
      rsvp,
      paid: false,
      edit_token: editToken,
    })
    .select("id,edit_token")
    .single();

  if (error) {
    return NextResponse.json({ error: "回答を保存できませんでした。" }, { status: 500 });
  }

  return NextResponse.json({ responseId: data.id, editToken: data.edit_token });
}
