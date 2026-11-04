"use client";

import { CheckCircle2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

const AUTO_DISMISS_MS = 5000;

export function ToastNotice({ title = "操作成功", message, children, duration = AUTO_DISMISS_MS }: { title?: string; message?: string; children?: ReactNode; duration?: number }) {
  const [visible, setVisible] = useState(true);
  const [closing, setClosing] = useState(false);
  const close = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => setVisible(false), 220);
  };
  useEffect(() => {
    const timer = window.setTimeout(() => setClosing(true), duration);
    const removeTimer = window.setTimeout(() => setVisible(false), duration + 220);
    return () => { window.clearTimeout(timer); window.clearTimeout(removeTimer); };
  }, [duration]);
  if (!visible) return null;
  return <div className="pm-toast-stack"><div className={`pm-toast pm-toast-success${closing ? " pm-toast-closing" : ""}`} role="status" aria-live="polite" style={{ "--pm-toast-duration": `${duration}ms` } as CSSProperties}><CheckCircle2 size={20} className="pm-toast-icon" /><div><p className="pm-toast-title">{title}</p><p className="pm-toast-text">{message ?? children}</p></div><button onClick={close} className="pm-toast-close" aria-label="关闭通知"><X size={16} /></button><span className="pm-toast-progress" aria-hidden="true" /></div></div>;
}
