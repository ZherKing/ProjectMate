"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { LockKeyhole, LogOut, Power, UsersRound, X } from "lucide-react";
import styles from "./signout-dialog.module.css";

type Account = { name?: string | null; email?: string | null };

export function SignoutDialog({ account }: { account: Account | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const pendingRequest = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!account) return;
    const open = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const trigger = event.target.closest<HTMLElement>('a[href^="/api/auth/signout"],[data-action="logout"]');
      if (!trigger) return;
      event.preventDefault();
      event.stopPropagation();
      opener.current = trigger;
      trigger.closest("details")?.removeAttribute("open");
      setError("");
      if (!dialog.current?.open) dialog.current?.showModal();
      cancelButton.current?.focus();
    };
    document.addEventListener("click", open, true);
    return () => document.removeEventListener("click", open, true);
  }, [account]);

  function close() {
    if (pendingRequest.current) return;
    dialog.current?.close();
    const menu = opener.current?.closest("details");
    (menu?.querySelector<HTMLElement>("summary") || opener.current)?.focus();
  }

  async function confirm() {
    if (pendingRequest.current) return;
    pendingRequest.current = true;
    setPending(true);
    setError("");
    try {
      await signOut({ redirect: false });
      window.location.assign("/");
    } catch {
      setError("退出登录未完成，请重试。当前页面已保留。");
      pendingRequest.current = false;
      setPending(false);
    }
  }

  if (!account) return null;
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="signout-title" aria-describedby="signout-description" onKeyDown={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); close(); }}>
    <div className={styles.accent} aria-hidden="true" />
    <div className={styles.body}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.logoutIcon}><LogOut size={22} /></span>
          <div><h2 id="signout-title">确认退出当前账号？</h2><p id="signout-description">结束本设备上的登录会话</p></div>
        </div>
        <button type="button" className={styles.close} aria-label="关闭退出登录确认" disabled={pending} onClick={close}><X size={18} /><kbd>ESC</kbd></button>
      </div>
      <div className={styles.identity}>
        <div className={styles.account}><span className={styles.avatar}>{(account.name || account.email || "我").slice(0, 1)}<i /></span><div><strong>{account.name || "项目成员"}</strong><p>{account.email}</p></div></div>
        <div className={styles.notice}><LockKeyhole size={16} /><p>退出后需重新登录才能使用个人设置、收藏和组队等功能。请先保存当前页面中尚未提交的修改。</p></div>
      </div>
      <div className={styles.collaboration}><UsersRound size={18} /><div><strong>已保存的项目与收藏会保留</strong><p>退出当前账号不会删除已保存的项目、任务或赛事收藏记录。</p></div></div>
      <div className={styles.device}><LockKeyhole size={16} /><span>本设备登录状态将同时清除</span></div>
      {error && <p className={styles.error} role="status">{error}</p>}
      <div className={styles.actions}>
        <button ref={cancelButton} type="button" className={styles.cancel} disabled={pending} onClick={close}>取消，保持在线</button>
        <button type="button" className={styles.confirm} disabled={pending} onClick={confirm}><Power size={16} />{pending ? "正在退出…" : "确认退出登录"}</button>
      </div>
    </div>
    <div className={styles.footer}><span><i />当前设备会话</span><span>可按 <strong>Tab</strong> 切换焦点</span></div>
  </dialog>;
}
