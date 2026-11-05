"use client";

import { usePathname } from "next/navigation";

export function SiteNav({ items, className = "pm-nav" }: { items: ReadonlyArray<readonly [string, string]>; className?: string }) {
  const pathname = usePathname();
  return <nav className={className} aria-label="主导航">{items.map(([label, href]) => <a key={href} href={href} aria-current={pathname === href || pathname.startsWith(href + "/") ? "page" : undefined} data-active={pathname === href || pathname.startsWith(href + "/")}>{label}</a>)}</nav>;
}
