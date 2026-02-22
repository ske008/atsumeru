"use client";

import { useEffect, useState } from "react";
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

export default function ParticipantPage() {
  const params = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("rsvp");
  const [name, setName] = useState("");
  const [myName, setMyName] = useState("");
  const [myRsvp, setMyRsvp] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/events/${params.eventId}`);
        if (!res.ok) {
          setError("イベントが見つかりません。");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setEvent(data);

        // Check if user already responded (saved token in localStorage)
        const saved = loadToken(params.eventId);
        if (saved) {
          // Try to fetch their response to see current status
          const rRes = await fetch(
            `/api/events/${params.eventId}/responses/${saved.responseId}?edit=${saved.editToken}`,
            { method: "GET" }
          );
          // If GET isn't supported, that's fine - we just show the rsvp_done state
          if (rRes.ok) {
            const rData = await rRes.json();
            setMyName(rData.name);
            setMyRsvp(rData.rsvp);
            setStep("rsvp_done");
          }
        }
      } catch {
        setError("通信エラーが発生しました。");
      }
      setLoading(false);
    })();
  }, [params.eventId]);

  // When paying step: detect return from payment app
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

  const submitRsvp = async (rsvp: "yes" | "maybe" | "no") => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("名前を入力してください。");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/events/${params.eventId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, rsvp }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "回答を保存できませんでした。");
        return;
      }

      saveToken(params.eventId, data.responseId, data.editToken);
      setMyName(trimmed);
      setMyRsvp(rsvp);

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

  const confirmPaid = async () => {
    const saved = loadToken(params.eventId);
    if (!saved) return;

    try {
      await fetch(
        `/api/events/${params.eventId}/responses/${saved.responseId}?edit=${saved.editToken}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paid: true }),
        }
      );
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

  const rsvpLabel = myRsvp === "yes" ? "参加" : myRsvp === "no" ? "不参加" : "未定";

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

  // Done step
  if (step === "done") {
    return (
      <main className="container">
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <p className="badge" style={{ background: "var(--primary-soft)", color: "var(--primary)", marginBottom: 12 }}>完了</p>
          <h2 className="h2">支払いを報告しました</h2>
          <p className="hint">幹事に反映されました。ありがとうございます。</p>
        </div>
      </main>
    );
  }

  // Confirm step
  if (step === "confirm") {
    return (
      <main className="container">
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <h2 className="h2">送金は完了しましたか？</h2>
          <p className="hint" style={{ marginBottom: 20 }}>{myName}さんの支払いを記録します</p>
          <div className="stack">
            <button className="btn btn-primary" onClick={confirmPaid}>はい、送金しました</button>
            <button className="btn btn-ghost" onClick={() => setStep("rsvp_done")}>まだしていない</button>
          </div>
        </div>
      </main>
    );
  }

  // Paying step (waiting for return from payment app)
  if (step === "paying") {
    return (
      <main className="container">
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <h2 className="h2">送金アプリを開いています</h2>
          <p className="hint" style={{ marginBottom: 20 }}>送金が終わったらこのページに戻ってください</p>
          <button className="btn btn-ghost" onClick={() => setStep("confirm")}>送金が終わった</button>
        </div>
      </main>
    );
  }

  // RSVP done step
  if (step === "rsvp_done") {
    return (
      <main className="container">
        <div className="stack">
          <div className="card" style={{ textAlign: "center" }}>
            <div className="badge" style={{ background: "var(--primary-soft)", color: "var(--primary)", marginBottom: 12 }}>回答済み</div>
            <h2 className="h2">{event.title}</h2>
            <p className="hint">{myName}さん → {rsvpLabel}</p>
          </div>

          {event.collecting && myRsvp === "yes" && (
            <div className="card">
              <h2 className="h2" style={{ textAlign: "center" }}>
                ¥{event.amount.toLocaleString()}
              </h2>
              <p className="hint" style={{ textAlign: "center" }}>お支払い金額</p>
              <div style={{ marginTop: 12 }}>
                {event.pay_url ? (
                  <button className="btn btn-primary" style={{ width: "100%" }} onClick={openPayLink}>
                    送金する
                  </button>
                ) : (
                  <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setStep("confirm")}>
                    送金したので報告する
                  </button>
                )}
              </div>
            </div>
          )}

          {error && <p className="status status-error">{error}</p>}
        </div>
      </main>
    );
  }

  // RSVP form (initial step)
  return (
    <main className="container">
      <div className="stack">
        <div className="card">
          <h1 className="h1">{event.title}</h1>
          <p className="hint">
            {event.date || "日時未定"}
            {event.place ? ` / ${event.place}` : ""}
          </p>
          {event.note && <p className="hint">{event.note}</p>}
        </div>

        <div className="card">
          <h2 className="h2">出欠を回答する</h2>
          <div className="stack" style={{ marginTop: 12 }}>
            <input
              className="input"
              placeholder="お名前"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
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

        {event.collecting && (
          <div className="card">
            <p className="section-label">集金情報</p>
            <p style={{ fontSize: "1.2rem", fontWeight: 700, marginTop: 4 }}>
              ¥{event.amount.toLocaleString()}
            </p>
          </div>
        )}

        {error && <p className="status status-error">{error}</p>}
      </div>
    </main>
  );
}
