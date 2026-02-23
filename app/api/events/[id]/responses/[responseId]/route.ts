import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; responseId: string } }) {
  const token = req.nextUrl.searchParams.get("edit");
  if (!token) {
    return NextResponse.json({ error: "編集トークンが必要です。" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエスト形式が正しくありません。" }, { status: 400 });
  }

  const { data: responseRow, error: responseError } = await supabaseAdmin
    .from("responses")
    .select("id,edit_token")
    .eq("id", params.responseId)
    .eq("event_id", params.id)
    .single();

  if (responseError || !responseRow) {
    return NextResponse.json({ error: "回答データが見つかりません。" }, { status: 404 });
  }

  if (responseRow.edit_token !== token) {
    return NextResponse.json({ error: "編集トークンが一致しません。" }, { status: 403 });
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.rsvp === "yes" || body.rsvp === "maybe" || body.rsvp === "no") {
    updatePayload.rsvp = body.rsvp;
  }

  if (typeof body.paid === "boolean") {
    updatePayload.paid = body.paid;
    updatePayload.paid_at = body.paid ? new Date().toISOString() : null;
  }

  const { data, error } = await supabaseAdmin
    .from("responses")
    .update(updatePayload)
    .eq("id", params.responseId)
    .eq("event_id", params.id)
    .select("id,name,rsvp,paid,paid_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "回答の更新に失敗しました。" }, { status: 500 });
  }

  return NextResponse.json(data);
}
