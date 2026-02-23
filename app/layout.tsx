import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "アツメル",
  description: "出欠と集金をシンプルに",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
