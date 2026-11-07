import type { AnyNode } from "domhandler";
import * as cheerio from "cheerio";
import screens from "@/design/screens.json";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getCompetition, getCompetitionTrackDetails, listCompetitionTracks, listCompetitions, listFavoriteCompetitionIds } from "@/lib/db/queries";
import { getProfile } from "@/lib/db/profile";
import { requireAdmin } from "@/lib/auth/guards";
import { listRecruitmentProjects, getAccessibleProjectId, getProjectStats } from "@/lib/db/projects";
import { listProjectTasks, getLatestCoachReport } from "@/lib/db/tasks";
import { DesignScreen } from "./design-screen";
import { SiteShell } from "@/components/layout/site-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { populateAdminContent } from "./admin-content";
import { configureSettingsPage, type SettingsSection } from "./settings-content";
import { teamCreateModalTemplate } from "@/design/team-create-modal-template";
import { getCompetitionAnalysis } from "@/lib/ai/analysis-cache";
import { isAiConfigured } from "@/lib/ai/provider";
import { sqlite } from "@/lib/db/client";

export type ScreenName = keyof typeof screens;

export async function DesignPage({ name, variant, query, adminSection = "review", settingsSection = "profile" }: { name: ScreenName; variant?: "register"; query?: Record<string, string | string[] | undefined>; adminSection?: "review" | "sources" | "users" | "logs" | "settings"; settingsSection?: SettingsSection }) {
  const session = await auth();
  const user = session?.user;
  const favoritesView = name === "favorites" || (name === "competitions" && query?.tab === "favorites");
  if ((name === "dashboard" || name === "projects" || name === "settings" || name === "competitionDetail") && !user) redirect("/login");
  if (favoritesView && !user) redirect("/login?next=/competitions/favorites");
  if (name === "admin" && !(await requireAdmin())) redirect("/login?next=/admin");
  const $ = cheerio.load(screens[name]);
  const hasHeader = $("body > header").length > 0;
  $("body > header").remove();
  $("body > footer").remove();
  const text = (el: cheerio.Cheerio<AnyNode>) => el.text().replace(/\s+/g, " ").trim();
  const main = $("main");
  $("[data-action=\"favorite\"]").each((index,el)=>{ $(el).attr("data-favorite-key",name+"-"+index); });
  const sharedShell = name === "favorites" || name === "admin";
  if (sharedShell) {
    $("body > header").remove();
    $("body > footer").remove();
    main.removeClass("pt-16").attr("data-design-main", name);
    if (name === "favorites") {
      main.find("#toastNotification").remove();
      const content=main.children("div").first().children("div").filter((_,el)=>($(el).attr("class")||"").includes("max-w-[1240px]")).first();
      content.attr("class", "w-full max-w-[1240px] mx-auto px-6 py-8");
    }
  }
  const allCompetitions = name === "competitions" || name === "favorites" || name === "home" || name === "teams" ? listCompetitions() : [];
  const favoriteIds = favoritesView && user?.id ? listFavoriteCompetitionIds(user.id) : null;
  const competitions = favoriteIds
    ? allCompetitions.filter((item) => favoriteIds.has(item.id) || favoriteIds.has(item.name))
    : allCompetitions;
  if (name === "competitionDetail") {
    // 详情页只呈现设计稿中的卡片，不重复渲染站点导航、页脚和背景模拟列表。
    $("body > header").remove();
    $("body > footer").remove();
    main.children("div").first().children("div").first().remove();
    main.removeClass("pt-16 bg-surface").addClass("min-h-screen");
  }
  if (name === "settings" && user?.id) {
    main.find("nav").filter((_, el) => /控制台/.test(text($(el)))).first().remove();
    const profile = getProfile(user.id);
    main.find('input[type="text"]').filter((_,el)=>$(el).attr("value")==="计算机科学与软件学院 (2022级本硕)").attr("value", profile?.school || "");
    main.find('input[type="text"]').filter((_,el)=>$(el).attr("value")==="林星宇").attr("value", user.name || "");
    main.find('input').eq(3).attr("value", profile?.skills || "");
    main.find('input').eq(0).attr("data-settings-field","name").attr("maxlength","40");
    main.find('input').eq(1).attr("data-settings-field","school").attr("maxlength","120").removeAttr("readonly").removeClass("cursor-not-allowed select-none");
    const skillInput=main.find('input').eq(3).attr("data-settings-field","skills").attr("maxlength","500").attr("placeholder","输入技能，用逗号分隔");
    skillInput.parent().children("span").remove();
    const upload=main.find("button").filter((_,el)=>/更换头像/.test(text($(el)))).attr("data-action","upload-avatar");
    upload.after('<input type="file" accept="image/png,image/jpeg,image/webp" data-avatar-file class="hidden" aria-label="选择头像图片" />');
    const avatarArea=upload.parent().parent();
    avatarArea.find("img").attr("src",user.image||"/assets/logo.svg").attr("alt","个人头像").attr("data-settings-avatar","");
    avatarArea.find("span").filter((_,el)=>/林星宇 \(StarSky\)/.test(text($(el)))).text(user.name||"项目成员");
    avatarArea.find("span").filter((_,el)=>/认证高校学生/.test(text($(el)))).remove();
    main.find("span").filter((_,el)=>/^已核验$|ENTERPRISE SSO BOUND/.test(text($(el)))).text("账号资料");
    main.find("p").filter((_,el)=>/全国大学生计算机系统与算法竞赛参赛资格已同步/.test(text($(el)))).text("填写你的学校或所在组织。");
    main.find("p").filter((_,el)=>/绑定后不可直接修改/.test(text($(el)))).text("邮箱用于账号登录，当前页面不支持变更登录邮箱。");
    main.find("span").filter((_,el)=>/草稿配置已实时写入客户端本地缓存/.test(text($(el)))).text("你有尚未保存的个人资料修改");
    main.find("span").filter((_,el)=>/^MAX 5 TAGS$/.test(text($(el)))).text("用逗号分隔");
    main.find("button").filter((_,el)=>/放弃未保存修改/.test(text($(el)))).attr("data-action","discard-settings");
    main.find('input[type="email"]').attr("value", user.email || "");
    main.find("button").filter((_,el)=>/保存个人设置/.test(text($(el)))).attr("data-action","save-settings");
    main.find("#save-settings-btn").closest("div.sticky").attr("data-settings-save-bar","").addClass("hidden");
    main.find("button").filter((_,el)=>/立即接入 OAuth 认证|接入新 MCP 协议|更新密码|重置密钥|注销 Token|申请永久注销/.test(text($(el)))).attr("data-action","unavailable");
    main.find("button").filter((_,el)=>/退出当前登录会话/.test(text($(el)))).attr("data-action","logout");
    configureSettingsPage($, settingsSection);
  }
  if (name === "favorites" && user?.id) {
    const firstHeading=main.find("h3").first();
    const template=firstHeading.parent().clone();
    const cardSection=firstHeading.parent().parent();
    cardSection.children().remove();
    const favoriteIds=listFavoriteCompetitionIds(user.id);
    competitions.forEach((item,index)=>{
      const card=template.clone();
      const track=listCompetitionTracks().find((group)=>group.competitionId===item.id);
      card.attr("data-competition-id",item.id).attr("data-source-url",item.sourceUrl).attr("data-favorite","true").attr("data-action","open-competition-detail");
      card.find("h3").first().text(item.name);
      card.find("p").first().text(item.platform+" · "+(item.status||"状态未知"));
      card.find("span").filter((_,el)=>/报名中|进行中|已截止|收藏于/.test(text($(el)))).first().text(item.status);
      card.find("span").filter((_,el)=>/收藏于/.test(text($(el)))).text("收藏于最近更新");
      card.find("button").filter((_,el)=>/取消收藏/.test($(el).attr("title")||"")).attr("data-action","favorite").attr("data-favorite-key",item.id).removeAttr("data-design-handler");
      card.find("button").filter((_,el)=>/立即发起组队/.test(text($(el)))).attr("data-route","/teams/create").removeAttr("data-design-handler");
      card.find("button").filter((_,el)=>/官方赛题|查看赛道/.test(text($(el)))).attr("data-route","/competitions").removeAttr("data-design-handler");
      card.find("span").filter((_,el)=>/奖池|推荐 \d/.test(text($(el)))).each((_,el)=>{ $(el).text("来源："+item.platform); });
      cardSection.append(card);
    });
    if (!competitions.length) cardSection.append('<p class="rounded-xl bg-surface-container-low p-6 text-body-md text-on-surface-variant" role="status">还没有收藏赛事，返回比赛中心收藏你感兴趣的比赛。</p>');
    main.find("h1").first().text("我的赛事收藏");
    main.find("button").filter((_,el)=>/返回比赛中心|浏览更多/.test(text($(el)))).attr("data-route","/competitions");
  }
  if (name === "admin" && user?.id) {
    populateAdminContent($, user.id, adminSection);
    main.find("[data-admin-heading] > nav[aria-label=\"Breadcrumb\"]").remove();
    main.find("[data-admin-heading] > div > div.flex-wrap").remove();
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
      tracks.slice(0, 6).forEach((track) => trackHost.after('<button type="button" data-track-id="'+escapeHtml(track.id)+'" class="w-full text-left p-4 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition"><strong>'+escapeHtml(track.name)+'</strong><span class="block mt-1 text-body-sm text-on-surface-variant">'+escapeHtml(track.description || "暂无赛道说明")+'</span></button>'));
      main.find("h1").last().text(tracks[0]?.name || "暂无赛道说明");
    }
  }

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
    main.find("span").filter((_, el) => text($(el)) === "LIVE RADAR").parent().remove();
    main.find("span").filter((_, el) => /官方数据更新于/.test(text($(el)))).parent().remove();
    main.find("p").filter((_, el) => /平台所收录比赛均已通过/.test(text($(el)))).parent().remove();
    const headings=main.find("h3").slice(0,3);
    const listColumn=headings.first().closest("article").parent();
    listColumn.removeClass("xl:col-span-5").addClass("xl:col-span-12");
    if (favoritesView) {
      main.find("h1").first().text("我收藏的赛事");
      main.find("h1").first().next("p").text("集中查看你保存的比赛，继续了解赛道并开始组队。");
      main.find("h2").filter((_,el)=>/多维筛选/.test(text($(el)))).closest("aside").remove();
      main.find("#filter-tabs").remove();
    }
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
      card.attr("data-competition-card", "").attr("data-competition-id",item.id).attr("data-action","open-competition-detail").attr("data-platform",item.platform).attr("data-status",item.status).attr("data-favorite",String(favoriteKeys.has(item.id)||favoriteKeys.has(item.name)))
        .attr("data-search-text",searchText).attr("data-updated-at",String(item.updatedAt)).attr("data-default-order",String(index))
        .attr("data-deadline",deadline==null?"":String(deadline)).attr("data-source-url",item.sourceUrl)
        .attr("tabindex","0").attr("role","button").attr("aria-label",item.name);
      card.find("span").filter((_,el)=>/官方规约已校验/.test(text($(el)))).text("来源："+item.platform);
      card.find("span").filter((_,el)=>/查看赛道专区/.test(text($(el)))).first().replaceWith('<button type="button" data-action="open-competition-detail" data-competition-id="'+escapeHtml(item.id)+'" class="font-label-md text-label-md text-primary">详情</button>');
      const detailButton=card.find('button[data-action="open-competition-detail"]').last().clone();
      card.find('button[data-action="open-competition-detail"]').last().remove();
      const sourceLabel=card.find("span").filter((_,el)=>/^来源：/.test(text($(el)))).first();
      sourceLabel.closest("div").addClass("hidden");
      card.append('<div class="mt-auto flex items-center justify-between gap-3 border-t border-surface-container pt-3" data-competition-card-footer><span class="text-xs text-on-surface-variant">来源：'+escapeHtml(item.platform)+'</span></div>');
      card.find("[data-competition-card-footer]").append(detailButton);
      card.find("p").first().after('<p class="mt-2 text-body-sm text-on-surface-variant">更新于 '+escapeHtml(new Date(item.updatedAt).toLocaleDateString("zh-CN"))+ (tracks?.names.length?' · '+tracks.names.length+' 个赛道':'')+'</p>');
      listContainer.append(card);
    });
    main.find('input[placeholder*="检索比赛名"]').attr("data-competition-search","").attr("aria-label","搜索比赛、平台或赛道").attr("placeholder","搜索比赛名称、平台或赛道…").closest("label").attr("data-search-field","");
    main.find('input[placeholder*="检索比赛名"]').closest("label").find("[data-icon=search],svg").last().remove();
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
    main.find("button").filter((_,el)=>/精准筛选/.test(text($(el)))).attr("data-action","apply-filters").find("span").last().text("搜索");
    main.find("[data-page-prev]").attr("data-action","page-prev");
    main.find("[data-page-next]").attr("data-action","page-next");
    main.find("#filter-tabs button").first().find("span").last().text(String(competitions.length));
    main.find("#filter-tabs button").filter((_,el)=>/我收藏的/.test(text($(el)))).attr("data-action","favorites-unavailable").removeAttr("data-route");
    main.find("button").filter((_,el)=>/发起组队/.test(text($(el)))).attr("data-route","/teams/create");
    main.find("#filter-tabs button").filter((_,el)=>/AI 推荐/.test(text($(el)))).attr("data-selected","false");
    const activeTracks=competitions.reduce((sum,item)=>sum+(trackGroups.get(item.id)?.names.length||0),0);
    const statMap=new Map([["进行中赛道",String(activeTracks)], ["奖池总额","暂无数据"], ["AI匹配率","暂无数据"]]);
    main.find("span").each((_,el)=>{const label=text($(el));const value=statMap.get(label);if(value!==undefined)$(el).next().text(value);});
    main.find("h2").filter((_,el)=>/生产力智能体赛道/.test(text($(el)))).closest("section").remove();
    const detailDoc=cheerio.load(screens.competitionDetail);
    const detailCard=detailDoc("#competition-detail-card").clone();
    detailCard.attr("id","competition-detail-modal-card");
    detailCard.find("footer button").remove();
    detailCard.find("footer").find("div").last().append('<a class="px-4 py-2 rounded-lg bg-surface-container text-primary font-label-md text-label-md" data-action="view-competition-source" target="_blank" rel="noreferrer">查看赛事页面</a><button class="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md" type="button" data-action="start-team">开始组队</button>');
    detailCard.find("header button").filter((_,el)=>/closeModal/.test($(el).attr("data-design-handler")||"")).attr("data-action","close-competition-detail").removeAttr("data-design-handler");
    detailCard.find("span").filter((_,el)=>/ESC 可关闭/.test(text($(el)))).remove();
    detailCard.find("#fav-btn").attr("data-action","detail-favorite").removeAttr("data-design-handler");
    detailCard.find("h1").attr("data-modal-name","");
    detailCard.find("span").filter((_,el)=>/^第十二届$/.test(text($(el)))).attr("data-modal-season","");
    detailCard.find("span").filter((_,el)=>/^主办单位：/.test(text($(el)))).attr("data-modal-platform","");
    detailCard.find("span").filter((_,el)=>/^共 3 个赛题$/.test(text($(el)))).attr("data-modal-track-count","");
    detailCard.find("span").filter((_,el)=>/^报名截止时间$/.test(text($(el)))).next().attr("data-modal-deadline","");
    detailCard.find("h4").eq(0).closest("section").find("p").first().attr("data-modal-track-description","");
    detailCard.find("h4").eq(0).closest("section").find("p").eq(1).attr("data-modal-track-objective","");
    detailCard.find("h4").eq(1).closest("section").find("p").first().attr("data-modal-requirements","");
    detailCard.find("h4").eq(1).closest("section").find("p").attr("data-modal-requirement-item","");
    detailCard.find("h4").eq(1).closest("section").find("h5,h6").attr("data-modal-requirement-title","");
    const aiSection = detailCard.find("p").filter((_, el) => /AI 赛道分析/.test(text($(el)))).closest("section");
    aiSection.attr("data-ai-analysis-section", "");
    aiSection.find("span").filter((_, el) => /数据未生成/.test(text($(el)))).attr("data-ai-analysis-status", "");
    aiSection.find("p").filter((_, el) => /AI 赛道分析/.test(text($(el)))).attr("data-ai-analysis-placeholder", "");
    aiSection.find("p").filter((_, el) => /需等待赛事组委会/.test(text($(el)))).attr("data-ai-analysis-placeholder-description", "");
    aiSection.find("div.rounded-xl").last().attr("data-ai-analysis-empty", "");
    aiSection.find("div.flex.items-center.justify-between").first().append('<button type="button" data-action="analyze-track" class="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm">生成分析</button>');
    detailCard.find("a").filter((_,el)=>/^ccf.org.cn/.test(text($(el)))).attr("data-modal-authority-source","");
    detailCard.find("a").filter((_,el)=>/下载官方赛题说明书/.test(text($(el)))).attr("data-modal-spec-link","");
    detailCard.find("a").filter((_,el)=>/样例开发集/.test(text($(el)))).attr("data-modal-sample-link","");
    detailCard.find("span").filter((_,el)=>/^TRACK-A/.test(text($(el)))).attr("data-modal-track-label","");
    detailCard.find("span").filter((_,el)=>/^作品提交截止：$/.test(text($(el)))).next().attr("data-modal-track-deadline","");
    detailCard.find("span").filter((_,el)=>/^信息来源已通过/.test(text($(el)))).attr("data-modal-source-note","");
    detailCard.find("span").filter((_,el)=>/报名进行中|待核验/.test(text($(el)))).first().attr("data-modal-status","");
    detailCard.find("button").filter((_,el)=>/赛题 Track-/.test(text($(el)))).each((index,el)=>{ $(el).attr("data-track-id",String(index)); });
    detailCard.find("[data-design-handler]").removeAttr("data-design-handler");
    const trackData=Object.fromEntries(competitions.map((item)=>[item.id,(trackGroups.get(item.id)?.names||[])]));
    const competitionData=Object.fromEntries(competitions.map((item)=>[item.id,{name:item.name,platform:item.platform,status:item.status,season:item.season,sourceUrl:item.sourceUrl,tracks:getCompetitionTrackDetails(item.id).map(track=>({...track,analysis:getCompetitionAnalysis(item.id,track.id,item.updatedAt)}))}]));
    const modalHtml='<div id="competition-detail-modal" class="hidden fixed inset-0 z-[80] flex items-center justify-center bg-inverse-surface/45 p-3 sm:p-6 backdrop-blur-[6px]" data-competition-modal data-track-data="'+escapeHtml(JSON.stringify(trackData))+'" data-competition-data="'+escapeHtml(JSON.stringify(competitionData))+'">'+detailCard.toString()+"</div>";
    main.append(modalHtml);
  }
  if (name === "dashboard") {
    const h=main.find("h1");h.text("下午好，"+(user?.name || "项目成员")+"！");
    main.find("a,button").filter((_,el)=>/立即组队|发布队伍/.test(text($(el)))).attr("data-route","/teams/create");
    main.find('input[type="checkbox"]').attr("data-action","demo-task");
  }
  if (name === "teams") {
    main.find("span").filter((_, el) => /LIVE TEAMMATCHING SYSTEM|实时组队就绪/.test(text($(el)))).parent().remove();
    main.find("#open-creator-btn").find("svg").last().remove();
    const existingCreator = main.find("#creator-modal");
    if (existingCreator.length) {
      const competitionId = Array.isArray(query?.competition) ? query?.competition[0] : query?.competition || "";
      existingCreator.html(`<div id="creator-modal-card" data-competition-id="${escapeHtml(competitionId)}" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">${teamCreateModalTemplate}</div>`);
      existingCreator.find("#creator-modal-card").addClass("hidden");
      existingCreator.attr("data-team-create-modal", "");
      existingCreator.attr("data-competition-id", competitionId);
      existingCreator.find("#ai-generate-btn").attr("data-action", "generate-team-copy");
      existingCreator.find("#ai-output-box").addClass("pm-ai-copy-scroll");
      existingCreator.find("#ai-generated-text").attr("data-ai-team-copy", "").text("填写项目名称和描述后，可以生成可编辑的招募文案草稿。");
      existingCreator.find('[data-section="target-competition"]').prepend('<div class="mb-3" data-publish-competition-picker><label class="block text-xs font-semibold text-on-surface-variant mb-1.5">关联比赛</label><input data-publish-competition-search class="w-full rounded-lg bg-white px-3 py-2 text-sm" placeholder="输入比赛名称关键词筛选"><select data-publish-competition-select class="mt-2 w-full rounded-lg bg-white px-3 py-2 text-sm" aria-label="选择关联比赛"></select></div>');
      const picker=existingCreator.find('[data-publish-competition-select]');
      competitions.forEach((competition)=>picker.append(`<option value="${escapeHtml(competition.id)}">${escapeHtml(competition.name)}</option>`));
      if(competitionId)picker.val(competitionId);
      existingCreator.find("span").filter((_, el) => text($(el)) === "关联赛道").remove();
      existingCreator.find("span").filter((_, el) => /可以发布/.test(text($(el)))).closest("div").remove();
      existingCreator.find("#status-dot,#status-label").remove();
      existingCreator.find('[data-field="roles"]').attr("data-team-roles", "");
      existingCreator.find("[data-role-toggle]").filter((_, el) => $(el).attr("id") === "add-custom-role").removeAttr("data-role-toggle").attr("data-action", "show-custom-role");
      existingCreator.find('[data-section="recruitment-roles"] span').filter((_, el) => /^已选 \d+ 个角色$/.test(text($(el)))).attr("data-selected-role-count", "").text("已选 0 个角色");
      existingCreator.find("#team-project-name").val("").attr("placeholder", "请输入项目名称");
      existingCreator.find("#team-project-desc").val("").attr("placeholder", "请输入一句话项目描述、技术方向和参赛目标");
      existingCreator.find("#team-hours").val("").attr("placeholder", "例如 10");
      existingCreator.find("[data-role-toggle]").attr("data-selected", "false").removeClass("bg-primary/10 border-primary/30 text-primary").addClass("bg-surface-container-low text-on-surface-variant");
      existingCreator.find("[data-role-toggle]").filter((_, el) => $(el).find("svg").length === 0).append('<svg aria-hidden="true" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4.5v15m7.5-7.5h-15" stroke-linecap="round" stroke-linejoin="round"/></svg>');
      existingCreator.find("[data-selected-role-count]").text("已选 0 个角色");
      existingCreator.find('[data-section="recruitment-roles"]').append('<div class="hidden flex gap-2" data-custom-role-editor><input type="text" maxlength="40" class="min-w-0 flex-1 rounded-lg bg-white px-3 py-2 text-sm" placeholder="输入自定义招募岗位" data-custom-role-input><button type="button" class="px-3 py-2 rounded-lg border border-outline-variant text-label-sm" data-action="add-custom-role">添加</button></div>');
      const selectedCompetition = competitionId ? getCompetition(competitionId) : undefined;
      if (selectedCompetition) {
        const competitionCard=existingCreator.find('[data-section="target-competition"]');
        competitionCard.find("h3").first().text(selectedCompetition.name);
        competitionCard.find("[data-team-competition-status]").text(selectedCompetition.status);
        competitionCard.find("[data-team-competition-source]").text(selectedCompetition.platform+" 官方数据源");
        competitionCard.find("[data-team-competition-season]").text(selectedCompetition.season||"赛事信息");
        const tracks=getCompetitionTrackDetails(competitionId);
        const trackSelect=existingCreator.find("#team-track");trackSelect.empty();
        tracks.forEach((track,index)=>trackSelect.append(`<option value="${escapeHtml(track.name)}"${index===0?" selected":""}>${escapeHtml(track.name)}</option>`));
        if(!tracks.length)trackSelect.append('<option value="自拟赛道" selected>自拟赛道</option>');
      }
      else if (!competitionId) {
        const competitionCard=existingCreator.find('[data-section="target-competition"]').removeClass("hidden");
        competitionCard.find("h3").first().text("请选择关联比赛");
        competitionCard.find("p").first().text("可输入关键词筛选真实赛事，再选择对应比赛。");
        competitionCard.find("[data-team-competition-status],[data-team-competition-season],[data-team-competition-source]").remove();
        competitionCard.find(".pt-2").remove();
      }
      else {
        const tracks=getCompetitionTrackDetails(competitionId);const trackSelect=existingCreator.find("#team-track").empty();
        tracks.forEach(track=>trackSelect.append(`<option value="${escapeHtml(track.name)}">${escapeHtml(track.name)}</option>`));
        if(!tracks.length)trackSelect.append('<option value="自拟赛道">自拟赛道</option>');
      }
    }
    const projects = listRecruitmentProjects();
    const seatTotal = projects.reduce((sum, project) => sum + project.seatCount, 0);
    main.find("h2").filter((_,el)=>/精选活跃战队/.test(text($(el)))).parent().find("span").filter((_,el)=>/共 \d+ 个精选席位/.test(text($(el)))).text(projects.length ? `共 ${seatTotal} 个席位` : "暂无席位数据");
    const activeProjectCount = projects.filter((project) => project.status === "招募中").length;
    const openRoleCount = projects.reduce((sum, project) => sum + (project.roles ? project.roles.split(/[，,、/]+/).map((role) => role.trim()).filter(Boolean).length : 0), 0);
    main.find("p").filter((_,el)=>text($(el)) === "正在寻光组队中").next().text(String(activeProjectCount));
    main.find("p").filter((_,el)=>text($(el)) === "急需核心技术岗").next().text(String(openRoleCount));
    main.find("p").filter((_,el)=>text($(el)) === "平均匹配响应").next().text("暂无数据");
    const teamFilters=main.find('[data-section="team-filters"]');
    const trackFilterButtons=main.find("button.filter-pill");
    trackFilterButtons.each((index,el)=>{const label=text($(el));if(label!=="全部赛事")$(el).attr("data-team-track-filter",label);});
    main.find("button.role-chip").each((_,el)=>{ $(el).attr("data-team-role-filter",text($(el))); });
    main.find("button").filter((_,el)=>/^(不限|10h+\/周|20h\+\/周\(冲刺\))$/.test(text($(el)))).each((_,el)=>{ $(el).attr("data-team-hours-filter",text($(el))); });
    const sampleCards=main.find(".apply-team-btn").filter((_,el)=>!$(el).closest("#ai-synergy-modal").length).map((_,el)=>$(el).closest('[class*="rounded-xl"]').get(0)).get();
    if(projects.length && sampleCards.length){
      const parent=$(sampleCards[0]).parent(); const template=$(sampleCards[0]).clone();
      sampleCards.forEach(el=>$(el).remove());
      projects.forEach(project=>{
        const card=template.clone();card.attr("id","project-"+project.id).attr("data-project-card","").attr("data-project-id",project.id).attr("data-project-title",project.title).attr("data-roles",project.roles||"").attr("data-track",project.trackName||"").attr("data-hours",String(project.weeklyHours||10));
        card.find("h3").first().text(project.title);
        card.find("h3").first().next("p").text(project.description);
        card.find("span").filter((_,el)=>/^队长:/.test(text($(el)))).text(project.creatorName || "项目发起人");
        card.find("span").filter((_,el)=>/^每周 \d/.test(text($(el)))).text("每周 "+(project.weeklyHours||10)+"h");
        card.find("span").filter((_,el)=>/共 \d+ 个席位|差 \d+ 人满员|招募中/.test(text($(el)))).first().text(`共 ${project.seatCount} 个席位`);
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
    } else {
      main.find(".apply-team-btn").filter((_,el)=>!$(el).closest("#ai-synergy-modal").length).each((_,el)=>{ $(el).closest('[class*="rounded-xl"]').remove(); });
      const activeHeading=main.find("h2").filter((_,el)=>/精选活跃战队/.test(text($(el))));
      activeHeading.after('<p class="pm-empty-team-state text-sm text-on-surface-variant mt-3">暂无活跃组队项目，发布你的项目后会显示在这里。</p>');
    }
    main.find(".view-detail-btn").attr("data-action","team-details");
    if (!projects.length) main.find(".apply-team-btn").filter((_,el)=>!$(el).closest("#ai-synergy-modal").length).each((index,el)=>{const card=$(el).closest('[class*="rounded-xl"]');card.attr("data-project-card","").attr("data-project-id","design-sample-"+index).attr("data-demo","true");});
    main.find('input[name="track-type"]').each((_,el)=>{ $(el).attr("value", text($(el).parent())); });
    const select=$("#creator-comp-select");select.empty();competitions.forEach(c=>select.append('<option value="'+escapeHtml(c.id)+'">'+escapeHtml(c.name)+'</option>'));
  }
  if (name === "projects") {
    const projectStats = user?.id ? (() => { const id=getAccessibleProjectId(user.id); return id ? getProjectStats(id) : null; })() : null;
    const projectContext = user?.id ? (() => { const id=getAccessibleProjectId(user.id); return id ? sqlite.prepare("SELECT nickname,title,competition_id AS competitionId,track_name AS trackName,status FROM recruitment_projects WHERE id=? AND creator_id=?").get(id,user.id) as { nickname: string | null; title: string; competitionId: string | null; trackName: string | null; status: string } | undefined : undefined; })() : undefined;
    const titleHeading = main.find("h1").first();
    if (projectContext && titleHeading.length) {
      titleHeading.text(projectContext.nickname || projectContext.title).after('<div class="pm-project-nickname-row"><input data-project-nickname maxlength="80" value="'+escapeHtml(projectContext.nickname || projectContext.title)+'" aria-label="项目昵称"><button type="button" class="pm-button-outline" data-action="save-project-nickname">保存昵称</button></div>');
      titleHeading.parent().find("span").filter((_,el)=>/正在冲刺|Sprint/.test(text($(el)))).text(projectContext.status);
      const competition=projectContext.competitionId?getCompetition(projectContext.competitionId):undefined;
      const info=titleHeading.parent().find("p").first();
      info.text(competition?[competition.name,projectContext.trackName].filter(Boolean).join(" · "):"比赛与赛道信息暂无");
    } else if (titleHeading.length) {
      titleHeading.text("暂无项目");
      titleHeading.parent().find("span").filter((_,el)=>/正在冲刺|Sprint/.test(text($(el)))).remove();
      titleHeading.parent().find("p").first().text("创建组队项目后，项目进度、任务和成员数据会显示在这里。");
    }
    main.find("button").filter((_, el) => /邀请新成员/.test(text($(el)))).attr("data-action", "project-invite");
    main.find("button").filter((_, el) => /新建任务卡片/.test(text($(el)))).attr("data-action", "new-project-task");
    main.find("span").filter((_, el) => text($(el)) === "整体完成度").next().text(projectStats ? `${projectStats.completion}%` : "暂无数据");
    if (projectStats) {
      main.find("span").filter((_, el) => /^\d{1,3}%$/.test(text($(el)))).text(`${projectStats.completion}%`);
      main.find("p").filter((_, el) => /预计可如期交付主算法/.test(text($(el)))).text(`${projectStats.completed}/${projectStats.tasks.length} 项任务已完成`);
      const countdown=main.find("span").filter((_,el)=>text($(el))==="决赛作品提交倒计时").closest(".bg-surface-container-low.rounded-xl");
      if(projectContext?.competitionId){
        const event=sqlite.prepare("SELECT MIN(deadline) AS deadline FROM competition_tracks WHERE competition_id=?").get(projectContext.competitionId) as {deadline:number|null}|undefined;
        const deadline=event?.deadline;
        countdown.find("span").filter((_,el)=>/^\d+$/.test(text($(el)))).text(deadline?String(Math.max(0,Math.ceil((deadline-Date.now())/(24*60*60*1000)))):"暂无");
        countdown.find("span").filter((_,el)=>/^截止:/.test(text($(el)))).text(deadline?`截止: ${new Date(deadline).toLocaleDateString("zh-CN")}`:"截止日期暂无");
      } else countdown.find("span").filter((_,el)=>/^\d+$/.test(text($(el)))).text("暂无");
      const urgentList=main.find("h3").filter((_,el)=>/高优先级未完成任务/.test(text($(el)))).closest(".bg-surface-container-lowest");
      const urgent=projectStats.tasks.filter(task=>task.priority==="高"&&task.status!=="已完成");
      urgentList.find("span").filter((_,el)=>/\d+ 紧急/.test(text($(el)))).text(`${urgent.length} 项`);
      const urgentCards=urgentList.children("div").last().empty();
      if(urgent.length) urgent.forEach(task=>urgentCards.append('<article class="rounded-lg bg-surface-container-low p-3"><div class="flex items-center justify-between"><span class="font-mono-metric text-mono-metric font-bold">#'+escapeHtml(task.id)+'</span><span class="text-xs">'+escapeHtml(task.status)+'</span></div><p class="mt-1 text-sm font-medium">'+escapeHtml(task.title)+'</p><p class="mt-1 text-xs text-on-surface-variant">负责人：'+escapeHtml(task.assignee||"未分配")+'</p></article>'));
      else urgentCards.append('<p class="text-sm text-on-surface-variant">暂无未完成的高优先级任务。</p>');
      const goal=main.find("h3").filter((_,el)=>/当前冲刺目标/.test(text($(el)))).closest(".bg-surface-container-lowest");
      goal.find("h3").text("任务概览");goal.find("span").filter((_,el)=>/^W\d/.test(text($(el)))).remove();
      goal.children("p").first().text(projectStats.tasks.length?`当前共 ${projectStats.tasks.length} 项任务，其中 ${projectStats.remaining} 项尚未完成。`:"暂无任务数据。");
      const milestones=goal.find(".flex.flex-col.gap-3.pt-2").empty();
      projectStats.tasks.slice(0,4).forEach(task=>milestones.append('<div class="flex items-start gap-3"><span class="mt-1.5 h-2 w-2 shrink-0 rounded-full '+(task.status==="已完成"?"bg-secondary":"bg-primary")+'"></span><div><p class="text-sm font-medium">'+escapeHtml(task.title)+'</p><p class="text-xs text-on-surface-variant">'+escapeHtml(task.status)+' · '+escapeHtml(task.assignee||"待分配")+'</p></div></div>'));
      if(!projectStats.tasks.length)milestones.append('<p class="text-sm text-on-surface-variant">暂无任务数据。</p>');
      const membersCard=main.find("h3").filter((_,el)=>/成员任务负荷/.test(text($(el)))).closest(".bg-surface-container-lowest");
      membersCard.find("span").filter((_,el)=>/位核心在席/.test(text($(el)))).text(`${projectStats.memberCount} 位成员`);
      const memberList=membersCard.children("div").last().empty();
      const assigned=[...new Set(projectStats.tasks.map(task=>task.assignee).filter((name):name is string=>Boolean(name)))];
      if(assigned.length) assigned.forEach(name=>{const assignedTasks=projectStats.tasks.filter(task=>task.assignee===name&&task.status!=="已完成");const percent=projectStats.tasks.length?Math.round(assignedTasks.length/Math.max(1,projectStats.remaining)*100):0;memberList.append('<div class="flex items-center justify-between gap-3"><div class="min-w-0"><p class="truncate text-sm font-medium">'+escapeHtml(name)+'</p><p class="text-xs text-on-surface-variant">'+assignedTasks.length+' 项未完成任务</p></div><span class="pm-status '+(percent>=75?"pm-status-amber":"pm-status-gray")+'">'+percent+'%</span></div>');});
      else memberList.append('<p class="text-sm text-on-surface-variant">暂无已指派任务或成员负荷数据。</p>');
      const map: Array<[RegExp,string]>=[[/待分配|待办/,"待分配 / 需求池"],[/进行中/,"正在进行中"],[/阻塞|紧急/,"阻塞与依赖"],[/已完成/,"已验收闭环"]];
      main.find("span").filter((_,el)=>map.some(([,name])=>text($(el))===name)).each((_,labelEl)=>{const label=$(labelEl);const match=map.find(([,name])=>name===text(label));if(!match)return;const column=label.closest("div.bg-surface-container-low.rounded-xl");const tasks=projectStats.tasks.filter(task=>match[0].test(task.status));column.find("span").filter((_,el)=>/^\d+$/.test(text($(el)))).last().text(String(tasks.length));column.children("div").slice(1).remove();tasks.forEach(task=>column.append('<article class="rounded-lg bg-surface-container-lowest p-3 shadow-sm"><div class="flex justify-between"><span class="font-mono-metric text-xs">#'+escapeHtml(task.id)+'</span><span class="text-xs">'+escapeHtml(task.priority)+'</span></div><p class="mt-2 text-sm font-medium">'+escapeHtml(task.title)+'</p><p class="mt-2 text-xs text-on-surface-variant">'+escapeHtml(task.assignee||"未分配")+'</p></article>'));if(!tasks.length)column.append('<p class="px-2 py-3 text-xs text-on-surface-variant">暂无任务</p>');});
    } else {
      main.find("span").filter((_,el)=>/^ID:\s*PM-/.test(text($(el)))).text("暂无项目 ID");
      main.find("span").filter((_,el)=>text($(el))==="实时守护中").text("等待项目数据");
      main.find("p").filter((_,el)=>/结合 GitHub 代码日志|GitHub 代码日志|Kanban 工时/.test(text($(el)))).text("创建项目并添加任务后，AI 教练会根据真实数据分析。");
      main.find("span").filter((_,el)=>/^#TASK-/.test(text($(el)))).closest("article").remove();
      main.find("span").filter((_,el)=>/^\d{1,3}%$/.test(text($(el)))).text("暂无数据");
      main.find("p").filter((_,el)=>/预计可如期交付主算法|评审环境已提前锁定/.test(text($(el)))).text("暂无项目进度数据");
      main.find("span").filter((_,el)=>/^截止:/.test(text($(el)))).text("暂无截止日期");
      main.find("h3").filter((_,el)=>/当前冲刺目标/.test(text($(el)))).closest(".bg-surface-container-lowest").find("p,.flex.flex-col.gap-3.pt-2").remove();
      main.find("h3").filter((_,el)=>/成员任务负荷|高优先级未完成任务/.test(text($(el)))).closest(".bg-surface-container-lowest").children("div").last().html('<p class="text-sm text-on-surface-variant">暂无项目数据</p>');
      main.find("span").filter((_,el)=>/^\d+ 紧急$/.test(text($(el)))).text("暂无");
      main.find("span").filter((_,el)=>/位成员|位核心在席/.test(text($(el)))).text("暂无成员");
      main.find("span").filter((_,el)=>/正在进行中|待分配 \/ 需求池|阻塞与依赖|已验收闭环/.test(text($(el)))).each((_,el)=>{const col=$(el).closest("div.bg-surface-container-low.rounded-xl");col.children("div").slice(1).remove();col.append('<p class="px-2 py-3 text-xs text-on-surface-variant">暂无项目任务</p>');});
    }
    main.append('<div id="project-invite-modal" class="hidden fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"><div class="pm-workspace-modal" role="dialog" aria-modal="true" aria-labelledby="project-invite-title"><button type="button" class="pm-workspace-modal-close" data-action="close-workspace-modal" aria-label="关闭">×</button><h2 id="project-invite-title">邀请新成员</h2><p>生成一个 7 天内有效的项目邀请链接，发送给你的队友。</p><div class="pm-invite-link-row"><input readonly data-project-invite-link aria-label="项目邀请链接" /><button type="button" data-action="copy-project-invite">复制</button></div><p class="pm-workspace-modal-status" data-project-invite-status></p><button type="button" class="pm-button-primary" data-action="generate-project-invite">生成邀请链接</button></div></div>');
    main.append('<div id="project-task-modal" class="hidden fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"><div class="pm-workspace-modal" role="dialog" aria-modal="true" aria-labelledby="project-task-title"><button type="button" class="pm-workspace-modal-close" data-action="close-workspace-modal" aria-label="关闭">×</button><h2 id="project-task-title">新建任务卡片</h2><div class="pm-workspace-form"><label>任务名称<input data-project-task-title placeholder="例如：冻结接口文档" maxlength="160" /></label><label>优先级<select data-project-task-priority><option>中</option><option>高</option><option>低</option></select></label><label>负责人<input data-project-task-assignee placeholder="可留空" maxlength="80" /></label></div><p class="pm-workspace-modal-status" data-project-task-status></p><button type="button" class="pm-button-primary" data-action="create-project-task">创建任务</button></div></div>');
    const metricSection=main.find("section").filter((_,el)=>/整体完成度/.test(text($(el)))).first();
    const metricGrid=metricSection.children("div.grid").first();
    const metricCards=metricGrid.children("div").filter((_,el)=>/整体完成度|决赛作品提交倒计时/.test(text($(el))));
    const leftColumn=main.find("h3").filter((_,el)=>/当前冲刺目标/.test(text($(el)))).first().closest("div.xl\\:col-span-3");
    if(metricSection.length&&leftColumn.length){
      leftColumn.prepend(metricCards);
      metricGrid.remove();
      metricSection.children("div").first().removeClass("pb-6");
    }
    main.find("h4").filter((_,el)=>/赛道评审偏好对应/.test(text($(el)))).closest("div.bg-surface-container-lowest").remove();
    const coachColumn=main.find("div.xl\\:col-span-6").first();
    const suggestion=main.find("#ai-suggestion-card");
    const rightColumn=suggestion.parent();
    const conversation=coachColumn.children("div").first().children("div.flex-1").first();
    if(coachColumn.length&&suggestion.length&&conversation.length){
      suggestion.attr("class","rounded-xl bg-surface-container-low p-5 mt-5");
      conversation.children("div").last().children("div").last().append(suggestion);
      coachColumn.removeClass("xl:col-span-6").addClass("xl:col-span-9");
      rightColumn.remove();
    }
    const projectId = user?.id ? getAccessibleProjectId(user.id) : null;
    const report = projectId ? getLatestCoachReport(projectId) : undefined;
    const liveTasks = projectId ? listProjectTasks(projectId) : [];
    if (conversation.length) {
      conversation.attr("data-coach-messages", "").empty();
      if (report) conversation.append('<div class="pm-coach-message pm-coach-message-assistant" data-coach-message="assistant">'+escapeHtml(report.summary)+'</div>');
      const coachPanel=conversation.parent();
      coachPanel.attr("data-coach-project-id", projectId || "").removeClass("min-h-[640px]").addClass("h-[680px] max-h-[calc(100vh-180px)] min-h-0");
      conversation.addClass("pm-coach-messages");
      if (!projectId) {
        const emptyState='<p class="pm-coach-empty" data-coach-empty>当前账号暂无可分析的项目。创建自己的组队项目并添加任务后，即可开始与 AI 教练对话。</p>';
        conversation.append(emptyState);
        coachPanel.find("input[data-coach-input],button[data-action='coach']").prop("disabled", true).addClass("opacity-50 cursor-not-allowed");
      }
      if (!isAiConfigured()) coachPanel.find("input[data-coach-input]").attr("placeholder", "请先配置服务器 AI_API_KEY");
    }
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
    input.closest("div").next().find("button").each((_,el)=>{ $(el).attr("data-action","coach-prompt").attr("data-prompt",text($(el))); });
    if (!projectId) main.find('[data-coach-project-id]').find("input[data-coach-input],button[data-action='coach']").prop("disabled", true).addClass("opacity-50 cursor-not-allowed");
    main.find("button").filter((_,el)=>/任务看板|新建任务卡片|筛选视图/.test(text($(el)))).attr("data-route","/projects/tasks");
    $("#btn-update-kanban").attr("data-route","/projects/tasks");
    $("#btn-apply-suggestion").attr("data-action","apply-advice");
    $("#btn-dismiss-suggestion").attr("data-action","dismiss-advice");
    // Existing tasks remain accessible from the source Kanban cards.
    main.find("div").filter((_,el)=>/^#TASK-\d+$/.test(text($(el)))).attr("data-route","/projects/tasks");
    const tasks=projectId ? listProjectTasks(projectId) : [];
    tasks.forEach(task=>main.find("span").filter((_,el)=>text($(el)).toUpperCase()==="#"+task.id.toUpperCase()).attr("data-task-id",task.id));
    if(report)main.find('[data-report-placeholder]').text(report.summary);
    main.find("span,p,h3,h4").filter((_, el) => /AI 风险评估|AI 推荐决策方案|收益: \+2\.0d 裕量|优化冲刺排期策略/.test(text($(el)))).each((_, el) => {
      const value = text($(el));
      if (/AI 风险评估/.test(value)) $(el).text("项目风险评估");
      else if (/AI 推荐决策方案/.test(value)) $(el).text("项目排期建议");
      else if (/收益: \+2\.0d 裕量/.test(value)) $(el).text("等待真实任务数据");
      else if (/优化冲刺排期策略/.test(value) && !report) $(el).text("暂无项目分析");
    });
    if (!report) main.find("p").filter((_, el) => /根据当前任务|存在一定风险|建议优先/.test(text($(el)))).text("暂无分析。运行 AI 教练后，这里会显示基于当前项目任务的建议。");
  }
  if (name === "home") {
    main.find("h3,p,span").filter((_, el) => /高胜率|上榜率|胜率预测|AI匹配率|协同胜率/.test(text($(el)))).each((_, el) => {
      const value = text($(el));
      if (/高胜率/.test(value)) $(el).text(value.replace(/高胜率/g, "适合你的"));
      if (/上榜率|胜率预测|AI匹配率|协同胜率/.test(value)) $(el).text("暂未生成真实指标");
    });
    main.find("span").filter((_, el) => /^\d{2,3}\.\d%$/.test(text($(el)))).each((_, el) => { $(el).text("暂无数据"); });
    main.find("p").filter((_, el) => /基于往届 .*获奖团队画像解析|根据专业背景与过往成果/.test(text($(el)))).text("个性化建议会在完善个人资料后提供。");
    main.find("p").filter((_, el) => /计算推荐上榜率|竞赛胜率模型/.test(text($(el)))).text("建议依据已审核赛事资料和你的个人偏好生成。");
  }
  if (name === "teams") {
    main.find("p,h3,span").filter((_, el) => /AI 协同推荐精度|AI 契合 \d+%|匹配度 \d+%|匹配度优先|竞赛胜率模型|匹配度和技术栈推荐越精准/.test(text($(el)))).each((_, el) => {
      const value = text($(el));
      if (/AI 协同推荐精度/.test(value)) $(el).text("规则匹配状态");
      else if (/AI 契合 \d+%|匹配度 \d+%/.test(value)) $(el).text("等待匹配");
      else if (/匹配度优先/.test(value)) $(el).text("按项目资料排序");
      else if (/竞赛胜率模型/.test(value)) $(el).text("根据项目资料和个人偏好排序");
      else if (/匹配度和技术栈推荐越精准/.test(value)) $(el).text("填写更多项目资料后，规则匹配会更准确。");
    });
    main.find("p").filter((_, el) => /^\d{2,3}\.\d%$/.test(text($(el)))).each((_, el) => { $(el).text("暂无数据"); });
    const profile = user?.id ? getProfile(user.id) : undefined;
    const profileTerms = `${profile?.roles || ""},${profile?.skills || ""},${profile?.interests || ""}`.toLowerCase().split(/[，,、/\s]+/).filter((term) => term.length > 1);
    const scoreFor = (roles: string | null, hours: number | null) => {
      if (!profileTerms.length) return null;
      const roleTerms = (roles || "").toLowerCase().split(/[，,、/\s]+/).filter((term) => term.length > 1);
      const overlaps = roleTerms.filter((role) => profileTerms.some((term) => role.includes(term) || term.includes(role))).length;
      const skillScore = roleTerms.length ? Math.round((overlaps / roleTerms.length) * 70) : 0;
      const timeScore = profile?.weeklyHours && hours ? Math.max(0, 30 - Math.round(Math.abs(profile.weeklyHours - hours) / 2)) : 0;
      return Math.min(100, skillScore + timeScore);
    };
    main.find("select").filter((_, el) => /AI 契合度最高/.test($(el).text())).find("option").first().text("资料匹配度最高");
    main.find("[data-project-id]").each((_, el) => {
      const card = $(el);
      const score = scoreFor(card.attr("data-roles") || null, Number(card.attr("data-hours")) || null);
      const label = card.find("span").filter((__, span) => /等待匹配|资料匹配/.test(text($(span)))).first();
      if (label.length) label.text(score === null ? "完善资料后匹配" : `资料匹配 ${score}%`);
      if (score !== null) card.attr("data-match-score", String(score));
    });
    if (!listRecruitmentProjects().length) main.find(".apply-team-btn").filter((_, el) => !$(el).closest("#ai-synergy-modal").length).each((_, el) => { $(el).closest('[class*="rounded-xl"]').remove(); });
    if (user?.id && !profileTerms.length) main.find("#ai-synergy-modal").find("p").filter((_, el) => /匹配|推荐/.test(text($(el)))).last().text("完善个人技能、兴趣和每周投入时间后，系统会按规则筛选项目。");
  }
  $("[data-action='favorite']").each((index,el)=>{
    const card=$(el).parents().filter((_,parent)=>$(parent).find("h3").length===1).first();
    $(el).attr("data-favorite-key",card.attr("data-competition-id")||card.find("h3").text().trim().slice(0,250)||name+"-"+index);
  });
  $("#poster-modal p").filter((_,el)=>/AI 正在全网/.test(text($(el)))).text("招募项目已保存，可复制链接邀请搭档加入。");
  const renderedHtml = sharedShell ? main.toString() : $("body").html() || "";
  const screen = <DesignScreen name={name} html={renderedHtml} loggedIn={!!user} variant={variant} />;
  return sharedShell ? <SiteShell>{screen}</SiteShell> : <>{hasHeader && name !== "competitionDetail" && <SiteHeader />}{screen}{name !== "competitionDetail" && <SiteFooter />}</>;
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!)); }
