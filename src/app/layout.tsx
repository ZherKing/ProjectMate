import type { Metadata } from "next";
import "./globals.css";
import { auth } from "@/auth";
import { SignoutDialog } from "@/components/layout/signout-dialog";
import { UserMenuBehavior } from "@/components/layout/user-menu-behavior";

export const metadata: Metadata = {
  icons: {
    icon: [{ url: "/assets/favicon.svg?v=pm-1", type: "image/svg+xml", sizes: "any" }],
    shortcut: "/assets/favicon.svg?v=pm-1",
  },
  title: {
    default: "ProjectMate｜首页",
    template: "ProjectMate｜%s",
  },
  description: "面向年轻开发者的 AI 比赛与项目协作平台",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  return (
    <html lang="zh-CN">
      <body>{children}<UserMenuBehavior /><SignoutDialog account={session?.user ? { name: session.user.name, email: session.user.email } : null} /></body>
    </html>
  );
}
