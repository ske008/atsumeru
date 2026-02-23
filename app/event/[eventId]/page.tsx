"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type EventRow = {
  id: string;
  title: string;
  date: string | null;
  place: string | null;
  note: string | null;
  collecting: boolean;
  amount: number;
  pay_url: string | null;
};

type ResponseRow = {
  id: string;
  name: string;
  rsvp: "yes" | "maybe" | "no";
  paid: boolean;
  edit_token: string;
};

function ensureAbsoluteUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const RSVP_LABEL: Record<ResponseRow["rsvp"], string> = {
  yes: "参加",
  maybe: "未定",
  no: "不参加",
};

function formatDate(value: string | null) {
  if (!value) return null;
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

// 参加登録直後の支払い待ち
type JustSubmitted = {
  name: string;
  responseId: string;
  editToken: string;
};

export default function ParticipantPage() {
  const params = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // 参加登録直後 → 支払い選択を表示するため
  const [justSubmitted, setJustSubmitted] = useState<JustSubmitted | null>(null);

  const yesRows = useMemo(() => responses.filter((r) => r.rsvp === "yes"), [responses]);
  const maybeRows = useMemo(() => responses.filter((r) => r.rsvp === "maybe"), [responses]);
  const noRows = useMemo(() => responses.filter((r) => r.rsvp === "no"), [responses]);

  const fetchResponses = async () => {
    try {
      const res = await fetch(`/api/events/${params.eventId}/responses/public`);
      if (res.ok) {
        const data = await res.json();
        setResponses((data.responses || []) as ResponseRow[]);
      }
    } catch {}
  };

  useEffect(() => {
    (async () => {
      try {
        const [eventRes, listRes] = await Promise.all([
          fetch(`/api/events/${params.eventId}`),
          fetch(`/api/events/${params.eventId}/responses/public`),
        ]);

        if (!eventRes.ok) {
          setError("イベントが見つかりません。");
          setLoading(false);
          return;
        }

        setEvent(await eventRes.json());

        if (listRes.ok) {
          const data = await listRes.json();
          setResponses((data.responses || []) as ResponseRow[]);
        }
      } catch {
        setError("通信エラーが発生しました。");
      }
      setLoading(false);
    })();
  }, [params.eventId]);

  const submitRsvp = async (rsvp: "yes" | "maybe" | "no") => {
    const trimmed = name.trim();
    if (!trimmed) { setError("名前を入力してください。"); return; }

    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      const res = await fetch(`/api/events/${params.eventId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, rsvp }),
      });
      const data = await res.json();

      if (!res.ok) { setError(data.error || "送信に失敗しました。"); return; }

      // 一覧を更新
      await fetchResponses();
      setName("");

      // 集金ありで「参加」→ 支払い選択を表示
      if (rsvp === "yes" && event?.collecting) {
        setJustSubmitted({ name: trimmed, responseId: data.responseId, editToken: data.editToken });
      } else {
        setNotice(`${trimmed} の回答を送信しました。`);
      }
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setSubmitting(false);
    }
  };

  const markPaid = async () => {
    if (!justSubmitted) return;

    try {
      const res = await fetch(
        `/api/events/${params.eventId}/responses/${justSubmitted.responseId}?edit=${justSubmitted.editToken}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paid: true }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "更新に失敗しました。");
        return;
      }
      // ローカルで即反映
      setResponses((prev) =>
        prev.map((r) => (r.id === justSubmitted.responseId ? { ...r, paid: true } : r))
      );
      setNotice(`${justSubmitted.name} の支払いを記録しました。`);
    } catch {
      setError("通信エラーが発生しました。");
    }
    setJustSubmitted(null);
  };

  const skipPay = () => {
    if (justSubmitted) {
      setNotice(`${justSubmitted.name} の参加を登録しました。`);
    }
    setJustSubmitted(null);
  };

  const togglePaid = async (row: ResponseRow) => {
    try {
      const res = await fetch(
        `/api/events/${params.eventId}/responses/${row.id}?edit=${row.edit_token}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paid: !row.paid }),
        }
      );
      if (!res.ok) return;
      setResponses((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, paid: !row.paid } : r))
      );
    } catch {}
  };

  if (loading) {
    return <main className="container"><div className="card hero"><p className="hint">読み込み中...</p></div></main>;
  }

  if (error && !event) {
    return <main className="container"><div className="card hero"><p className="status status-error">{error}</p></div></main>;
  }

  if (!event) return null;

  return (
    <main className="container">
      <div className="stack">
        {/* イベント情報 */}
        <div className="card">
          <h1 className="h1">{event.title}</h1>
          <div className="hint" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {formatDate(event.date) && <span>{formatDate(event.date)}</span>}
            {event.place && <span>{event.place}</span>}
          </div>
          {event.note && <p className="hint">{event.note}</p>}
          {event.collecting && event.amount > 0 && (
            <div style={{ marginTop: 12 }}>
              <span className="badge badge-accent">&yen;{event.amount.toLocaleString()} / 人</span>
            </div>
          )}
        </div>

        {/* 支払い選択（参加登録直後に表示） */}
        {justSubmitted && (
          <div className="card">
            <h2 className="h2">{justSubmitted.name} さん、支払いはどうしますか？</h2>
            {event.amount > 0 && (
              <p className="hint" style={{ marginTop: 4 }}>&yen;{event.amount.toLocaleString()}</p>
            )}
            {event.pay_url && (
              <div style={{ marginTop: 12 }}>
                <a
                  href={ensureAbsoluteUrl(event.pay_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-accent btn-full"
                >
                  送金ページを開く
                </a>
              </div>
            )}
            <div className="grid3" style={{ marginTop: 12, gridTemplateColumns: "1fr 1fr" }}>
              <button className="btn btn-primary" onClick={markPaid}>
                支払い済み
              </button>
              <button className="btn btn-ghost" onClick={skipPay}>
                あとで払う
              </button>
            </div>
            {error && <p className="status status-error" style={{ marginTop: 8 }}>{error}</p>}
          </div>
        )}

        {/* フォーム（支払い選択中は非表示） */}
        {!justSubmitted && (
          <div className="card">
            <h2 className="h2">出欠を回答する</h2>
            <div className="stack" style={{ marginTop: 14 }}>
              <input
                className="input"
                placeholder="名前"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {notice && <p className="status status-info">{notice}</p>}
              {error && <p className="status status-error">{error}</p>}
              <div className="grid3">
                <button className="btn btn-primary" onClick={() => submitRsvp("yes")} disabled={submitting}>
                  参加
                </button>
                <button className="btn btn-ghost" onClick={() => submitRsvp("maybe")} disabled={submitting}>
                  未定
                </button>
                <button className="btn btn-danger" onClick={() => submitRsvp("no")} disabled={submitting}>
                  不参加
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 回答一覧 */}
        <div className="card-flush">
          <div style={{ padding: "14px 14px 8px" }}>
            <div className="row-between">
              <p className="h2">回答一覧</p>
              <div className="row" style={{ gap: 6 }}>
                {yesRows.length > 0 && <span className="badge badge-success">{yesRows.length} 参加</span>}
                {maybeRows.length > 0 && <span className="badge badge-warn">{maybeRows.length} 未定</span>}
                {noRows.length > 0 && <span className="badge">{noRows.length} 不参加</span>}
              </div>
            </div>
          </div>
          <div className="list" style={{ border: "none", borderTop: "1px solid var(--border)" }}>
            {responses.length === 0 && (
              <div className="item">
                <span className="hint" style={{ marginTop: 0 }}>まだ回答がありません。</span>
              </div>
            )}
            {responses.map((row) => (
              <div key={row.id} className="item">
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{row.name}</div>
                  <div className="hint" style={{ marginTop: 0 }}>{RSVP_LABEL[row.rsvp]}</div>
                </div>
                {event.collecting && row.rsvp === "yes" && (
                  <button
                    className={`btn btn-sm ${row.paid ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => togglePaid(row)}
                  >
                    {row.paid ? "支払い済み" : "未払い"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
