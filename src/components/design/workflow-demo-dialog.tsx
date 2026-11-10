"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CheckCircle2, Circle, ClipboardList, Code2, FileText, MessageSquare, Pause, Play, RotateCcw, Search, ShieldCheck, Sparkles, Users } from "lucide-react";
import { WorkspaceDialog } from "./workspace-dialog";

const steps = [
  { title: "发现赛事", subtitle: "填写能力画像，找到相关赛事", start: 0, end: 12, icon: Search },
  { title: "分析与招募", subtitle: "理解赛道要求，发布组队项目", start: 12, end: 25, icon: Sparkles },
  { title: "找到队友", subtitle: "查看技能关联，邀请成员加入", start: 25, end: 38, icon: Users },
  { title: "推进协作", subtitle: "拆解待办，在讨论空间同步进展", start: 38, end: 50, icon: ClipboardList },
  { title: "整理产出", subtitle: "结合教练建议，沉淀文档与代码", start: 50, end: 60, icon: FileText },
];
const timeLabel = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;

function Scene({ index, progress }: { index: number; progress: number }) {
  const stage = progress < .3 ? 0 : progress < .65 ? 1 : 2;
  const scene = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const node=scene.current;
    if(node)node.scrollTo({top:stage>0?node.scrollHeight:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
  },[stage]);
  const reveal = (level: number) => stage >= level ? " is-revealed" : "";
  return <div ref={scene} className="pm-demo-scene" key={index} data-demo-scene={index}>
    {index === 0 && <>
      <div className="pm-demo-scene-heading"><span className="pm-demo-icon"><Search size={20}/></span><div><strong>从你的能力出发</strong><small>个人设置 → 技术主攻标签与方向</small></div></div>
      <div className="pm-demo-sample-card"><span className="pm-demo-label">我的技术标签</span><div className="pm-demo-tags"><span>React</span><span>TypeScript</span><span>前端开发</span></div><p>兴趣方向：校园应用 · 每周可投入 10 小时</p></div>
      <div className={"pm-demo-reveal" + reveal(1)}><div className="pm-demo-flow"><ArrowRight size={16}/> 根据资料与赛事状态筛选</div><div className="pm-demo-sample-card"><div className="pm-demo-card-title"><strong>校园应用创新挑战赛</strong><span className="pm-demo-pill">方向相关</span></div><p>软件应用开发赛道 · 示例赛事</p><small>推荐依据：前端技能与应用开发方向相关，资格与时间仍需核实。</small></div></div>
    </>}
    {index === 1 && <>
      <div className="pm-demo-scene-heading"><span className="pm-demo-icon"><Sparkles size={20}/></span><div><strong>先理解赛题，再寻找伙伴</strong><small>赛事详情 → 赛道分析 → 开始组队</small></div></div>
      <div className="pm-demo-columns"><div className="pm-demo-sample-card"><span className="pm-demo-label">赛道分析 · 示例结果</span><strong>校园应用开发方向</strong><ul><li>来源信息：参赛要求以官方原文为准</li><li>分析建议：先完成可演示的应用原型</li><li>待确认：截止时间、团队人数与交付要求</li></ul></div><div className={"pm-demo-sample-card pm-demo-reveal" + reveal(1)}><span className="pm-demo-label">可编辑的招募草稿</span><strong>校园协作应用小队</strong><p>一起完成校园服务原型，寻找后端开发与产品设计伙伴。</p><div className="pm-demo-tags"><span>后端开发</span><span>产品设计</span></div><small><Check size={13}/> 审阅内容后，由你决定是否发布</small></div></div>
      <div className={"pm-demo-caption pm-demo-reveal" + reveal(2)}><ShieldCheck size={16}/> AI 提供建议；发布与数据操作由你确认。</div>
    </>}
    {index === 2 && <>
      <div className="pm-demo-scene-heading"><span className="pm-demo-icon"><Users size={20}/></span><div><strong>让合适的人找到彼此</strong><small>组队大厅 → 能力匹配 → 团队邀请</small></div></div>
      <div className="pm-demo-sample-card"><div className="pm-demo-person"><span className="pm-demo-avatar">林</span><div><strong>林同学 · 示例成员</strong><small>Python / API 开发 · 每周 12 小时</small></div><span className="pm-demo-pill">岗位相关</span></div><p>与你的前端方向互补，可进一步沟通接口分工与投入时间。</p></div>
      <div className={"pm-demo-invite pm-lavender-surface pm-demo-reveal" + reveal(1)}><span className="pm-demo-label">PROJECTMATE · 团队邀请</span><strong>邀请你加入校园协作应用小队</strong><small>查看项目目标、岗位与团队人数，再确认是否加入。</small><span className="pm-demo-example-button">查看邀请并确认 <ArrowRight size={13}/></span></div>
      <div className={"pm-demo-caption pm-demo-reveal" + reveal(2)}><CheckCircle2 size={16}/> 示例成员已确认加入，进入同一个项目空间。</div>
    </>}
    {index === 3 && <>
      <div className="pm-demo-scene-heading"><span className="pm-demo-icon"><ClipboardList size={20}/></span><div><strong>把讨论变成可以推进的任务</strong><small>项目空间 → 任务看板与讨论空间</small></div></div>
      <div className="pm-demo-columns"><div className="pm-demo-sample-card"><span className="pm-demo-label">任务看板</span><div className="pm-demo-task"><CheckCircle2 size={16}/> 确认需求与页面结构</div><div className="pm-demo-task">{stage >= 2 ? <CheckCircle2 size={16}/> : <Circle size={16}/>} 完成原型与接口联调</div><div className="pm-demo-task"><Circle size={16}/> 整理演示与项目说明</div><div className="pm-demo-meter"><span style={{width: stage >= 2 ? "67%" : "33%"}}/></div><small>示例任务进度：{stage >= 2 ? "2 / 3" : "1 / 3"} 项已完成</small></div><div className={"pm-demo-sample-card pm-demo-reveal" + reveal(1)}><span className="pm-demo-label"><MessageSquare size={14}/> 讨论空间</span><p className="pm-demo-chat">我已整理接口字段，大家可以开始联调。</p><p className={"pm-demo-chat is-self pm-demo-reveal" + reveal(2)}>收到，原型测试通过后一起更新待办。</p><small>团队消息持续保存在项目中。</small></div></div>
    </>}
    {index === 4 && <>
      <div className="pm-demo-scene-heading"><span className="pm-demo-icon"><FileText size={20}/></span><div><strong>让协作过程沉淀为项目成果</strong><small>项目空间 → AI 教练与文档产出</small></div></div>
      <div className="pm-demo-sample-card pm-lavender-surface"><span className="pm-demo-label"><Sparkles size={14}/> 教练建议 · 示例结果</span><p>优先完成未结项任务，预留时间整理演示材料，并与成员确认交付安排。</p><small>实际分析以项目任务为依据，需要配置 AI 服务。</small></div>
      <div className={"pm-demo-columns pm-demo-reveal" + reveal(1)}><div className="pm-demo-sample-card"><span className="pm-demo-label"><FileText size={15}/> 文档区</span><strong>项目说明.md</strong><p>汇总目标、分工与使用方法</p></div><div className="pm-demo-sample-card"><span className="pm-demo-label"><Code2 size={15}/> 代码区</span><strong>src / app / page.tsx</strong><p>按目录管理并阅读代码</p></div></div>
      <div className={"pm-demo-caption pm-demo-reveal" + reveal(2)}><CheckCircle2 size={16}/> 从发现赛事到团队协作，现在轮到你开始了。</div>
    </>}
  </div>;
}

