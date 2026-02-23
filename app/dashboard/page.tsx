import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";
import { OWNER_TOKENS_COOKIE, parseOwnerTokens } from "@/lib/ownerTokens";

type EventRow = {
  id: string;
  title: string;
  date: string | null;
  place: string | null;
  collecting: boolean;
  amount: number;
  owner_token: string;
  created_at: string;
};

type ResponseRow = {
  id: string;
  event_id: string;
  name: string;
  rsvp: "yes" | "maybe" | "no";
  paid: boolean;
};

function fmtDate(value: string | null) {
  if (!value) return "日時未設定";
  try {
    return new Date(value).toLocaleString("ja-JP", {
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export default async function DashboardPage() {
  if (!supabaseAdmin) {
    return (
      <main className="container">
        <div className="card hero">
          <h1 className="h1">全体ダッシュボード</h1>
          <p className="status status-error" style={{ marginTop: 16 }}>
            環境変数が不足しています（SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）。
          </p>
          <div style={{ marginTop: 16 }}>
            <Link className="btn btn-ghost" href="/">ホームへ戻る</Link>
          </div>
        </div>
      </main>
    );
  }

  const cookieStore = cookies();
  const ownerTokens = parseOwnerTokens(cookieStore.get(OWNER_TOKENS_COOKIE)?.value);

  let eventsError: unknown = null;
  let responsesError: unknown = null;
  let events: EventRow[] = [];
  let responses: ResponseRow[] = [];

  if (ownerTokens.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("events")
      .select("id,title,date,place,collecting,amount,owner_token,created_at")
      .in("owner_token", ownerTokens)
      .order("created_at", { ascending: false });

    eventsError = error;
    events = (data || []) as EventRow[];

    const eventIds = events.map((event) => event.id);
    if (!error && eventIds.length > 0) {
      const { data: responseData, error: responseError } = await supabaseAdmin
        .from("responses")
        .select("id,event_id,name,rsvp,paid")
        .in("event_id", eventIds)
        .order("created_at", { ascending: true });

      responsesError = responseError;
      responses = (responseData || []) as ResponseRow[];
    }
  }

  if (eventsError || responsesError) {
    return (
      <main className="container">
        <div className="card hero">
          <h1 className="h1">全体ダッシュボード</h1>
          <p className="status status-error" style={{ marginTop: 16 }}>
            データ取得に失敗しました。
          </p>
        </div>
      </main>
    );
  }

  const eventList = events;
  const responseList = responses;

  const totalYes = responseList.filter((r) => r.rsvp === "yes").length;
  const totalPaid = responseList.filter((r) => r.rsvp === "yes" && r.paid).length;

  return (
    <main className="container">
      <div className="stack">
        <div className="row-between">
          <h1 className="h1">ダッシュボード</h1>
          <Link className="btn btn-ghost btn-sm" href="/">ホーム</Link>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <div className="card" style={{ textAlign: "center", padding: 16 }}>
            <p className="stat-value">{eventList.length}</p>
            <p className="stat-label">イベント</p>
          </div>
          <div className="card" style={{ textAlign: "center", padding: 16 }}>
            <p className="stat-value">{totalYes}</p>
            <p className="stat-label">参加者</p>
          </div>
          <div className="card" style={{ textAlign: "center", padding: 16 }}>
            <p className="stat-value">{totalPaid}</p>
            <p className="stat-label">支払い済み</p>
          </div>
        </div>

        {/* Event List */}
        {eventList.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: 32 }}>
            <p className="hint" style={{ marginTop: 0 }}>まだイベントがありません。</p>
            <div style={{ marginTop: 12 }}>
              <Link className="btn btn-primary" href="/event/new">最初のイベントを作成</Link>
            </div>
          </div>
        )}

        {eventList.map((event) => {
          const rows = responseList.filter((r) => r.event_id === event.id);
          const yesCount = rows.filter((r) => r.rsvp === "yes").length;
          const maybeCount = rows.filter((r) => r.rsvp === "maybe").length;
          const paidCount = rows.filter((r) => r.rsvp === "yes" && r.paid).length;
          const paidRatio = yesCount > 0 ? (paidCount / yesCount) * 100 : 0;

          return (
            <div className="card" key={event.id}>
              <div className="row-between row-between-mobile">
                <div>
                  <h2 className="h2">{event.title}</h2>
                  <p className="hint">
                    {fmtDate(event.date)}
                    {event.place ? ` / ${event.place}` : ""}
                  </p>
                </div>
                <Link className="btn btn-ghost btn-sm" href={`/event/${event.id}/manage?token=${event.owner_token}`}>
                  管理
                </Link>
              </div>

              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                <span className="badge badge-success">{yesCount} 参加</span>
                {maybeCount > 0 && <span className="badge badge-warn">{maybeCount} 未定</span>}
                {event.collecting && (
                  <span className="badge badge-accent">{paidCount}/{yesCount} 支払い済み</span>
                )}
              </div>

              {event.collecting && yesCount > 0 && (
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${paidRatio}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
