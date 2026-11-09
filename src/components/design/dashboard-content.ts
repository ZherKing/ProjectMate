import type { CheerioAPI } from "cheerio";
import { dashboardTemplateData } from "@/lib/db/dashboard";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const date = (value: number) => new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const empty = (text: string, href: string, label: string) => `<div class="rounded-xl bg-surface-container-low p-5 text-body-sm text-on-surface-variant leading-relaxed">${escape(text)}<a class="block mt-3 text-primary font-label-md text-label-md" href="${escape(href)}">${escape(label)} →</a></div>`;
const projectUrl = (id: string, tab = "") => `/projects${tab}?project=${encodeURIComponent(id)}`;

/** Populate the original design instead of building a second dashboard layout. */
export function populateDashboard($: CheerioAPI, userId: string) {
  const data = dashboardTemplateData(userId);
  if (!data) return;
  const main = $("main");
  main.attr("data-dashboard-template", "original");
  main.find("[data-design-handler]").removeAttr("data-design-handler");
  main.find("[data-action],[data-route]").removeAttr("data-action").removeAttr("data-route");
  const shell = main.children("div").first().children("div").first();
  const hero = shell.children("section").first();
  const badgeRow = hero.find("h1").prev();
  const badge = badgeRow.children().first();
  const badgeIcon = badge.find("svg").first().toString();
  badge.html(`${badgeIcon} 个人协作工作台`);
  badgeRow.children().eq(1).text("项目与待办 · 实时汇总");
  hero.find("h1").text(`你好，${data.name}！`);
  hero.find("h1").next("p").text(`当前参与 ${data.projects.length} 个项目，还有 ${data.unfinished} 项待办未完成。${data.recommendations.length ? `根据个人资料和赛事状态，为你整理了 ${data.recommendations.length} 场推荐赛事。` : "完善技术标签与兴趣方向，发现适合自己的赛事和队伍。"}`);
  hero.find("button").eq(0).attr("data-route", "/teams?create=1");
  hero.find("button").eq(1).attr("data-route", "/settings#technical-skills");
  const deadline = data.deadlines[0];
  const days = deadline ? Math.max(1, Math.ceil((deadline.deadline - Date.now()) / 86400000)) : null;
  const metrics = [
    ["推荐赛事", data.recommendations.length, "场可查看", "根据个人资料与赛事状态", "/competitions/recommendations"],
    ["参与项目", data.projects.length, "个协作项目", `其中 ${data.projects.filter(p => p.role === "创建者").length} 个由你创建`, "/projects"],
    ["未读通知", data.notifications.unread, "条待查看", "查看邀请与申请处理结果 →", "/settings/notifications"],
    ["近期赛事截止", days ?? "—", days ? "天内截止" : "暂无截止", deadline?.name || "未来 7 天暂无关联赛事截止", "/competitions/favorites"],
  ];
  hero.children("div.grid").children().each((index, element) => {
    const card = $(element), metric = metrics[index];
    card.attr("data-dashboard-metric", String(index));
    card.children().first().find("span").text(String(metric[0]));
    card.children().eq(1).children().eq(0).text(String(metric[1]));
    card.children().eq(1).children().eq(1).text(String(metric[2]));
    card.children().eq(2).text(String(metric[3])).addClass("line-clamp-2");
    card.wrap(`<a href="${metric[4]}" class="block min-w-0"></a>`);
    card.addClass("h-full");
  });
  const grid = shell.children("div.grid").last();
  const left = grid.children().eq(0), right = grid.children().eq(1);
  const recommendations = left.children("section").eq(0);
  recommendations.find("h2").text("赛事与赛道推荐");
  recommendations.find("h2").next("span").text("资料规则推荐");
  recommendations.children().first().find("p").text("根据技术标签、兴趣方向、角色及赛事报名状态排序，不自动调用 AI。");
  recommendations.children().first().children().last().html('<a href="/competitions/recommendations" class="font-label-sm text-label-sm text-primary whitespace-nowrap">查看全部 →</a>');
  const recList = recommendations.children().eq(1);
  const recTemplate = recList.children().first().clone();
  recList.empty();
  for (const event of data.recommendations.slice(0, 3)) {
    const card = recTemplate.clone();
    const top = card.children().first(), summary = top.children().first(), tags = summary.children().first();
    tags.children().eq(0).text(event.matched.length ? "方向相关" : "报名状态推荐");
    tags.children().eq(1).text(event.platform);
    tags.children().eq(2).text(event.trackNames[0] || "赛事信息");
    const href = "/competitions?q=" + encodeURIComponent(event.name);
    summary.find("h3").text(event.name).wrapInner(`<a href="${escape(href)}"></a>`);
    summary.children("p").text(event.trackNames.length ? "赛道方向：" + event.trackNames.join("、") : "具体参赛要求与赛道方向请以赛事原文为准。");
    top.children().last().children("span").text(event.status);
    top.children().last().children("p").text("更新于 " + date(event.updatedAt));
    const reason = card.children().eq(1);
    reason.find("p").eq(0).text("推荐依据");
    reason.find("span.font-mono-metric").text("来源：" + event.platform);
    reason.find("p").eq(1).text(event.matched.length ? `个人资料中的 ${event.matched.join("、")} 与赛事标题或赛道相关。请进一步查看官方要求，确认参赛资格、时间和具体方向。` : "该赛事当前处于报名或进行阶段，作为探索候选展示；尚未发现直接技能关联，请先确认方向是否适合。");
    const controls = reason.children().last();
    controls.html(`<div class="flex items-center gap-2"><a href="/teams?create=1&amp;competition=${encodeURIComponent(event.id)}" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container">开始组队</a><a href="${escape(href)}" class="px-3 py-1.5 text-primary font-label-md text-label-md">查看赛事详情 →</a></div>`);
    recList.append(card);
  }
  if (!data.recommendations.length) recList.html(empty(data.profile?.skills ? "暂时没有匹配的赛事，可补充兴趣方向或浏览全部比赛。" : "先填写技术主攻标签与方向，再查看个性化赛事推荐。", "/settings#technical-skills", "完善推荐资料"));

  const project = left.children("section").eq(1);
  const heading = project.children().eq(0);
  const active = data.active;
  heading.find("h2").text(active ? "当前协作项目：" + active.name : "当前协作项目");
  heading.find("p").text(active ? `目标赛事：${data.overview?.project.competitionName || "未关联赛事"} · ${data.overview?.project.trackName || "未设置赛道"} · 角色：${active.role}` : "暂无参与的项目，创建或加入队伍后在这里查看协作进展。");
  heading.children().last().children("span").text(active?.status || "尚未加入项目");
  heading.find("a").attr("href", active ? projectUrl(active.id) : "/teams").text(active ? "进入工作台 →" : "发现队伍 →");
  const meters = project.children().eq(1), progress = meters.children().eq(0);
  progress.find("span.font-mono-metric").first().text(data.progress + "% COMPLETED");
  progress.find('[style*="width"]').first().attr("style", `width:${data.progress}%`).attr("role", "progressbar").attr("aria-label", "项目任务完成度").attr("aria-valuenow", String(data.progress)).attr("aria-valuemin", "0").attr("aria-valuemax", "100");
  const states = [["已完成", data.completed], ["进行中", data.activeTasks.filter(t => t.status === "进行中").length], ["其他未完成", data.activeTasks.filter(t => t.status !== "已完成" && t.status !== "进行中").length]];
  progress.children().eq(1).children().each((index, element) => {
    $(element).find("span").text(String(states[index][0]));
    $(element).find("p").text(states[index][1] + " 项");
  });
  const risk = meters.children().eq(1);
  risk.children().first().children("div").text("AI 项目教练");
  risk.children().first().children("p").text(data.report ? data.report.summary.slice(0, 400) : "暂无分析。进入项目教练，根据真实任务和进度生成协作建议。").addClass("line-clamp-6");
  risk.children().eq(1).find("p").first().text(data.report ? "生成于 " + date(data.report.createdAt) : "基于项目实际任务分析");
  risk.children().eq(1).find("p").last().html(`<a href="${active ? projectUrl(active.id, "/coach") : "/teams"}" class="text-primary">${active ? "打开 AI 教练" : "先加入项目"} →</a>`);
  const tasks = project.children().eq(2);
  tasks.find("h4").text(`项目待办清单（${data.activeTasks.filter(t => t.status !== "已完成").length} 项未完成）`);
  tasks.children().first().children("span").text("在任务看板中编辑与标记完成");
  const taskList = tasks.children().last();
  taskList.empty();
  for (const task of [...data.activeTasks].sort((a,b) => Number(a.status === "已完成") - Number(b.status === "已完成")).slice(0,5)) {
    taskList.append(`<a href="${projectUrl(task.projectId, "/tasks")}" class="flex items-start justify-between gap-3 p-3 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors"><span class="font-body-md text-body-md text-on-surface min-w-0 break-words">${task.status === "已完成" ? "✓" : "○"} ${escape(task.title)}</span><span class="shrink-0 px-2 py-0.5 rounded bg-surface-container-highest font-label-sm text-label-sm text-on-surface-variant">${escape(task.status)}</span></a>`);
  }
  if (!data.activeTasks.length) taskList.html(empty("暂无项目待办。添加任务后，这里的进度条会随实际完成情况更新。", active ? projectUrl(active.id, "/tasks") : "/teams", active ? "添加待办事项" : "发现队伍"));

  const radar = right.children("section").eq(0);
  if (!data.deadlines.length) radar.children().first().children("span").remove();
  const radarList = radar.children().eq(1).empty();
  for (const event of data.deadlines.slice(0,4)) radarList.append(`<a href="/competitions?q=${encodeURIComponent(event.name)}" class="p-3.5 rounded-xl bg-error-container/30 border-l-4 border-error flex flex-col gap-2"><div class="flex flex-wrap items-center justify-between gap-2"><span class="px-2 py-0.5 rounded bg-error text-on-error font-mono-metric text-mono-metric">${Math.max(1,Math.ceil((event.deadline-Date.now())/86400000))} 天内截止</span><span class="font-mono-metric text-mono-metric text-error">${date(event.deadline)}</span></div><h4 class="font-label-md text-label-md text-on-surface font-bold break-words">${escape(event.name)}</h4><p class="font-body-sm text-body-sm text-on-surface-variant">收藏或项目关联赛事 · 以官方公告为准</p></a>`);
  if (!data.deadlines.length) radarList.html(empty("未来 7 天暂无收藏或项目关联赛事截止。", "/competitions/favorites", `查看我的收藏（${data.favoriteCount}）`));
  const teams = right.children("section").eq(1);
  teams.children().first().find("p").text("根据技术标签与招募岗位进行规则匹配");
  const teamList = teams.children().eq(1).empty();
  for (const team of data.teams.items.slice(0,2)) teamList.append(`<div class="p-3.5 rounded-xl bg-surface-container-low flex flex-col gap-2.5"><span class="font-label-sm text-label-sm text-primary">招募：${escape(team.roles)}</span><h4 class="font-label-md text-label-md text-on-surface font-bold break-words">${escape(team.title)}</h4><p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">${escape(team.reason)}</p><div class="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant/20"><span class="font-mono-metric text-mono-metric text-on-surface-variant">${team.memberCount} 人已在队${team.maxMembers ? ` / 上限 ${team.maxMembers} 人` : ""}</span><a href="/teams?team=${encodeURIComponent(team.id)}" class="px-3 py-1 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm">查看队伍</a></div></div>`);
  if (!data.teams.items.length) teamList.html(empty(data.teams.hasProfile ? "暂时没有与你技能直接相关的招募队伍。" : "填写技术主攻标签与方向，发现适合的招募队伍。", data.teams.hasProfile ? "/teams" : "/settings#technical-skills", data.teams.hasProfile ? "浏览组队大厅" : "完善个人画像"));
  const profile = right.children("section").eq(2);
  const fields = [data.profile?.skills, data.profile?.roles, data.profile?.interests, data.profile?.weeklyHours];
  const filled = fields.filter(Boolean).length;
  profile.children().first().children().first().text("个人匹配资料");
  profile.children().first().children().last().text(`${filled} / 4 项已填写`);
  profile.children().eq(1).children().attr("class", "h-full bg-primary").attr("style", `width:${filled*25}%`);
  profile.children().last().html((data.profile?.skills || "").split(/[,，、/|\s]+/).filter(Boolean).slice(0,8).map(skill => `<span class="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-mono-metric text-mono-metric">${escape(skill)}</span>`).join("") + '<a href="/settings#technical-skills" class="text-primary font-label-sm text-label-sm">编辑资料 →</a>');
  right.append(`<section class="bg-surface-container-lowest rounded-xl p-5 shadow-sm"><div class="flex items-center justify-between mb-4"><h3 class="font-title-md text-title-md text-on-surface">邀请与近期通知</h3><a href="/settings/notifications" class="text-primary font-label-sm text-label-sm">查看全部 →</a></div><div class="flex flex-col gap-3.5">${data.notifications.items.length ? data.notifications.items.slice(0,3).map(item => `<a href="${escape(item.href)}" class="p-3.5 rounded-xl bg-surface-container-low"><h4 class="font-label-md text-label-md text-on-surface font-bold">${escape(item.title)}${item.readAt ? "" : " · 未读"}</h4><p class="font-body-sm text-body-sm text-on-surface-variant mt-1 line-clamp-2">${escape(item.message)}</p></a>`).join("") : '<p class="font-body-sm text-body-sm text-on-surface-variant">暂无邀请或通知。</p>'}</div></section>`);
}
