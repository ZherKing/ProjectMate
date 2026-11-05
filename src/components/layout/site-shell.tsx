import type { ReactNode } from "react";
import { Bell, Plus, UserRound } from "lucide-react";
import { auth } from "@/auth";
import { ToastNotice } from "./toast-notice";
import { SiteNav } from "./site-nav";
import { ScrollHeader } from "./scroll-header";

export { ToastNotice } from "./toast-notice";

const nav = [
  ["比赛中心", "/competitions"],
  ["组队大厅", "/teams"],
  ["项目空间", "/projects"],
] as const;

export async function SiteShell({ children }: { children: ReactNode }) {
  const session = await auth();
  const user = session?.user;
  return <div className="pm-shell">
    <ScrollHeader className="pm-header"><div className="pm-header-inner">
      <a href="/" className="pm-brand"><span className="pm-brand-mark"><span className="pm-logo-glyph">P</span></span><span>ProjectMate</span></a>
      <SiteNav items={nav} />
      <div className="pm-header-actions">
        {user ? <button className="pm-icon-button" aria-label="通知中心"><Bell size={18} strokeWidth={1.8} /><span className="pm-unread" /></button> : null}
        {user ? <a className="pm-header-cta" href="/teams/create"><Plus size={16} /><span className="pm-header-cta-label">发布项目</span></a> : null}
        {user ? <details className="pm-user-menu"><summary className="pm-user"><span className="pm-avatar">{user.image ? <img src={user.image} alt="个人头像" className="w-8 h-8 rounded-full object-cover" /> : <UserRound size={17} />}</span><span className="pm-user-meta"><strong>{user.name || "项目搭档"}</strong></span></summary><div className="pm-user-menu-panel"><a href="/settings">个人设置</a><a href="/api/auth/signout?callbackUrl=/">退出登录</a></div></details> : <div className="pm-auth-links"><a href="/login">登录</a><a className="pm-register" href="/register">免费注册</a></div>}
      </div>
    </div></ScrollHeader>
    <main className="pm-main">{children}</main>
    <footer className="pm-footer"><div className="pm-footer-grid">
      <div><a href="/" className="pm-footer-brand">ProjectMate</a><p className="pm-footer-desc">面向高校学生与青年开发者的智能赛事协作平台。算法驱动精准人岗匹配，让每一次组队都迸发硬核生产力。</p><div className="pm-footer-symbols"><span>⌘</span><span>◇</span><span>▣</span></div></div>
      <div><h3>平台资源</h3><a href="/competitions">比赛中心</a><a href="/teams">组队大厅</a><a href="/projects">项目协作工作台</a></div>
      <div><h3>合规与条款</h3><a href="/competitions">赛事数据合规来源</a><a href="/#privacy">隐私权保护政策</a><a href="/#terms">用户服务协议</a></div>
      <div><h3>支持与关于</h3><a href="/#workflow">产品版本说明</a><a href="/#help">使用帮助中心</a><a href="/#contact">高校合作对接</a></div>
    </div><div className="pm-footer-bottom"><span>© 2025 ProjectMate AI. 赛事官方数据均经授权同步，保留所有权利。</span><span className="pm-mono">v2.4.0-collegian-core</span></div></footer>
  </div>;
}
