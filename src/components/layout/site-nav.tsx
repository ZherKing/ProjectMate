"use client";

import { usePathname } from "next/navigation";

export function SiteNav({ items }: { items: ReadonlyArray<readonly [string, string]> }) {
  const pathname = usePathname();
  return <nav className="pm-nav">{items.map(([label, href]) => <a key={href} href={href} data-active={pathname === href || (href !== "/" && pathname.startsWith(href))}>{label}</a>)}</nav>;
}
