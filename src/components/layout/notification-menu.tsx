"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, CheckCheck, Loader2, RefreshCw } from "lucide-react";
import styles from "./notification-menu.module.css";

type Notice = { id:string; title:string; message:string; href:string; createdAt:number; readAt:number|null };
export type NotificationSummary = { items:Notice[]; unread:number; total:number };
export function NotificationMenu({initial}:{initial:NotificationSummary}) {
  const [data,setData]=useState(initial),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),reading=useRef(false),generation=useRef(0),alive=useRef(true);
  const id=useId(),pathname=usePathname(),router=useRouter();
  async function refresh(){if(reading.current||busy)return;reading.current=true;const version=generation.current;try{const response=await fetch('/api/notifications',{cache:'no-store'});if(!response.ok)throw new Error('通知读取失败，请重试。');const result=await response.json();if(alive.current&&version===generation.current){setData(result);setError('');}}catch(e){if(alive.current)setError((e as Error).message);}finally{reading.current=false;}}
  useEffect(()=>{alive.current=true;const timer=setInterval(()=>{if(!document.hidden)void refresh();},30000);const focus=()=>void refresh();window.addEventListener('focus',focus);return()=>{alive.current=false;clearInterval(timer);window.removeEventListener('focus',focus);};},[busy]);
  useEffect(()=>{setOpen(false);},[pathname]);
  useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(e.target instanceof Node&&!root.current?.contains(e.target))setOpen(false);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);};},[open]);
  async function mark(item?:Notice){if(busy)return;setBusy(true);setError('');generation.current++;try{const response=await fetch('/api/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'read',...(item?{id:item.id}:{})})});if(!response.ok)throw new Error('标记已读失败，请重试。');setData(current=>({...current,unread:item?Math.max(0,current.unread-(item.readAt?0:1)):0,items:current.items.map(n=>!item||n.id===item.id?{...n,readAt:n.readAt||Date.now()}:n)}));if(item){setOpen(false);const href=item.href.startsWith('/')&&!item.href.startsWith('//')?item.href:'/settings/notifications';router.push(href);}router.refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div ref={root} className={styles.root}>
    <button ref={trigger} type="button" className={`${styles.trigger} ${data.unread?styles.unread:''}`} aria-label={data.unread?`通知，${data.unread} 条未读`:"通知，无未读消息"} aria-expanded={open} aria-controls={id} onClick={()=>{setOpen(value=>!value);if(!open)void refresh();}}><Bell size={21}/>{data.unread>0&&<span className={styles.badge} aria-hidden="true">{data.unread>99?'99+':data.unread}</span>}</button>
    {open&&<section id={id} className={styles.panel} aria-label="通知菜单"><header><div><h2>通知</h2><p>{data.unread} 条未读 · 共 {data.total} 条</p></div><button type="button" disabled={busy||!data.unread} onClick={()=>void mark()}><CheckCheck size={14}/>全部已读</button></header>
      {error&&<div className={styles.error} role="status">{error}<button type="button" onClick={()=>void refresh()}><RefreshCw size={13}/>重试</button></div>}
      <div className={styles.list}>{data.items.slice(0,8).map(item=><button type="button" key={item.id} disabled={busy} className={`${styles.item} ${!item.readAt?styles.newItem:''}`} onClick={()=>void mark(item)}><span className={styles.title}>{!item.readAt&&<i aria-label="未读"/>}{item.title}</span><span className={styles.message}>{item.message}</span><time dateTime={new Date(item.createdAt).toISOString()}>{new Date(item.createdAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time></button>)}{!data.items.length&&<div className={styles.empty}><Bell size={24}/><p>暂无通知</p><span>组队邀请和申请结果会显示在这里。</span></div>}</div>
      <footer><span>{busy?<><Loader2 size={13} className={styles.spinner}/>正在更新…</>:'点击消息查看详情并标记已读'}</span><Link href="/settings/notifications" onClick={()=>setOpen(false)}>查看全部通知 →</Link></footer>
    </section>}
  </div>;
}
