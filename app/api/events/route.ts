import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { mergeOwnerTokens, readOwnerTokensFromRequest, writeOwnerTokensCookie } from "@/lib/ownerTokens";

export const dynamic = "force-dynamic";

const MONTHLY_LIMIT = 10;

function randomToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip");
}

async function hashIp(ip: string): Promise<string> {
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "atsumeru-rate-limit-salt";
  const data = new TextEncoder().encode(ip + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
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

    const totalAmount = Number(body.total_amount ?? 0);
    if (Number.isNaN(totalAmount) || totalAmount < 0) {
      return NextResponse.json({ error: "合計金額は0以上の数字で入力してください。" }, { status: 400 });
    }

    const splitCount = Number(body.split_count ?? 0);
    if (Number.isNaN(splitCount) || splitCount < 0) {
      return NextResponse.json({ error: "人数は0以上の数字で入力してください。" }, { status: 400 });
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

    // Rate limiting: max MONTHLY_LIMIT events per IP per calendar month
    const clientIp = getClientIp(req);
    let ipHash: string | null = null;
    if (clientIp) {
      ipHash = await hashIp(clientIp);
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

      const { count, error: countError } = await supabaseAdmin
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", monthStart);

      if (!countError && (count ?? 0) >= MONTHLY_LIMIT) {
        return NextResponse.json(
          { error: `1端末からのイベント作成は月${MONTHLY_LIMIT}回までです。来月またお試しください。` },
          { status: 429 }
        );
      }
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
        total_amount: totalAmount,
        split_count: splitCount,
        pay_url: payUrl,
        owner_token: ownerToken,
        ip_hash: ipHash,
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
