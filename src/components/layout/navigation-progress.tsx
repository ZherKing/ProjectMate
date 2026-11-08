"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname(), search = useSearchParams().toString();
  const [active, setActive] = useState(false);
  const started = useRef(0), finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null), fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (finishTimer.current) clearTimeout(finishTimer.current);
    finishTimer.current = setTimeout(() => { setActive(false); if (fallbackTimer.current) clearTimeout(fallbackTimer.current); }, Math.max(0, 200 - (performance.now() - started.current)));
    return () => { if (finishTimer.current) clearTimeout(finishTimer.current); };
  }, [pathname, search]);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target.closest<HTMLElement>("a[href], [data-route]");
      if (!target || target.matches(":disabled") || target.getAttribute("target") === "_blank" || target.hasAttribute("download")) return;
      const destination = target.getAttribute("data-route") || target.getAttribute("href");
      if (!destination || destination.startsWith("#")) return;
      const url = new URL(destination, window.location.href);
      if (url.origin !== location.origin || url.pathname + url.search === location.pathname + location.search) return;
      if (finishTimer.current) clearTimeout(finishTimer.current);
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
      started.current = performance.now(); setActive(true);
      fallbackTimer.current = setTimeout(() => setActive(false), 15000);
    };
    document.addEventListener("click", click, true);
    return () => { document.removeEventListener("click", click, true); if (fallbackTimer.current) clearTimeout(fallbackTimer.current); };
  }, []);
  return <div className={`pm-navigation-progress${active ? " is-active" : ""}`} aria-hidden="true" />;
}
