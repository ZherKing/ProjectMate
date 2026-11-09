"use client";

import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Copy, Search, ShieldCheck, UserMinus, UserPlus, Users, X } from "lucide-react";
import type { ProjectMember, ProjectRole } from "@/lib/db/project-members";
import { TransferProjectDialog } from "@/components/settings/transfer-project-dialog";
import { screenAction } from "./actions";
import { DesignNoticeContext } from "./design-notice-context";

type Dialog = { kind: "invite" } | { kind: "role" | "remove"; member: ProjectMember };

function MemberDialog({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.querySelector<HTMLElement>("button,input,select")?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <div className="pm-todo-backdrop pm-members-backdrop" onClick={e => { if (e.target === e.currentTarget && !busy) close.current(); }} onKeyDown={e => {
    if (e.key === "Escape" && !busy) { e.stopPropagation(); close.current(); }
    if (e.key === "Tab") {
      const items = box.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]");
      if (!items?.length) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }}><div ref={box} className="pm-workspace-modal pm-todo-editor pm-members-dialog" role="dialog" aria-modal="true" aria-labelledby="member-dialog-title" aria-busy={busy}>
    <button type="button" className="pm-workspace-modal-close" aria-label="关闭成员操作" disabled={busy} onClick={onClose}><X size={20} /></button>
    <h2 id="member-dialog-title">{title}</h2>{children}
  </div></div>;
}

export function ProjectMembersPanel({ projectId, viewerId, viewerRole, members, canInvite = true }: { projectId: string | null; viewerId: string; viewerRole: ProjectRole | null; members: ProjectMember[]; canInvite?: boolean }) {
  const router = useRouter();
  const toast = useContext(DesignNoticeContext);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [transfer,setTransfer]=useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [nextRole, setNextRole] = useState("成员");
  const [busy, setBusy] = useState(false);
  const [inviteEmail,setInviteEmail]=useState("");
  const [inviteLink, setInviteLink] = useState("");
  const linkRef = useRef<HTMLInputElement>(null);
  const canManage = viewerRole === "创建者" || viewerRole === "管理员";
  const keyword = query.trim().normalize("NFKC").toLocaleLowerCase();
  const filtered = members.filter(member => (!role || member.role === role) && (!keyword || (member.name || "").normalize("NFKC").toLocaleLowerCase().includes(keyword)));
  const pages = Math.max(1, Math.ceil(filtered.length / 5));
  const currentPage = Math.min(page, pages);
  const date = (value: number) => new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
  const open = (value: Dialog) => { setInviteEmail("");setInviteLink(""); if (value.kind === "role") setNextRole(value.member.role); setDialog(value); };
  async function perform() {
    if (!dialog || !projectId || busy) return;
    setBusy(true);
    try {
      const result = dialog.kind === "invite"
        ? await screenAction("create-project-invite", { projectId,recipientEmail:inviteEmail })
        : await screenAction(dialog.kind === "role" ? "change-project-member-role" : "remove-project-member", { projectId, memberId: dialog.member.id, role: nextRole });
      toast(result.message, result.ok ? "操作成功" : "操作未完成");
      if (result.ok) {
        if (dialog.kind === "invite" && result.href) setInviteLink(new URL(result.href, window.location.origin).href);
        else { setDialog(null); router.refresh(); }
      }
    } catch { toast("请求未完成，请稍后重试。", "连接失败"); }
    finally { setBusy(false); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(inviteLink); toast("邀请链接已复制。", "复制成功"); }
    catch { linkRef.current?.focus(); linkRef.current?.select(); toast("请手动复制已选中的邀请链接。", "复制提示"); }
  }
  return <section className="pm-todo-board pm-members-panel" aria-labelledby="members-heading">
    <div className="pm-todo-heading"><div><h2 id="members-heading"><span className="pm-todo-section-number">02</span>成员架构</h2><p>管理项目成员与权限，共同推进项目协作。</p></div>
      <div className="pm-todo-tools">{viewerRole === "创建者" && <button type="button" className="pm-button-outline" disabled={members.length<2} onClick={()=>setTransfer(true)}>转让创建者</button>}<span>共 {members.length} 位成员 · 当前权限：{viewerRole || "无项目权限"}</span>{canManage && <button type="button" className="pm-button-primary" disabled={!canInvite} title={!canInvite?"项目已暂停招募或人数已达上限":undefined} onClick={() => open({ kind: "invite" })}><UserPlus size={16} />邀请新成员</button>}</div>
    </div>
    <div className="pm-members-toolbar"><label className="pm-member-search"><Search size={17} aria-hidden="true" /><input aria-label="搜索成员昵称" placeholder="搜索成员昵称…" value={query} maxLength={100} onChange={e => { setQuery(e.target.value); setPage(1); }} /></label>
      <label className="pm-member-filter"><span>项目权限</span><select aria-label="筛选项目权限" value={role} onChange={e => { setRole(e.target.value); setPage(1); }}><option value="">全部权限</option><option>创建者</option><option>管理员</option><option>成员</option></select></label>
      <span className="pm-members-filter-count">筛选结果 {filtered.length} 位</span>
    </div>
    <div className="pm-todo-list">{filtered.slice((currentPage - 1) * 5, currentPage * 5).map(member => <article className="pm-todo-item pm-member-item" key={member.id}>
      <div className="pm-todo-item-top"><span className="pm-member-avatar"><span aria-hidden="true">{member.name?.trim().slice(0, 1) || <Users size={22} />}</span>{member.avatarVersion !== null && <img src={`/api/avatars/${encodeURIComponent(member.id)}?v=${member.avatarVersion}`} alt="" onError={e => { e.currentTarget.style.display = "none"; }} />}</span>
        <div className="pm-todo-item-copy"><h3>{member.name || "未设置昵称"}{member.id === viewerId && <span className="pm-member-self">你</span>}</h3><p>加入时间：{date(member.joinedAt)}</p></div>
        <span className={`pm-member-role ${member.role === "创建者" ? "is-owner" : member.role === "管理员" ? "is-admin" : ""}`}><ShieldCheck size={13} />{member.role}</span>
      </div>
      <div className="pm-member-bottom"><p className="pm-member-skills">技术标签：{member.skills || "未填写"}</p><div className="pm-todo-item-actions">
        {viewerRole === "创建者" && member.role !== "创建者" && <button type="button" className="pm-button-outline" disabled={busy} onClick={() => open({ kind: "role", member })}><ShieldCheck size={14} />调整权限</button>}
        {member.id !== viewerId && member.role !== "创建者" && (viewerRole === "创建者" || viewerRole === "管理员" && member.role === "成员") && <button type="button" className="pm-button-outline pm-member-remove" disabled={busy} onClick={() => open({ kind: "remove", member })}><UserMinus size={14} />移出项目</button>}
      </div></div>
    </article>)}{!filtered.length && <div className="pm-todo-empty"><Users size={28} /><p>{!projectId ? "暂无可访问的项目，请先创建项目或通过邀请加入项目。" : members.length ? "没有匹配的成员，请调整昵称关键词或权限筛选。" : "暂无成员记录。"}</p></div>}</div>
    <div className="pm-todo-pagination"><span>第 {currentPage} / {pages} 页 · 共 {filtered.length} 位</span><div><button type="button" className="pm-button-outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>上一页</button><button type="button" className="pm-button-outline" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>下一页</button></div></div>
    <p className="pm-members-permission-note">创建者可任免管理员并管理成员；管理员可邀请和移除普通成员；普通成员可查看列表。</p>
    {transfer&&projectId&&<TransferProjectDialog projectId={projectId} members={members} onClose={()=>setTransfer(false)}/>}
    {dialog && <MemberDialog title={dialog.kind === "invite" ? "邀请新成员" : dialog.kind === "role" ? "调整成员权限" : "移出项目成员"} busy={busy} onClose={() => { if (!busy) setDialog(null); }}>
      {dialog.kind === "invite" ? <><p>生成一个 7 天内有效、仅可使用一次的邀请链接。对方登录后可加入当前项目。</p><div className="pm-workspace-form"><label>邀请站内队友（可选）<input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="对方已注册的登录邮箱" maxLength={254}/></label><p>填写后向对方发送组队邀请通知；留空只生成链接。</p><label>项目邀请链接<input ref={linkRef} readOnly value={inviteLink} placeholder="点击下方按钮生成邀请链接" /></label></div><div className="pm-todo-editor-actions">{inviteLink ? <button type="button" className="pm-button-primary" onClick={copyLink}><Copy size={15} />复制邀请链接</button> : <button type="button" className="pm-button-primary" disabled={busy} onClick={perform}>{busy ? "生成中…" : "生成邀请链接"}</button>}</div></>
        : <form noValidate onSubmit={e => { e.preventDefault(); void perform(); }}><p>{dialog.kind === "remove" ? `确定将“${dialog.member.name || "未设置昵称"}”移出当前项目吗？对方将失去项目访问权限，账号及已有任务记录会保留。` : `为“${dialog.member.name || "未设置昵称"}”设置项目权限。`}</p>
          {dialog.kind === "role" && <div className="pm-workspace-form"><label>项目权限<select value={nextRole} onChange={e => setNextRole(e.target.value)} disabled={busy}><option>成员</option><option>管理员</option></select></label><p>管理员可以邀请新成员和移除普通成员。取消管理员权限后，其尚未使用的邀请链接将失效。</p></div>}
          <div className="pm-todo-editor-actions"><button type="button" className="pm-button-outline" disabled={busy} onClick={() => setDialog(null)}>取消</button><button type="submit" className={`pm-button-primary ${dialog.kind === "remove" ? "pm-member-confirm-remove" : ""}`} disabled={busy}>{busy ? "处理中…" : dialog.kind === "remove" ? "确认移出" : "保存权限"}</button></div>
        </form>}
    </MemberDialog>}
  </section>;
}
