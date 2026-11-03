import type { AnyNode } from "domhandler";
import * as cheerio from "cheerio";
import screens from "@/design/screens.json";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listCompetitions } from "@/lib/db/queries";
import { listRecruitmentProjects } from "@/lib/db/projects";
import { listProjectTasks, getLatestCoachReport } from "@/lib/db/tasks";
import { DesignScreen } from "./design-screen";

export type ScreenName = keyof typeof screens;

export async function DesignPage({ name }: { name: ScreenName }) {
  const session = await auth();
  const user = session?.user;
  if ((name === "dashboard" || name === "projects") && !user) redirect("/login");
  const $ = cheerio.load(screens[name]);
  const text = (el: cheerio.Cheerio<AnyNode>) => el.text().replace(/\s+/g, " ").trim();
  const main = $("main");
  $("[data-action=\"favorite\"]").each((index,el)=>{ $(el).attr("data-favorite-key",name+"-"+index); });
  const competitions = name === "competitions" || name === "home" || name === "teams" ? listCompetitions() : [];

  // Header uses the source layout but real authentication state.
  const actions = $("header > div").children().last();
  if (user) {
    actions.html('<a href="/teams/create" class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors shadow-sm">＋ 发布项目</a><a href="/profile" class="flex items-center gap-2.5 pl-2"><span class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center">'+escapeHtml((user.name || "我").slice(0,1))+'</span><span class="hidden lg:flex flex-col text-left"><strong class="text-label-md">'+escapeHtml(user.name || "项目成员")+'</strong><span class="text-label-sm text-on-surface-variant">能力画像 · 个人工作台</span></span></a><a href="/dashboard" class="text-label-sm text-primary">工作台</a>');
  } else {
    actions.html('<a href="/login" class="px-3 py-1.5 text-primary rounded-lg text-label-md font-semibold">登录</a><a href="/register" class="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-label-md font-semibold">免费注册</a>');
  }
  $('header img[alt="ProjectMate Brand Logo"]').parent().wrap('<a href="/" aria-label="ProjectMate 首页"></a>');
  // Preserve the source navigation and route semantics.
  $("a[data-path]").each((_, el) => { if ($(el).attr("href") === "#") $(el).attr("href", "/"); });
  $('a[href="#"]').each((_, el) => {
    const label = text($(el));
    if (/比赛|赛事中心/.test(label)) $(el).attr("href", "/competitions");
    else if (/组队/.test(label)) $(el).attr("href", "/teams");
    else if (/工作台|项目/.test(label)) $(el).attr("href", "/projects");
    else $(el).attr("data-action", "unavailable");
  });
  $("[data-design-handler]").each((_, el) => {
    const $el = $(el); const label = text($el); const handler = $el.attr("data-design-handler") || "";
    if (/closeDemoModal/.test(handler)) $el.attr("data-action", "close-demo");
    else if (/openDemoModal/.test(handler)) $el.attr("data-action", "open-demo");
    else if (/toggleCollect|收藏/.test(handler)) $el.attr("data-action", "favorite");
    else if (/注册/.test(label)) $el.attr("data-route", "/register");
    else if (/登录/.test(label)) $el.attr("data-route", "/login");
    else if (/画像/.test(label)) $el.attr("data-route", "/profile");
    else if (/招募|立即组队/.test(label)) $el.attr("data-route", "/teams/create");
    else if (/探索|筛选出|查看全部/.test(label)) $el.attr("data-route", "/teams");
    else if (/浏览热门比赛|查看赛题|章程/.test(label)) $el.attr("data-route", "/competitions");
    else if (/申请|投递/.test(label)) $el.attr("data-route", "/teams");
    else $el.attr("data-action", "unavailable");
    $el.removeAttr("data-design-handler");
  });
  // Remove the source's fake guest-state switch; the public notice remains informative.
  main.find("button").filter((_, el) => /了解权益差异/.test(text($(el)))).attr("data-action", "access-details");
  $("button").each((_, el) => {
    const e=$(el), label=text(e);
    if(e.attr("data-action")||e.attr("data-route")||e.attr("id"))return;
    if(/发布项目|发布队伍/.test(label))e.attr("data-route","/teams/create");
    else if(/查看赛道详情|查看赛题大纲/.test(label))e.attr("data-route","/competitions");
    else if(/优化.*画像/.test(label))e.attr("data-route","/profile");
    else if(/收藏/.test(label)||e.find('[data-icon="favorite_border"],[data-icon="bookmark_border"]').length)e.attr("data-action","favorite");
  });
  $("input").filter((_,el)=>/搜索比赛、赛道/.test($(el).attr("placeholder")||"")).attr("data-global-search","");

  if (name === "home") {
    main.find("button").filter((_,el)=>/查看全部.*比赛/.test(text($(el)))).attr("data-route","/competitions");
    main.find("a,button").filter((_,el)=>/一键发帖|发帖招募/.test(text($(el)))).attr("data-route","/teams/create");
    const flow = main.find("h2").filter((_,el)=>/四步标准闭环/.test(text($(el))));
    flow.closest("section").attr("id","workflow");
    main.find("h2").filter((_,el)=>/游客模式 vs/.test(text($(el)))).attr("data-access-details","");
  }
  if (name === "competitions") {
    // Keep each source card's complete geometry; bind titles and sources from SQLite.
    const headings=main.find("h3").slice(0,3);
    headings.each((index,el)=>{
      const item=competitions[index];if(!item)return;
      $(el).text(item.name);
      const card=$(el).parents().filter((_,p)=>!!$(p).attr("class")?.includes("rounded-2xl")).first();
      card.attr("data-competition-id",item.id).attr("data-platform",item.platform).attr("data-status",item.status).attr("tabindex","0").attr("role","button");
      card.find("button,a").attr("data-action","select-competition");
    });
    main.find('input[placeholder*="检索比赛名"]').attr("data-competition-search","");
    const platforms = [...new Set(competitions.map(item => item.platform))];
    main.find('input[type="checkbox"]').slice(0,5).each((index,el)=>{
      const label = platforms[index] || ["传智杯", "华为 ICT", "赛氪"][Math.max(0,index-platforms.length)];
      $(el).attr("data-platform-filter",label).prop("checked",true);
      $(el).parent().find("span").first().text(label);
    });
    main.find('input[name="status"]').each((_,el)=>{ $(el).attr("data-status-filter",text($(el).parent())); });
    main.find("h2,h3").filter((_,el)=>/赛事列表/.test(text($(el)))).first().attr("data-results-heading","");
    main.find("button").filter((_,el)=>/重置条件/.test(text($(el)))).attr("data-action","reset-filters");
    main.find("h2").filter((_,el)=>/生产力智能体赛道/.test(text($(el)))).attr("data-selected-competition-title","");
    const original=main.find("a").filter((_,el)=>/组委会官方原文/.test(text($(el))));
    if(competitions[0])original.attr("href",competitions[0].sourceUrl).attr("target","_blank").attr("rel","noreferrer");
    main.find("button").filter((_,el)=>/发起组队/.test(text($(el)))).attr("data-route","/teams/create");
    main.find("button").filter((_,el)=>/AI 生成参赛方案/.test(text($(el)))).attr("data-action","unavailable");
    main.find("[data-selected-competition-title]").text((competitions[0]?.name || "比赛") + " · 赛道分析示例");
  }
  if (name === "dashboard") {
    const h=main.find("h1");h.text("下午好，"+(user?.name || "项目成员")+"！");
    main.find("a,button").filter((_,el)=>/立即组队|发布队伍/.test(text($(el)))).attr("data-route","/teams/create");
    main.find('input[type="checkbox"]').attr("data-action","demo-task");
  }
  if (name === "teams") {
    const projects = listRecruitmentProjects();
    const sampleCards=main.find(".apply-team-btn").filter((_,el)=>!$(el).closest("#ai-synergy-modal").length).map((_,el)=>$(el).closest('[class*="rounded-xl"]').get(0)).get();
    if(projects.length && sampleCards.length){
      const parent=$(sampleCards[0]).parent(); const template=$(sampleCards[0]).clone();
      sampleCards.forEach(el=>$(el).remove());
      projects.forEach(project=>{
        const card=template.clone();card.attr("id","project-"+project.id).attr("data-project-id",project.id).attr("data-project-title",project.title).attr("data-roles",project.roles||"").attr("data-hours",String(project.weeklyHours||10));
        card.find("h3").first().text(project.title);
        card.find("h3").first().next("p").text(project.description);
        card.find("span").filter((_,el)=>/^队长:/.test(text($(el)))).text(project.creatorName || "项目发起人");
        card.find("span").filter((_,el)=>/^每周 \d/.test(text($(el)))).text("每周 "+(project.weeklyHours||10)+"h");
        card.find("span").filter((_,el)=>/^已开工 MVP/.test(text($(el)))).text(project.status);
        card.find("span").filter((_,el)=>/^AI 契合/.test(text($(el)))).text("等待匹配");
        card.find("[data-icon=psychology]").parent().contents().filter((_,el)=>el.type==="text").remove();
        card.find("[data-icon=psychology]").parent().append(escapeHtml(project.trackName || "自拟赛道"));
        const roleBox=card.find("div.space-y-2.mb-5");
        roleBox.find("span.text-error").text("正在招募");
        roleBox.find("div.flex.flex-wrap").html('<span class="px-2.5 py-1 rounded-lg bg-error-container text-on-error-container text-label-sm">'+escapeHtml(project.roles || "待补充角色")+'</span>');
        card.find(".apply-team-btn").attr("data-project-id",project.id).attr("data-action","apply");
        parent.append(card);
      });
    } else main.find(".apply-team-btn").attr("data-action","apply");
    main.find(".view-detail-btn").attr("data-action","team-details");
    if (!projects.length) main.find(".apply-team-btn").filter((_,el)=>!$(el).closest("#ai-synergy-modal").length).each((index,el)=>{const card=$(el).closest('[class*="rounded-xl"]');card.attr("data-project-id","design-sample-"+index).attr("data-demo","true");});
    main.find('input[name="track-type"]').each((_,el)=>{ $(el).attr("value", text($(el).parent())); });
    const select=$("#creator-comp-select");select.empty();competitions.forEach(c=>select.append('<option value="'+escapeHtml(c.id)+'">'+escapeHtml(c.name)+'</option>'));
  }
  if (name === "projects") {
    const report = getLatestCoachReport("demo-project");
    const liveTasks = listProjectTasks("demo-project");
    if(report){
      const conclusion=main.find("span").filter((_,e)=>/结论.*Conclusion/i.test(text($(e)))).first();
      const panel=conclusion.parent().parent();panel.find("p").first().text(report.summary);
      const evidence=main.find("span").filter((_,el)=>/^依据/.test(text($(el)))).first().parent().parent();
      evidence.find("p").text("根据当前项目任务数据库：");
      evidence.find("ul").empty();liveTasks.forEach(task=>evidence.find("ul").append("<li>"+escapeHtml(task.title)+"："+escapeHtml(task.status)+"，优先级"+escapeHtml(task.priority)+"。</li>"));
      main.find("span").filter((_,el)=>/^来源：代码库/.test(text($(el)))).text("来源："+report.source+" · 项目任务数据库");
      main.find("span").filter((_,el)=>/^更新于 14:30/.test(text($(el)))).text("更新于 "+new Date(report.createdAt).toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"}));
    }
    const input=main.find('input[placeholder*="AI 教练"]');input.attr("data-coach-input","");
    input.closest("div").find("button").attr("data-action","coach");
    main.find("button").filter((_,el)=>/发送/.test(text($(el)))).attr("data-action","coach");
    main.find("button").filter((_,el)=>/任务看板|新建任务卡片|筛选视图/.test(text($(el)))).attr("data-route","/projects/tasks");
    $("#btn-update-kanban").attr("data-route","/projects/tasks");
    $("#btn-apply-suggestion").attr("data-action","apply-advice");
    $("#btn-dismiss-suggestion").attr("data-action","dismiss-advice");
    // Existing tasks remain accessible from the source Kanban cards.
    main.find("div").filter((_,el)=>/^#TASK-\d+$/.test(text($(el)))).attr("data-route","/projects/tasks");
    const tasks=listProjectTasks("demo-project");
    tasks.forEach(task=>main.find("span").filter((_,el)=>text($(el)).toUpperCase()==="#"+task.id.toUpperCase()).attr("data-task-id",task.id));
    if(report)main.find('[data-report-placeholder]').text(report.summary);
  }
  $("[data-action='favorite']").each((index,el)=>{
    const card=$(el).parents().filter((_,parent)=>$(parent).find("h3").length===1).first();
    $(el).attr("data-favorite-key",card.find("h3").text().trim().slice(0,250)||name+"-"+index);
  });
  $("#poster-modal p").filter((_,el)=>/AI 正在全网/.test(text($(el)))).text("招募项目已保存，可复制链接邀请搭档加入。");
  return <DesignScreen name={name} html={$("body").html() || ""} loggedIn={!!user} />;
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!)); }
