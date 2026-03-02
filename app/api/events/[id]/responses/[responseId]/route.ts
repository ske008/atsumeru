import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; responseId: string } }) {
  const editToken = req.nextUrl.searchParams.get("edit");
  const ownerToken = req.nextUrl.searchParams.get("token");

  if (!editToken && !ownerToken) {
    return NextResponse.json({ error: "トークンが必要です。" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエスト形式が正しくありません。" }, { status: 400 });
  }

  // イベントと回答を同時にチェック
  const [eventRes, responseRes] = await Promise.all([
    supabaseAdmin.from("events").select("owner_token").eq("id", params.id).single(),
    supabaseAdmin.from("responses").select("id,edit_token").eq("id", params.responseId).eq("event_id", params.id).single(),
  ]);

  if (responseRes.error || !responseRes.data) {
    return NextResponse.json({ error: "回答データが見つかりません。" }, { status: 404 });
  }

  const isOwner = ownerToken && eventRes.data?.owner_token === ownerToken;
  const isParticipant = editToken && responseRes.data?.edit_token === editToken;

  if (!isOwner && !isParticipant) {
    return NextResponse.json({ error: "権限がありません。" }, { status: 403 });
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.name === "string" && body.name.trim()) {
    updatePayload.name = body.name.trim();
  }

  if (body.rsvp === "yes" || body.rsvp === "maybe" || body.rsvp === "no") {
    updatePayload.rsvp = body.rsvp;
  }

  if (typeof body.paid === "boolean") {
    updatePayload.paid = body.paid;
    updatePayload.paid_at = body.paid ? new Date().toISOString() : null;
  }

  if (typeof body.amount === "number" || body.amount === null) {
    updatePayload.amount = body.amount;
  }

  const { data, error } = await supabaseAdmin
    .from("responses")
    .update(updatePayload)
    .eq("id", params.responseId)
    .eq("event_id", params.id)
    .select("id,name,rsvp,paid,paid_at,amount")
    .single();

  if (error) {
    return NextResponse.json({ error: "回答の更新に失敗しました。" }, { status: 500 });
  }

  return NextResponse.json(data);
}
