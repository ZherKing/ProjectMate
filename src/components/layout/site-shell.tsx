import type { ReactNode } from "react";

const links = [
  ["比赛中心", "/competitions"],
  ["组队大厅", "/teams"],
  ["项目空间", "/projects"],
] as const;

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-8 px-6">
          <a href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 font-bold text-white">P</span>
            ProjectMate
          </a>
          <nav className="hidden gap-6 text-sm text-slate-600 md:flex">
            {links.map(([label, href]) => <a key={href} href={href} className="hover:text-indigo-600">{label}</a>)}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <button className="hidden rounded-md border border-slate-200 px-3 py-2 text-sm md:block">⌘ K 搜索</button>
            <a href="/login" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">登录 / 注册</a>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1280px] flex-wrap gap-6 px-6 py-8 text-sm text-slate-500">
          <span className="font-semibold text-slate-700">ProjectMate</span>
          <a href="/competitions">比赛中心</a><a href="/teams">组队大厅</a><a href="/#about">数据来源</a>
          <span className="ml-auto">© 2026 ProjectMate</span>
        </div>
      </footer>
    </div>
  );
}

export function ToastNotice({ children }: { children: ReactNode }) {
  return <div className="fixed bottom-6 right-6 z-30 rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 bg-white px-4 py-3 text-sm shadow-xl"><span className="mr-2 text-emerald-600">✓</span>{children}</div>;
}
