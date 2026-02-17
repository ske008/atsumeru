"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

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
  paid_at: string | null;
};

type UiStatus = {
  kind: "info" | "success" | "error";
  message: string;
};

export default function EventPage() {
  const params = useParams<{ eventId: string }>();
  const search = useSearchParams();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [response, setResponse] = useState<ResponseRow | null>(null);
  const [editToken, setEditToken] = useState<string | null>(null);
  const [status, setStatus] = useState<UiStatus | null>(null);
  const [sending, setSending] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);

  useEffect(() => {
    const token = search.get("edit");
    if (token) {
      setEditToken(token);
    }
  }, [search]);

  useEffect(() => {
    const load = async () => {
      setStatus(null);
      try {
        const res = await fetch(`/api/events/${params.eventId}`);
        const data = await res.json();
        if (!res.ok) {
          setStatus({ kind: "error", message: data.error || "イベント情報を読み込めませんでした。" });
          return;
        }
        setEvent(data);
      } catch {
        setStatus({ kind: "error", message: "通信エラーが発生しました。時間をおいて再試行してください。" });
      }
    };

    load();
  }, [params.eventId]);

  const submitRsvp = async (rsvp: ResponseRow["rsvp"]) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("名前を入力してください。");
      return;
    }

    setNameError("");
    setSending(true);
    setStatus(null);

    try {
      const res = await fetch(`/api/events/${params.eventId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, rsvp }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus({ kind: "error", message: data.error || "回答を送信できませんでした。" });
        return;
      }

      setResponse({
        id: data.responseId,
        name: trimmedName,
        rsvp,
        paid: false,
        paid_at: null,
      });
      setEditToken(data.editToken);

      if (rsvp === "yes") {
        setStatus({ kind: "success", message: "参加で回答しました。必要ならこのまま支払い済みにしてください。" });
      } else {
        setStatus({ kind: "success", message: "回答を登録しました。" });
      }
    } catch {
      setStatus({ kind: "error", message: "通信エラーが発生しました。時間をおいて再試行してください。" });
    } finally {
      setSending(false);
    }
  };

  const markPaid = async () => {
    if (!response || !editToken) {
      setStatus({ kind: "error", message: "支払い状態を更新できません。再度回答してからお試しください。" });
      return;
    }

    setMarkingPaid(true);
    setStatus(null);

    try {
      const res = await fetch(`/api/events/${params.eventId}/responses/${response.id}?edit=${editToken}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: true }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus({ kind: "error", message: data.error || "支払い状態を更新できませんでした。" });
        return;
      }

      setResponse((prev) => (prev ? { ...prev, paid: !!data.paid, paid_at: data.paid_at ?? null } : prev));
      setStatus({ kind: "success", message: "支払い済みに更新しました。" });
    } catch {
      setStatus({ kind: "error", message: "通信エラーが発生しました。時間をおいて再試行してください。" });
    } finally {
      setMarkingPaid(false);
    }
  };

  const canShowPaymentCard = useMemo(() => {
    return !!event && event.collecting && response?.rsvp === "yes";
  }, [event, response]);

  if (!event) {
    return (
      <main className="container">
        <div className="card">
          <p className="status status-info">イベント情報を読み込んでいます...</p>
          {status && <p className={`status status-${status.kind}`}>{status.message}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="stack">
        <section className="card">
          <h1 className="h1">{event.title}</h1>
          <p className="hint">このページで出欠を送信します。</p>
          <p className="hint" style={{ marginTop: 8 }}>
            {event.date || "日時未定"}
            {event.place ? ` / ${event.place}` : ""}
          </p>
          {event.note && <p className="notice" style={{ marginTop: 10 }}>{event.note}</p>}
        </section>

        <section className="card">
          <h2 className="h2">出欠を回答する</h2>
          <div className="stack" style={{ marginTop: 12 }}>
            <div>
              <input
                className="input"
                placeholder="お名前"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError("");
                }}
              />
              {nameError && <p className="status status-error" style={{ marginTop: 8 }}>{nameError}</p>}
            </div>
            <div className="grid3">
              <button className="btn btn-primary" disabled={sending} onClick={() => submitRsvp("yes")}>参加</button>
              <button className="btn btn-ghost" disabled={sending} onClick={() => submitRsvp("maybe")}>未定</button>
              <button className="btn btn-ghost" disabled={sending} onClick={() => submitRsvp("no")}>不参加</button>
            </div>
          </div>
        </section>

        {canShowPaymentCard && (
          <section className="card">
            <h2 className="h2">支払い</h2>
            {!response?.paid ? (
              <div className="stack" style={{ marginTop: 10 }}>
                <p className="notice">金額: {event.amount.toLocaleString()}円</p>
                {event.pay_url && (
                  <a href={event.pay_url} target="_blank" rel="noreferrer">
                    <button className="btn btn-primary" style={{ width: "100%" }}>送金ページを開く</button>
                  </a>
                )}
                <button className="btn btn-ghost" onClick={markPaid} disabled={markingPaid}>
                  {markingPaid ? "更新中..." : "支払い済みにする"}
                </button>
              </div>
            ) : (
              <p className="status status-success" style={{ marginTop: 10 }}>支払い済みです。ありがとうございます。</p>
            )}
          </section>
        )}

        {status && <p className={`status status-${status.kind}`}>{status.message}</p>}
      </div>
    </main>
  );
}
