import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container">
      <div className="stack">
        <section className="card">
          <h1 className="h1">出欠と集金を、これだけで</h1>
          <p className="hint">説明なしで使える最小構成です。まずイベントを作成してください。</p>
          <div style={{ marginTop: 12 }}>
            <Link href="/event/new">
              <button className="btn btn-primary">イベントを作成する</button>
            </Link>
          </div>
        </section>

        <section className="card">
          <h2 className="h2">使い方</h2>
          <div className="list" style={{ marginTop: 10 }}>
            <div className="item">1. 幹事がイベントを作成</div>
            <div className="item">2. 参加者URLを共有</div>
            <div className="item">3. 管理画面で集金済みを切替</div>
          </div>
        </section>
      </div>
    </main>
  );
}
