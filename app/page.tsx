import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container">
      <div className="stack">
        <div className="hero">
          <h1 className="h1">アツメル</h1>
          <p className="subtitle">出欠と集金を、これひとつで。</p>
        </div>

        <Link href="/event/new" className="btn btn-primary btn-full" style={{ height: 52 }}>
          イベントを作成する
        </Link>

        <div className="card-flush">
          <div className="list" style={{ border: "none" }}>
            <div className="item">
              <span style={{ fontWeight: 600 }}>1</span>
              <span>幹事がイベントを作成</span>
            </div>
            <div className="item">
              <span style={{ fontWeight: 600 }}>2</span>
              <span>参加URLを共有</span>
            </div>
            <div className="item">
              <span style={{ fontWeight: 600 }}>3</span>
              <span>管理ページで出欠と集金を確認</span>
            </div>
          </div>
        </div>

        <Link href="/dashboard" className="btn btn-ghost btn-full">
          全体ダッシュボード
        </Link>
      </div>
    </main>
  );
}
