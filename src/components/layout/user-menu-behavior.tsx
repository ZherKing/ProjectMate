"use client";

import { useEffect } from "react";

export function UserMenuBehavior() {
  useEffect(() => {
    const closeTimers = new WeakMap<HTMLDetailsElement, number>();

    const findMenu = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLDetailsElement>("details.pm-user-menu") : null;

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const menu = findMenu(event.target);
      if (!menu) return;
      const timer = closeTimers.get(menu);
      if (timer) window.clearTimeout(timer);
      menu.open = true;
    };

    const onPointerOut = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const menu = findMenu(event.target);
      if (!menu || (event.relatedTarget instanceof Node && menu.contains(event.relatedTarget))) return;
      const timer = window.setTimeout(() => {
        if (!menu.matches(":hover") && !menu.contains(document.activeElement)) menu.open = false;
      }, 100);
      closeTimers.set(menu, timer);
    };

    const onFocusOut = (event: FocusEvent) => {
      const menu = findMenu(event.target);
      if (menu && !(event.relatedTarget instanceof Node && menu.contains(event.relatedTarget))) menu.open = false;
    };

    const onClick = (event: MouseEvent) => {
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches || !(event.target instanceof Element)) return;
      const summary = event.target.closest("details.pm-user-menu > summary");
      if (summary) event.preventDefault();
    };

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
  return null;
}
