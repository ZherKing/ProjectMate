"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export function ScrollHeader({ children, className }: { children: ReactNode; className: string }) {
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    const onScroll = () => header.current?.classList.toggle("is-scrolled", window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return <header ref={header} className={className}>{children}</header>;
}