export function WorkflowDemoDialog({onClose}:{onClose:()=>void}) {
  const [elapsed,setElapsed]=useState(0),[playing,setPlaying]=useState(false);
  const last=useRef<number|null>(null);
  useEffect(()=>{setPlaying(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);},[]);
  useEffect(()=>{
    last.current=null;
    if(!playing)return;
    const timer=setInterval(()=>{
      const now=performance.now();
      if(document.hidden){last.current=null;return;}
      if(last.current===null){last.current=now;return;}
      const delta=Math.min((now-last.current)/1000,.5);last.current=now;
      setElapsed(value=>Math.min(60,value+delta));
    },100);
    return()=>clearInterval(timer);
  },[playing]);
  useEffect(()=>{if(elapsed>=60)setPlaying(false);},[elapsed]);
  const index=steps.findIndex(step=>elapsed<step.end);
  const currentIndex=index<0?4:index,step=steps[currentIndex];
  const progress=(elapsed-step.start)/(step.end-step.start);
  const finished=elapsed>=60;
  return <WorkspaceDialog title="1 分钟工作流演示" className="pm-workflow-demo" onClose={onClose}>
    <div className="pm-demo-banner pm-lavender-surface"><span className="pm-demo-pill">交互演示 · 示例数据</span><p>用一分钟，了解从发现赛事到团队协作的完整流程。</p><small>仅演示操作过程，不调用 AI、不发送邀请、不创建真实项目。</small></div>
    <nav className="pm-demo-steps" aria-label="演示步骤">{steps.map((item,i)=>{const Icon=item.icon;return <button type="button" key={item.title} aria-current={i===currentIndex?"step":undefined} onClick={()=>{setElapsed(item.start);last.current=null;}}><Icon size={16}/><span>{i+1}. {item.title}</span></button>;})}</nav>
    <div className="pm-demo-stage-header" aria-live="polite"><strong>{finished?"演示完成":step.title}</strong><span>{step.subtitle}</span></div>
    <Scene index={currentIndex} progress={progress}/>
    <div className="pm-demo-controls"><button type="button" className="pm-button-outline" aria-label={playing?"暂停演示":finished?"重播演示":"继续演示"} onClick={()=>{if(finished)setElapsed(0);setPlaying(value=>!value);}}>{playing?<Pause size={16}/>:<Play size={16}/>}<span>{playing?"暂停":finished?"重播":"继续"}</span></button><button className="pm-demo-restart" type="button" onClick={()=>{setElapsed(0);setPlaying(true);last.current=null;}} aria-label="从头重播"><RotateCcw size={16}/></button><div className="pm-demo-timeline"><label htmlFor="workflow-time">演示进度</label><input id="workflow-time" type="range" min="0" max="60" step="1" value={Math.floor(elapsed)} onChange={e=>{setElapsed(Number(e.target.value));last.current=null;}}/></div><span className="pm-demo-time">{timeLabel(elapsed)} / 1:00</span></div>
    <div className="pm-demo-footer"><span role="status">{finished?"流程已看完，选择一个入口开始体验。":"也可以点击上方步骤，直接查看感兴趣的环节。"}</span><div><Link href="/competitions" className="pm-button-outline" onClick={onClose}>浏览比赛</Link><Link href="/teams?create=1" className="pm-button-primary" onClick={onClose}>开始组队<ArrowRight size={14}/></Link></div></div>
  </WorkspaceDialog>;
}
