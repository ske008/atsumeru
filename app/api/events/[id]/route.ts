import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id,title,date,place,note,collecting,amount,pay_url,created_at")
    .eq("id", params.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "イベントが見つかりません。" }, { status: 404 });
  }

  return NextResponse.json(data);
}
