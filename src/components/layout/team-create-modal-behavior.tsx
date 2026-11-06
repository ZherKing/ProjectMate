"use client";
import { useEffect } from "react";
export function TeamCreateModalBehavior() {
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const close = event.target.closest("#modal-close-btn,#modal-cancel-btn");
      if (close) { event.preventDefault(); document.querySelector<HTMLElement>("#publish-project-modal")?.classList.add("hidden"); return; }
      const role = event.target.closest<HTMLButtonElement>("[data-field=roles] button");
      if (role) { event.preventDefault(); role.classList.toggle("bg-primary/10"); role.classList.toggle("bg-surface-container-low"); }
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, []);
  return null;
}
