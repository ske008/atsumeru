import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "管理トークンが必要です。" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエスト形式が正しくありません。" }, { status: 400 });
  }

  const amount = Number(body.amount ?? 0);
  if (Number.isNaN(amount) || amount < 0) {
    return NextResponse.json({ error: "金額は0以上の数字で入力してください。" }, { status: 400 });
  }

  const totalAmount = Number(body.total_amount ?? 0);
  if (Number.isNaN(totalAmount) || totalAmount < 0) {
    return NextResponse.json({ error: "合計金額は0以上の数字で入力してください。" }, { status: 400 });
  }

  const splitCount = Number(body.split_count ?? 0);
  if (Number.isNaN(splitCount) || splitCount < 0) {
    return NextResponse.json({ error: "人数は0以上の数字で入力してください。" }, { status: 400 });
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .select("id,owner_token")
    .eq("id", params.id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "イベントが見つかりません。" }, { status: 404 });
  }

  if (event.owner_token !== token) {
    return NextResponse.json({ error: "管理トークンが一致しません。" }, { status: 403 });
  }

  let payUrl: string | null = null;
  if (typeof body.pay_url === "string" && body.pay_url.trim()) {
    try {
      const parsed = new URL(body.pay_url.trim());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return NextResponse.json({ error: "支払いURLはhttp://またはhttps://で始まる必要があります。" }, { status: 400 });
      }
      payUrl = parsed.toString();
    } catch {
      return NextResponse.json({ error: "支払いURLの形式が正しくありません。" }, { status: 400 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from("events")
    .update({
      collecting: !!body.collecting,
      amount,
      total_amount: totalAmount,
      split_count: splitCount,
      pay_url: payUrl,
    })
    .eq("id", params.id)
    .select("id,collecting,amount,total_amount,split_count,pay_url")
    .single();

  if (error) {
    return NextResponse.json({ error: "集金設定の更新に失敗しました。" }, { status: 500 });
  }

  return NextResponse.json(data);
}
