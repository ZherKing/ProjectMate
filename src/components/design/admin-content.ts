import type { CheerioAPI } from "cheerio";
import { sqlite } from "@/lib/db/client";
import { listAdminAuditLogs, listAdminUsers, listPendingCompetitions } from "@/lib/db/queries";
import { isConfiguredAdminEmail } from "@/lib/auth/permissions";
import { getSiteSetting } from "@/lib/site-settings";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const dateLabel = (value: number | null) => value ? new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) : "暂无入库记录";

export function populateAdminContent($: CheerioAPI, currentUserId: string, section: "review" | "sources" | "users" | "logs" | "settings") {
  const pending = listPendingCompetitions();
  const users = listAdminUsers();
  const logs = section === "logs" ? listAdminAuditLogs() : [];
  const sourceStats = section === "sources" ? sqlite.prepare("SELECT platform, COUNT(*) AS total, SUM(CASE WHEN review_status = 'pending' THEN 1 ELSE 0 END) AS pending, MAX(updated_at) AS latest FROM competitions GROUP BY platform").all() as Array<{ platform: string; total: number; pending: number; latest: number }> : [];
  const adapterSources = [
    { name: "传智杯", description: "赛事与赛道公开页面抓取适配器", configured: true },
    { name: "172校园赛事网", description: "开发应用分类公开赛事抓取适配器", configured: true },
    { name: "赛氪", description: "公开列表接口适配器，需配置有效接口", configured: !!process.env.SAIKR_API_URL },
  ];
  $("[data-admin-pending-count]").text(`${pending.length} 待处理`);
  $("[data-admin-source-count]").text(`${adapterSources.length} 个来源`);
  $("[data-admin-user-count]").text(`${users.length} 位用户`);
  $("[data-admin-queue-count]").text(`待审核 ${pending.length} 项`);
  $("[data-admin-source-filter]").append([...new Set(pending.map(item => item.platform))].sort().map(platform => `<option value="${escapeHtml(platform)}">${escapeHtml(platform)}</option>`).join(""));
  const queue = $("[data-admin-queue]");
  const template = queue.find("[data-admin-review-template]").clone().removeAttr("data-admin-review-template");
  queue.empty();
  pending.forEach((item, index) => {
    const card = template.clone().attr("data-review-id", item.id).attr("data-admin-source", item.platform).attr("data-admin-search", `${item.name} ${item.platform} ${item.season || ""}`);
    if (index >= 5) card.addClass("hidden");
    card.find("h3").text(item.name).addClass("break-words");
    card.find("h3").closest("div.flex-col").addClass("min-w-0");
    card.find("[data-admin-review-meta]").html(`<span>来源：${escapeHtml(item.platform)}</span>${item.season ? `<span>${escapeHtml(item.season)}</span>` : ""}<span>更新时间：${dateLabel(item.updatedAt)}</span>`);
    const source = card.find("[data-admin-source-link]");
    if (/^https?:\/\//i.test(item.sourceUrl)) source.attr("href", item.sourceUrl);
    else source.removeAttr("href").attr("aria-disabled", "true").text("来源链接不可用");
    queue.append(card);
  });
  $("[data-admin-empty-queue]").toggleClass("hidden", pending.length > 0).text(pending.length ? "没有匹配的待审核赛事，请调整关键词或数据源。" : "当前没有待审核赛事，新增抓取条目会在这里等待审核。");
  $("[data-admin-review-page-label]").text(`第 1 / ${Math.max(1, Math.ceil(pending.length / 5))} 页 · 共 ${pending.length} 项`);
  $('[data-admin-queue-page="prev"]').attr("disabled", "");
  if (pending.length <= 5) $('[data-admin-queue-page="next"]').attr("disabled", "");

  $("[data-admin-sources]").html(adapterSources.map(source => {
    const stats = sourceStats.find(item => item.platform === source.name);
    return `<article class="p-4 rounded-xl bg-surface flex flex-col gap-4 min-w-0"><div><div class="flex flex-wrap items-center justify-between gap-2"><h3 class="font-title-md text-title-md text-on-surface">${source.name}</h3><span class="px-2 py-0.5 rounded font-label-sm text-label-sm ${source.configured ? "bg-primary-fixed text-primary" : "bg-tertiary-fixed text-on-tertiary-fixed"}">${source.configured ? "适配器已接入" : "待配置接口"}</span></div><p class="mt-2 font-body-sm text-body-sm text-on-surface-variant">${source.description}</p></div><dl class="grid gap-2 p-3 bg-surface-container-low rounded-lg font-body-sm text-body-sm"><div class="flex justify-between gap-2"><dt class="text-on-surface-variant">收录赛事</dt><dd class="font-mono-metric">${stats?.total || 0} 项</dd></div><div class="flex justify-between gap-2"><dt class="text-on-surface-variant">待审核</dt><dd class="font-mono-metric text-tertiary">${stats?.pending || 0} 项</dd></div><div class="flex flex-col gap-1"><dt class="text-on-surface-variant">最近数据更新</dt><dd class="font-mono-metric text-mono-metric">${dateLabel(stats?.latest || null)}</dd></div></dl></article>`;
  }).join(""));
  $("[data-admin-sources]").after('<p class="font-body-sm text-body-sm text-on-surface-variant">以上为本站已有记录统计，不提供实时连通性监测。通过部署环境的赛事同步命令更新数据，新赛事审核通过后再对外展示。</p>');

  $("[data-admin-users]").addClass("space-y-3").html(users.map(user => {
    const current = user.id === currentUserId;
    const eligible = isConfiguredAdminEmail(user.email);
    const effectiveAdmin = eligible && user.role === "admin";
    return `<article class="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-4 rounded-xl bg-surface" data-admin-user-id="${escapeHtml(user.id)}"><div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><h3 class="font-title-md text-title-md">${escapeHtml(user.name || "未设置昵称")}</h3><span class="px-2 py-0.5 rounded-full font-label-sm text-label-sm ${effectiveAdmin ? "bg-primary-fixed text-primary" : "bg-surface-container text-on-surface-variant"}">${effectiveAdmin ? "管理员" : "普通用户"}</span>${current ? '<span class="text-label-sm text-primary">当前账号</span>' : ""}</div><p class="mt-1 font-body-sm text-body-sm text-on-surface-variant break-all">${escapeHtml(user.email)}</p><p class="mt-1 font-body-sm text-body-sm text-on-surface-variant">${eligible ? "已列入管理员邮箱白名单" : "未列入管理员邮箱白名单"}</p></div><div class="flex items-center gap-2 shrink-0"><select aria-label="${escapeHtml(user.name || user.email)}的角色" data-admin-role class="max-w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-sm"${current ? " disabled" : ""}><option value="user"${user.role !== "admin" ? " selected" : ""}>普通用户</option><option value="admin"${user.role === "admin" ? " selected" : ""}${!eligible ? " disabled" : ""}>管理员</option></select><button type="button" data-action="admin-role" class="px-3 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container"${current ? " disabled" : ""}>保存角色</button></div></article>`;
  }).join(""));

  const actionNames: Record<string, string> = { "competition.approve": "通过赛事审核", "competition.reject": "退回赛事", "user.role.update": "更新用户角色" };
  $("[data-admin-audit]").addClass("space-y-3").html(logs.length ? logs.map(log => `<article class="p-4 rounded-xl bg-surface"><div class="flex flex-wrap items-center justify-between gap-2"><h3 class="font-label-md text-label-md text-on-surface">${escapeHtml(actionNames[log.action] || log.action)}</h3><time class="font-mono-metric text-mono-metric text-on-surface-variant">${dateLabel(log.createdAt)}</time></div><p class="mt-2 font-body-sm text-body-sm text-on-surface-variant break-all">操作人：${escapeHtml(log.actorEmail || log.actorId)}</p><p class="mt-1 font-body-sm text-body-sm text-on-surface-variant break-all">${log.targetType === "competition" ? "赛事" : "用户"}：${escapeHtml(log.targetId)}</p>${log.details ? `<p class="mt-2 font-body-sm text-body-sm text-on-surface-variant break-words">记录：${escapeHtml(log.details)}</p>` : ""}</article>`).join("") : '<p class="py-8 text-center font-body-md text-body-md text-on-surface-variant">暂无操作记录，赛事审核与角色变更后会自动记录。</p>');
  $("[data-admin-audit-status]").text(logs.length ? `最近操作：${dateLabel(logs[0].createdAt)} · 审计记录保存在本站数据库` : "审计记录保存在本站数据库，当前暂无管理操作");

  const routes = ["/admin", "/admin/sources", "/admin/users", "/admin/logs", "/admin/settings"];
  const sections = ["#moderation-queue", "#data-sources", "#rbac-permissions", "#audit-trail", "#site-settings"];
  const labels = ["赛事审核", "数据源与爬虫", "用户管理", "操作日志", "网站设置"];
  const sectionNames = ["review", "sources", "users", "logs", "settings"];
  const sectionIndex = sectionNames.indexOf(section);
  $("nav[aria-label='治理模块分类'] a").each((index, element) => {
    const link = $(element);
    link.attr("href", routes[index]).removeAttr("data-admin-section-link");
    const selected = index === sectionIndex;
    link.toggleClass("bg-surface-container-low", selected)
      .toggleClass("text-primary", selected)
      .toggleClass("text-on-surface-variant", !selected);
    if (selected) link.attr("aria-current", "page");
    else link.removeAttr("aria-current");
    link.find("span.truncate").text(labels[index]);
  });
  const settingsLink = $("nav[aria-label='治理模块分类'] a").eq(4);
  if (!settingsLink.length) $("nav[aria-label='治理模块分类']").append('<a href="/admin/settings" class="flex items-center justify-between p-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all"><span class="flex items-center gap-3"><span class="font-mono-metric text-mono-metric">05</span><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="design-icon text-[20px]" data-icon="settings" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.41 1.41-.06-.06A1.7 1.7 0 0 0 16.45 18a1.7 1.7 0 0 0-1 .99V19a1.7 1.7 0 0 0-1.7 1.7h-2A1.7 1.7 0 0 0 10.05 19v-.01a1.7 1.7 0 0 0-1-.99 1.7 1.7 0 0 0-1.88.34l-.06.06-1.41-1.41.06-.06A1.7 1.7 0 0 0 6.1 15c.14-.48.52-.85 1-.99H7A1.7 1.7 0 0 0 8.7 12.3v-.6A1.7 1.7 0 0 0 7 10h-.1c-.48-.14-.86-.51-1-.99a1.7 1.7 0 0 0 .34-1.88l-.06-.06 1.41-1.41.06.06A1.7 1.7 0 0 0 9.53 6.1c.34-.34.52-.8.52-1.28V5A1.7 1.7 0 0 0 11.75 3.3h.5A1.7 1.7 0 0 0 13.95 5v.1c0 .48.18.94.52 1.28a1.7 1.7 0 0 0 1.88.34l.06-.06 1.41 1.41-.06.06A1.7 1.7 0 0 0 17.9 9c.14.48.52.85 1 .99H19A1.7 1.7 0 0 0 20.7 11.7v.6A1.7 1.7 0 0 0 19 14h-.1c-.48.14-.86.51-1 .99Z"></path></svg><span class="font-body-md text-body-md">网站设置</span></span></a>');
  const currentSettingsLink = $("nav[aria-label='治理模块分类'] a[href='/admin/settings']");
  currentSettingsLink.toggleClass("bg-surface-container-low", section === "settings").toggleClass("text-primary", section === "settings").toggleClass("text-on-surface-variant", section !== "settings");
  if (section === "settings") currentSettingsLink.attr("aria-current", "page");
  const pageTitles = ["赛事审核", "数据源与爬虫", "用户管理", "操作日志", "网站设置"];
  const descriptions = [
    "审核新抓取赛事，确认来源与信息后再发布到比赛中心。",
    "查看各抓取适配器状态和本站收录的数据。",
    "查看账号角色，并按邮箱白名单授予管理员权限。",
    "查看赛事审核与用户角色调整的操作记录。",
    "管理网站品牌信息和 SMTP 邮件服务。",
  ];
  $("[data-admin-heading] h1").text(pageTitles[sectionIndex]);
  $("[data-admin-heading] p").text(descriptions[sectionIndex]);
  if (section === "settings") {
    $("nav[aria-label='治理模块分类']").prev().find("span").filter((_, element) => /4 MODULES/.test($(element).text())).text("5 MODULES");
    const panel = $(`<section id="site-settings" class="flex flex-col gap-6 min-w-0">
      <div class="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5">
          <div><h2 class="font-title-lg text-title-lg text-on-surface flex items-center gap-2"><span class="font-mono-metric text-mono-metric font-semibold text-primary bg-primary-fixed px-2 py-0.5 rounded">01</span>网站基础信息</h2><p class="font-body-sm text-body-sm text-on-surface-variant mt-1">配置网站在导航栏、浏览器标签页和品牌区域中使用的信息。</p></div>
          <span class="px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">全局前台生效</span>
        </div>
        <div class="space-y-5 pt-5 border-t border-outline-variant/40">
          <label class="block font-label-sm text-label-sm text-on-surface">网站名称<input name="siteName" data-admin-setting class="mt-2 w-full max-w-xl h-10 px-3.5 rounded-lg border-0 bg-surface-container-low text-body-md text-on-surface" value="${escapeHtml(getSiteSetting("site.name") || "ProjectMate")}" /></label>
          <label class="block font-label-sm text-label-sm text-on-surface">网站副标题<input name="siteSubtitle" data-admin-setting class="mt-2 w-full max-w-2xl h-10 px-3.5 rounded-lg border-0 bg-surface-container-low text-body-md text-on-surface" value="${escapeHtml(getSiteSetting("site.subtitle"))}" placeholder="面向高校学生与青年开发者的智能赛事协作平台" /></label>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <div class="rounded-xl bg-surface-container-low p-4"><div class="flex items-center justify-between mb-2"><strong class="font-label-md text-label-md text-on-surface">网站 Logo</strong><span class="font-mono-metric text-mono-metric text-on-surface-variant">SVG / PNG / WebP</span></div><p class="font-body-sm text-body-sm text-on-surface-variant mb-3">支持品牌标识地址，建议使用透明背景。</p><input name="siteLogo" data-admin-setting class="w-full h-10 rounded-lg border-0 bg-surface-container-lowest px-3 text-body-sm" value="${escapeHtml(getSiteSetting("site.logo"))}" placeholder="/assets/logo.svg" /><div class="mt-3 rounded-lg bg-surface-container-lowest p-3 text-center font-label-sm text-primary">上传或替换 Logo</div></div>
            <div class="rounded-xl bg-surface-container-low p-4"><div class="flex items-center justify-between mb-2"><strong class="font-label-md text-label-md text-on-surface">站点图标（Favicon）</strong><span class="font-mono-metric text-mono-metric text-on-surface-variant">ICO / PNG / SVG</span></div><p class="font-body-sm text-body-sm text-on-surface-variant mb-3">用于浏览器标签页和收藏入口。</p><input name="siteIcon" data-admin-setting class="w-full h-10 rounded-lg border-0 bg-surface-container-lowest px-3 text-body-sm" value="${escapeHtml(getSiteSetting("site.icon"))}" placeholder="/assets/logo.svg" /><div class="mt-3 rounded-lg bg-surface-container-lowest p-3 text-center font-label-sm text-primary">上传或替换 Favicon</div></div>
          </div>
        </div>
      </div>
      <div class="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5"><div><h2 class="font-title-lg text-title-lg text-on-surface flex items-center gap-2"><span class="font-mono-metric text-mono-metric font-semibold text-primary bg-primary-fixed px-2 py-0.5 rounded">02</span>SMTP 邮件服务</h2><p class="font-body-sm text-body-sm text-on-surface-variant mt-1">配置邮箱验证码、密码修改和安全通知所使用的邮件服务。</p></div><span class="px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">按需配置</span></div>
        <div class="pt-5 border-t border-outline-variant/40 grid grid-cols-1 md:grid-cols-2 gap-5">
          <label class="font-label-sm text-label-sm text-on-surface">SMTP 服务器地址<input name="host" data-admin-setting class="mt-2 w-full h-10 rounded-lg border-0 bg-surface-container-low px-3.5 font-mono-metric text-mono-metric" value="${escapeHtml(getSiteSetting("smtp.host"))}" placeholder="smtp.example.com" /></label><label class="font-label-sm text-label-sm text-on-surface">SMTP 端口<input name="port" data-admin-setting class="mt-2 w-full h-10 rounded-lg border-0 bg-surface-container-low px-3.5 font-mono-metric text-mono-metric" value="${escapeHtml(getSiteSetting("smtp.port") || "587")}" /></label>
          <label class="font-label-sm text-label-sm text-on-surface">传输加密协议<select name="secure" data-admin-setting class="mt-2 w-full h-10 rounded-lg border-0 bg-surface-container-low px-3.5 text-body-sm"><option value="false" ${getSiteSetting("smtp.secure") !== "true" ? "selected" : ""}>STARTTLS / 非 SSL</option><option value="true" ${getSiteSetting("smtp.secure") === "true" ? "selected" : ""}>SSL / TLS</option></select></label><label class="font-label-sm text-label-sm text-on-surface">SMTP 用户名<input name="user" data-admin-setting class="mt-2 w-full h-10 rounded-lg border-0 bg-surface-container-low px-3.5 font-mono-metric text-mono-metric" value="${escapeHtml(getSiteSetting("smtp.user"))}" /></label>
          <label class="md:col-span-2 font-label-sm text-label-sm text-on-surface">SMTP 密码 / 授权凭证<input name="password" data-admin-setting type="password" class="mt-2 w-full max-w-xl h-10 rounded-lg border-0 bg-surface-container-low px-3.5 font-mono-metric text-mono-metric" placeholder="留空保持原密码" /><span class="mt-1 block font-body-sm text-body-sm text-on-surface-variant">密码已加密保存，安全隔离存储，不回显真实明文。</span></label>
          <label class="font-label-sm text-label-sm text-on-surface">发件人显示名称<input name="fromName" data-admin-setting class="mt-2 w-full h-10 rounded-lg border-0 bg-surface-container-low px-3.5" value="${escapeHtml(getSiteSetting("smtp.fromName") || "ProjectMate")}" /></label><label class="font-label-sm text-label-sm text-on-surface">发件人邮箱<input name="fromEmail" data-admin-setting class="mt-2 w-full h-10 rounded-lg border-0 bg-surface-container-low px-3.5 font-mono-metric text-mono-metric" value="${escapeHtml(getSiteSetting("smtp.fromEmail"))}" /></label>
        </div>
        <div class="mt-6 rounded-xl bg-surface-container-low p-4"><div class="flex items-center justify-between gap-3 mb-2"><strong class="font-label-md text-label-md text-on-surface">SMTP 发信联通性测试</strong><span class="font-mono-metric text-mono-metric text-on-surface-variant">Ping Socket &amp; HELO/EHLO</span></div><p class="font-body-sm text-body-sm text-on-surface-variant mb-3">向指定邮箱投递测试邮件，验证服务器链路与认证凭证。</p><div class="flex flex-col sm:flex-row gap-3"><input name="testTo" data-admin-setting class="flex-1 h-9 rounded-lg border-0 bg-surface-container-lowest px-3 font-mono-metric text-mono-metric" placeholder="测试收件邮箱" /><button type="button" data-admin-settings-test class="h-9 px-4 rounded-lg bg-primary text-on-primary font-label-md text-label-md">测试发送</button></div><p data-admin-settings-message class="hidden mt-3 font-body-sm text-body-sm text-on-surface-variant"></p></div>
      </div>
      <div data-admin-settings-bar class="hidden settings-admin-save-bar"><div class="flex items-center gap-2 text-on-surface-variant"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="design-icon text-secondary" data-icon="cloud_done" aria-hidden="true"><path d="M4.2 15.1A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.2"></path><path d="m15.7 18.4-.9-.3"></path><path d="m9.2 15.9-.9-.3"></path><path d="m10.6 20.7.3-.9"></path></svg><span class="font-body-sm text-body-sm">你有尚未保存的网站设置修改</span></div><div class="flex items-center gap-3"><button type="button" data-admin-settings-cancel class="px-4 py-2 rounded-lg text-on-surface-variant hover:text-on-surface font-label-md text-label-md">放弃未保存修改</button><button type="button" data-admin-settings-save class="px-6 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="design-icon" data-icon="save" aria-hidden="true"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"></path><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0 1 1v7"></path><path d="M7 3v4a1 1 0 0 0 1 1h7"></path></svg><span>保存网站设置</span></button></div></div>
    </section>`);
    const adminLayout = $("main aside").first().parent();
    adminLayout.children().last().append(panel);
  }
  const visibleSection = sections[sectionIndex];
  sections.filter(selector => selector !== visibleSection).forEach(selector => $(selector).remove());
  $('a[data-admin-section-link][href="#audit-trail"]').attr("href", "/admin/logs").removeAttr("data-admin-section-link");
  if (section !== "logs") $("aside[aria-label='审计日志状态']").remove();
}
