"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

const RSVP_LABEL: Record<ResponseRow["rsvp"], string> = {
  yes: "参加",
  maybe: "未定",
  no: "不参加",
};

const normalizeAmountInput = (value: string) =>
  Array.from(value)
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code >= 0xff10 && code <= 0xff19) {
        return String.fromCharCode(code - 0xfee0);
      }
      return ch;
    })
    .join("")
    .replace(/\D/g, "");

function formatDate(value: string | null) {
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

export default function ManagePage() {
  const params = useParams<{ eventId: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [event, setEvent] = useState<EventRow | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [form, setForm] = useState({ collecting: false, amount: "", payUrl: "" });
  const [status, setStatus] = useState<UiStatus | null>(null);
  const [savingSetting, setSavingSetting] = useState(false);

  const normalizedAmount = form.amount ? Number(form.amount) : 0;
  const amountPreview = normalizedAmount.toLocaleString("ja-JP");
  const yesResponses = responses.filter((row) => row.rsvp === "yes");
  const paidResponses = yesResponses.filter((row) => row.paid);
  const paidRatio = yesResponses.length > 0 ? (paidResponses.length / yesResponses.length) * 100 : 0;

  const participantUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/event/${params.eventId}`;
  }, [params.eventId]);

  const loadAll = async () => {
    try {
      const eventRes = await fetch(`/api/events/${params.eventId}`);
      const eventData = await eventRes.json();
      if (!eventRes.ok) {
        setStatus({ kind: "error", message: eventData.error || "イベント情報の取得に失敗しました。" });
        return;
      }

      setEvent(eventData);
      setForm({
        collecting: !!eventData.collecting,
        amount: String(eventData.amount ?? 0),
        payUrl: eventData.pay_url || "",
      });

      if (!token) {
        setStatus({ kind: "error", message: "管理URLに token がありません。作成直後のURLを開いてください。" });
        return;
      }

      const responseRes = await fetch(`/api/events/${params.eventId}/responses?token=${token}`);
      const responseData = await responseRes.json();
      if (!responseRes.ok) {
        setStatus({ kind: "error", message: responseData.error || "回答一覧の取得に失敗しました。" });
        return;
      }

      setResponses(responseData.responses || []);
      setStatus(null);
    } catch {
      setStatus({ kind: "error", message: "通信エラーが発生しました。" });
    }
  };

  useEffect(() => {
    loadAll();
  }, [params.eventId, token]);

  const copyParticipantUrl = async () => {
    if (!participantUrl) return;
    try {
      await navigator.clipboard.writeText(participantUrl);
      setStatus({ kind: "success", message: "URLをコピーしました。" });
    } catch {
      setStatus({ kind: "error", message: "コピーに失敗しました。" });
    }
  };

  const saveCollecting = async () => {
    if (!token) {
      setStatus({ kind: "error", message: "管理トークンがありません。" });
      return;
    }

    if (form.amount && Number.isNaN(Number(form.amount))) {
      setStatus({ kind: "error", message: "金額は数字で入力してください。" });
      return;
    }

    setSavingSetting(true);
    setStatus(null);

    try {
      const res = await fetch(`/api/events/${params.eventId}/manage?token=${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collecting: form.collecting,
          amount: Number(form.amount || 0),
          pay_url: form.payUrl.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus({ kind: "error", message: data.error || "設定の更新に失敗しました。" });
        return;
      }

      setEvent((prev) =>
        prev ? { ...prev, collecting: data.collecting, amount: data.amount, pay_url: data.pay_url } : prev
      );
      setStatus({ kind: "success", message: "設定を更新しました。" });
    } catch {
      setStatus({ kind: "error", message: "通信エラーが発生しました。" });
    } finally {
      setSavingSetting(false);
    }
  };

  const togglePaid = async (row: ResponseRow) => {
    if (!token) return;

    try {
      const res = await fetch(`/api/events/${params.eventId}/responses/${row.id}/paid?token=${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: !row.paid }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus({ kind: "error", message: data.error || "更新に失敗しました。" });
        return;
      }

      setResponses((prev) =>
        prev.map((item) => (item.id === row.id ? { ...item, paid: data.paid, paid_at: data.paid_at } : item))
      );
    } catch {
      setStatus({ kind: "error", message: "通信エラーが発生しました。" });
    }
  };

  return (
    <main className="container">
      <div className="stack">
        {/* Header */}
        <div>
          <div className="row-between row-between-mobile">
            <div>
              <h1 className="h1">{event?.title || "読み込み中..."}</h1>
              {event && (
                <p className="hint">
                  {formatDate(event.date)}
                  {event.place ? ` / ${event.place}` : ""}
                </p>
              )}
            </div>
            <Link href={`/event/${params.eventId}`} className="btn btn-ghost btn-sm">
              参加者ページ
            </Link>
          </div>
        </div>

        {status && <p className={`status status-${status.kind}`}>{status.message}</p>}

        {/* Share URL */}
        <div className="card">
          <p className="section-label">参加者URL</p>
          <div className="row" style={{ marginTop: 8 }}>
            <input className="input" value={participantUrl} readOnly style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm" onClick={copyParticipantUrl}>コピー</button>
          </div>
        </div>

        {/* Collection Settings */}
        <div className="card">
          <p className="h2">集金設定</p>
          <div className="stack" style={{ marginTop: 12 }}>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.collecting}
                onChange={(e) => setForm((prev) => ({ ...prev, collecting: e.target.checked }))}
              />
              集金を開始する
            </label>

            {form.collecting && (
              <div className="collect-panel">
                <div className="stack-sm">
                  <div className="money-input-wrap">
                    <input
                      className="input"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="金額"
                      value={form.amount}
                      onChange={(e) => setForm((prev) => ({ ...prev, amount: normalizeAmountInput(e.target.value) }))}
                    />
                    <span className="money-suffix">円</span>
                  </div>
                  {normalizedAmount > 0 && <p className="amount-preview">1人あたり {amountPreview}円</p>}
                  <input
                    className="input"
                    placeholder="送金URL（PayPay等・任意）"
                    value={form.payUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, payUrl: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <button className="btn btn-primary btn-full" onClick={saveCollecting} disabled={savingSetting}>
              {savingSetting ? "更新中..." : "設定を保存"}
            </button>
          </div>
        </div>

        {/* Payment Progress */}
        {form.collecting && yesResponses.length > 0 && (
          <div className="card">
            <div className="row-between">
              <p className="h2">集金状況</p>
              <span className="badge badge-success">
                {paidResponses.length} / {yesResponses.length} 支払い済み
              </span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${paidRatio}%` }} />
            </div>
          </div>
        )}

        {/* Responses */}
        <div className="card-flush">
          <div style={{ padding: "14px 14px 8px" }}>
            <div className="row-between">
              <p className="h2">回答一覧</p>
              <span className="badge">{responses.length}件</span>
            </div>
          </div>

          {responses.length === 0 ? (
            <div style={{ padding: "12px 14px 16px" }}>
              <p className="hint" style={{ marginTop: 0 }}>まだ回答がありません。</p>
            </div>
          ) : (
            <div className="list" style={{ border: "none", borderTop: `1px solid var(--border)` }}>
              {responses.map((row) => (
                <div key={row.id} className="item">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{row.name}</div>
                    <div className="hint" style={{ marginTop: 0 }}>{RSVP_LABEL[row.rsvp]}</div>
                  </div>
                  {form.collecting && row.rsvp === "yes" ? (
                    <button
                      className={`btn btn-sm ${row.paid ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => togglePaid(row)}
                    >
                      {row.paid ? "支払い済み" : "未払い"}
                    </button>
                  ) : (
                    <span className="badge">{RSVP_LABEL[row.rsvp]}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
