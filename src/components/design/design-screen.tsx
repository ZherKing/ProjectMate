"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { Info, X } from "lucide-react";
import { screenAction } from "./actions";
import { useSettingsEditor } from "./use-settings-editor";
import { useAdminWorkspace } from "./use-admin-workspace";
import { AccountSettingsWorkspace } from "@/components/settings/account-settings-workspace";
import { LoginFactorDialog,LoginRecoveryDialog,type LoginChallenge } from "@/components/settings/login-dialogs";
import { accountApi,renewSession } from "@/components/settings/common";
import { ProjectWorkspaceSettings } from "./project-workspace-settings";
import { DesignNoticeContext } from "./design-notice-context";

type Notice = { title: string; message: string; login?: boolean };
function setAiLoading(target: HTMLElement | null, active: boolean) {
  if (!target) return;
  if (!active) { target.removeAttribute("data-ai-loading"); return; }
  target.dataset.aiLoading = "true";
  target.setAttribute("aria-live", "polite");
  target.innerHTML = '<span>AI 分析中</span><span class="pm-ai-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
}
async function revealText(target: HTMLElement | null, value: string) {
  if (!target) return;
  target.removeAttribute("data-ai-loading");
  target.textContent = "";
  const scrollBox = target.closest<HTMLElement>(".pm-ai-copy-scroll");
  for (const char of Array.from(value)) {
    target.append(char);
    if (scrollBox) scrollBox.scrollTop = scrollBox.scrollHeight;
    await new Promise((resolve) => setTimeout(resolve, 12));
  }
}
export function DesignScreen({ name, html, loggedIn, variant, taskBoard, workspaceProjectId, settingsSection }: { name: string; html: string; loggedIn: boolean; variant?: "register"; taskBoard?: ReactNode; workspaceProjectId?: string | null; settingsSection?: string }) {
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{const screen=root.current?.closest<HTMLElement>(".design-screen");if(screen)screen.dataset.interactive="true";return()=>{if(screen)delete screen.dataset.interactive;};},[]);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [loginChallenge,setLoginChallenge]=useState<LoginChallenge|null>(null);
  const [loginRecovery,setLoginRecovery]=useState(false);
  const githubHandled=useRef(false);
  const [accountSlot,setAccountSlot]=useState<HTMLElement|null>(null);
  const reportPending=useRef(false);
  const [taskSlot,setTaskSlot]=useState<HTMLElement|null>(null);
  useEffect(()=>{setTaskSlot(root.current?.querySelector<HTMLElement>("[data-todo-slot]")||null);setAccountSlot(root.current?.querySelector<HTMLElement>("[data-settings-workspace]")||null);},[html]);
  const detailCloseTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const competitionFilterTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(detailCloseTimer.current)clearTimeout(detailCloseTimer.current);if(competitionFilterTimer.current)clearTimeout(competitionFilterTimer.current);},[]);
  const markup = useMemo(() => <div dangerouslySetInnerHTML={{__html:html}} />, [html]);
  const router=useRouter();
  const taskRoute=()=>{const projectId=root.current?.querySelector<HTMLElement>("[data-workspace-project-id]")?.dataset.workspaceProjectId;return "/projects/tasks"+(projectId?"?project="+encodeURIComponent(projectId):"");};
  const [notice,setNotice]=useState<Notice|null>(null);
  const [noticeClosing,setNoticeClosing]=useState(false);
  useEffect(()=>{if(name!=="login"||githubHandled.current)return;const query=new URLSearchParams(location.search);if(query.get("account")==="deleted")setNotice({title:"账号已注销",message:"当前账号已关闭，个人登录凭据已失效。"});if(query.get("githubError")){githubHandled.current=true;setNotice({title:"GitHub登录未完成",message:query.get("githubError")==="not_configured"?"管理员尚未配置GitHub OAuth。":query.get("githubError")==="not_linked"?"请先使用站内账号登录，并在个人设置绑定GitHub。":"授权被取消、过期或未完成，请重新开始。"});return;}if(query.get("github")!=="ready")return;githubHandled.current=true;(async()=>{try{const state=await accountApi("/api/settings/github/login");if(state.needsFactor){setLoginChallenge({kind:"github"});return;}const result=await accountApi("/api/settings/github/login",{});await renewSession(result.ticket);finishLogin();}catch(e){setNotice({title:"GitHub登录未完成",message:(e as Error).message});}})();},[name]);
  const step=useRef(1);
  const loginMethod=useRef("password");
  const loginPending=useRef(false);
  const loginReturnTo=useRef<string|null>(null);
  const publishedId=useRef("");
  const publishedDraft=useRef({title:"",roles:""});
  const posterVisible=useRef(false);
  const showRouteTransition=()=>{
    document.getElementById("pm-route-transition")?.remove();
    const overlay=document.createElement("div");overlay.id="pm-route-transition";overlay.setAttribute("role","status");overlay.setAttribute("aria-label","正在打开组队项目");overlay.innerHTML='<div class="pm-route-transition-card"><span class="pm-route-spinner" aria-hidden="true"></span><span>正在打开发布组队项目…</span></div>';document.body.append(overlay);
  };
  useEffect(()=>()=>{document.getElementById("pm-route-transition")?.remove();},[]);
  useEffect(()=>{
    if (!posterVisible.current) return;
    const poster=root.current?.querySelector("#poster-modal");poster?.classList.remove("hidden");poster?.setAttribute("role","dialog");
    const title=root.current?.querySelector("#poster-proj-title");if(title)title.textContent=publishedDraft.current.title;
  },[html,notice]);
  useEffect(()=>{
    const query=new URLSearchParams(location.search);
    if(name==="teams"&&query.get("create")==="1"&&loggedIn){
      const el=root.current?.querySelector<HTMLElement>("#creator-modal");el?.classList.remove("hidden");el?.querySelector<HTMLElement>("#creator-modal-card")?.classList.remove("hidden");el?.setAttribute("role","dialog");
    }
    if(name!=="competitions"&&name!=="favorites")return;
    const restore=()=>{
      const params=new URLSearchParams(location.search);
      const scope=root.current;if(!scope)return;
      const input=scope.querySelector<HTMLInputElement>('[data-competition-search]');
      if(input)input.value=params.get("q")||"";
      const platforms=params.getAll("platform");
      scope.querySelectorAll<HTMLInputElement>('[data-platform-filter]').forEach(i=>i.checked=platforms.length?platforms.includes(i.dataset.platformFilter||""):true);
      const status=params.get("status")||"";
      scope.querySelectorAll<HTMLInputElement>('[data-status-filter]').forEach(i=>i.checked=i.dataset.statusFilter===status);
      const sort=params.get("sort")||"default";
      scope.dataset.competitionPage=params.get("page")||"1";
      scope.dataset.favoritesMode=name==="favorites"&&params.get("tab")!=="recommendations"||params.get("tab")==="favorites"?"true":"false";
      scope.dataset.recommendationsMode=(params.get("tab")==="recommendations"||scope.querySelector('[data-design-main][data-recommendations-mode="true"]')!==null)?"true":"false";
      scope.querySelectorAll<HTMLElement>('[data-sort-filter]').forEach(i=>{
        const on=i.dataset.sortFilter===sort;i.dataset.selected=String(on);
        i.classList.toggle("bg-surface-container-lowest",on);i.classList.toggle("text-primary",on);i.classList.toggle("font-semibold",on);
      });
      const heading=scope.querySelector("h1");if(heading)heading.textContent=scope.dataset.favoritesMode==="true"?"我的赛事收藏":scope.dataset.recommendationsMode==="true"?"AI 推荐赛事":"发现比赛";
      filterCompetitions(false);
    };
    restore();window.addEventListener("popstate",restore);
    return()=>window.removeEventListener("popstate",restore);
  },[name,loggedIn,html]);
  useEffect(()=>{
    if(!notice)return;
    setNoticeClosing(false);
    const duration=notice.login?1200:5000;
    const closeTimer=setTimeout(()=>setNoticeClosing(true),duration);
    const removeTimer=setTimeout(()=>{
      if(notice.login){
        const next=loginReturnTo.current||location.pathname+location.search;
        loginReturnTo.current=null;
        router.push("/login?next="+encodeURIComponent(next));
      } else setNotice(null);
    },duration+220);
    return()=>{clearTimeout(closeTimer);clearTimeout(removeTimer);};
  },[notice,router]);
  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")root.current?.querySelectorAll('[role="dialog"]:not(#competition-detail-modal-card):not(#creator-modal):not(#creator-modal-card):not(#team-detail-modal-card),#ai-synergy-modal,#demo-modal,#poster-modal,#team-detail-modal').forEach(el=>el.classList.add("hidden"));};document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey);},[]);
  useEffect(()=>{
    const header=root.current?.querySelector<HTMLElement>('[data-design-header]');
    if(!header)return;
    const onScroll=()=>header.classList.toggle("is-scrolled",window.scrollY>12);
    onScroll();window.addEventListener("scroll",onScroll,{passive:true});
    return()=>window.removeEventListener("scroll",onScroll);
  },[]);
  const toast=(message:string,title="操作提示",login=false)=>setNotice({title,message,login});
  useSettingsEditor(root,name==="settings",html,toast);
  useAdminWorkspace(root,name==="admin",html,toast);
  const guard=(returnTo?:string)=>{if(loggedIn)return true;loginReturnTo.current=returnTo||location.pathname+location.search;toast("正在前往登录页面，登录后可继续当前操作。","需要登录",true);return false;};
  const modal=(id:string,open:boolean)=>{const el=root.current?.querySelector<HTMLElement>("#"+id);if(el){if(!open&&id==="creator-modal"&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){el.querySelector<HTMLElement>("#creator-modal-card")?.classList.add("pm-team-modal-closing");setTimeout(()=>{el.classList.add("hidden");el.querySelector<HTMLElement>("#creator-modal-card")?.classList.remove("pm-team-modal-closing");},180);}else{el.classList.toggle("hidden",!open);el.querySelector<HTMLElement>("#creator-modal-card")?.classList.toggle("hidden",!open);}el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");if(open)(el.querySelector('button,input') as HTMLElement|null)?.focus();}};
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
  const run=async(action:string,data:Record<string,string>={},button?:HTMLButtonElement,silent=false)=>{
    if(!guard())return null;
    if(button)button.disabled=true;
    try{const result=await screenAction(action,data);const loginRedirect=typeof result.href==="string"&&result.href.startsWith("/login");if(!silent)toast(result.message,result.ok?"操作成功":"操作未完成",loginRedirect);return result;}
    catch{if(!silent)toast("请求未完成，请稍后重试。","连接失败");return null;}
    finally{if(button)button.disabled=false;}
  };
  const filterCompetitions=(syncUrl=true)=>{
    const scope=root.current;if((name!=="competitions"&&name!=="favorites")||!scope)return;
    const q=scope.querySelector<HTMLInputElement>('[data-competition-search]')?.value.trim()||"";
    const terms=q.normalize("NFKC").toLowerCase().split(/\s+/).filter(Boolean);
    const inputs=[...scope.querySelectorAll<HTMLInputElement>('[data-platform-filter]')];
    const platforms=inputs.filter(i=>i.checked).map(i=>i.dataset.platformFilter||"");
    const status=scope.querySelector<HTMLInputElement>('[data-status-filter]:checked')?.dataset.statusFilter||"";
    const cards=[...scope.querySelectorAll<HTMLElement>('[data-competition-card]')];
    const favoritesMode=scope.dataset.favoritesMode==="true";
    const recommendationsMode=scope.dataset.recommendationsMode==="true";
    const matched=cards.filter(card=>{const text=(card.dataset.searchText||"").normalize("NFKC").toLowerCase();return (!favoritesMode||card.dataset.favorite==="true")&&(!recommendationsMode||card.dataset.recommended==="true")&&terms.every(term=>text.includes(term))&&platforms.includes(card.dataset.platform||"")&&(!status||card.dataset.status===status);});
    const sort=scope.querySelector<HTMLElement>('[data-sort-filter][data-selected="true"]')?.dataset.sortFilter||"default";
    const deadline=(card:HTMLElement)=>card.dataset.deadline?Number(card.dataset.deadline):Infinity;
    matched.sort((a,b)=>sort==="name"?(a.querySelector("h3")?.textContent||"").localeCompare(b.querySelector("h3")?.textContent||"","zh-CN"):sort==="updated"?Number(b.dataset.updatedAt)-Number(a.dataset.updatedAt):sort==="deadline"?(deadline(a)-deadline(b)||Number(a.dataset.defaultOrder)-Number(b.dataset.defaultOrder)):Number(a.dataset.defaultOrder)-Number(b.dataset.defaultOrder));
    const parent=cards[0]?.parentElement;
    if(parent&&matched.some((card,index)=>parent.children[index]!==card))matched.forEach(card=>parent.append(card));
    const pageSize=6;const totalPages=Math.max(1,Math.ceil(matched.length/pageSize));let page=syncUrl?1:Math.min(Math.max(Number(scope.dataset.competitionPage||1),1),totalPages);scope.dataset.competitionPage=String(page);
    const visible=new Set(matched.slice((page-1)*pageSize,page*pageSize));cards.forEach(card=>card.classList.toggle("hidden",!visible.has(card)));
    const heading=scope.querySelector('[data-results-heading]');if(heading)heading.textContent="共匹配 "+matched.length+" 项赛事";
    scope.querySelector('[data-no-competitions]')?.classList.toggle("hidden",matched.length>0);
    const pagination=scope.querySelector<HTMLElement>('[data-pagination]');if(pagination){const label=pagination.querySelector('[data-page-label]');if(label)label.textContent=`第 ${page} / ${totalPages} 页`;const prev=pagination.querySelector<HTMLButtonElement>('[data-page-prev]');const next=pagination.querySelector<HTMLButtonElement>('[data-page-next]');if(prev)prev.disabled=page<=1;if(next)next.disabled=page>=totalPages;}
    if(syncUrl){
      const params=new URLSearchParams(location.search);
      for(const key of ["q","platform","status","track","sort","page"])params.delete(key);
      if(q)params.set("q",q);
      if(!platforms.length)params.append("platform","__none__");
      else if(platforms.length!==inputs.length)platforms.forEach(item=>params.append("platform",item));
      if(status)params.set("status",status);
      if(sort!=="default")params.set("sort",sort);
      const query=params.toString();window.history.replaceState(window.history.state,"",location.pathname+(query?"?"+query:"")+location.hash);
    }
  };
  const renderTrackPage=(modalCard:HTMLElement, tracks:Array<{name:string;description:string|null;deadline:number|null;analysis?:{analysis:string;generatedAt:number;model:string}|null}>, buttons:HTMLButtonElement[], page:number)=>{
    const totalPages=Math.max(1,Math.ceil(tracks.length/3));
    const safePage=Math.min(Math.max(page,0),totalPages-1);
    modalCard.dataset.trackPage=String(safePage);
    buttons.forEach((button,index)=>{
      const trackIndex=Number(button.dataset.trackIndex ?? index);
      button.classList.toggle("hidden",trackIndex<safePage*3||trackIndex>=(safePage+1)*3||trackIndex>=tracks.length);
      const active=trackIndex===Number(modalCard.dataset.selectedTrackIndex||0);
      button.setAttribute("aria-selected",String(active));
      button.classList.toggle("bg-surface-container-high",active);button.classList.toggle("bg-surface-container-low",!active);button.classList.toggle("shadow-sm",active);
      const header=button.querySelector("div.flex.items-center.justify-between");const spans=header?.querySelectorAll("span");
      if(spans?.[1]){spans[1].textContent=active?"当前选中":"可切换";spans[1].classList.toggle("text-primary-container",active);spans[1].classList.toggle("text-on-surface-variant",!active);}
      if(spans?.[0]){spans[0].classList.toggle("bg-primary-container",active);spans[0].classList.toggle("text-on-primary",active);spans[0].classList.toggle("bg-surface-variant",!active);spans[0].classList.toggle("text-on-surface-variant",!active);}
    });
    const label=modalCard.querySelector<HTMLElement>("[data-track-page-label]");if(label)label.textContent=`第 ${safePage+1} / ${totalPages} 页`;
    const prev=modalCard.querySelector<HTMLButtonElement>("[data-action='track-page-prev']");if(prev)prev.disabled=safePage<=0;
    const next=modalCard.querySelector<HTMLButtonElement>("[data-action='track-page-next']");if(next)next.disabled=safePage>=totalPages-1;
  };
  const syncCompetitionTabs=(scope:HTMLElement, selected:HTMLElement)=>{
    scope.querySelectorAll<HTMLButtonElement>('#filter-tabs button').forEach(button=>{
      const active=button===selected;button.dataset.selected=String(active);button.classList.toggle('bg-primary',active);button.classList.toggle('text-on-primary',active);button.classList.toggle('shadow-sm',active);button.classList.toggle('text-on-surface-variant',!active);button.classList.toggle('hover:text-on-surface',!active);button.classList.toggle('hover:bg-surface-container-low',!active);
      const badge=button.querySelector<HTMLElement>('span:last-child');if(badge){badge.classList.toggle('bg-on-primary/20',active);badge.classList.toggle('text-on-primary',active);badge.classList.toggle('bg-surface-container-high',!active);badge.classList.toggle('text-on-surface-variant',!active);}
      button.querySelectorAll('svg').forEach(svg=>{svg.classList.toggle('text-on-primary',active);svg.classList.toggle('text-primary',!active);});
    });
  };
  const filterTeams=()=>{
    const scope=root.current;if(!scope)return;
    const active=Array.from(scope.querySelectorAll('.role-chip[data-selected="true"],.filter-pill[data-selected="true"]')).map(el=>el.textContent?.trim()||"");
    const roleFilters=[...scope.querySelectorAll<HTMLElement>('[data-team-role-filter][data-selected="true"]')].map(el=>el.dataset.teamRoleFilter||"");
    const trackFilters=[...scope.querySelectorAll<HTMLElement>('[data-team-track-filter][data-selected="true"]')].map(el=>el.dataset.teamTrackFilter||"");
    const hours=scope.querySelector<HTMLElement>('[data-team-hours-filter][data-selected="true"]')?.dataset.teamHoursFilter||"不限";
    const minimumHours=hours.includes("20")?20:hours.includes("10")?10:0;
    const cards=[...scope.querySelectorAll<HTMLElement>('[data-project-card][data-project-id]')];
    let visibleCount=0;
    cards.forEach(el=>{const roles=el.dataset.roles||"";const track=el.dataset.track||"";const weekly=Number(el.dataset.hours||0);const roleOk=!roleFilters.length||roleFilters.some(tag=>roles.includes(tag));const trackOk=!trackFilters.length||trackFilters.some(tag=>track.includes(tag));const hoursOk=weekly>=minimumHours;const visible=roleOk&&trackOk&&hoursOk;el.classList.toggle("hidden",!visible);if(visible)visibleCount++;});
    let empty=scope.querySelector<HTMLElement>("[data-team-filter-empty]");
    if(!empty){empty=document.createElement("p");empty.dataset.teamFilterEmpty="";empty.className="hidden rounded-xl bg-surface-container-low p-5 text-body-md text-on-surface-variant";empty.textContent="没有符合投入时间条件的组队项目。";scope.querySelector("[data-project-card]")?.parentElement?.append(empty);}
    empty.classList.toggle("hidden",visibleCount>0||cards.length===0);
  };
  const refreshPublishCompetition=(select:HTMLSelectElement)=>{
    const modalRoot=select.closest<HTMLElement>('[data-team-create-modal]');const id=select.value;const data=modalRoot?.querySelector<HTMLElement>('#creator-modal-card');if(data)data.dataset.competitionId=id;if(modalRoot)modalRoot.dataset.competitionId=id;
    const option=select.selectedOptions[0];const card=modalRoot?.querySelector<HTMLElement>('[data-section="target-competition"]');if(card&&option){const heading=card.querySelector('h3');if(heading)heading.textContent=option.textContent||"";}
  };
  async function onAuthSubmit(event: React.FormEvent<HTMLDivElement>) {
    const form = event.target as HTMLFormElement;
    if(form.id==="registerForm") {
      event.preventDefault();
      const data = new FormData(form);
      const name = String(data.get("name") || "").trim();
      const email = String(data.get("email") || "").trim().toLowerCase();
      const password = String(data.get("password") || "");
      const passwordConfirm = String(data.get("passwordConfirm") || "");
      if(!name || !email || password.length < 8){toast("请填写昵称、有效邮箱和至少 8 位密码。","信息不完整");return;}
      if(password !== passwordConfirm){toast("两次输入的密码不一致。","注册失败");return;}
      const button=form.querySelector<HTMLButtonElement>("#registerSubmit");if(button)button.disabled=true;
      try {
        const response=await fetch("/api/register",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name,email,password})});
        const result=await response.json() as {ok?:boolean;message?:string};
        if(!response.ok||!result.ok){toast(result.message||"注册未完成，请稍后重试。","注册失败");return;}
        const signed=await signIn("credentials",{email,password,redirect:false});
        if(!signed?.ok||signed.error){toast("账号已创建，请返回登录。","注册完成");return;}
        router.push("/profile");router.refresh();
      } catch {toast("注册服务暂时不可用，请稍后重试。","注册失败");}
      finally {if(button)button.disabled=false;}
      return;
    }
    if(form.id!=="authForm")return;
    event.preventDefault();
    if(loginPending.current)return;
    const data=new FormData(form);
    const principal=String(data.get("principal")||"").trim();
    const password=String(data.get("password")||"");
    if(!principal||loginMethod.current==="password"&&!password){toast("请填写账号和登录密码。","信息不完整");return;}
    const button=form.querySelector<HTMLButtonElement>('#btnSubmit');
    loginPending.current=true;if(button)button.disabled=true;
    try {
      if(loginMethod.current==="sms"){
        const emailCode=root.current?.querySelector<HTMLInputElement>("#smsInput")?.value||"";
        const verified=await accountApi("/api/auth/email",{action:"verify",email:principal,code:emailCode});
        if(verified.needsFactor){setLoginChallenge({kind:"email",challenge:verified.challenge});return;}
        await renewSession(verified.ticket);finishLogin();return;
      }
      const result=await signIn("credentials",{email:principal,password,redirect:false});
      if(result?.code==="two_factor_required"){setLoginChallenge({kind:"password",email:principal,password});return;}
      if(!result?.ok||result.error){toast(result?.code==="rate_limited"?"尝试过于频繁，请稍后再试。":"账号或密码不正确，请重新输入。","登录失败");return;}
      finishLogin();
    } catch(error) {toast(error instanceof Error?error.message:"登录服务暂时不可用，请稍后重试。","登录失败");}
    finally {loginPending.current=false;if(button)button.disabled=false;}
  }
  function finishLogin(){setLoginChallenge(null);setLoginRecovery(false);const next=new URLSearchParams(location.search).get("next");const destination=next?.startsWith("/")&&!next.startsWith("//")&&!/[\\\u0000-\u001f]/.test(next)?next:"/dashboard";router.push(destination);router.refresh();}
  async function exportReport(button?:HTMLButtonElement){
    if(reportPending.current)return;
    const projectId=root.current?.querySelector<HTMLElement>("[data-workspace-project-id]")?.dataset.workspaceProjectId;
    if(!projectId){toast("请先选择可访问的项目。","暂无报告");return;}
    reportPending.current=true;
    const label=button?.querySelector("span"),originalLabel=label?.textContent,originalWidth=button?.style.minWidth||"";
    if(button){button.style.minWidth=button.getBoundingClientRect().width+"px";button.disabled=true;button.setAttribute("aria-busy","true");if(label)label.textContent="导出中…";}
    try{
      const response=await fetch(`/api/projects/${encodeURIComponent(projectId)}/report`,{cache:"no-store"});
      if(!response.ok){const result=await response.json().catch(()=>({message:"报告生成失败，请稍后重试。"}));throw new Error(result.message);}
      const blob=await response.blob();if(!blob.size)throw new Error("报告内容为空，请重试。");
      const encoded=response.headers.get("content-disposition")?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const filename=encoded?decodeURIComponent(encoded):"项目报告.docx";
      const url=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=url;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      toast("报告已生成，正在下载。","导出成功");
    }catch(error){toast(error instanceof Error?error.message:"报告生成失败，请稍后重试。","导出未完成");}
    finally{reportPending.current=false;if(button){button.disabled=false;button.removeAttribute("aria-busy");button.style.minWidth=originalWidth;if(label)label.textContent=originalLabel||"导出项目报告";}}
  }
  async function onClick(event:React.MouseEvent<HTMLDivElement>){
    const raw=event.target as Element;
    const el=raw.closest<HTMLElement>('button,a,[data-route],[data-action],[data-track-filter],[data-competition-id]');if(!el||!root.current?.contains(el))return;
    const button=el.tagName==="BUTTON"?el as HTMLButtonElement:undefined;
    const id=el.id;const action=el.dataset.action;
    if(id==="btnSubmit"||id==="registerSubmit")return;
    if(action==="project-settings"){setSettingsOpen(true);return;}
    if(action==="export-project-report"){await exportReport(button);return;}
    const label=el.textContent?.replace(/\s+/g," ").trim()||"";
    const route=el.dataset.route;
    if(route){event.preventDefault();const destination=route.startsWith("/teams/create")?"/teams?create=1":route;if(["/profile","/teams/create","/projects","/dashboard","/settings","/competitions/detail","/competitions/favorites"].some(p=>route.startsWith(p))&&!guard(destination))return;router.push(destination);return;}
    if(el.tagName==="A"){
      const href=el.getAttribute("href")||"";
      if(href.startsWith("/")){event.preventDefault();const destination=href.startsWith("/teams/create")?"/teams?create=1":href;if(href.startsWith("/teams/create")&&!guard(destination))return;router.push(destination);return;}
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
    if(action==="auth-github"){event.preventDefault();window.location.assign("/api/auth/github?next="+encodeURIComponent(new URLSearchParams(location.search).get("next")||"/dashboard"));return;}
    if(action==="auth-email-send"){event.preventDefault();const email=root.current.querySelector<HTMLInputElement>("#principalInput")?.value.trim()||"";if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast("请填写已注册的登录邮箱。","信息不完整");return;}if(button)button.disabled=true;try{const result=await accountApi("/api/auth/email",{action:"send",email});toast(result.message,"验证码请求完成");}catch(e){toast((e as Error).message,"发送未完成");}finally{if(button)button.disabled=false;}return;}
    if(action==="auth-forgot"){event.preventDefault();root.current.querySelector<HTMLButtonElement>("#btnMethodSms")?.click();toast("可使用登录邮箱验证码和已启用的两步验证登录，再到个人设置更新密码。","找回密码");return;}
    if(action==="auth-unavailable"){event.preventDefault();toast("此认证服务尚未配置，请使用邮箱密码、邮箱验证码或已绑定的GitHub登录。","暂不可用");return;}
    if(el.matches("[data-role-toggle]")){
      const selected=el.dataset.selected!=="true";
      el.dataset.selected=String(selected);
      el.classList.toggle("bg-primary/10",selected);el.classList.toggle("border-primary/30",selected);el.classList.toggle("text-primary",selected);
      el.classList.toggle("bg-surface-container-low",!selected);el.classList.toggle("text-on-surface-variant",!selected);
      const count=el.closest("[data-section='recruitment-roles']")?.querySelector<HTMLElement>("[data-selected-role-count]");
      if(count){const total=el.closest("[data-team-roles]")?.querySelectorAll('[data-role-toggle][data-selected="true"]').length||0;count.textContent=`已选 ${total} 个角色`;}
      const icon=el.querySelector("svg");if(icon){icon.classList.remove("hidden");icon.innerHTML=selected?'<path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/>':'<path d="M12 4.5v15m7.5-7.5h-15" stroke-linecap="round" stroke-linejoin="round"/>';}
      return;
    }
    if(action==="show-custom-role"){
      const editor=el.closest("[data-section='recruitment-roles']")?.querySelector<HTMLElement>("[data-custom-role-editor]");
      editor?.classList.toggle("hidden");editor?.querySelector<HTMLInputElement>("[data-custom-role-input]")?.focus();return;
    }
    if(action==="project-invite"){root.current.querySelector<HTMLElement>("#project-invite-modal")?.classList.remove("hidden");return;}
    if(action==="edit-project-nickname"){const title=el.previousElementSibling as HTMLElement|null;if(!title)return;const value=title.textContent?.trim()||"";const input=document.createElement("input");input.dataset.projectNickname="";input.dataset.projectNicknameOriginal=value;input.setAttribute("aria-label","项目昵称");input.maxLength=80;input.value=value;input.className="pm-project-nickname-input";const save=document.createElement("button");save.type="button";save.dataset.action="save-project-nickname";save.className="pm-button-primary pm-project-nickname-save";save.textContent="保存昵称";title.replaceWith(input);el.replaceWith(save);input.focus();input.select();return;}
    if(action==="save-project-nickname"){const input=root.current.querySelector<HTMLInputElement>("[data-project-nickname]");if(input&&input.value.trim()===input.dataset.projectNicknameOriginal){const title=document.createElement("h1");title.className="font-headline-md text-headline-md text-on-surface tracking-tight";title.textContent=input.value.trim();const edit=document.createElement("button");edit.type="button";edit.dataset.action="edit-project-nickname";edit.className="pm-button-outline pm-project-nickname-edit";edit.textContent="修改昵称";input.replaceWith(title);el.replaceWith(edit);return;}const result=await run("update-project-nickname",{nickname:input?.value||"",projectId:root.current.querySelector<HTMLElement>("[data-workspace-project-id]")?.dataset.workspaceProjectId||""},button);if(result?.ok)router.refresh();return;}
    if(action==="new-project-task"){root.current.querySelector<HTMLElement>("#project-task-modal")?.classList.remove("hidden");return;}
    if(action==="close-workspace-modal"){el.closest<HTMLElement>("[id$='-modal']")?.classList.add("hidden");return;}
    if(action==="generate-project-invite"){
      const modalRoot=el.closest<HTMLElement>("#project-invite-modal");const status=modalRoot?.querySelector<HTMLElement>("[data-project-invite-status]");const result=await run("create-project-invite",{recipientEmail:modalRoot?.querySelector<HTMLInputElement>("[data-project-invite-recipient]")?.value||"",projectId:root.current.querySelector<HTMLElement>("[data-workspace-project-id]")?.dataset.workspaceProjectId||""},button);
      if(result?.ok&&result.href){const input=modalRoot?.querySelector<HTMLInputElement>("[data-project-invite-link]");if(input)input.value=location.origin+result.href;if(status)status.textContent="邀请链接已生成，7 天内有效。";}else if(status)status.textContent=result?.message||"邀请链接生成失败。";return;
    }
    if(action==="copy-project-invite"){const input=el.closest<HTMLElement>("#project-invite-modal")?.querySelector<HTMLInputElement>("[data-project-invite-link]");if(input?.value){try{await navigator.clipboard.writeText(input.value);toast("邀请链接已复制。","复制成功");}catch{input.select();toast("请手动复制已选中的邀请链接。","复制未完成");}}return;}
    if(action==="create-project-task"){
      const modalRoot=el.closest<HTMLElement>("#project-task-modal");const title=modalRoot?.querySelector<HTMLInputElement>("[data-project-task-title]")?.value||"";const priority=modalRoot?.querySelector<HTMLSelectElement>("[data-project-task-priority]")?.value||"中";const assignee=modalRoot?.querySelector<HTMLInputElement>("[data-project-task-assignee]")?.value||"";const status=modalRoot?.querySelector<HTMLElement>("[data-project-task-status]");const result=await run("create-project-task",{title,priority,assignee,projectId:root.current.querySelector<HTMLElement>("[data-workspace-project-id]")?.dataset.workspaceProjectId||""},button);if(result?.ok){if(status)status.textContent="任务已创建。";modalRoot?.classList.add("hidden");router.refresh();}else if(status)status.textContent=result?.message||"任务创建失败。";return;
    }
    if(action==="add-custom-role"){
      const editor=el.closest<HTMLElement>("[data-custom-role-editor]");const input=editor?.querySelector<HTMLInputElement>("[data-custom-role-input]");const value=input?.value.trim().slice(0,40)||"";
      if(!value){toast("请输入岗位名称。","岗位名称为空");return;}
      const section=el.closest<HTMLElement>("[data-section='recruitment-roles']");const roleRoot=section?.querySelector<HTMLElement>("[data-team-roles]");if(!roleRoot)return;
      if([...roleRoot.querySelectorAll<HTMLElement>("[data-role-toggle]")].some(role=>role.textContent?.trim().startsWith(value))){toast("该岗位已添加。","岗位已存在");return;}
      const role=document.createElement("button");role.type="button";role.dataset.roleToggle="";role.dataset.selected="true";role.className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-primary";
      const labelNode=document.createElement("span");labelNode.textContent=value;role.append(labelNode);
      const icon=document.createElementNS("http://www.w3.org/2000/svg","svg");icon.setAttribute("aria-hidden","true");icon.setAttribute("viewBox","0 0 24 24");icon.setAttribute("fill","none");icon.setAttribute("stroke","currentColor");icon.setAttribute("stroke-width","2");icon.setAttribute("class","w-3.5 h-3.5");
      const path=document.createElementNS("http://www.w3.org/2000/svg","path");path.setAttribute("d","M6 6l12 12M18 6 6 18");path.setAttribute("stroke-linecap","round");icon.append(path);role.append(icon);roleRoot.append(role);if(input)input.value="";
      const count=section?.querySelector<HTMLElement>("[data-selected-role-count]");if(count)count.textContent=`已选 ${roleRoot.querySelectorAll('[data-role-toggle][data-selected="true"]').length} 个角色`;return;
    }
    if(id==="open-ai-match-btn"){if(guard())modal("ai-synergy-modal",true);return;}
    if(action==="open-competition-detail"&&el.closest("[data-competition-card]")&&el.tagName==="BUTTON"){
      event.preventDefault();event.stopPropagation();
    }
    if(action==="open-competition-detail"){
      const competitionId=el.dataset.competitionId||el.closest<HTMLElement>('[data-competition-id]')?.dataset.competitionId||"";
      const card=root.current.querySelector<HTMLElement>('#competition-detail-modal');
      if(card){
        card.dataset.competitionId=competitionId;
        const source=root.current.querySelector<HTMLElement>(`[data-competition-card][data-competition-id="${CSS.escape(competitionId)}"]`);
        const competitionData=JSON.parse(card.dataset.competitionData||"{}");
        const competition=competitionData[competitionId] as { name?: string; platform?: string; status?: string; season?: string; sourceUrl?: string; tracks?: Array<{ name:string; description:string|null; deadline:number|null; analysis?:{analysis:string;generatedAt:number;model:string}|null }> }|undefined;
        const title=competition?.name||source?.querySelector("h3")?.textContent?.trim()||"赛事详情";
        card.dataset.selectedTrackIndex="0";
        const detailFavorite=source?.dataset.favorite==="true";
        const favoriteButton=card.querySelector<HTMLButtonElement>('[data-action="detail-favorite"]');
        if(favoriteButton){favoriteButton.setAttribute("aria-pressed",String(detailFavorite));const favoriteText=favoriteButton.querySelector("#fav-text");if(favoriteText)favoriteText.textContent=detailFavorite?"已收藏":"收藏赛事";const favoriteIcon=favoriteButton.querySelector("svg");if(favoriteIcon)favoriteIcon.setAttribute("fill",detailFavorite?"currentColor":"none");favoriteButton.classList.toggle("text-error",detailFavorite);}
        const modalTitle=card.querySelector("#modal-title");if(modalTitle)modalTitle.textContent=title;
        const status=competition?.status||source?.querySelector("span")?.textContent?.trim();const statusEl=card.querySelector("[data-modal-status]");if(statusEl&&status)statusEl.textContent=status;
        const sourceLink=card.querySelector<HTMLAnchorElement>('[data-action="view-competition-source"]');if(sourceLink)sourceLink.href=competition?.sourceUrl||source?.dataset.sourceUrl||"#";
        const authorityLink=card.querySelector<HTMLAnchorElement>('[data-modal-authority-source]');if(authorityLink){authorityLink.href=competition?.sourceUrl||"#";authorityLink.textContent=competition?.sourceUrl?new URL(competition.sourceUrl).hostname+new URL(competition.sourceUrl).pathname:"暂无官方来源";}
        const specLink=card.querySelector<HTMLAnchorElement>('[data-modal-spec-link]');if(specLink){if(competition?.sourceUrl){specLink.href=competition.sourceUrl;specLink.removeAttribute("aria-disabled");}else{specLink.removeAttribute("href");specLink.setAttribute("aria-disabled","true");}specLink.textContent=competition?.sourceUrl?"打开官方赛事页面":"暂无官方赛题说明";}
        const sampleLink=card.querySelector<HTMLAnchorElement>('[data-modal-sample-link]');if(sampleLink){if(competition?.sourceUrl){sampleLink.href=competition.sourceUrl;sampleLink.removeAttribute("aria-disabled");}else{sampleLink.removeAttribute("href");sampleLink.setAttribute("aria-disabled","true");}sampleLink.textContent=competition?.sourceUrl?"查看赛事原文":"暂无样例数据";}
        const seasonEl=card.querySelector("[data-modal-season]");if(seasonEl)seasonEl.textContent=competition?.season||"赛事信息";
        const platformEl=card.querySelector("[data-modal-platform]");if(platformEl)platformEl.textContent="来源平台："+(competition?.platform||"暂无");
        const deadline=competition?.tracks?.map(track=>track.deadline).filter((value):value is number=>Boolean(value)).sort((a,b)=>a-b)[0];const deadlineEl=card.querySelector("[data-modal-deadline]");if(deadlineEl)deadlineEl.textContent=deadline?new Date(deadline).toLocaleString("zh-CN"):"暂无截止时间";
        const trackCount=card.querySelector("[data-modal-track-count]");if(trackCount)trackCount.textContent=`共 ${(competition?.tracks||[]).length} 个赛道`;
        const trackData=JSON.parse(card.dataset.trackData||"{}");
        const tracks=(competition?.tracks||[]);
        const trackButtons=[...card.querySelectorAll<HTMLButtonElement>('button[data-track-id]')];
        trackButtons.forEach((trackButton,index)=>{trackButton.dataset.trackIndex=String(index);const track=tracks[index];trackButton.classList.toggle("hidden",!track);if(track){const titleEl=trackButton.querySelector("p");if(titleEl)titleEl.textContent=track.name;const label=trackButton.querySelector("span");if(label)label.textContent=`赛道 ${index+1}`;}});
        renderTrackPage(card,tracks,trackButtons,0);
        const firstTrack=tracks[0];const detailHeading=card.querySelector("h1");if(detailHeading)detailHeading.textContent=firstTrack?.name||title;
        const description=card.querySelector("[data-modal-track-description]");if(description)description.textContent=firstTrack?.description||"赛事来源未提供赛道任务说明。";
        const objective=card.querySelector("[data-modal-track-objective]");if(objective)objective.textContent="赛事来源未提供任务目标，请以官方赛事页面为准。";
        const requirements=card.querySelector("[data-modal-requirements]");if(requirements)requirements.textContent="赛事来源未提供统一提交格式和评测要求，请以官方赛事页面为准。";
        card.querySelectorAll("[data-modal-requirement-item]").forEach(item=>{item.textContent="赛事来源未提供该项提交要求。";});
        card.querySelectorAll("[data-modal-requirement-title]").forEach(item=>{item.textContent="提交要求";});
        const trackLabel=card.querySelector("[data-modal-track-label]");if(trackLabel)trackLabel.textContent=firstTrack?`赛道 1 · ${firstTrack.name}`:"暂无赛道信息";
        const trackDeadline=card.querySelector("[data-modal-track-deadline]");if(trackDeadline)trackDeadline.textContent=firstTrack?.deadline?new Date(firstTrack.deadline).toLocaleString("zh-CN"):"暂无提交截止时间";
        const cachedAnalysis=firstTrack?.analysis;const empty=card.querySelector<HTMLElement>("[data-ai-analysis-empty]");let output=card.querySelector<HTMLElement>("[data-ai-analysis-result]");const aiStatus=card.querySelector<HTMLElement>("[data-ai-analysis-status]");if(cachedAnalysis){empty?.classList.add("hidden");if(!output){output=document.createElement("div");output.dataset.aiAnalysisResult="";output.className="rounded-xl bg-surface-container-low p-4 font-body-sm text-body-sm text-on-surface-variant whitespace-pre-line leading-relaxed";card.querySelector("[data-ai-analysis-section]")?.append(output);}output.textContent=cachedAnalysis.analysis;if(aiStatus)aiStatus.textContent="已生成";}else{empty?.classList.remove("hidden");output?.remove();if(aiStatus)aiStatus.textContent="待生成";}
        const sourceNote=card.querySelector("[data-modal-source-note]");if(sourceNote)sourceNote.textContent=competition?.sourceUrl?"信息来源已通过赛事官方公开页面校验":"赛事官方来源尚未提供";
        if(detailCloseTimer.current){clearTimeout(detailCloseTimer.current);detailCloseTimer.current=null;}
        card.classList.remove("hidden","pm-detail-closing");
      }
      return;
    }
    if(action==="track-page-prev"||action==="track-page-next"){
      const modalCard=el.closest<HTMLElement>('[data-competition-modal]');
      if(modalCard){const competition=(JSON.parse(modalCard.dataset.competitionData||"{}") as Record<string,{tracks?:Array<{name:string;description:string|null;deadline:number|null;analysis?:{analysis:string;generatedAt:number;model:string}|null}>}>)[modalCard.dataset.competitionId||""];const buttons=[...modalCard.querySelectorAll<HTMLButtonElement>('button[data-track-id]')];renderTrackPage(modalCard,competition?.tracks||[],buttons,Number(modalCard.dataset.trackPage||0)+(action==="track-page-next"?1:-1));}
      return;
    }
    if(el.matches('button[data-track-id]')){
      const modalCard=el.closest<HTMLElement>('[data-competition-modal]');
      if(modalCard){const buttons=[...modalCard.querySelectorAll<HTMLButtonElement>('button[data-track-id]')];const index=Number((el as HTMLButtonElement).dataset.trackIndex??buttons.indexOf(el as HTMLButtonElement));modalCard.dataset.selectedTrackIndex=String(Math.max(0,index));buttons.forEach((item,i)=>{const active=i===index;item.setAttribute('aria-selected',String(active));item.classList.toggle('bg-primary-fixed',active);item.classList.toggle('ring-1',active);item.classList.toggle('ring-primary',active);item.classList.toggle('bg-surface-container-high',active);item.classList.toggle('bg-surface-container-low',!active);item.classList.toggle('shadow-sm',active);});const allTracks=(JSON.parse(modalCard.dataset.competitionData||'{}') as Record<string,{tracks?:Array<{name:string;description:string|null;deadline:number|null;analysis?:{analysis:string;generatedAt:number;model:string}|null}>}>)[modalCard.dataset.competitionId||'']?.tracks||[];renderTrackPage(modalCard,allTracks,buttons,Number(modalCard.dataset.trackPage||0));const track=(JSON.parse(modalCard.dataset.competitionData||'{}') as Record<string,{tracks?:Array<{name:string;description:string|null;deadline:number|null;analysis?:{analysis:string;generatedAt:number;model:string}|null}>}>)[modalCard.dataset.competitionId||'']?.tracks?.[index];if(track){const title=modalCard.querySelector('h1');if(title)title.textContent=track.name;const label=modalCard.querySelector('[data-modal-track-label]');if(label)label.textContent=`赛道 ${index+1} · ${track.name}`;const desc=modalCard.querySelector('[data-modal-track-description]');if(desc)desc.textContent=track.description||'赛事来源未提供赛道任务说明。';const deadline=modalCard.querySelector('[data-modal-track-deadline]');if(deadline)deadline.textContent=track.deadline?new Date(track.deadline).toLocaleString('zh-CN'):'暂无提交截止时间';}const empty=modalCard.querySelector<HTMLElement>('[data-ai-analysis-empty]');let output=modalCard.querySelector<HTMLElement>('[data-ai-analysis-result]');const status=modalCard.querySelector<HTMLElement>('[data-ai-analysis-status]');if(track?.analysis){empty?.classList.add('hidden');if(!output){output=document.createElement('div');output.dataset.aiAnalysisResult='';output.className='rounded-xl bg-surface-container-low p-4 font-body-sm text-body-sm text-on-surface-variant whitespace-pre-line leading-relaxed';modalCard.querySelector('[data-ai-analysis-section]')?.append(output);}output.textContent=track.analysis.analysis;if(status)status.textContent='已生成';}else{empty?.classList.remove('hidden');output?.remove();if(status)status.textContent='待生成';}}
      return;
    }
    if(action==="analyze-track"){
      const modalCard=el.closest<HTMLElement>('[data-competition-modal]');let output=modalCard?.querySelector<HTMLElement>('[data-ai-analysis-result]');if(!output&&modalCard){output=document.createElement('div');output.dataset.aiAnalysisResult="";output.className='rounded-xl bg-surface-container-low p-4 font-body-sm text-body-sm text-on-surface-variant whitespace-pre-line leading-relaxed';modalCard.querySelector('[data-ai-analysis-section]')?.append(output);}setAiLoading(output||null,true);const status=modalCard?.querySelector<HTMLElement>('[data-ai-analysis-status]');if(status)status.textContent='分析中';const result=await run("analyze-competition",{competitionId:modalCard?.dataset.competitionId||"",trackIndex:modalCard?.dataset.selectedTrackIndex||"0"},button);if(result?.ok&&result.summary&&modalCard){modalCard.querySelector('[data-ai-analysis-empty]')?.classList.add('hidden');await revealText(output||null,result.summary);if(status)status.textContent='已生成';}else{setAiLoading(output||null,false);if(output)output.textContent=result?.message||'分析未完成，请稍后重试。';if(status)status.textContent='未完成';}return;
    }
    if(action==="close-competition-detail"){
      const detail=root.current.querySelector<HTMLElement>('#competition-detail-modal');
      if(!detail||detail.classList.contains("pm-detail-closing"))return;
      if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){detail.classList.add("hidden");return;}
      detail.classList.add("pm-detail-closing");
      detailCloseTimer.current=setTimeout(()=>{detail.classList.add("hidden");detail.classList.remove("pm-detail-closing");detailCloseTimer.current=null;},180);
      return;
    }
    if(action==="view-competition-source"){return;}
    if(action==="start-team"){
      const destination="/teams?create=1&competition="+encodeURIComponent(el.closest<HTMLElement>('[data-competition-modal]')?.dataset.competitionId||"");
      if(!guard(destination))return;
      showRouteTransition();
      const detail=root.current?.querySelector<HTMLElement>('#competition-detail-modal');
      const navigate=()=>router.push(destination);
      if(!detail||detail.classList.contains('hidden')){setTimeout(navigate,180);return;}
      if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){detail.classList.add('hidden');setTimeout(navigate,120);return;}
      detail.classList.add('pm-detail-closing');
      detailCloseTimer.current=setTimeout(()=>{detail.classList.add('hidden');detail.classList.remove('pm-detail-closing');detailCloseTimer.current=null;setTimeout(navigate,80);},180);
      return;
    }
    if(action==="detail-favorite"){
      const modalCard=el.closest<HTMLElement>('[data-competition-modal]');const key=modalCard?.dataset.competitionId||"";
      const result=await run("favorite",{key},button);if(result?.ok){const active=el.getAttribute("aria-pressed")!=="true";el.classList.toggle("text-error",active);el.setAttribute("aria-pressed",String(active));const favoriteText=el.querySelector("#fav-text");if(favoriteText)favoriteText.textContent=active?"已收藏":"收藏赛事";const favoriteIcon=el.querySelector("svg");if(favoriteIcon)favoriteIcon.setAttribute("fill",active?"currentColor":"none");const source=root.current.querySelector<HTMLElement>(`[data-competition-id="${CSS.escape(key)}"]`);if(source){source.dataset.favorite=String(active);const sourceButton=source.querySelector<HTMLElement>('[data-action="favorite"]');sourceButton?.classList.toggle("text-error",active);}}return;
    }
    if(id==="open-creator-btn"){if(guard()){updateStep(1);modal("creator-modal",true);}return;}
    if(action==="team-publish"){const scope=root.current;const modalRoot=scope.querySelector<HTMLElement>('[data-team-create-modal]');const competitionId=modalRoot?.querySelector<HTMLElement>('[data-competition-id]')?.dataset.competitionId||new URLSearchParams(location.search).get('competition')||"";const title=scope.querySelector<HTMLInputElement>('#team-project-name')?.value||"";const description=scope.querySelector<HTMLTextAreaElement>('#team-project-desc')?.value||"";const trackName=scope.querySelector<HTMLSelectElement>('#team-track')?.value||"自拟赛道";const weeklyHours=scope.querySelector<HTMLInputElement>('#team-hours')?.value||"10";if(title.trim().length<2||description.trim().length<5){toast("请填写项目名称和项目描述后再发布。","项目信息未完成");return;}const roleRoot=scope.querySelector<HTMLElement>('[data-team-roles]');const roles=[...(roleRoot?.querySelectorAll<HTMLElement>('[data-role-toggle][data-selected="true"]')||[])].map(role=>role.querySelector('span')?.textContent?.trim()||'').filter(Boolean).join('、');const result=await run("publish",{title,description,competitionId,trackName,weeklyHours,roles},button);if(result?.ok){modal("creator-modal",false);router.refresh();}return;}
    if(action==="generate-team-copy"){const scope=root.current;const title=scope.querySelector<HTMLInputElement>('#team-project-name')?.value||"";const description=scope.querySelector<HTMLTextAreaElement>('#team-project-desc')?.value||"";const trackName=scope.querySelector<HTMLSelectElement>('#team-track')?.value||"";const competitionName=scope.querySelector<HTMLElement>('[data-team-competition-name]')?.textContent||scope.querySelector<HTMLElement>('[data-section="target-competition"] h3')?.textContent||"";const roleRoot=scope.querySelector<HTMLElement>('[data-team-roles]');const roles=[...(roleRoot?.querySelectorAll<HTMLElement>('[data-role-toggle][data-selected="true"]')||[])].map(role=>role.querySelector('span')?.textContent?.trim()||'').filter(Boolean).join('、');const output=scope.querySelector<HTMLElement>('[data-ai-team-copy]');setAiLoading(output,true);const result=await run('generate-team-copy',{title,description,competitionName,trackName,roles},button);if(result?.ok&&result.generatedText){await revealText(output,result.generatedText);const titleField=scope.querySelector<HTMLInputElement>('#team-project-name');if(titleField&&result.generatedTitle)titleField.value=result.generatedTitle;const descriptionField=scope.querySelector<HTMLTextAreaElement>('#team-project-desc');if(descriptionField){descriptionField.value=result.generatedText;descriptionField.dispatchEvent(new Event('input',{bubbles:true}));}}else{setAiLoading(output,false);if(output)output.textContent=result?.message||'生成未完成，请稍后重试。';}return;}
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
      const result=await run("favorite",{key},button);if(result?.ok){el.classList.toggle("text-error");const card=el.closest<HTMLElement>('[data-competition-id]');if(card)card.dataset.favorite=String(card.dataset.favorite!=="true");}return;
    }
    if(action==="apply"||el.classList.contains("apply-team-btn")){const card=el.closest<HTMLElement>('[data-project-id]');await run("apply",{projectId:el.dataset.projectId||card?.dataset.projectId||"design-sample"},button);return;}
    if(action==="team-details"||el.classList.contains("view-detail-btn")){const projectId=el.dataset.projectId||el.closest<HTMLElement>('[data-project-id]')?.dataset.projectId||"";const modalRoot=root.current.querySelector<HTMLElement>("#team-detail-modal");const card=el.closest<HTMLElement>('[data-project-id]');const details=JSON.parse(modalRoot?.dataset.teamDetails||"{}")[projectId];if(modalRoot&&details){modalRoot.dataset.projectId=projectId;modalRoot.classList.remove("hidden","pm-detail-closing");const set=(selector:string,value:string)=>{const node=modalRoot.querySelector<HTMLElement>(selector);if(node)node.textContent=value;};set("[data-team-detail-title]",details.title);set("[data-team-detail-description]",details.description);set("[data-team-detail-status]",details.status);set("[data-team-detail-track]",details.trackName);set("[data-team-detail-hours]",details.weeklyHours?`${details.weeklyHours} 小时 / 周`:"未设置");set("[data-team-detail-creator]",details.creatorName);set("[data-team-detail-roles]",details.roles);set("[data-team-detail-members]",String(details.memberCount||0));set("[data-team-detail-seats]",details.seatCount==null?"未设置":String(details.seatCount));const apply=modalRoot.querySelector<HTMLButtonElement>('[data-action="apply-team-detail"]');if(apply){const full=details.seatCount!=null&&details.memberCount>=details.seatCount;apply.disabled=details.status!=="招募中"||full;apply.textContent=details.status!=="招募中"?"暂停招募":full?"已满员":"申请加入";}}return;}
    if(action==="close-team-detail"){const modalRoot=root.current.querySelector<HTMLElement>("#team-detail-modal");if(modalRoot){modalRoot.classList.add("pm-detail-closing");setTimeout(()=>{modalRoot.classList.add("hidden");modalRoot.classList.remove("pm-detail-closing");},180);}return;}
    if(action==="apply-team-detail"){const modalRoot=root.current.querySelector<HTMLElement>("#team-detail-modal");await run("apply",{projectId:modalRoot?.dataset.projectId||""},button);return;}
    if(action==="coach"||id==="btn-apply-suggestion"){
      if(id==="btn-apply-suggestion"){toast("此处排期是设计示例，请在任务看板选择具体任务后修改；未自动更改任务。","请确认具体调整");router.push(taskRoute());return;}
      const input=root.current.querySelector<HTMLInputElement>('[data-coach-input]');
      const panel=el.closest<HTMLElement>("[data-coach-project-id]")||root.current.querySelector<HTMLElement>("[data-coach-project-id]");
      const projectId=panel?.dataset.coachProjectId||"";const messages=panel?.querySelector<HTMLElement>("[data-coach-messages]");
      if(!projectId||!messages){toast("当前账号暂无可分析的项目任务。","暂无项目");return;}
      const question=input?.value.trim()||"请评估当前任务风险";
      const history=[...messages.querySelectorAll<HTMLElement>("[data-coach-message]")].slice(-8).map(node=>({role:node.dataset.coachMessage||"assistant",content:node.textContent||""}));
      messages.querySelector("[data-coach-empty]")?.remove();
      const addMessage=(role:"user"|"assistant",content:string)=>{const bubble=document.createElement("div");bubble.className=`pm-coach-message pm-coach-message-${role}`;bubble.dataset.coachMessage=role;bubble.textContent=content;messages.append(bubble);return bubble;};
      addMessage("user",question);
      const pending=document.createElement("div");pending.className="pm-coach-message pm-coach-message-assistant";pending.dataset.coachPending="";pending.innerHTML='<span>AI 教练分析中</span><span class="pm-ai-dots" aria-hidden="true"><i></i><i></i><i></i></span>';messages.append(pending);messages.scrollTop=messages.scrollHeight;
      const prompt=JSON.stringify({projectId,history:[...history,{role:"user",content:question}]}).slice(-1900);
      const result=await run("coach",{projectId,prompt},button,true);pending.remove();
      addMessage("assistant",result?.ok&&result.summary?result.summary:result?.message||"AI 教练暂时无法回复，请稍后重试。");messages.scrollTop=messages.scrollHeight;
      if(result?.ok&&input)input.value="";return;
    }
    if(action==="coach-prompt"){
      const input=root.current.querySelector<HTMLInputElement>("[data-coach-input]");if(input){input.value=el.dataset.prompt||el.textContent?.trim()||"";root.current.querySelector<HTMLButtonElement>("button[data-action='coach']")?.click();}return;
    }
    if(action==="apply-advice"){toast("请在任务看板选择具体任务进行调整，当前建议不会自动修改数据。","排期建议");router.push(taskRoute());return;}
    if(action==="dismiss-advice"||id==="btn-dismiss-suggestion"){const card=root.current.querySelector<HTMLElement>('#ai-suggestion-card');if(card)card.style.opacity="0.55";toast("已忽略当前建议。","建议已忽略");return;}
    if(action==="reset-filters"){
      root.current.querySelectorAll<HTMLInputElement>('[data-platform-filter]').forEach(i=>i.checked=true);
      root.current.querySelectorAll<HTMLInputElement>('[data-status-filter]').forEach(i=>i.checked=i.dataset.statusFilter==="");
      root.current.querySelectorAll<HTMLElement>('[data-sort-filter]').forEach(i=>{const on=i.dataset.sortFilter==="default";i.dataset.selected=String(on);i.classList.toggle("bg-surface-container-lowest",on);i.classList.toggle("text-primary",on);i.classList.toggle("font-semibold",on);});
      const input=root.current.querySelector<HTMLInputElement>('[data-competition-search]');if(input)input.value="";
      filterCompetitions();return;
    }
    if(action==="logout"){toast("正在退出当前登录会话。","退出登录");setTimeout(()=>router.push("/api/auth/signout?callbackUrl=/"),800);return;}
    if(action==="review-approve"||action==="review-reject"){
      const competitionId=el.dataset.reviewId||el.closest<HTMLElement>('[data-review-id]')?.dataset.reviewId||"";
      const decision=action==="review-approve"?"approved":"rejected";
      const result=await run("review-competition",{competitionId,decision},button);
      if(result?.ok){el.closest("tr, article[data-review-id]")?.remove();router.refresh();}
      return;
    }
    if(action==="admin-users"||action==="admin-audit"){
      const users=root.current.querySelector<HTMLElement>("#admin-users-panel");
      const audit=root.current.querySelector<HTMLElement>("#admin-audit-panel");
      users?.classList.toggle("hidden",action!=="admin-users");
      audit?.classList.toggle("hidden",action!=="admin-audit");
      (action==="admin-users"?users:audit)?.scrollIntoView({behavior:"smooth",block:"start"});
      return;
    }
    if(action==="admin-role"){
      const row=el.closest<HTMLElement>("[data-admin-user-id]");
      const role=row?.querySelector<HTMLSelectElement>("[data-admin-role]")?.value||"user";
      const result=await run("admin-set-role",{userId:row?.dataset.adminUserId||"",role},button);
      if(result?.ok)router.refresh();
      return;
    }
    if(action==="apply-filters"){filterCompetitions();root.current.querySelector('[data-results-heading]')?.scrollIntoView({behavior:"smooth",block:"center"});return;}
    if(action==="select-competition"||el.dataset.competitionId){
      if(el.tagName==="A"&&el.getAttribute("target")==="_blank")return;
      const card=el.closest<HTMLElement>('[data-competition-id]')||el;
      const h=root.current.querySelector('[data-selected-competition-title]');if(h)h.textContent=(card.querySelector('h3')?.textContent||"")+" · 分析示例";
      const source=root.current.querySelector<HTMLAnchorElement>('[data-selected-source]');if(source&&card.dataset.sourceUrl)source.href=card.dataset.sourceUrl;
      root.current.querySelectorAll('[data-competition-id]').forEach(c=>c.classList.remove('ring-2','ring-primary'));card.classList.add('ring-2','ring-primary');return;
    }
    if(el.hasAttribute("data-sort-filter")){
      root.current.querySelectorAll<HTMLElement>("[data-sort-filter]").forEach(item=>{const on=item===el;item.dataset.selected=String(on);item.classList.toggle("bg-surface-container-lowest",on);item.classList.toggle("text-primary",on);item.classList.toggle("font-semibold",on);});filterCompetitions();return;
    }
    if(el.classList.contains('filter-pill')||el.classList.contains('role-chip')||el.hasAttribute('data-team-hours-filter')){const group=el.hasAttribute('data-team-hours-filter')?'[data-team-hours-filter]':el.classList.contains('role-chip')?'[data-team-role-filter]': '[data-team-track-filter]';root.current.querySelectorAll<HTMLElement>(group).forEach(item=>{if(item!==el)item.dataset.selected="false";item.classList.remove('bg-primary','text-on-primary','bg-surface-container-lowest','text-primary');});el.dataset.selected=el.dataset.selected==="true"?"false":"true";el.classList.toggle('bg-primary');el.classList.toggle('text-on-primary');el.classList.toggle('bg-surface-container-lowest',el.dataset.selected==="true");el.classList.toggle('text-primary',el.dataset.selected==="true");filterTeams();return;}
    if(el.closest('#filter-tabs')){syncCompetitionTabs(root.current,el as HTMLElement);const heading=root.current.querySelector('h1');if(/收藏/.test(label)){if(!guard())return;root.current.dataset.favoritesMode="true";root.current.dataset.recommendationsMode="false";root.current.dataset.competitionPage="1";if(heading)heading.textContent="我收藏的赛事";router.push("/competitions/favorites");return;}if(/AI 推荐/.test(label)){if(!guard())return;router.push("/competitions/recommendations");return;}root.current.dataset.favoritesMode="false";root.current.dataset.recommendationsMode="false";root.current.dataset.competitionPage="1";if(heading)heading.textContent="发现比赛";router.push("/competitions");return;}
    if(action==="page-prev"||action==="page-next"){const current=Number(root.current.dataset.competitionPage||1);root.current.dataset.competitionPage=String(Math.max(1,current+(action==="page-next"?1:-1)));filterCompetitions(false);return;}
    if(/新建任务|任务看板|更新任务看板/.test(label)){router.push(taskRoute());return;}
    if(action==="unavailable"||button){toast("此功能尚在完善中，当前操作未修改数据。","功能说明");}
  }
  return <div className="design-screen" data-screen={name} data-variant={variant}>
    <div ref={root} onSubmit={onAuthSubmit} onClick={onClick} onKeyDown={event=>{if(event.key==="Enter"&&(event.target as HTMLElement).matches("[data-coach-input]")){event.preventDefault();root.current?.querySelector<HTMLButtonElement>("button[data-action='coach']")?.click();}}} onInput={event=>{const target=event.target as HTMLElement;if(target.matches('[data-publish-competition-search]')){const query=(target as HTMLInputElement).value.trim().toLowerCase();root.current?.querySelectorAll<HTMLOptionElement>('[data-publish-competition-select] option').forEach(option=>{option.hidden=Boolean(query&&!option.textContent?.toLowerCase().includes(query));});}else if(target.matches('[data-publish-competition-select]'))refreshPublishCompetition(target as HTMLSelectElement);else if(target.matches('[data-competition-search]')){if(competitionFilterTimer.current)clearTimeout(competitionFilterTimer.current);competitionFilterTimer.current=setTimeout(()=>filterCompetitions(),100);}else if(target.matches('[data-platform-filter],[data-status-filter]'))filterCompetitions();}} onChange={event=>{const target=event.target as HTMLElement;if(target.matches('[data-publish-competition-select]'))refreshPublishCompetition(target as HTMLSelectElement);else if(target.matches('[data-platform-filter],[data-status-filter]'))filterCompetitions();}}>{markup}</div>
    <DesignNoticeContext.Provider value={toast}>{taskSlot && taskBoard && createPortal(taskBoard,taskSlot)}{accountSlot&&name==="settings"&&settingsSection!=="profile"&&createPortal(<AccountSettingsWorkspace section={settingsSection||"security"}/>,accountSlot)}{loginChallenge&&<LoginFactorDialog challenge={loginChallenge} onClose={()=>setLoginChallenge(null)} onSuccess={finishLogin} onRecovery={()=>{setLoginChallenge(null);setLoginRecovery(true);}}/>}{loginRecovery&&<LoginRecoveryDialog initialEmail={root.current?.querySelector<HTMLInputElement>("#principalInput")?.value||""} onClose={()=>setLoginRecovery(false)} onSuccess={finishLogin}/>}{settingsOpen&&<ProjectWorkspaceSettings projectId={workspaceProjectId||null} onClose={()=>setSettingsOpen(false)}/>}</DesignNoticeContext.Provider>
    {notice&&<div className={`fixed top-20 right-6 z-[100] w-80 max-w-[calc(100vw-2rem)] flex gap-3 overflow-hidden p-4 pb-5 bg-white rounded-xl shadow-xl border-l-4 border-primary ${noticeClosing?"pm-toast-closing":""}`} role="status" aria-live="polite" style={{"--pm-toast-duration":`${notice.login?1200:5000}ms`} as CSSProperties}><Info className="text-primary shrink-0" size={20}/><div className="flex-1"><p className="text-label-md font-semibold">{notice.title}</p><p className="text-body-sm text-on-surface-variant mt-1">{notice.message}</p></div>{!notice.login&&<button aria-label="关闭通知" onClick={()=>{setNoticeClosing(true);setTimeout(()=>setNotice(null),220);}}><X size={16}/></button>}<span className="pm-toast-progress absolute bottom-0 left-0 h-[3px] w-full origin-left bg-primary" aria-hidden="true"/></div>}
  </div>;
}
