import type { CheerioAPI } from "cheerio";
import { sqlite } from "@/lib/db/client";
import { listAdminAuditLogs, listAdminUsers, listPendingCompetitions } from "@/lib/db/queries";
import { isConfiguredAdminEmail } from "@/lib/auth/permissions";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const dateLabel = (value: number | null) => value ? new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) : "暂无入库记录";

export function populateAdminContent($: CheerioAPI, currentUserId: string, section: "review" | "sources" | "users" | "logs") {
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

  const routes = ["/admin", "/admin/sources", "/admin/users", "/admin/logs"];
  const sections = ["#moderation-queue", "#data-sources", "#rbac-permissions", "#audit-trail"];
  const labels = ["赛事审核", "数据源与爬虫", "用户管理", "操作日志"];
  const sectionNames = ["review", "sources", "users", "logs"];
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
  const pageTitles = ["赛事审核", "数据源与爬虫", "用户管理", "操作日志"];
  const descriptions = [
    "审核新抓取赛事，确认来源与信息后再发布到比赛中心。",
    "查看各抓取适配器状态和本站收录的数据。",
    "查看账号角色，并按邮箱白名单授予管理员权限。",
    "查看赛事审核与用户角色调整的操作记录。",
  ];
  $("[data-admin-heading] h1").text(pageTitles[sectionIndex]);
  $("[data-admin-heading] p").text(descriptions[sectionIndex]);
  const visibleSection = sections[sectionIndex];
  sections.filter(selector => selector !== visibleSection).forEach(selector => $(selector).remove());
  $('a[data-admin-section-link][href="#audit-trail"]').attr("href", "/admin/logs").removeAttr("data-admin-section-link");
  if (section !== "logs") $("aside[aria-label='审计日志状态']").remove();
}
