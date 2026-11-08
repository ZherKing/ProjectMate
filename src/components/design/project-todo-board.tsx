"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardList, Plus, Pencil, X } from "lucide-react";
import { screenAction } from "./actions";
import { DesignNoticeContext } from "./design-notice-context";

export type TodoItem = { id: string; title: string; notes: string | null; status: string };
export function ProjectTodoBoard({ projectId, tasks, canEdit = true }: { projectId: string | null; tasks: TodoItem[]; canEdit?: boolean }) {
  const router = useRouter();
  const toast = useContext(DesignNoticeContext);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<{ id: string; title: string; notes: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const opener = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const pages = Math.max(1, Math.ceil(tasks.length / 5));
  const currentPage = Math.min(page, pages);
  useEffect(() => { if (draft) titleRef.current?.focus(); }, [draft?.id]);
  const close = () => { setDraft(null); setMessage(""); opener.current?.focus(); };
  const open = (task?: TodoItem) => { opener.current = document.activeElement as HTMLElement; setMessage(""); setDraft({ id: task?.id || "", title: task?.title || "", notes: task?.notes || "" }); };
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!draft || !projectId || !canEdit || busy) return;
    if (!draft.title.trim()) {
      toast("请输入待办标题。", "信息不完整");
      titleRef.current?.focus();
      return;
    }
    setBusy(true); setMessage("");
    try {
      const result = await screenAction("save-todo", { projectId, taskId: draft.id, title: draft.title, notes: draft.notes });
      if (result.ok) { close(); router.refresh(); } else setMessage(result.message);
    } catch { setMessage("保存失败，请稍后重试。"); } finally { setBusy(false); }
  }
  async function toggle(task: TodoItem) {
    if (!projectId || !canEdit || busy) return; setBusy(true); setMessage("");
    try { const result = await screenAction("toggle-todo", { projectId, taskId: task.id, completed: String(task.status !== "已完成") }); if (result.ok) router.refresh(); else setMessage(result.message); }
    catch { setMessage("更新失败，请稍后重试。"); } finally { setBusy(false); }
  }
  return <section className="pm-todo-board" aria-labelledby="todo-heading">
    <div className="pm-todo-heading"><div><h2 id="todo-heading"><span className="pm-todo-section-number">01</span>任务看板</h2><p>记录项目待办，逐项推进；完成状态同步到整体完成度。</p></div><div className="pm-todo-tools"><span>{tasks.filter(t => t.status !== "已完成").length} 项待完成 / 共 {tasks.length} 项</span><button className="pm-button-primary" disabled={!projectId || !canEdit} onClick={() => open()}><Plus size={16} />添加待办事项</button></div></div>
    {message && !draft && <p role="status">{message}</p>}
    <div className="pm-todo-list">{tasks.slice((currentPage - 1) * 5, currentPage * 5).map(task => <article key={task.id} className="pm-todo-item">
      <div className="pm-todo-item-top"><span className="pm-todo-icon"><ClipboardList size={22} /></span><div className="pm-todo-item-copy"><h3 className={task.status === "已完成" ? "pm-todo-completed" : ""}>{task.title}</h3><p>{task.notes || "暂无备注"}</p></div><span className={`pm-todo-status ${task.status === "已完成" ? "is-done" : ""}`}>{task.status === "已完成" ? "已完成" : "待完成"}</span></div>
      <div className="pm-todo-item-actions"><button className="pm-button-outline" disabled={busy || !canEdit} onClick={() => open(task)}><Pencil size={14} />编辑待办</button><button className="pm-button-primary" disabled={busy || !canEdit} onClick={() => toggle(task)}><Check size={14} />{task.status === "已完成" ? "恢复待办" : "标记完成"}</button></div>
    </article>)}{!tasks.length && <div className="pm-todo-empty"><ClipboardList size={28} /><p>{projectId ? "暂无待办事项，点击“添加待办事项”创建第一条任务。" : "请先创建组队项目，再添加待办事项。"}</p></div>}</div>
    <div className="pm-todo-pagination"><span>第 {currentPage} / {pages} 页 · 共 {tasks.length} 项</span><div><button className="pm-button-outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>上一页</button><button className="pm-button-outline" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>下一页</button></div></div>
    {draft && <div className="pm-todo-backdrop" onKeyDown={e => { if (e.key === "Escape" && !busy) close(); if(e.key === "Tab") { const elements=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input,textarea')); const first=elements[0],last=elements[elements.length-1]; if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();} } }}><form noValidate className="pm-workspace-modal pm-todo-editor" role="dialog" aria-modal="true" aria-labelledby="todo-editor-title" onSubmit={save}><button type="button" className="pm-workspace-modal-close" aria-label="关闭待办编辑" disabled={busy} onClick={close}><X size={20} /></button><h2 id="todo-editor-title">{draft.id ? "编辑待办事项" : "添加待办事项"}</h2><p>填写待办标题，可补充说明或验收要求。</p><div className="pm-workspace-form"><label>待办标题<input ref={titleRef} required maxLength={160} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="请输入待办标题" /></label><label>备注<textarea maxLength={1000} rows={4} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="补充待办说明（选填）" /></label></div><p role="status" className="pm-workspace-modal-status">{message}</p><div className="pm-todo-editor-actions"><button type="button" className="pm-button-outline" disabled={busy} onClick={close}>取消</button><button className="pm-button-primary" disabled={busy}>{busy ? "保存中…" : "保存待办"}</button></div></form></div>}
  </section>;
}
