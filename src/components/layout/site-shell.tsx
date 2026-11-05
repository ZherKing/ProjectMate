import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

export { ToastNotice } from "./toast-notice";

export async function SiteShell({ children }: { children: ReactNode }) {
  return <div className="pm-shell">
    <SiteHeader />
    <main className="pm-main">{children}</main>
    <SiteFooter />
  </div>;
}
