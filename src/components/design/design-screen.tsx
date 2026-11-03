"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Info, X } from "lucide-react";
import { screenAction } from "./actions";

type Notice = { title: string; message: string; login?: boolean };
export function DesignScreen({ name, html, loggedIn }: { name: string; html: string; loggedIn: boolean }) {
  const root=useRef<HTMLDivElement>(null);
  const markup = useMemo(() => <div dangerouslySetInnerHTML={{__html:html}} />, [html]);
  const router=useRouter();
  const [notice,setNotice]=useState<Notice|null>(null);
  const step=useRef(1);
  const loginMethod=useRef("password");
  const loginPending=useRef(false);
  const publishedId=useRef("");
  const publishedDraft=useRef({title:"",roles:""});
  const posterVisible=useRef(false);
  useEffect(()=>{
    if (!posterVisible.current) return;
    const poster=root.current?.querySelector("#poster-modal");poster?.classList.remove("hidden");poster?.setAttribute("role","dialog");
    const title=root.current?.querySelector("#poster-proj-title");if(title)title.textContent=publishedDraft.current.title;
  },[html,notice]);
  useEffect(()=>{
    const query=new URLSearchParams(location.search);
    if(name==="teams"&&query.get("create")==="1"&&loggedIn){
      const el=root.current?.querySelector("#creator-modal");el?.classList.remove("hidden");el?.setAttribute("role","dialog");
    }
    if(name==="competitions"&&query.get("q")){
      const input=root.current?.querySelector<HTMLInputElement>('[data-competition-search]');
      if(input){input.value=query.get("q")||"";input.dispatchEvent(new Event("input",{bubbles:true}));}
    }
  },[name,loggedIn]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(null),notice.login?7000:5000);return()=>clearTimeout(timer);},[notice]);
  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")root.current?.querySelectorAll('[role="dialog"],#creator-modal,#ai-synergy-modal,#demo-modal,#poster-modal').forEach(el=>el.classList.add("hidden"));};document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey);},[]);
  const toast=(message:string,title="操作提示",login=false)=>setNotice({title,message,login});
  const guard=()=>{if(loggedIn)return true;toast("登录后即可使用此功能，登录成功后可返回当前页面。","需要登录",true);return false;};
  const modal=(id:string,open:boolean)=>{const el=root.current?.querySelector("#"+id);if(el){el.classList.toggle("hidden",!open);el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");if(open)(el.querySelector('button,input') as HTMLElement|null)?.focus();}};
  const value=(id:string)=>(root.current?.querySelector("#"+id) as HTMLInputElement|HTMLTextAreaElement|null)?.value||"";
  const setValue=(id:string,text:string)=>{const el=root.current?.querySelector("#"+id) as HTMLInputElement|HTMLTextAreaElement|null;if(el)el.value=text;};
  const updateStep=(next:number)=>{
    step.current=next;
    for(let i=1;i<=3;i++){
      root.current?.querySelector("#step-content-"+i)?.classList.toggle("hidden",i!==next);
      const tab=root.current?.querySelector("#step-tab-"+i);if(tab){tab.classList.remove("text-on-surface-variant", "bg-surface-container-high");tab.classList.toggle("bg-primary",i===next);tab.classList.toggle("text-on-primary",i===next);tab.classList.toggle("bg-surface-container",i!==next);}
    }
    root.current?.querySelector("#wizard-prev-btn")?.classList.toggle("hidden",next===1);
    root.current?.querySelector("#wizard-next-btn")?.classList.toggle("hidden",next===3);
    root.current?.querySelector("#wizard-publish-btn")?.classList.toggle("hidden",next!==3);
  };
  const run=async(action:string,data:Record<string,string>={},button?:HTMLButtonElement)=>{
    if(!guard())return null;
    if(button)button.disabled=true;
    try{const result=await screenAction(action,data);toast(result.message,result.ok?"操作成功":"操作未完成",!!result.href);return result;}
    catch{toast("请求未完成，请稍后重试。","连接失败");return null;}
    finally{if(button)button.disabled=false;}
  };
  const filterCompetitions=()=>{
    const scope=root.current;if(!scope)return;
    const q=(scope.querySelector('[data-competition-search]') as HTMLInputElement|null)?.value.toLowerCase()||"";
    const platformInputs=Array.from(scope.querySelectorAll<HTMLInputElement>('[data-platform-filter]'));
    const platforms=platformInputs.filter(i=>i.checked).map(i=>i.dataset.platformFilter);
    const state=scope.querySelector<HTMLInputElement>('[data-status-filter]:checked')?.dataset.statusFilter || "";
    let count=0;
    scope.querySelectorAll<HTMLElement>('[data-competition-id]').forEach(el=>{
      const visible=!!el.textContent?.toLowerCase().includes(q) && (!platformInputs.length||platforms.includes(el.dataset.platform)) && (!state||el.dataset.status===state);
      el.classList.toggle("hidden",!visible);if(visible)count++;
    });
    const heading=scope.querySelector('[data-results-heading]');if(heading)heading.textContent="赛事列表 · 共匹配 "+count+" 项赛事";
  };
  const filterTeams=()=>{
    const scope=root.current;if(!scope)return;
    const active=Array.from(scope.querySelectorAll('.role-chip[data-selected="true"],.filter-pill[data-selected="true"]')).map(el=>el.textContent?.trim()||"");
    scope.querySelectorAll<HTMLElement>('[data-project-id]').forEach(el=>{if(el.tagName==="BUTTON")return;const text=el.textContent||"";el.classList.toggle("hidden",active.some(tag=>tag!=="全部赛事"&&!text.includes(tag)));});
  };
  async function onAuthSubmit(event: React.FormEvent<HTMLDivElement>) {
    const form = event.target as HTMLFormElement;
    if(form.id!=="authForm")return;
    event.preventDefault();
    if(loginPending.current)return;
    if(loginMethod.current!=="password"){toast("验证码服务尚未接入，请使用账号密码登录。","暂不可用");return;}
    const data=new FormData(form);
    const principal=String(data.get("principal")||"").trim();
    const password=String(data.get("password")||"");
    if(!principal||!password){toast("请填写账号和登录密码。","信息不完整");return;}
    const button=form.querySelector<HTMLButtonElement>('#btnSubmit');
    loginPending.current=true;if(button)button.disabled=true;
    try {
      const result=await signIn("credentials",{email:principal,password,redirect:false});
      if(!result?.ok||result.error){toast("账号或密码不正确，请重新输入。","登录失败");return;}
      const next=new URLSearchParams(location.search).get("next");
      const destination=next?.startsWith("/")&&!next.startsWith("//")?next:"/dashboard";
      router.push(destination);router.refresh();
    } catch {toast("登录服务暂时不可用，请稍后重试。","登录失败");}
    finally {loginPending.current=false;if(button)button.disabled=false;}
  }
  async function onClick(event:React.MouseEvent<HTMLDivElement>){
    const raw=event.target as Element;
    const el=raw.closest<HTMLElement>('button,a,[data-route],[data-action],[data-competition-id]');if(!el||!root.current?.contains(el))return;
    const button=el.tagName==="BUTTON"?el as HTMLButtonElement:undefined;
    const id=el.id;const action=el.dataset.action;
    if(id==="btnSubmit")return;
    const label=el.textContent?.replace(/\s+/g," ").trim()||"";
    const route=el.dataset.route;
    if(route){event.preventDefault();if(["/profile","/teams/create","/projects","/dashboard"].some(p=>route.startsWith(p))&&!guard())return;router.push(route.startsWith("/teams/create")?"/teams?create=1":route);return;}
    if(el.tagName==="A"){
      const href=el.getAttribute("href")||"";
      if(href.startsWith("/")){event.preventDefault();if(href.startsWith("/teams/create")&&!guard())return;router.push(href.startsWith("/teams/create")?"/teams?create=1":href);return;}
      if(href==="#")event.preventDefault();
    }
    if(action==="toggle-password"){
      const input=root.current.querySelector<HTMLInputElement>('#passwordInput');
      if(input){const visible=input.type==="password";input.type=visible?"text":"password";el.setAttribute("aria-label",visible?"隐藏密码":"显示密码");el.setAttribute("aria-pressed",String(visible));}
      return;
    }
    if(action==="auth-password"||action==="auth-sms"){
      const sms=action==="auth-sms";loginMethod.current=sms?"sms":"password";
      root.current.querySelector('#passwordFieldGroup')?.classList.toggle("hidden",sms);
      root.current.querySelector('#smsFieldGroup')?.classList.toggle("hidden",!sms);
      const pwd=root.current.querySelector<HTMLInputElement>('#passwordInput');if(pwd){pwd.disabled=sms;pwd.required=!sms;}
      const code=root.current.querySelector<HTMLInputElement>('#smsInput');if(code)code.disabled=!sms;
      for(const [id,active] of [["btnMethodPwd",!sms],["btnMethodSms",sms]] as const){const tab=root.current.querySelector('#'+id);tab?.classList.toggle("text-primary",active);tab?.classList.toggle("text-on-surface-variant",!active);}
      return;
    }
    if(action==="auth-unavailable"){event.preventDefault();toast("此认证服务尚未配置，请使用已注册的账号密码登录。","暂不可用");return;}
    if(id==="open-ai-match-btn"){if(guard())modal("ai-synergy-modal",true);return;}
    if(id==="open-creator-btn"){if(guard()){updateStep(1);modal("creator-modal",true);}return;}
    if(["close-ai-synergy","close-ai-synergy-action","close-creator-btn","close-poster-btn"].includes(id)){modal(id.includes("synergy")?"ai-synergy-modal":id.includes("poster")?"poster-modal":"creator-modal",false);if(id==="close-poster-btn"){posterVisible.current=false;router.refresh();}return;}
    if(id==="fill-example-idea"){setValue("idea-input-field","我们想做一个面向大学生的 AI 项目搭档，帮助发现比赛、找到队友并推进项目。");return;}
    if(id==="wizard-prev-btn"){updateStep(Math.max(1,step.current-1));return;}
    if(id==="reset-ai-gen"){updateStep(2);return;}
    if(id==="wizard-next-btn"){
      if(step.current===1){updateStep(2);return;}
      const idea=value("idea-input-field").trim();if(idea.length<5){toast("请用至少5个字描述你的项目想法。","补充项目想法");return;}
      setValue("ai-project-name",idea.slice(0,30));setValue("ai-tech-stack","Next.js + TypeScript + SQLite + AI");setValue("ai-team-roles","前端开发 1人 / 后端与 AI 工程师 1人");setValue("ai-project-desc",idea);updateStep(3);toast("已根据想法整理可编辑的招募草稿，当前使用本地规则。","草稿已生成");return;
    }
    if(id==="wizard-publish-btn"){
      publishedDraft.current={title:value("ai-project-name"),roles:value("ai-team-roles")};
      const selected=root.current?.querySelector<HTMLInputElement>('input[name="track-type"]:checked');
      const result=await run("publish",{title:value("ai-project-name"),description:value("ai-project-desc"),roles:value("ai-team-roles"),competitionId:value("creator-comp-select"),trackName:selected?.value||"自拟应用赛道"},button);
      if(result?.ok){posterVisible.current=true;publishedId.current=result.id||"";modal("creator-modal",false);const title=root.current?.querySelector('#poster-proj-title');if(title)title.textContent=publishedDraft.current.title;modal("poster-modal",true);}return;
    }
    if(id==="copy-poster-link-btn"){try{await navigator.clipboard.writeText(location.origin+"/teams#project-"+publishedId.current);toast("真实项目链接已复制。","复制成功");}catch{toast("无法访问剪贴板，请手动复制地址栏。","复制未完成");}return;}
    if(id==="download-poster-btn"){
      const title=(publishedDraft.current.title||value("ai-project-name")).replace(/[&<>]/g,"");const roles=(publishedDraft.current.roles||value("ai-team-roles")).replace(/[&<>]/g,"");
      const svg='<svg xmlns="http://www.w3.org/2000/svg" width="900" height="520"><rect width="900" height="520" rx="24" fill="#3525cd"/><text x="60" y="90" font-size="30" fill="white">ProjectMate · 招募搭档</text><text x="60" y="200" font-size="30" fill="white">'+title.slice(0,24)+'</text><text x="60" y="300" font-size="22" fill="white">'+roles.slice(0,36)+'</text><text x="60" y="430" font-size="20" fill="white">'+location.origin+'/teams</text></svg>';
      const url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"}));const a=document.createElement("a");a.href=url;a.download="项目招募海报.svg";a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast("招募海报已生成。","下载已开始");return;
    }
    if(action==="open-demo"){modal("demo-modal",true);return;}
    if(action==="close-demo"){modal("demo-modal",false);return;}
    if(action==="access-details"){root.current.querySelector('[data-access-details]')?.scrollIntoView({behavior:"smooth"});return;}
    if(action==="favorite"){
      const key=el.dataset.favoriteKey||el.closest('article,[data-competition-id]')?.querySelector('h3')?.textContent||"selected-track";
      const result=await run("favorite",{key},button);if(result?.ok)el.classList.toggle("text-error");return;
    }
    if(action==="apply"||el.classList.contains("apply-team-btn")){const card=el.closest<HTMLElement>('[data-project-id]');await run("apply",{projectId:el.dataset.projectId||card?.dataset.projectId||"design-sample"},button);return;}
    if(action==="team-details"||el.classList.contains("view-detail-btn")){toast(el.closest('[data-project-id]')?.querySelector('h3')?.textContent||"此卡片为设计示例，发布真实项目后可申请加入。","项目详情");return;}
    if(action==="coach"||id==="btn-apply-suggestion"){
      if(id==="btn-apply-suggestion"){toast("此处排期是设计示例，请在任务看板选择具体任务后修改；未自动更改任务。","请确认具体调整");router.push("/projects/tasks");return;}
      const input=root.current.querySelector<HTMLInputElement>('[data-coach-input]');
      const result=await run("coach",{prompt:input?.value||"请评估当前任务风险"},button);
      if(result?.ok){router.refresh();if(input)input.value="";}return;
    }
    if(action==="apply-advice"){toast("请在任务看板选择具体任务进行调整，当前建议不会自动修改数据。","排期建议");router.push("/projects/tasks");return;}
    if(action==="dismiss-advice"||id==="btn-dismiss-suggestion"){const card=root.current.querySelector<HTMLElement>('#ai-suggestion-card');if(card)card.style.opacity="0.55";toast("已忽略当前建议。","建议已忽略");return;}
    if(action==="reset-filters"){root.current.querySelectorAll<HTMLInputElement>('input[type="checkbox"],input[type="radio"]').forEach(i=>i.checked=i.hasAttribute("data-platform-filter"));const i=root.current.querySelector<HTMLInputElement>('[data-competition-search]');if(i)i.value="";filterCompetitions();return;}
    if(action==="select-competition"||el.dataset.competitionId){
      const card=el.closest<HTMLElement>('[data-competition-id]')||el;
      const h=root.current.querySelector('[data-selected-competition-title]');if(h)h.textContent=(card.querySelector('h3')?.textContent||"")+" · 赛道详情";
      root.current.querySelectorAll('[data-competition-id]').forEach(c=>c.classList.remove('ring-2','ring-primary'));card.classList.add('ring-2','ring-primary');return;
    }
    if(el.classList.contains('filter-pill')||el.classList.contains('role-chip')){el.dataset.selected=el.dataset.selected==="true"?"false":"true";el.classList.toggle('bg-primary');el.classList.toggle('text-on-primary');filterTeams();return;}
    if(el.closest('#filter-tabs')){el.parentElement?.querySelectorAll('button').forEach(b=>b.classList.remove('bg-primary','text-on-primary'));el.classList.add('bg-primary','text-on-primary');if(/收藏/.test(label)&&!guard())return;toast("当前展示已收录赛事；个性化推荐仍在完善。","赛事列表");return;}
    if(/新建任务|任务看板|更新任务看板/.test(label)){router.push("/projects/tasks");return;}
    if(/导出项目报告/.test(label)){router.push("/projects/tasks");return;}
    if(action==="unavailable"||button){toast("此功能尚在完善中，当前操作未修改数据。","功能说明");}
  }
  return <div className="design-screen" data-screen={name}>
    <div ref={root} onSubmit={onAuthSubmit} onClick={onClick} onInput={filterCompetitions} onChange={filterCompetitions} onKeyDown={event=>{const el=event.target as HTMLElement;if(event.key==="Enter"&&el.hasAttribute('data-global-search')){router.push('/competitions?q='+encodeURIComponent((el as HTMLInputElement).value));}}} >{markup}</div>
    {notice&&<div className="fixed top-20 right-6 z-[100] w-80 max-w-[calc(100vw-2rem)] flex gap-3 p-4 bg-white rounded-xl shadow-xl border-l-4 border-primary" role="status" aria-live="polite"><Info className="text-primary shrink-0" size={20}/><div className="flex-1"><p className="text-label-md font-semibold">{notice.title}</p><p className="text-body-sm text-on-surface-variant mt-1">{notice.message}</p>{notice.login&&<a href="/login" className="inline-block text-label-sm text-primary mt-2 font-bold">去登录 →</a>}</div><button aria-label="关闭通知" onClick={()=>setNotice(null)}><X size={16}/></button></div>}
  </div>;
}
