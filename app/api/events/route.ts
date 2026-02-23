import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { mergeOwnerTokens, readOwnerTokensFromRequest, writeOwnerTokensCookie } from "@/lib/ownerTokens";

export const dynamic = "force-dynamic";

function randomToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!title) {
      return NextResponse.json({ error: "イベント名を入力してください。" }, { status: 400 });
    }

    const amount = Number(body.amount ?? 0);
    if (Number.isNaN(amount) || amount < 0) {
      return NextResponse.json({ error: "金額は0以上の数字で入力してください。" }, { status: 400 });
    }

    const ownerToken = randomToken();
    const { data, error } = await supabaseAdmin
      .from("events")
      .insert({
        title,
        date: body.date || null,
        place: typeof body.place === "string" && body.place.trim() ? body.place.trim() : null,
        note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
        collecting: !!body.collecting,
        amount,
        pay_url: typeof body.pay_url === "string" && body.pay_url.trim() ? body.pay_url.trim() : null,
        owner_token: ownerToken,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: "イベント作成に失敗しました。" }, { status: 500 });
    }

    const response = NextResponse.json({ eventId: data.id, ownerToken });
    const existingTokens = readOwnerTokensFromRequest(req);
    const mergedTokens = mergeOwnerTokens(existingTokens, ownerToken);
    writeOwnerTokensCookie(response, mergedTokens);
    return response;
  } catch (e) {
    console.error("[POST /api/events]", e);
    return NextResponse.json({ error: "リクエスト形式が正しくありません。" }, { status: 400 });
  }
}
