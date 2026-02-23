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
  created_at?: string;
};

type Step = "rsvp" | "rsvp_done" | "paying" | "confirm" | "done";

const STORAGE_KEY = "atsumeru_tokens";

function saveToken(eventId: string, responseId: string, editToken: string) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const tokens = raw ? JSON.parse(raw) : {};
    tokens[eventId] = { responseId, editToken };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {}
}

function loadToken(eventId: string): { responseId: string; editToken: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const tokens = JSON.parse(raw);
    return tokens[eventId] || null;
  } catch {
    return null;
  }
}

const RSVP_LABEL: Record<ResponseRow["rsvp"], string> = {
  yes: "参加",
  maybe: "未定",
  no: "不参加",
};

export default function ParticipantPage() {
  const params = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("rsvp");

  const [name, setName] = useState("");
  const [myName, setMyName] = useState("");
  const [myRsvp, setMyRsvp] = useState<ResponseRow["rsvp"] | "">("");

  const [editingResponseId, setEditingResponseId] = useState<string | null>(null);
  const [editingToken, setEditingToken] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const yesRows = useMemo(() => responses.filter((r) => r.rsvp === "yes"), [responses]);

  const loadAll = async () => {
    setLoading(true);
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

      const eventData = await eventRes.json();
      setEvent(eventData);

      if (listRes.ok) {
        const listData = await listRes.json();
        setResponses((listData.responses || []) as ResponseRow[]);
      }

      const saved = loadToken(params.eventId);
      if (saved && !editingResponseId) {
        setStep("rsvp_done");
      }
    } catch {
      setError("通信エラーが発生しました。");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [params.eventId]);

  useEffect(() => {
    if (step !== "paying") return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") setStep("confirm");
    };
    const onFocus = () => setStep("confirm");
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [step]);

  const startEditing = (row: ResponseRow) => {
    setEditingResponseId(row.id);
    setEditingToken(row.edit_token);
    setName(row.name);
    setMyName(row.name);
    setMyRsvp(row.rsvp);
    setNotice(`「${row.name}」の回答を編集中です。`);
    setError("");
    setStep("rsvp");
  };

  const clearEditing = () => {
    setEditingResponseId(null);
    setEditingToken(null);
    setName("");
    setNotice("");
  };

  const submitRsvp = async (rsvp: "yes" | "maybe" | "no") => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("名前を入力してください。");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      if (editingResponseId && editingToken) {
        const patchBody: Record<string, unknown> = { rsvp };
        if (rsvp !== "yes") {
          patchBody.paid = false;
        }

        const res = await fetch(`/api/events/${params.eventId}/responses/${editingResponseId}?edit=${editingToken}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "回答の更新に失敗しました。");
          return;
        }

        saveToken(params.eventId, editingResponseId, editingToken);
      } else {
        const res = await fetch(`/api/events/${params.eventId}/responses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed, rsvp }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "回答の送信に失敗しました。");
          return;
        }

        saveToken(params.eventId, data.responseId, data.editToken);
        setEditingResponseId(data.responseId);
        setEditingToken(data.editToken);
      }

      setMyName(trimmed);
      setMyRsvp(rsvp);
      await loadAll();

      if (rsvp === "yes" && event?.collecting && event.pay_url) {
        setStep("paying");
        setTimeout(() => window.open(event.pay_url!, "_blank"), 100);
      } else if (rsvp === "yes" && event?.collecting) {
        setStep("confirm");
      } else {
        setStep("rsvp_done");
      }
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setSubmitting(false);
    }
  };

  const markPaidSelf = async () => {
    if (!editingResponseId || !editingToken) {
      setError("編集対象の行を選んでください。");
      return;
    }

    try {
      const res = await fetch(`/api/events/${params.eventId}/responses/${editingResponseId}?edit=${editingToken}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "支払い状態の更新に失敗しました。");
        return;
      }
      await loadAll();
      setStep("done");
    } catch {
      setError("通信エラーが発生しました。");
    }
  };

  const confirmPaid = async () => {
    const saved = loadToken(params.eventId);
    if (!saved) {
      setError("先に回答を登録してください。");
      return;
    }

    try {
      await fetch(`/api/events/${params.eventId}/responses/${saved.responseId}?edit=${saved.editToken}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: true }),
      });
      await loadAll();
      setStep("done");
    } catch {
      setError("通信エラーが発生しました。");
    }
  };

  const openPayLink = () => {
    if (event?.pay_url) {
      setStep("paying");
      setTimeout(() => window.open(event.pay_url!, "_blank"), 100);
    } else {
      setStep("confirm");
    }
  };

  if (loading) {
    return (
      <main className="container">
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <p className="hint">読み込み中...</p>
        </div>
      </main>
    );
  }

  if (error && !event) {
    return (
      <main className="container">
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <p className="status status-error">{error}</p>
        </div>
      </main>
    );
  }

  if (!event) return null;

  if (step === "done") {
    return (
      <main className="container">
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <p className="badge" style={{ background: "var(--primary-soft)", color: "var(--primary)", marginBottom: 12 }}>完了</p>
          <h2 className="h2">支払い報告を受け付けました</h2>
          <p className="hint">ありがとうございます。</p>
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-ghost" onClick={() => setStep("rsvp_done")}>一覧に戻る</button>
          </div>
        </div>
      </main>
    );
  }

  if (step === "confirm") {
    return (
      <main className="container">
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <h2 className="h2">支払いは完了しましたか？</h2>
          <p className="hint" style={{ marginBottom: 20 }}>{myName} さんの支払い状況を更新します。</p>
          <div className="stack">
            <button className="btn btn-primary" onClick={confirmPaid}>支払い済みにする</button>
            <button className="btn btn-ghost" onClick={() => setStep("rsvp_done")}>あとで報告する</button>
          </div>
        </div>
      </main>
    );
  }

  if (step === "paying") {
    return (
      <main className="container">
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <h2 className="h2">支払いページを開いています</h2>
          <p className="hint" style={{ marginBottom: 20 }}>支払い後にこのページへ戻ってください。</p>
          <button className="btn btn-ghost" onClick={() => setStep("confirm")}>支払い後に確認する</button>
        </div>
      </main>
    );
  }

  if (step === "rsvp_done") {
    return (
      <main className="container">
        <div className="stack">
          <div className="card" style={{ textAlign: "center" }}>
            <div className="badge" style={{ background: "var(--primary-soft)", color: "var(--primary)", marginBottom: 12 }}>回答済み</div>
            <h2 className="h2">{event.title}</h2>
            <p className="hint">{myName ? `${myName} さん` : "あなた"} / {myRsvp ? RSVP_LABEL[myRsvp] : "-"}</p>
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={() => setStep("rsvp")}>回答を変更する</button>
            </div>
          </div>

          {event.collecting && myRsvp === "yes" && (
            <div className="card">
              <h2 className="h2" style={{ textAlign: "center" }}>¥{event.amount.toLocaleString()}</h2>
              <p className="hint" style={{ textAlign: "center" }}>支払い金額</p>
              <div style={{ marginTop: 12 }}>
                {event.pay_url ? (
                  <button className="btn btn-primary" style={{ width: "100%" }} onClick={openPayLink}>支払いページを開く</button>
                ) : (
                  <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setStep("confirm")}>支払い済みを報告する</button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="stack">
        <div className="card">
          <h1 className="h1">{event.title}</h1>
          <p className="hint">
            {event.date || "日時未設定"}
            {event.place ? ` / ${event.place}` : ""}
          </p>
          {event.note && <p className="hint">{event.note}</p>}
        </div>

        <div className="card">
          <h2 className="h2">出欠を回答する</h2>
          <p className="hint">一覧の名前を押すと、その行を編集できます。同名は別行として追加されます。</p>

          <div className="stack" style={{ marginTop: 12 }}>
            <input className="input" placeholder="名前" value={name} onChange={(e) => setName(e.target.value)} />
            {editingResponseId && <p className="status status-info">編集中の行ID: {editingResponseId.slice(0, 8)}...</p>}
            {notice && <p className="status status-info">{notice}</p>}
            {error && <p className="status status-error">{error}</p>}

            <div className="grid3">
              <button className="btn btn-primary" onClick={() => submitRsvp("yes")} disabled={submitting}>参加</button>
              <button className="btn btn-ghost" onClick={() => submitRsvp("maybe")} disabled={submitting}>未定</button>
              <button className="btn btn-danger" onClick={() => submitRsvp("no")} disabled={submitting}>不参加</button>
            </div>

            {event.collecting && editingResponseId && (
              <button className="btn btn-primary" onClick={markPaidSelf} disabled={submitting}>
                この行を支払い済みにする
              </button>
            )}

            {editingResponseId && (
              <button className="btn btn-ghost" onClick={clearEditing}>
                編集をやめる
              </button>
            )}
          </div>
        </div>

        <div className="card">
          <div className="row-between">
            <h2 className="h2">回答一覧</h2>
            <span className="badge">{responses.length} 件</span>
          </div>

          <div className="list" style={{ marginTop: 10 }}>
            {responses.length === 0 && <div className="item hint">まだ回答がありません。</div>}
            {responses.map((row) => (
              <button
                key={row.id}
                className="item row-between"
                style={{ background: "#fff", cursor: "pointer", textAlign: "left" }}
                onClick={() => startEditing(row)}
                type="button"
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{row.name}</div>
                  <div className="hint">{RSVP_LABEL[row.rsvp]}</div>
                </div>
                {event.collecting && row.rsvp === "yes" ? (
                  <span className="badge">{row.paid ? "支払い済み" : "未払い"}</span>
                ) : (
                  <span className="badge">-</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {event.collecting && (
          <div className="card">
            <div className="row-between">
              <p className="section-label">集金情報</p>
              <span className="badge">参加 {yesRows.length} 名</span>
            </div>
            <p style={{ fontSize: "1.2rem", fontWeight: 700, marginTop: 4 }}>¥{event.amount.toLocaleString()}</p>
          </div>
        )}
      </div>
    </main>
  );
}
