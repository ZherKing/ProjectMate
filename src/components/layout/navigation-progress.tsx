"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  useEffect(() => { setActive(false); }, [pathname]);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin === window.location.origin && url.pathname !== window.location.pathname) setActive(true);
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, []);
  return <div className={`pm-navigation-progress${active ? " is-active" : ""}`} aria-hidden="true" />;
}
