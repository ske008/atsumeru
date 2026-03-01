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

  // 一覧から支払う際の状態管理
  const [payingRow, setPayingRow] = useState<{ id: string } | null>(null);
  // 回答編集
  const [editingRow, setEditingRow] = useState<{ id: string; name: string; rsvp: string } | null>(null);

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

  // 一覧から未払いバッジをタップ
  const handleUnpaidClick = (row: ResponseRow) => {
    if (event?.pay_url) {
      setPayingRow({ id: row.id });
    } else {
      togglePaid(row);
    }
  };


  const skipPay = () => {
    if (justSubmitted) {
      setNotice(`${justSubmitted.name} の参加を登録しました。`);
    }
    setJustSubmitted(null);
  };


  const saveEdit = async (row: ResponseRow, override?: { name?: string; rsvp?: string }) => {
    const current = editingRow;
    if (!current && !override) return;
    const payload = {
      name: override?.name ?? current?.name ?? row.name,
      rsvp: override?.rsvp ?? current?.rsvp ?? row.rsvp,
    };
    try {
      const res = await fetch(
        `/api/events/${params.eventId}/responses/${row.id}?edit=${row.edit_token}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (res.ok) {
        await fetchResponses();
        setEditingRow(null);
      }
    } catch {}
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
            <p style={{ marginTop: 12, fontSize: "1.1rem", fontWeight: 600 }}>
              支払い金額：&yen;{event.amount.toLocaleString()}
            </p>
          )}
          {event.collecting && event.pay_url && (
            <p style={{ marginTop: 8, fontSize: 14, color: "var(--muted)" }}>
              支払い先：
              <a
                href={ensureAbsoluteUrl(event.pay_url)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#3366cc" }}
              >
                {event.pay_url}
              </a>
            </p>
          )}
        </div>

        {/* 支払い選択（参加登録直後に表示） */}
        {justSubmitted && (
          <div className="card">
            <h2 className="h2">{justSubmitted.name} さん、お支払いにお進みください</h2>
            {event.amount > 0 && (
              <p className="hint" style={{ marginTop: 4 }}>&yen;{event.amount.toLocaleString()}</p>
            )}
            {event.pay_url && (
              <p style={{ marginTop: 8, fontSize: 14, color: "var(--muted)" }}>
                支払い先：
                <a
                  href={ensureAbsoluteUrl(event.pay_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#3366cc" }}
                >
                  {event.pay_url}
                </a>
              </p>
            )}
            {event.pay_url && (
              <p style={{ marginTop: 4, fontSize: 13, color: "var(--muted)" }}>
                支払いが完了したら、支払い完了を押してください
              </p>
            )}
            {event.pay_url ? (
              <>
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-primary btn-full" onClick={() => { window.open(ensureAbsoluteUrl(event.pay_url!), "_blank", "noopener,noreferrer"); markPaid(); }}>
                    支払う
                  </button>
                </div>
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-ghost btn-full" onClick={skipPay}>
                    後で支払う
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-primary btn-full" onClick={markPaid}>
                    支払う
                  </button>
                </div>
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-ghost btn-full" onClick={skipPay}>
                    後で支払う
                  </button>
                </div>
              </>
            )}
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
              {notice && event.collecting && event.pay_url && (
                <p style={{ fontSize: 14, color: "var(--muted)" }}>
                  支払い先：
                  <a
                    href={ensureAbsoluteUrl(event.pay_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#3366cc" }}
                  >
                    {event.pay_url}
                  </a>
                </p>
              )}
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
            {event.collecting && (
              <p style={{ marginTop: 4, fontSize: 13, color: "var(--muted)" }}>
                未払いの方は「未払い」をクリックして支払い方法を選択してください
              </p>
            )}
          </div>

          {responses.length === 0 ? (
            <div style={{ padding: "8px 14px 14px" }}>
              <span className="hint" style={{ marginTop: 0 }}>まだ回答がありません。</span>
            </div>
          ) : (
            <div style={{ borderTop: "1px solid var(--border)" }}>
              {/* 参加 */}
              {yesRows.length > 0 && (
                <div>
                  <div style={{ padding: "8px 14px 4px", fontSize: "0.8125rem", fontWeight: 600, color: "var(--success, #16a34a)" }}>
                    参加 ({yesRows.length})
                  </div>
                  <div className="list" style={{ border: "none" }}>
                    {yesRows.map((row) => (
                      <div key={row.id}>
                        {editingRow?.id === row.id ? (
                          <div style={{ padding: "8px 14px 12px" }}>
                            <input
                              className="input"
                              value={editingRow.name}
                              onChange={(e) => setEditingRow({ ...editingRow, name: e.target.value })}
                              onBlur={() => editingRow.name.trim() && saveEdit(row, { name: editingRow.name })}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
                              style={{ marginBottom: 8 }}
                              autoFocus
                            />
                            <div className="grid3">
                              {(["yes", "maybe", "no"] as const).map((v) => (
                                <button
                                  key={v}
                                  className={`btn ${editingRow.rsvp === v ? "btn-primary" : "btn-ghost"}`}
                                  style={{ fontSize: "0.8125rem" }}
                                  onClick={() => saveEdit(row, { rsvp: v })}
                                >
                                  {v === "yes" ? "参加" : v === "maybe" ? "未定" : "不参加"}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="item">
                              <span
                                style={{ fontWeight: 500, fontSize: "0.9375rem", cursor: "pointer", textDecoration: "underline", textDecorationColor: "var(--border)", textUnderlineOffset: 3 }}
                                onClick={() => setEditingRow({ id: row.id, name: row.name, rsvp: row.rsvp })}
                              >
                                {row.name}
                              </span>
                              {event.collecting && (
                                <button
                                  onClick={() => row.paid ? togglePaid(row) : handleUnpaidClick(row)}
                                  style={{
                                    fontSize: "0.75rem",
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                    border: "none",
                                    cursor: "pointer",
                                    background: row.paid ? "var(--success, #16a34a)" : "var(--border)",
                                    color: row.paid ? "#fff" : "var(--muted)",
                                  }}
                                >
                                  {row.paid ? "支払い済み" : "未払い"}
                                </button>
                              )}
                            </div>
                            {payingRow?.id === row.id && (
                              <div style={{ padding: "8px 14px 12px", background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button
                                    className="btn btn-primary"
                                    style={{ flex: 1, fontSize: "0.8125rem" }}
                                    onClick={() => { if (event.pay_url) window.open(ensureAbsoluteUrl(event.pay_url), "_blank", "noopener,noreferrer"); togglePaid(row); setPayingRow(null); }}
                                  >
                                    キャッシュレスで支払う
                                  </button>
                                  <button
                                    className="btn btn-ghost"
                                    style={{ flex: 1, fontSize: "0.8125rem" }}
                                    onClick={() => { togglePaid(row); setPayingRow(null); }}
                                  >
                                    現金で支払う
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 未定 */}
              {maybeRows.length > 0 && (
                <div>
                  <div style={{ padding: "8px 14px 4px", fontSize: "0.8125rem", fontWeight: 600, color: "var(--warn, #d97706)" }}>
                    未定 ({maybeRows.length})
                  </div>
                  <div className="list" style={{ border: "none" }}>
                    {maybeRows.map((row) => (
                      <div key={row.id}>
                        {editingRow?.id === row.id ? (
                          <div style={{ padding: "8px 14px 12px" }}>
                            <input
                              className="input"
                              value={editingRow.name}
                              onChange={(e) => setEditingRow({ ...editingRow, name: e.target.value })}
                              onBlur={() => editingRow.name.trim() && saveEdit(row, { name: editingRow.name })}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
                              style={{ marginBottom: 8 }}
                              autoFocus
                            />
                            <div className="grid3">
                              {(["yes", "maybe", "no"] as const).map((v) => (
                                <button
                                  key={v}
                                  className={`btn ${editingRow.rsvp === v ? "btn-primary" : "btn-ghost"}`}
                                  style={{ fontSize: "0.8125rem" }}
                                  onClick={() => saveEdit(row, { rsvp: v })}
                                >
                                  {v === "yes" ? "参加" : v === "maybe" ? "未定" : "不参加"}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="item">
                            <span
                              style={{ fontWeight: 500, fontSize: "0.9375rem", cursor: "pointer", textDecoration: "underline", textDecorationColor: "var(--border)", textUnderlineOffset: 3 }}
                              onClick={() => setEditingRow({ id: row.id, name: row.name, rsvp: row.rsvp })}
                            >
                              {row.name}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 不参加 */}
              {noRows.length > 0 && (
                <div>
                  <div style={{ padding: "8px 14px 4px", fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>
                    不参加 ({noRows.length})
                  </div>
                  <div className="list" style={{ border: "none" }}>
                    {noRows.map((row) => (
                      <div key={row.id}>
                        {editingRow?.id === row.id ? (
                          <div style={{ padding: "8px 14px 12px" }}>
                            <input
                              className="input"
                              value={editingRow.name}
                              onChange={(e) => setEditingRow({ ...editingRow, name: e.target.value })}
                              onBlur={() => editingRow.name.trim() && saveEdit(row, { name: editingRow.name })}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
                              style={{ marginBottom: 8 }}
                              autoFocus
                            />
                            <div className="grid3">
                              {(["yes", "maybe", "no"] as const).map((v) => (
                                <button
                                  key={v}
                                  className={`btn ${editingRow.rsvp === v ? "btn-primary" : "btn-ghost"}`}
                                  style={{ fontSize: "0.8125rem" }}
                                  onClick={() => saveEdit(row, { rsvp: v })}
                                >
                                  {v === "yes" ? "参加" : v === "maybe" ? "未定" : "不参加"}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="item">
                            <span
                              style={{ fontWeight: 500, fontSize: "0.9375rem", color: "var(--muted)", cursor: "pointer", textDecoration: "underline", textDecorationColor: "var(--border)", textUnderlineOffset: 3 }}
                              onClick={() => setEditingRow({ id: row.id, name: row.name, rsvp: row.rsvp })}
                            >
                              {row.name}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
