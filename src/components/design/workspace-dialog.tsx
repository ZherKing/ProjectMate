"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function WorkspaceDialog({ title, busy = false, className = "", onClose, children }: {
  title: string; busy?: boolean; className?: string; onClose: () => void; children: ReactNode;
}) {
  const id = useId(), box = useRef<HTMLDivElement>(null);
  const state = useRef({ busy, onClose });
  state.current = { busy, onClose };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.querySelector<HTMLElement>("button,input,select,textarea")?.focus();
    // Capture Escape even when a disabled submit button has moved focus to body.
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopImmediatePropagation();
        if (!state.current.busy) state.current.onClose();
      }
      if (event.key === "Tab") {
        const items = Array.from(box.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]") || [])
          .filter(item => item.getClientRects().length > 0 && getComputedStyle(item).visibility !== "hidden");
        if (!items.length) { event.preventDefault(); return; }
        const first = items[0], last = items[items.length - 1];
        if (!box.current?.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keydown, true);
    return () => { document.removeEventListener("keydown", keydown, true); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <div className="pm-todo-backdrop pm-files-backdrop" onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div ref={box} className={`pm-workspace-modal pm-todo-editor ${className}`} role="dialog" aria-modal="true" aria-labelledby={id} aria-busy={busy}>
      <button type="button" className="pm-workspace-modal-close" aria-label="关闭文件操作" disabled={busy} onClick={onClose}><X size={20} /></button>
      <h2 id={id}>{title}</h2>{children}
    </div>
  </div>;
}
