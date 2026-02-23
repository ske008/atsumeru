import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";

type EventRow = {
  id: string;
  title: string;
  date: string | null;
  place: string | null;
  collecting: boolean;
  amount: number;
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
  return new Date(value).toLocaleString("ja-JP");
}

export default async function DashboardPage() {
  if (!supabaseAdmin) {
    return (
      <main className="container">
        <section className="card">
          <h1 className="h1">全体ダッシュボード</h1>
          <p className="status status-error" style={{ marginTop: 12 }}>
            Supabase 環境変数が不足しています（SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）。
          </p>
          <div style={{ marginTop: 12 }}>
            <Link className="btn btn-ghost" href="/">
              ホームへ戻る
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const [{ data: events, error: eventsError }, { data: responses, error: responsesError }] = await Promise.all([
    supabaseAdmin
      .from("events")
      .select("id,title,date,place,collecting,amount,created_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("responses")
      .select("id,event_id,name,rsvp,paid")
      .order("created_at", { ascending: true }),
  ]);

  if (eventsError || responsesError) {
    return (
      <main className="container">
        <section className="card">
          <h1 className="h1">全体ダッシュボード</h1>
          <p className="status status-error" style={{ marginTop: 12 }}>
            データ取得に失敗しました。時間をおいて再試行してください。
          </p>
        </section>
      </main>
    );
  }

  const eventList = (events || []) as EventRow[];
  const responseList = (responses || []) as ResponseRow[];

  const totalYes = responseList.filter((r) => r.rsvp === "yes").length;
  const totalPaid = responseList.filter((r) => r.rsvp === "yes" && r.paid).length;
  const totalUnpaid = totalYes - totalPaid;

  return (
    <main className="container">
      <div className="stack">
        <section className="card">
          <div className="row-between">
            <div>
              <h1 className="h1">全体ダッシュボード</h1>
              <p className="hint">イベント全体の出欠・支払い状況を確認できます。</p>
            </div>
            <Link className="btn btn-ghost" href="/">
              ホーム
            </Link>
          </div>
        </section>

        <section className="card">
          <div className="list">
            <div className="item row-between">
              <strong>イベント数</strong>
              <span className="badge">{eventList.length}</span>
            </div>
            <div className="item row-between">
              <strong>参加（はい）合計</strong>
              <span className="badge">{totalYes}</span>
            </div>
            <div className="item row-between">
              <strong>支払い済み</strong>
              <span className="badge">{totalPaid}</span>
            </div>
            <div className="item row-between">
              <strong>未払い</strong>
              <span className="badge">{totalUnpaid}</span>
            </div>
          </div>
        </section>

        {eventList.map((event) => {
          const rows = responseList.filter((r) => r.event_id === event.id);
          const yesRows = rows.filter((r) => r.rsvp === "yes");
          const maybeRows = rows.filter((r) => r.rsvp === "maybe");
          const noRows = rows.filter((r) => r.rsvp === "no");
          const paidRows = yesRows.filter((r) => r.paid);
          const unpaidRows = yesRows.filter((r) => !r.paid);

          return (
            <section className="card" key={event.id}>
              <div className="row-between" style={{ alignItems: "flex-start" }}>
                <div>
                  <h2 className="h2">{event.title}</h2>
                  <p className="hint">
                    {fmtDate(event.date)}
                    {event.place ? ` / ${event.place}` : ""}
                  </p>
                  <p className="hint">作成日: {fmtDate(event.created_at)}</p>
                </div>
                <Link className="btn btn-ghost" href={`/event/${event.id}/manage`}>
                  管理ページ
                </Link>
              </div>

              <div className="list" style={{ marginTop: 10 }}>
                <div className="item row-between">
                  <span>参加（はい）</span>
                  <strong>{yesRows.length}</strong>
                </div>
                <div className="item row-between">
                  <span>未定</span>
                  <strong>{maybeRows.length}</strong>
                </div>
                <div className="item row-between">
                  <span>不参加</span>
                  <strong>{noRows.length}</strong>
                </div>
                {event.collecting && (
                  <>
                    <div className="item row-between">
                      <span>支払い済み</span>
                      <strong>{paidRows.length}</strong>
                    </div>
                    <div className="item row-between">
                      <span>未払い</span>
                      <strong>{unpaidRows.length}</strong>
                    </div>
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
