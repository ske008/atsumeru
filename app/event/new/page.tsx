"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type EventForm = {
  title: string;
  date: string;
  place: string;
  note: string;
  collecting: boolean;
  amount: string;
  payUrl: string;
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

export default function NewEventPage() {
  const router = useRouter();
  const [form, setForm] = useState<EventForm>({
    title: "",
    date: "",
    place: "",
    note: "",
    collecting: true,
    amount: "",
    payUrl: "",
  });
  const [status, setStatus] = useState<{ kind: "error" | "info"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const normalizedAmount = form.amount ? Number(form.amount) : 0;
  const amountPreview = normalizedAmount.toLocaleString("ja-JP");

  const submit = async () => {
    setStatus(null);

    if (!form.title.trim()) {
      setStatus({ kind: "error", message: "イベント名を入力してください。" });
      return;
    }

    if (form.amount && Number.isNaN(Number(form.amount))) {
      setStatus({ kind: "error", message: "金額は数字で入力してください。" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          date: form.date || null,
          place: form.place.trim() || null,
          note: form.note.trim() || null,
          collecting: form.collecting,
          amount: Number(form.amount || 0),
          pay_url: form.payUrl.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus({ kind: "error", message: data.error || "イベント作成に失敗しました。" });
        return;
      }

      router.push(`/event/${data.eventId}/manage?token=${data.ownerToken}`);
    } catch {
      setStatus({ kind: "error", message: "通信エラーが発生しました。" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="container">
      <div className="stack">
        <div className="row-between">
          <h1 className="h1">イベント作成</h1>
          <Link href="/" className="btn btn-ghost btn-sm">戻る</Link>
        </div>

        <div className="card">
          <div className="stack">
            <div className="stack-sm">
              <p className="section-label">基本情報</p>
              <input
                className="input"
                placeholder="イベント名（例: 3月の飲み会）"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <input
                className="input"
                type="datetime-local"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
              <input
                className="input"
                placeholder="場所（任意）"
                value={form.place}
                onChange={(e) => setForm({ ...form, place: e.target.value })}
              />
              <input
                className="input"
                placeholder="メモ（任意）"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>

            <div className="divider" />

            <div className="stack-sm">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.collecting}
                  onChange={(e) => setForm({ ...form, collecting: e.target.checked })}
                />
                集金を開始する
              </label>

              {form.collecting && (
                <div className="collect-panel">
                  <div className="stack-sm">
                    <p className="section-label">集金設定</p>
                    <div className="money-input-wrap">
                      <input
                        className="input"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="金額"
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: normalizeAmountInput(e.target.value) })}
                      />
                      <span className="money-suffix">円</span>
                    </div>
                    {normalizedAmount > 0 && (
                      <p className="amount-preview">1人あたり {amountPreview}円</p>
                    )}
                    <input
                      className="input"
                      placeholder="送金URL（PayPay等・任意）"
                      value={form.payUrl}
                      onChange={(e) => setForm({ ...form, payUrl: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            {status && (
              <p className={`status ${status.kind === "error" ? "status-error" : "status-info"}`}>
                {status.message}
              </p>
            )}

            <button className="btn btn-primary btn-full" onClick={submit} disabled={submitting}>
              {submitting ? "作成中..." : "作成して管理ページへ"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
