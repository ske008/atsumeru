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
  total_amount: number;
  split_count: number;
  pay_url: string | null;
};

type ResponseRow = {
  id: string;
  name: string;
  rsvp: "yes" | "maybe" | "no";
  paid: boolean;
  paid_at: string | null;
  amount: number | null;
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
  const [form, setForm] = useState({ collecting: false, splitMode: false, amount: "", totalAmount: "", splitCount: "", payUrl: "" });
  const [status, setStatus] = useState<UiStatus | null>(null);
  const [savingSetting, setSavingSetting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAmount, setBulkAmount] = useState("");

  const normalizedAmount = form.amount ? Number(form.amount) : 0;
  const normalizedTotalAmount = form.totalAmount ? Number(form.totalAmount) : 0;
  const normalizedSplitCount = form.splitCount ? Number(form.splitCount) : 0;

  const yesResponses = responses.filter((row) => row.rsvp === "yes");

  // 個別設定の合計
  const individualTotal = yesResponses.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const individualCount = yesResponses.filter((r) => r.amount !== null).length;

  // 割り勘の対象人数
  const splitTargetCount = Math.max(0, (normalizedSplitCount > 0 ? normalizedSplitCount : yesResponses.length) - individualCount);
  const remainingAmount = Math.max(0, normalizedTotalAmount - individualTotal);

  const calculatedPerPerson = splitTargetCount > 0 ? Math.ceil(remainingAmount / splitTargetCount) : 0;

  const amountPreview = normalizedAmount.toLocaleString("ja-JP");
  const totalAmountPreview = normalizedTotalAmount.toLocaleString("ja-JP");

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
      const isSplit = (eventData.total_amount ?? 0) > 0;
      setForm({
        collecting: !!eventData.collecting,
        splitMode: isSplit,
        amount: isSplit ? "" : String(eventData.amount ?? 0),
        totalAmount: isSplit ? String(eventData.total_amount ?? 0) : "",
        splitCount: isSplit && (eventData.split_count ?? 0) > 0 ? String(eventData.split_count) : "",
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

    if (!form.splitMode && form.amount && Number.isNaN(Number(form.amount))) {
      setStatus({ kind: "error", message: "金額は数字で入力してください。" });
      return;
    }
    if (form.splitMode && form.totalAmount && Number.isNaN(Number(form.totalAmount))) {
      setStatus({ kind: "error", message: "合計金額は数字で入力してください。" });
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
          amount: form.splitMode ? 0 : Number(form.amount || 0),
          total_amount: form.splitMode ? Number(form.totalAmount || 0) : 0,
          split_count: form.splitMode ? Number(form.splitCount || 0) : 0,
          pay_url: form.payUrl.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus({ kind: "error", message: data.error || "設定の更新に失敗しました。" });
        return;
      }

      setEvent((prev) =>
        prev ? { ...prev, collecting: data.collecting, amount: data.amount, total_amount: data.total_amount, split_count: data.split_count, pay_url: data.pay_url } : prev
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

  const updateIndividualAmount = async (rowId: string, amount: number | null) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/events/${params.eventId}/responses/${rowId}?token=${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) throw new Error();
      setResponses((prev) => prev.map((item) => (item.id === rowId ? { ...item, amount } : item)));
    } catch {
      setStatus({ kind: "error", message: "金額の更新に失敗しました。" });
    }
  };

  const updateSelectedAmounts = async () => {
    if (!token || selectedIds.size === 0) return;
    const amount = bulkAmount === "" ? null : Number(bulkAmount);
    if (amount !== null && Number.isNaN(amount)) return;

    setStatus({ kind: "info", message: "更新中..." });
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/events/${params.eventId}/responses/${id}?token=${token}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount }),
          })
        )
      );
      setResponses((prev) =>
        prev.map((item) => (selectedIds.has(item.id) ? { ...item, amount } : item))
      );
      setSelectedIds(new Set());
      setBulkAmount("");
      setStatus({ kind: "success", message: "一括更新しました。" });
    } catch {
      setStatus({ kind: "error", message: "一部の更新に失敗しました。" });
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
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
          <p className="h2">このイベントのURL</p>
          <div className="row" style={{ marginTop: 8 }}>
            <input className="input" value={participantUrl} readOnly style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm" onClick={copyParticipantUrl}>コピー</button>
          </div>
          <p className="hint" style={{ marginTop: 8, fontSize: "0.8125rem" }}>
            ※イベント編集は、イベント作成した端末、ブラウザでのみ可能です。
          </p>

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
                  <div style={{ display: "flex", gap: 8 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flex: 1, padding: "8px 12px", border: `2px solid ${!form.splitMode ? "var(--primary, #2563eb)" : "var(--border)"}`, borderRadius: 8 }}>
                      <input
                        type="radio"
                        name="splitMode"
                        checked={!form.splitMode}
                        onChange={() => setForm((prev) => ({ ...prev, splitMode: false }))}
                      />
                      <span style={{ fontSize: "0.875rem" }}>1人あたり</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flex: 1, padding: "8px 12px", border: `2px solid ${form.splitMode ? "var(--primary, #2563eb)" : "var(--border)"}`, borderRadius: 8 }}>
                      <input
                        type="radio"
                        name="splitMode"
                        checked={form.splitMode}
                        onChange={() => setForm((prev) => ({ ...prev, splitMode: true }))}
                      />
                      <span style={{ fontSize: "0.875rem" }}>割り勘</span>
                    </label>
                  </div>

                  {!form.splitMode ? (
                    <>
                      <div className="money-input-wrap">
                        <input
                          className="input"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="1人あたりの金額"
                          value={form.amount}
                          onChange={(e) => setForm((prev) => ({ ...prev, amount: normalizeAmountInput(e.target.value) }))}
                        />
                        <span className="money-suffix">円</span>
                      </div>
                      {normalizedAmount > 0 && <p className="amount-preview">1人あたり {amountPreview}円</p>}
                    </>
                  ) : (
                    <>
                      <div className="money-input-wrap">
                        <input
                          className="input"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="合計金額"
                          value={form.totalAmount}
                          onChange={(e) => setForm((prev) => ({ ...prev, totalAmount: normalizeAmountInput(e.target.value) }))}
                        />
                        <span className="money-suffix">円</span>
                      </div>
                      <div className="money-input-wrap">
                        <input
                          className="input"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder={`人数（未入力: 参加者数 ${yesResponses.length}人 で自動計算）`}
                          value={form.splitCount}
                          onChange={(e) => setForm((prev) => ({ ...prev, splitCount: normalizeAmountInput(e.target.value) }))}
                        />
                        <span className="money-suffix">人</span>
                      </div>
                      {normalizedTotalAmount > 0 && (
                        <div className="amount-preview" style={{ fontSize: "0.875rem" }}>
                          <p>全体：{totalAmountPreview}円</p>
                          {individualCount > 0 && (
                            <p style={{ color: "var(--primary)", fontWeight: 600 }}>
                              個別設定：{individualCount}名（計 {individualTotal.toLocaleString()}円）を控除
                            </p>
                          )}
                          <p style={{ marginTop: 4, paddingTop: 4, borderTop: "1px dashed var(--border)" }}>
                            残り：{remainingAmount.toLocaleString()}円 ÷ {splitTargetCount}人 = <strong>{calculatedPerPerson.toLocaleString()}円/人</strong>
                          </p>
                          {normalizedSplitCount === 0 && <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>（参加者数で自動計算中）</p>}
                        </div>
                      )}
                    </>
                  )}

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
            {event && (event.total_amount > 0 || event.amount > 0) && (
              <div style={{ marginTop: 8, fontSize: "0.875rem", color: "var(--muted)" }}>
                {event.total_amount > 0 ? (
                  <div className="stack-xs">
                    <p>合計：{event.total_amount.toLocaleString()}円</p>
                    {individualCount > 0 && <p>個別設定 {individualCount}名分を考慮済み</p>}
                    <p style={{ color: "var(--foreground)", fontWeight: 600 }}>
                      通常：{calculatedPerPerson.toLocaleString()}円 / 個別：設定通り
                    </p>
                  </div>
                ) : (
                  <p>1人あたり：{event.amount.toLocaleString()}円</p>
                )}
              </div>
            )}
            <div className="progress-bar" style={{ marginTop: 12 }}>
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
            <>
              {selectedIds.size > 0 && (
                <div style={{ padding: "12px 14px", background: "var(--primary-subtle, #eff6ff)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", position: "sticky", top: 0, zIndex: 10 }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>{selectedIds.size}人を選択中</span>
                  <div className="money-input-wrap" style={{ width: 140 }}>
                    <input
                      className="input input-sm"
                      placeholder="設定する金額"
                      value={bulkAmount}
                      onChange={(e) => setBulkAmount(normalizeAmountInput(e.target.value))}
                    />
                    <span className="money-suffix" style={{ fontSize: "0.75rem" }}>円</span>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={updateSelectedAmounts}>一括設定</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>解除</button>
                </div>
              )}
              <div className="list" style={{ border: "none", borderTop: `1px solid var(--border)` }}>
                {responses.map((row) => (
                  <div key={row.id} className="item" style={{ alignItems: "center", gap: 12 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleSelect(row.id)}
                      style={{ width: 18, height: 18 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{row.name}</div>
                      <div className="hint" style={{ marginTop: 0 }}>{RSVP_LABEL[row.rsvp]}</div>
                    </div>

                    {row.rsvp === "yes" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="money-input-wrap" style={{ width: 100 }}>
                          <input
                            className="input input-sm"
                            placeholder="自動"
                            value={row.amount === null ? "" : String(row.amount)}
                            onChange={(e) => {
                              const val = e.target.value === "" ? null : Number(normalizeAmountInput(e.target.value));
                              setResponses((prev) => prev.map((item) => (item.id === row.id ? { ...item, amount: val } : item)));
                            }}
                            onBlur={(e) => updateIndividualAmount(row.id, e.target.value === "" ? null : Number(normalizeAmountInput(e.target.value)))}
                            style={{ textAlign: "right", paddingRight: 24 }}
                          />
                          <span className="money-suffix" style={{ fontSize: "0.75rem" }}>円</span>
                        </div>
                        {form.collecting && (
                          <button
                            className={`btn btn-sm ${row.paid ? "btn-primary" : "btn-ghost"}`}
                            onClick={() => togglePaid(row)}
                            style={{ minWidth: 80 }}
                          >
                            {row.paid ? "済" : "未"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
