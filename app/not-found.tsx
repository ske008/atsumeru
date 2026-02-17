import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container">
      <div className="card">
        <h1 className="h1">ページが見つかりません</h1>
        <p className="hint" style={{ marginTop: 10 }}>
          URLが古い可能性があります。トップからイベントを開き直してください。
        </p>
        <div style={{ marginTop: 12 }}>
          <Link href="/">
            <button className="btn btn-primary">トップへ戻る</button>
          </Link>
        </div>
      </div>
    </main>
  );
}
