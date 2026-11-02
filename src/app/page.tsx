import { SiteShell } from "@/components/layout/site-shell";

const events = [
  ["中国高校计算机大赛（C4）", "国家级 A 类", "报名进行中", "14 天"],
  ["全球 AI 创新极客大赛", "国际竞技", "报名进行中", "28 天"],
  ["Kaggle 医疗影像挑战赛", "开源社区", "即将截止", "1 天"],
];

const tracks = [
  ["生成式 AI 原生应用赛道", "Multi-Agent、RAG、端到端生成工作流", "Next.js · 向量检索 · 产品设计"],
  ["具身智能与仿生机器人", "空间计算、VLA、多模态控制和仿真训练", "ROS2 · C++ · PyBullet"],
  ["Web3 与分布式高可用系统", "数据流处理、隐私计算和数字身份", "Rust · Go · Solidity"],
];

export default function PublicHomePage() {
  return (
    <SiteShell>
      <main>
        <section className="mx-auto grid max-w-[1280px] gap-12 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-600">高校极客 · 商业挑战 · 算法竞赛</p>
            <h1 className="mt-5 max-w-3xl text-5xl font-extrabold leading-tight tracking-tight md:text-7xl">把想法变成可以展示的硬核作品</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">面向高校青年与开发者的 AI 赛事协作工作台。智能匹配高胜率赛道，三步完成多元背景组队，更有 AI 教练全程伴随指导。</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/login" className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white">登录开始工作台 →</a>
              <a href="/competitions" className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold">浏览热门比赛</a>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-xs text-slate-500">{["ACM/ICPC", "Kaggle", "Hackathon", "互联网+", "双创"].map((tag) => <span key={tag} className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">{tag}</span>)}</div>
          </div>
          <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-[0_20px_60px_rgba(79,70,229,0.12)]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4"><strong>AI 人岗协同评估流</strong><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">实时运行</span></div>
            <div className="py-7"><p className="text-xs text-slate-500">技术栈互补度</p><div className="mt-2 flex items-end justify-between"><strong className="text-4xl text-indigo-600">96.4%</strong><span className="text-sm text-emerald-600">卓越</span></div><div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-2 w-[96%] rounded-full bg-gradient-to-r from-indigo-600 to-emerald-500" /></div></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="font-semibold">星火医疗智研战队</p><p className="mt-1 text-xs text-slate-500">急聘：前端交互 · 算法工程师</p><a className="mt-4 inline-block text-sm font-semibold text-indigo-600" href="/teams">一键申请入队 →</a></div>
            <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">AI 评审提示：前端工程化和答辩交互是当前最值得补齐的能力。</p>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white"><div className="mx-auto grid max-w-[1280px] grid-cols-2 divide-x divide-slate-200 px-6 py-8 md:grid-cols-4">{[["280+", "权威认证赛事"], ["14,800+", "活跃高校极客"], ["89.4%", "AI 匹配组队达成率"], ["48h", "平均完成跨学科组队"]].map(([value, label]) => <div key={label} className="px-4 first:pl-0"><strong className="block text-2xl">{value}</strong><span className="mt-1 block text-xs text-slate-500">{label}</span></div>)}</div></section>

        <section className="mx-auto max-w-[1280px] px-6 py-20"><Heading eyebrow="Open Competitions" title="热门公开比赛与赛程节点" action="查看全部 →" /><div className="mt-8 grid gap-5 lg:grid-cols-3">{events.map(([name, tag, status, days]) => <article key={name} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex justify-between text-xs"><span className="font-semibold text-indigo-600">{tag}</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">{status}</span></div><h3 className="mt-5 text-lg font-semibold">{name}</h3><div className="mt-5 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">报名截止：<strong>{days}</strong></div><div className="mt-5 flex gap-2"><a href="/competitions" className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-center text-sm">查看赛题</a><a href="/teams" className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white">申请组队</a></div></article>)}</div></section>

        <section className="bg-slate-100/70"><div className="mx-auto max-w-[1280px] px-6 py-20"><Heading eyebrow="Track Matrix" title="热门赛道技术透视与人群定位" action="按类别筛选" /><div className="mt-8 grid gap-5 lg:grid-cols-3">{tracks.map(([name, desc, skills]) => <article key={name} className="rounded-xl border border-slate-200 bg-white p-6"><div className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-50 text-indigo-600">✦</div><h3 className="mt-5 font-semibold">{name}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{desc}</p><p className="mt-5 text-sm font-semibold text-indigo-700">{skills}</p><a href="/competitions" className="mt-6 inline-block text-sm font-semibold text-indigo-600">探索此类队伍 →</a></article>)}</div></div></section>

        <section id="about" className="mx-auto max-w-[1280px] px-6 py-20"><Heading eyebrow="Live Recruiting" title="公开组队精选 · 席位虚位以待" action="一键发帖招募" /><div className="mt-8 grid gap-5 md:grid-cols-2">{["BioInsight：视觉多模态眼底辅助诊断工作站", "AutoRefactor：复杂代码库自主 Code-Agent"].map((name) => <article key={name} className="rounded-xl border border-slate-200 bg-white p-5"><span className="text-xs font-semibold text-indigo-600">正在招募 · 缺 2 位</span><h3 className="mt-3 font-semibold">{name}</h3><p className="mt-3 text-sm text-slate-600">急需：UI/UX 产品设计师 · 前端工程师 · 算法工程师</p><a href="/teams" className="mt-5 inline-block text-sm font-semibold text-indigo-600">投递匹配简历 →</a></article>)}</div></section>
      </main>
    </SiteShell>
  );
}

function Heading({ eyebrow, title, action }: { eyebrow: string; title: string; action: string }) {
  return <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-indigo-600">{eyebrow}</p><h2 className="mt-2 text-3xl font-bold tracking-tight">{title}</h2></div><a href="/competitions" className="text-sm font-semibold text-indigo-600">{action}</a></div>;
}
