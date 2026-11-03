"use client";

import { CheckCircle2, X } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

export function ToastNotice({ title = "操作成功", message, children }: { title?: string; message?: string; children?: ReactNode }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return <div className="pm-toast-stack"><div className="pm-toast pm-toast-success"><CheckCircle2 size={20} className="pm-toast-icon" /><div><p className="pm-toast-title">{title}</p><p className="pm-toast-text">{message ?? children}</p></div><button onClick={() => setVisible(false)} className="pm-toast-close" aria-label="关闭通知"><X size={16} /></button></div></div>;
}
