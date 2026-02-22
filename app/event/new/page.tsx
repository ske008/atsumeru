"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type EventForm = {
  title: string;
  date: string;
  place: string;
  note: string;
  collecting: boolean;
  amount: string;
  payUrl: string;
};

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
        setStatus({ kind: "error", message: data.error || "作成できませんでした。入力内容を確認してください。" });
        return;
      }

      router.push(`/event/${data.eventId}/manage?token=${data.ownerToken}`);
    } catch {
      setStatus({ kind: "error", message: "通信エラーが発生しました。時間をおいて再試行してください。" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="container">
      <div className="card">
        <h1 className="h1">イベント作成</h1>
        <p className="hint">作成後すぐ管理画面に移動します。出欠が0人でも先に集金設定できます。</p>

        <div className="stack" style={{ marginTop: 12 }}>
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

          <label className="row" style={{ minHeight: 44 }}>
            <input
              type="checkbox"
              checked={form.collecting}
              onChange={(e) => setForm({ ...form, collecting: e.target.checked })}
            />
            作成と同時に集金を開始する
          </label>

          <input
            className="input"
            inputMode="numeric"
            placeholder="集金金額（任意）"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <input
            className="input"
            placeholder="送金URL（任意）"
            value={form.payUrl}
            onChange={(e) => setForm({ ...form, payUrl: e.target.value })}
          />

          {status && (
            <p className={`status ${status.kind === "error" ? "status-error" : "status-info"}`}>{status.message}</p>
          )}

          <button className="btn btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? "作成中..." : "作成して管理画面へ"}
          </button>
        </div>
      </div>
    </main>
  );
}
