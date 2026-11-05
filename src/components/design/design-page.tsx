import type { AnyNode } from "domhandler";
import * as cheerio from "cheerio";
import screens from "@/design/screens.json";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getCompetition, getCompetitionTrackDetails, listCompetitionTracks, listCompetitions, listFavoriteCompetitionIds, listPendingCompetitions, listAdminUsers, listAdminAuditLogs } from "@/lib/db/queries";
import { getProfile } from "@/lib/db/profile";
import { requireAdmin } from "@/lib/auth/guards";
import { listRecruitmentProjects } from "@/lib/db/projects";
import { listProjectTasks, getLatestCoachReport } from "@/lib/db/tasks";
import { DesignScreen } from "./design-screen";

export type ScreenName = keyof typeof screens;

export async function DesignPage({ name, variant, query }: { name: ScreenName; variant?: "register"; query?: Record<string, string | string[] | undefined> }) {
  const session = await auth();
  const user = session?.user;
  if ((name === "dashboard" || name === "projects" || name === "settings" || name === "competitionDetail") && !user) redirect("/login");
  if (name === "admin" && !(await requireAdmin())) redirect("/login?next=/admin");
  const $ = cheerio.load(screens[name]);
  const text = (el: cheerio.Cheerio<AnyNode>) => el.text().replace(/\s+/g, " ").trim();
  const main = $("main");
  $("[data-action=\"favorite\"]").each((index,el)=>{ $(el).attr("data-favorite-key",name+"-"+index); });
  const competitions = name === "competitions" || name === "home" || name === "teams" ? listCompetitions() : [];
  if (name === "competitionDetail") {
    // 详情页只呈现设计稿中的卡片，不重复渲染站点导航、页脚和背景模拟列表。
    $("body > header").remove();
    $("body > footer").remove();
    main.children("div").first().children("div").first().remove();
    main.removeClass("pt-16 bg-surface").addClass("min-h-screen");
  }
  if (name === "settings" && user?.id) {
    const profile = getProfile(user.id);
    main.find('input[type="text"]').filter((_,el)=>$(el).attr("value")==="计算机科学与软件学院 (2022级本硕)").attr("value", profile?.school || "");
    main.find('input[type="text"]').filter((_,el)=>$(el).attr("value")==="林星宇").attr("value", user.name || "");
    main.find('input').eq(3).attr("value", profile?.skills || "");
    main.find('input[type="email"]').attr("value", user.email || "");
    main.find("button").filter((_,el)=>/保存个人设置/.test(text($(el)))).attr("data-action","save-settings");
    main.find("#save-settings-btn").closest("div.sticky").attr("data-settings-save-bar","").addClass("hidden");
    main.find("button").filter((_,el)=>/立即接入 OAuth 认证|接入新 MCP 协议|更新密码|重置密钥|注销 Token|申请永久注销/.test(text($(el)))).attr("data-action","unavailable");
    main.find("button").filter((_,el)=>/退出当前登录会话/.test(text($(el)))).attr("data-action","logout");
  }
  if (name === "admin") {
    const pending = listPendingCompetitions();
    const adminUsers = listAdminUsers();
    const auditLogs = listAdminAuditLogs();
    main.find("tbody tr").remove();
    if (!pending.length) main.find("tbody").append('<tr><td colspan="6" class="py-12 text-center text-body-md text-on-surface-variant">当前没有待审核赛事。</td></tr>');
    pending.forEach((item) => main.find("tbody").append(`<tr data-review-id="${escapeHtml(item.id)}"><td class="py-4 px-4"><strong>${escapeHtml(item.name)}</strong><span class="block text-on-surface-variant">${escapeHtml(item.platform)} · ${escapeHtml(item.season || "")}</span></td><td class="py-4 px-4">${escapeHtml(item.platform)}</td><td class="py-4 px-4">${new Date(item.updatedAt).toLocaleString("zh-CN")}</td><td class="py-4 px-4">待校验</td><td class="py-4 px-4">待人工初审</td><td class="py-4 px-4 text-right"><a class="mr-2" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">原文</a><button type="button" data-review-action="approve" data-review-id="${escapeHtml(item.id)}">通过</button><button type="button" data-review-action="reject" data-review-id="${escapeHtml(item.id)}">退回</button></td></tr>`));
    main.find("span").filter((_,el)=>/共 3 条待审/.test(text($(el)))).text(`共 ${pending.length} 条待审`);
    main.find("button").filter((_,el)=>/^通过$/.test(text($(el)))).attr("data-action", "review-approve");
    main.find("button").filter((_,el)=>/^退回$/.test(text($(el)))).attr("data-action", "review-reject");
    main.find("button").filter((_,el)=>/用户与角色管理/.test(text($(el)))).attr("data-action", "admin-users");
    main.find("button").filter((_,el)=>/操作审计日志/.test(text($(el)))).attr("data-action", "admin-audit");
    main.append(`<section id="admin-users-panel" class="hidden mt-6 p-6 rounded-xl bg-surface-container-lowest shadow-sm"><div class="flex items-center justify-between mb-4"><h2 class="font-title-md text-title-md text-on-surface">用户与角色管理</h2><span class="font-body-sm text-body-sm text-on-surface-variant">${adminUsers.length} 位用户</span></div><div class="space-y-3">${adminUsers.map((item)=>`<div class="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-lg bg-surface-container-low" data-admin-user-id="${escapeHtml(item.id)}"><div><strong>${escapeHtml(item.name || "未设置昵称")}</strong><span class="block text-body-sm text-on-surface-variant">${escapeHtml(item.email)}</span></div><div class="flex items-center gap-2"><select class="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-sm" data-admin-role><option value="user"${item.role === "user" ? " selected" : ""}>普通用户</option><option value="admin"${item.role === "admin" ? " selected" : ""}>管理员</option></select><button type="button" data-action="admin-role" class="rounded-lg bg-primary px-3 py-2 text-label-sm text-on-primary">保存角色</button></div></div>`).join("")}</div></section>`);
    main.append(`<section id="admin-audit-panel" class="hidden mt-6 p-6 rounded-xl bg-surface-container-lowest shadow-sm"><div class="flex items-center justify-between mb-4"><h2 class="font-title-md text-title-md text-on-surface">操作审计日志</h2><span class="font-body-sm text-body-sm text-on-surface-variant">最近 ${auditLogs.length} 条</span></div><div class="space-y-2">${auditLogs.length ? auditLogs.map((item)=>`<div class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 p-3 rounded-lg bg-surface-container-low"><div><strong>${escapeHtml(item.action)}</strong><span class="block text-body-sm text-on-surface-variant">${escapeHtml(item.actorEmail || item.actorId)} · ${escapeHtml(item.targetType)}:${escapeHtml(item.targetId)}</span></div><time class="text-body-sm text-on-surface-variant">${new Date(item.createdAt).toLocaleString("zh-CN")}</time></div>`).join("") : '<p class="text-body-sm text-on-surface-variant">暂无审计记录。</p>'}</div></section>`);
  }
  if (name === "competitionDetail") {
    const rawId = query?.id;
    const selectedId = (Array.isArray(rawId) ? rawId[0] : rawId) || listCompetitions()[0]?.id || "";
    const competition = getCompetition(selectedId) || listCompetitions()[0];
    const tracks = competition ? getCompetitionTrackDetails(competition.id) : [];
    if (competition) {
      main.find("h1").filter((_,el)=>/2025 CCF|赛事详情/.test(text($(el)))).last().text(competition.name);
      main.find("span").filter((_,el)=>/报名进行中|待核验/.test(text($(el)))).first().text(competition.status);
      main.find("a").filter((_,el)=>/ccf.org|官方权威来源/.test(text($(el)))).attr("href", competition.sourceUrl).text("查看赛事原文");
      main.find("button").filter((_,el)=>/Track-A|Track-B|Track-C/.test(text($(el)))).remove();
      const trackHost = main.find("h2").filter((_,el)=>/赛题方向列表/.test(text($(el)))).parent();
      const trackTemplate = main.find("button").filter((_,el)=>/赛题/.test(text($(el)))).first();
      tracks.slice(0, 6).forEach((track, index) => trackHost.after('<button type="button" data-track-id="'+escapeHtml(track.id)+'" class="w-full text-left p-4 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition"><strong>'+escapeHtml(track.name)+'</strong><span class="block mt-1 text-body-sm text-on-surface-variant">'+escapeHtml(track.description || "暂无赛道说明")+'</span></button>'));
      main.find("h1").last().text(tracks[0]?.name || "暂无赛道说明");
    }
  }

  // Header uses the source layout but real authentication state.
  const actions = $("header > div").children().last();
  if (user) {
    actions.html('<a href="/teams/create" class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors shadow-sm">＋ 发布项目</a><details class="pm-user-menu"><summary class="flex items-center gap-2.5 pl-2 cursor-pointer list-none"><span class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center">'+escapeHtml((user.name || "我").slice(0,1))+'</span><span class="hidden lg:flex flex-col text-left"><strong class="text-label-md">'+escapeHtml(user.name || "项目成员")+'</strong></span></summary><div class="pm-user-menu-panel"><a href="/settings">个人设置</a><a href="/api/auth/signout?callbackUrl=/">退出登录</a></div></details>');
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
    if (/togglePasswordVisibility/.test(handler)) $el.attr("data-action", "toggle-password");
    else if (/switchLoginMethod/.test(handler)) $el.attr("data-action", handler.includes("sms") ? "auth-sms" : "auth-password");
    else if (/switchAuthTab/.test(handler)) {
      if (handler.includes("register")) $el.attr("data-route", "/register");
      else $el.attr("data-action", "auth-password");
    }
    else if (/triggerOAuthLogin|triggerCountdown/.test(handler)) $el.attr("data-action", "auth-unavailable");
    else if (name === "login" && /忘记密码/.test(label)) $el.attr("data-action", "auth-unavailable");
    else if (/closeDemoModal/.test(handler)) $el.attr("data-action", "close-demo");
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
  if (name === "login") {
    main.addClass("overflow-x-clip");
    $("#principalInput").attr("autocomplete","username").attr("maxlength","254").attr("type","email").attr("placeholder","请输入注册邮箱");
    $('label[for="principalInput"]').text("登录邮箱");
    $("#passwordInput").attr("autocomplete","current-password").attr("maxlength","256");
    $("#smsInput").prop("disabled",true);
    $('[data-action="toggle-password"]').attr("aria-label","显示密码").attr("aria-pressed","false");
    $("#authForm").attr("data-auth-form","");
    if (variant === "register") {
      $("#authForm").attr("id", "registerForm").removeAttr("data-auth-form").attr("data-register-form", "");
      $("#btnMethodPwd").parent().html('<span class="font-label-md text-label-md text-primary">邮箱注册</span>');
      $("#passwordFieldGroup").remove();
      $("#smsFieldGroup").remove();
      const form = $("#registerForm");
      form.html(`
        <div class="space-y-1.5"><label class="block font-label-md text-label-md text-on-surface" for="registerName">昵称</label><div class="relative flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="lucide lucide-user-round absolute left-3.5 design-icon text-[20px] text-on-surface-variant"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg><input class="w-full pl-11 pr-4 py-3 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary transition-all" id="registerName" name="name" placeholder="输入你的昵称" required type="text" maxlength="40"></div></div>
        <div class="space-y-1.5"><label class="block font-label-md text-label-md text-on-surface" for="registerEmail">注册邮箱</label><div class="relative flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="lucide lucide-mail absolute left-3.5 design-icon text-[20px] text-on-surface-variant"><path d="m4 4 8 6 8-6"></path><rect width="20" height="16" x="2" y="4" rx="2"></rect></svg><input class="w-full pl-11 pr-4 py-3 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary transition-all" id="registerEmail" name="email" placeholder="name@university.edu.cn" required type="email" maxlength="254"></div></div>
        <div class="space-y-1.5"><label class="block font-label-md text-label-md text-on-surface" for="registerPassword">设置密码</label><div class="relative flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="lucide lucide-lock-keyhole absolute left-3.5 design-icon text-[20px] text-on-surface-variant"><circle cx="12" cy="16" r="1"></circle><rect width="18" height="12" x="3" y="10" rx="2"></rect><path d="M7 10V7a5 5 0 0 1 10 0v3"></path></svg><input class="w-full pl-11 pr-4 py-3 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary transition-all" id="registerPassword" name="password" placeholder="至少 8 位密码" required type="password" minlength="8" maxlength="256"></div></div>
        <div class="space-y-1.5"><label class="block font-label-md text-label-md text-on-surface" for="registerPasswordConfirm">确认密码</label><div class="relative flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="lucide lucide-shield-check absolute left-3.5 design-icon text-[20px] text-on-surface-variant"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20 4 17.5 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg><input class="w-full pl-11 pr-4 py-3 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary transition-all" id="registerPasswordConfirm" name="passwordConfirm" placeholder="再次输入密码" required type="password" minlength="8" maxlength="256"></div></div>
        <div class="flex items-center justify-between pt-1"><span class="font-body-sm text-body-sm text-on-surface-variant">注册后可完善能力画像</span><span class="font-body-sm text-body-sm text-on-surface-variant">受 TLS 1.3 安全保护</span></div>
        <div class="pt-2"><button class="w-full py-3.5 px-6 rounded-lg bg-primary text-on-primary font-title-md text-title-md hover:bg-primary-container shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2" id="registerSubmit" type="submit"><span>创建账号</span></button></div>
      `);
      $("#registerForm").closest(".lg\\:col-span-6").find(".flex.items-center.justify-between.pb-4").find("button").first().attr("data-route", "/login").removeAttr("data-design-handler").text("账号登录").removeClass("text-primary border-b-2 border-primary").addClass("text-on-surface-variant");
      $("#registerForm").closest(".lg\\:col-span-6").find(".flex.items-center.justify-between.pb-4").find("button").last().text("快速注册").removeAttr("data-design-handler").addClass("text-primary border-b-2 border-primary").removeClass("text-on-surface-variant");
      main.find("span").filter((_,el)=>/新用户登录自动开启/.test(text($(el)))).parent().html('<span>已有账号？</span><a class="text-primary hover:underline font-label-sm" href="/login">返回账号登录</a>');
    }
  }
  if (name === "home") {
    main.find("aside").filter((_,el)=>/游客浏览模式已就绪/.test(text($(el)))).each((_,el)=>{
      if(user) $(el).remove();
      else $(el).find("button").filter((_,button)=>/立即登录/.test(text($(button)))).attr("data-route","/login");
    });
    main.find("button").filter((_,el)=>/登录开始工作台/.test(text($(el)))).each((_,el)=>{
      $(el).attr("data-route",user?"/dashboard":"/login").removeAttr("data-action");
      if(user) {
        const icon=$(el).find("svg").first().clone();
        $(el).empty().append(icon).append("<span>进入个人工作台</span>");
      }
    });
    main.find("h2").filter((_,el)=>/游客模式 vs/.test(text($(el)))).text("公开浏览与登录后功能").attr("data-access-details","");
    main.find("th").filter((_,el)=>/当前：游客模式/.test(text($(el)))).text("公开浏览");
    main.find("th").filter((_,el)=>/已登录账号/.test(text($(el)))).text("登录后");
    if(user) main.find("button").filter((_,el)=>/免费注册账号/.test(text($(el)))).text("进入个人工作台").attr("data-route","/dashboard");
    main.find("button").filter((_,el)=>/查看全部.*比赛/.test(text($(el)))).attr("data-route","/competitions");
    main.find("a,button").filter((_,el)=>/一键发帖|发帖招募/.test(text($(el)))).attr("data-route","/teams/create");
    const flow = main.find("h2").filter((_,el)=>/四步标准闭环/.test(text($(el))));
    flow.closest("section").attr("id","workflow");
  }
  if (name === "competitions") {
    const headings=main.find("h3").slice(0,3);
    const listColumn=headings.first().closest("article").parent();
    listColumn.removeClass("xl:col-span-5").addClass("xl:col-span-12");
    const template=headings.first().closest("article").clone();
    const trackGroups=new Map(listCompetitionTracks().map(track=>[track.competitionId,track]));
    const favoriteKeys=user?.id ? listFavoriteCompetitionIds(user.id) : new Set<string>();
    const articleGrid=$('<div class="grid grid-cols-1 md:grid-cols-2 gap-6"></div>');
    listColumn.children("article").appendTo(articleGrid);
    listColumn.append(articleGrid);
    listColumn.attr("data-competition-list-panel","");
    listColumn.append('<div class="flex items-center justify-between gap-3 pt-2" data-pagination><button type="button" class="px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant text-label-sm disabled:opacity-40" data-page-prev disabled>上一页</button><span class="font-mono-metric text-mono-metric text-on-surface-variant" data-page-label>第 1 页</span><button type="button" class="px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant text-label-sm disabled:opacity-40" data-page-next>下一页</button></div>');
    const listContainer=articleGrid;
    listContainer.children("article").remove();
    competitions.forEach((item,index)=>{
      const card=template.clone();
      card.find(".absolute,[class*=grid-cols-3]").remove();
      card.find("div").filter((_,el)=>($(el).attr("class")||"").includes("flex flex-wrap gap-1.5")).remove();
      const title=card.find("h3").first().text(item.name);
      title.parent().find("p").first().text(item.platform);
      title.parent().find("span").first().text(item.status);
      title.parent().find("span").eq(1).remove();
      const tracks=trackGroups.get(item.id);
      const searchText=[item.name,item.platform,item.status,item.season,...(tracks?.names||[])].join(" ");
      const deadline=tracks?.deadline ?? null;
      card.attr("data-competition-id",item.id).attr("data-action","open-competition-detail").attr("data-platform",item.platform).attr("data-status",item.status).attr("data-favorite",String(favoriteKeys.has(item.id)||favoriteKeys.has(item.name)))
        .attr("data-search-text",searchText).attr("data-updated-at",String(item.updatedAt)).attr("data-default-order",String(index))
        .attr("data-deadline",deadline==null?"":String(deadline)).attr("data-source-url",item.sourceUrl)
        .attr("tabindex","0").attr("role","button").attr("aria-label",item.name);
      card.find("span").filter((_,el)=>/官方规约已校验/.test(text($(el)))).text("来源："+item.platform);
      card.find("span").filter((_,el)=>/查看赛道专区/.test(text($(el)))).first().replaceWith('<button type="button" data-action="open-competition-detail" data-competition-id="'+escapeHtml(item.id)+'" class="font-label-md text-label-md text-primary">详情</button>');
      card.find("p").first().after('<p class="mt-2 text-body-sm text-on-surface-variant">更新于 '+escapeHtml(new Date(item.updatedAt).toLocaleDateString("zh-CN"))+ (tracks?.names.length?' · '+tracks.names.length+' 个赛道':'')+'</p>');
      listContainer.append(card);
    });
    main.find('input[placeholder*="检索比赛名"]').attr("data-competition-search","").attr("aria-label","搜索比赛、平台或赛道").attr("placeholder","搜索比赛名称、平台或赛道…");
    const platformInputs=main.find('input[type="checkbox"]').slice(0,5);
    const platformTemplate=platformInputs.first().closest("label").clone();
    const platformContainer=platformInputs.first().closest("label").parent();
    platformInputs.each((_,el)=>{ $(el).closest("label").remove(); });
    const platforms=[...new Set(competitions.map(item=>item.platform))];
    platforms.forEach(platform=>{
      const option=platformTemplate.clone();
      option.find("input").attr("data-platform-filter",platform).attr("aria-label",platform).prop("checked",true);
      option.find("input").next("span").text(platform);
      option.children("span").last().text(String(competitions.filter(item=>item.platform===platform).length));
      platformContainer.append(option);
    });
    main.find("span").filter((_,el)=>text($(el))==="5类").text(platforms.length+"类");
    const statuses=[...new Set(competitions.map(item=>item.status))];
    const statusInput=main.find('input[name="status"]').first();
    const statusTemplate=statusInput.closest("label").clone();
    const statusContainer=statusInput.closest("label").parent();
    statusContainer.empty();
    ["全部状态",...statuses].forEach((status,index)=>{
      const option=statusTemplate.clone();
      option.find("input").attr("data-status-filter",index===0?"":status).attr("value",index===0?"":status).prop("checked",index===0);
      option.find("span").first().text(status);
      statusContainer.append(option);
    });
    main.find("span").filter((_,el)=>["大模型/Agent","全栈应用","智能硬件/IoT","数据科学/ML","Web3与密码学"].includes(text($(el)))).each((_,el)=>{
      $(el).removeAttr("role tabindex aria-pressed data-selected data-track-filter")
        .attr("aria-disabled","true").attr("title","赛事来源未提供统一分类；可用上方关键词搜索真实赛道名称")
        .removeClass("bg-primary-fixed text-primary").addClass("bg-surface-container-low text-on-surface-variant opacity-60 cursor-default");
    });
    main.find("button").filter((_,el)=>/团队 \(1-5人\)|个人挑战/.test(text($(el)))).prop("disabled",true).attr("title","来源未提供统一参赛模式，暂不可筛选").addClass("opacity-50 cursor-not-allowed");
    main.find("span").filter((_,el)=>["仅本科","硕博不限","全员无门槛"].includes(text($(el)))).attr("title","来源未提供统一资格信息，暂不可筛选").addClass("opacity-50");
    const sortOptions=new Map([["AI 匹配优先",["默认顺序","default"]],["截止最近",["截止最近","deadline"]],["热度优先",["名称排序","name"]],["最新发布",["最近更新","updated"]]]);
    main.find("button").each((_,el)=>{const option=sortOptions.get(text($(el)));if(option)$(el).text(option[0]).attr("data-sort-filter",option[1]);});
    const count=main.find("span").filter((_,el)=>/^共匹配 /.test(text($(el)))).first().attr("data-results-heading","").text("共匹配 "+competitions.length+" 项赛事");
    count.parent().after('<p class="hidden rounded-xl bg-surface-container-low p-5 text-body-md text-on-surface-variant" data-no-competitions role="status">没有匹配的赛事，请调整关键词或筛选条件。</p>');
    main.find("button").filter((_,el)=>/重置条件/.test(text($(el)))).attr("data-action","reset-filters");
    main.find("button").filter((_,el)=>/精准筛选/.test(text($(el)))).attr("data-action","apply-filters");
    main.find("[data-page-prev]").attr("data-action","page-prev");
    main.find("[data-page-next]").attr("data-action","page-next");
    main.find("#filter-tabs button").first().find("span").last().text(String(competitions.length));
    main.find("button").filter((_,el)=>/发起组队/.test(text($(el)))).attr("data-route","/teams/create");
    main.find("h2").filter((_,el)=>/生产力智能体赛道/.test(text($(el)))).closest("section").remove();
    const detailDoc=cheerio.load(screens.competitionDetail);
    const detailCard=detailDoc("#competition-detail-card").clone();
    detailCard.attr("id","competition-detail-modal-card");
    detailCard.find("footer button").remove();
    detailCard.find("footer").find("div").last().append('<a class="px-4 py-2 rounded-lg bg-surface-container text-primary font-label-md text-label-md" data-action="view-competition-source" target="_blank" rel="noreferrer">查看赛事页面</a><button class="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md" type="button" data-action="start-team">开始组队</button>');
    detailCard.find("header button").filter((_,el)=>/closeModal/.test($(el).attr("data-design-handler")||"")).attr("data-action","close-competition-detail").removeAttr("data-design-handler");
    detailCard.find("span").filter((_,el)=>/ESC 可关闭/.test(text($(el)))).remove();
    detailCard.find("#fav-btn").attr("data-action","detail-favorite").removeAttr("data-design-handler");
    detailCard.find("span").filter((_,el)=>/报名进行中|待核验/.test(text($(el)))).first().attr("data-modal-status","");
    detailCard.find("button").filter((_,el)=>/赛题 Track-/.test(text($(el)))).each((index,el)=>{ $(el).attr("data-track-id",String(index)); });
    detailCard.find("[data-design-handler]").removeAttr("data-design-handler");
    const trackData=Object.fromEntries(competitions.map((item)=>[item.id,(trackGroups.get(item.id)?.names||[])]));
    const modalHtml='<div id="competition-detail-modal" class="hidden fixed inset-0 z-[80] flex items-center justify-center bg-inverse-surface/45 p-3 sm:p-6 backdrop-blur-[6px]" data-competition-modal data-track-data="'+escapeHtml(JSON.stringify(trackData))+'">'+detailCard.toString()+"</div>";
    main.append(modalHtml);
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
    $(el).attr("data-favorite-key",card.attr("data-competition-id")||card.find("h3").text().trim().slice(0,250)||name+"-"+index);
  });
  $("#poster-modal p").filter((_,el)=>/AI 正在全网/.test(text($(el)))).text("招募项目已保存，可复制链接邀请搭档加入。");
  return <DesignScreen name={name} html={$("body").html() || ""} loggedIn={!!user} variant={variant} />;
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!)); }
