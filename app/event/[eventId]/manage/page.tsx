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

  const participantUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/event/${params.eventId}`;
  }, [params.eventId]);

  const loadAll = async () => {
    setStatus({ kind: "info", message: "読み込み中です..." });

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
      setStatus({ kind: "error", message: "通信エラーが発生しました。時間をおいて再試行してください。" });
    }
  };

  useEffect(() => {
    loadAll();
  }, [params.eventId, token]);

  const copyParticipantUrl = async () => {
    if (!participantUrl) return;
    try {
      await navigator.clipboard.writeText(participantUrl);
      setStatus({ kind: "success", message: "参加者URLをコピーしました。" });
    } catch {
      setStatus({ kind: "error", message: "コピーに失敗しました。手動でURLを選択してコピーしてください。" });
    }
  };

  const saveCollecting = async () => {
    if (!token) {
      setStatus({ kind: "error", message: "管理URLに token がありません。作成直後のURLを開いてください。" });
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
        setStatus({ kind: "error", message: data.error || "集金設定の更新に失敗しました。" });
        return;
      }

      setEvent((prev) => (prev ? { ...prev, collecting: data.collecting, amount: data.amount, pay_url: data.pay_url } : prev));
      setStatus({ kind: "success", message: "集金設定を更新しました。" });
    } catch {
      setStatus({ kind: "error", message: "通信エラーが発生しました。時間をおいて再試行してください。" });
    } finally {
      setSavingSetting(false);
    }
  };

  const togglePaid = async (row: ResponseRow) => {
    if (!token) {
      setStatus({ kind: "error", message: "管理URLに token がありません。作成直後のURLを開いてください。" });
      return;
    }

    try {
      const res = await fetch(`/api/events/${params.eventId}/responses/${row.id}/paid?token=${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: !row.paid }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus({ kind: "error", message: data.error || "支払い状態の更新に失敗しました。" });
        return;
      }

      setResponses((prev) => prev.map((item) => (item.id === row.id ? { ...item, paid: data.paid, paid_at: data.paid_at } : item)));
      setStatus({ kind: "success", message: data.paid ? "支払い済みに更新しました。" : "未払いに戻しました。" });
    } catch {
      setStatus({ kind: "error", message: "通信エラーが発生しました。時間をおいて再試行してください。" });
    }
  };

  return (
    <main className="container">
      <div className="stack">
        <section className="card">
          <div className="row-between">
            <div>
              <h1 className="h1">{event?.title || "イベント管理"}</h1>
              <p className="hint">このページで出欠と集金状況を管理します。</p>
            </div>
            <Link href={`/event/${params.eventId}`} className="btn btn-ghost">
              参加者ページを見る
            </Link>
          </div>
          {event && (
            <p className="hint" style={{ marginTop: 8 }}>
              {event.date || "日時未設定"}
              {event.place ? ` / ${event.place}` : ""}
            </p>
          )}
        </section>

        <section className="card settings-card">
          <h2 className="h2">設定</h2>
          <p className="hint">出欠が0件でも、ここで先に集金情報を設定できます。</p>
          <div className="stack" style={{ marginTop: 10 }}>
            <label className="row" style={{ minHeight: 44 }}>
              <input
                type="checkbox"
                checked={form.collecting}
                onChange={(e) => setForm((prev) => ({ ...prev, collecting: e.target.checked }))}
              />
              集金を開始する
            </label>
            <div className="money-field collect-panel">
              <p className="section-label">集金金額</p>
              <div className="money-input-wrap">
                <input
                  className="input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="集金金額"
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: normalizeAmountInput(e.target.value) }))}
                />
                <span className="money-suffix">円</span>
              </div>
              <p className="hint hint-inline">数字のみ入力（例: 3500）</p>
              <p className="amount-preview">1人あたり {amountPreview}円</p>
            </div>
            <input
              className="input"
              placeholder="送金URL（任意）"
              value={form.payUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, payUrl: e.target.value }))}
            />
            <button className="btn btn-primary" onClick={saveCollecting} disabled={savingSetting}>
              {savingSetting ? "更新中..." : "設定を更新する"}
            </button>
          </div>
        </section>

        <section className="card">
          <h2 className="h2">共有</h2>
          <p className="hint">参加者にこのURLを共有してください。</p>
          <div className="row" style={{ marginTop: 10 }}>
            <input className="input" value={participantUrl} readOnly />
            <button className="btn btn-primary" onClick={copyParticipantUrl}>参加者URLをコピー</button>
          </div>
        </section>

        <section className="card">
          <h2 className="h2">回答一覧</h2>
          {responses.length === 0 && (
            <p className="status status-info" style={{ marginTop: 10 }}>
              まだ回答がありません。
            </p>
          )}
          {responses.length > 0 && (
            <div className="list" style={{ marginTop: 10 }}>
              {responses.map((row) => (
                <div key={row.id} className="item row-between">
                  <div>
                    <div>{row.name}</div>
                    <div className="hint" style={{ marginTop: 4 }}>{RSVP_LABEL[row.rsvp]}</div>
                  </div>
                  {form.collecting ? (
                    row.paid ? (
                      <button className="btn btn-primary" onClick={() => togglePaid(row)}>未払いに戻す</button>
                    ) : (
                      <button className="btn btn-ghost" onClick={() => togglePaid(row)}>支払い済みにする</button>
                    )
                  ) : (
                    <span className="badge">集金OFF</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="h2">集金確認</h2>
          {!form.collecting && (
            <p className="status status-warn" style={{ marginTop: 10 }}>
              集金を開始すると、この欄で支払い状況を確認できます。
            </p>
          )}
          {form.collecting && (
            <>
              <p className="hint" style={{ marginTop: 10 }}>
                支払い済み: {paidResponses.length} / {yesResponses.length}
              </p>
              {yesResponses.length === 0 && (
                <p className="status status-info" style={{ marginTop: 10 }}>
                  参加(はい)の回答がまだありません。
                </p>
              )}
              {yesResponses.length > 0 && (
                <div className="list" style={{ marginTop: 10 }}>
                  {yesResponses.map((row) => (
                    <div key={row.id} className="item row-between">
                      <div>
                        <div>{row.name}</div>
                        <div className="hint" style={{ marginTop: 4 }}>
                          {row.paid ? "支払い済み" : "未払い"}
                        </div>
                      </div>
                      {row.paid ? (
                        <button className="btn btn-primary" onClick={() => togglePaid(row)}>未払いに戻す</button>
                      ) : (
                        <button className="btn btn-ghost" onClick={() => togglePaid(row)}>支払い済みにする</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {status && <p className={`status status-${status.kind}`}>{status.message}</p>}
      </div>
    </main>
  );
}

