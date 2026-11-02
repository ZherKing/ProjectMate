import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProjectMate",
  description: "面向年轻开发者的 AI 比赛与项目协作平台",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
