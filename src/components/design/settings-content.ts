import type { CheerioAPI } from "cheerio";

export type SettingsSection = "profile" | "security" | "connections" | "notifications" | "danger";

const modules = [
  { key: "profile", href: "/settings", title: "账号资料", description: "管理头像、昵称、学校和个人技能。" },
  { key: "security", href: "/settings/security", title: "安全与登录", description: "查看密码与两步验证功能的接入状态。" },
  { key: "connections", href: "/settings/connections", title: "外部连接与 MCP", description: "管理外部授权和模型上下文协议连接。" },
  { key: "notifications", href: "/settings/notifications", title: "通知偏好", description: "查看通知偏好功能的接入状态。" },
  { key: "danger", href: "/settings/danger", title: "危险操作", description: "退出当前登录会话，了解账号注销功能的可用状态。" },
] as const;

export function configureSettingsPage($: CheerioAPI, section: SettingsSection) {
  const main = $("main");
  main.find("span").filter((_, element) => $(element).text().trim() === "AUTH_CONTEXT:").parent().remove();
  const sidebar = main.find("aside").first();
  const content = sidebar.next();
  sidebar.parent().attr("class", "flex flex-col lg:flex-row items-start gap-6");
  sidebar.attr("class", "lg:w-[280px] shrink-0 flex flex-col gap-5 sticky top-24");
  content.attr("class", "flex-1 min-w-0 flex flex-col gap-6");
  const cards = content.children("div");
  const profile = cards.eq(0);
  const connections = cards.eq(1);
  const security = cards.eq(2);
  const saveBar = cards.eq(3);
  const selected = modules.find(module => module.key === section)!;

  sidebar.children().first().attr("role", "navigation").attr("aria-label", "个人设置导航");
  sidebar.find("button").each((index, element) => {
    const module = modules[index];
    const button = $(element);
    const active = module.key === section;
    const label = button.children("div").first();
    label.find("span").first().attr("class", "font-mono-metric text-mono-metric");
    label.find("span").last().text(module.title);
    const classes = `w-full flex items-center justify-between px-3.5 py-3 rounded-lg font-body-md text-body-md transition-all text-left group ${active ? "bg-surface-container text-primary font-semibold" : module.key === "danger" ? "text-error hover:bg-error-container/40" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"}`;
    button.replaceWith(`<a href="${module.href}" class="${classes}"${active ? ' aria-current="page"' : ""}>${label.toString()}</a>`);
  });
  sidebar.children().eq(1).find("p").text("个人资料修改后需要保存。外部授权、两步验证和通知订阅尚未接入，页面会明确显示其可用状态。");
  sidebar.children().eq(1).find("div").last().remove();
  main.find("h1").first().text(selected.title);
  main.find("h1").first().parent().next("p").text(selected.description);
  main.find("h1").first().siblings("span").remove();

  if (section === "profile") {
    connections.remove();
    security.remove();
    return;
  }
  profile.remove();
  saveBar.remove();

  if (section === "connections") {
    security.remove();
    connections.children().slice(1).remove();
    connections.find("h2").text("外部连接与 MCP");
    connections.find("h2").parent().siblings("p").text("授权服务配置完成后，可在此管理外部连接。");
    connections.find("h2").siblings("span").remove();
    connections.children().first().find("div.w-8").text("03");
    connections.find("button").remove();
    connections.append('<div class="p-5 rounded-xl bg-surface-container-low flex flex-col gap-3"><h3 class="font-title-md text-title-md text-on-surface">尚未接入外部授权服务</h3><p class="font-body-md text-body-md text-on-surface-variant">当前没有可用的 OAuth 授权入口或 MCP 连接。完成服务端授权配置后才能绑定账号与连接服务器。</p><span class="self-start px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">未接入</span></div>');
    return;
  }
  connections.remove();
  if (section === "notifications") {
    security.remove();
    content.append('<section class="bg-surface-container-lowest rounded-xl p-6 shadow-sm flex flex-col gap-5"><div><h2 class="font-title-lg text-title-lg text-on-surface">通知偏好</h2><p class="mt-1 font-body-sm text-body-sm text-on-surface-variant">管理赛事提醒、组队消息与项目通知。</p></div><div class="p-5 rounded-xl bg-surface-container-low flex flex-col gap-3"><h3 class="font-title-md text-title-md text-on-surface">通知订阅功能尚未接入</h3><p class="font-body-md text-body-md text-on-surface-variant">当前操作结果仍通过站内 Toast 提示。赛事订阅、邮件提醒和消息推送尚未启用，暂无可保存的通知偏好。</p><span class="self-start px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">未接入</span></div></section>');
    return;
  }
  if (section === "security") {
    security.children().first().find("div.w-8").text("02");
    security.find("h2").text("安全与登录");
    security.find("h2").parent().find("p").text("当前使用账号密码登录；在线修改密码和两步验证尚未接入。");
    security.children().last().remove();
    security.find("h3").each((_, element) => { $(element).next("p").text("此功能尚未接入，当前页面不能修改安全凭据。"); });
    security.find("span").filter((_, element) => $(element).text().trim() === "PROTECTED").text("未接入").attr("class", "px-2 py-1 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm");
    const passwordButton = security.find("button").filter((_, element) => /更新密码/.test($(element).text())).first();
    const twoFactorButton = security.find("button").filter((_, element) => /重置密钥/.test($(element).text())).first();
    twoFactorButton.text("启用 2FA").attr("class", passwordButton.attr("class") || "").attr("data-action", "twofa-modal");
    passwordButton.attr("data-action", "password-modal");
    security.append('<div id="password-modal" class="hidden fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/30 p-4"><div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div class="flex items-center justify-between"><h2 class="font-title-lg text-title-lg">更改登录密码</h2><button type="button" data-action="password-close" class="text-slate-500">×</button></div><p class="mt-2 text-sm text-slate-500">验证码将发送到当前登录邮箱。</p><div class="mt-5 grid gap-3"><div class="flex gap-2"><input data-password-code class="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2" placeholder="邮箱验证码" /><button data-action="password-send" type="button" class="rounded-lg bg-slate-100 px-3 py-2 text-sm">发送验证码</button></div><input data-password-new type="password" class="rounded-lg border border-slate-200 px-3 py-2" placeholder="新密码（至少 8 位）" /><input data-password-confirm type="password" class="rounded-lg border border-slate-200 px-3 py-2" placeholder="确认新密码" /><button data-action="password-submit" type="button" class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">确认修改</button></div></div></div>');
    security.append('<div id="twofa-modal" class="hidden fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/30 p-4"><div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div class="flex items-center justify-between"><h2 class="font-title-lg text-title-lg">绑定两步验证</h2><button type="button" data-action="twofa-close" class="text-slate-500">×</button></div><p class="mt-2 text-sm text-slate-500">先验证当前邮箱，再使用身份验证器扫描二维码。</p><div class="mt-5 grid gap-3"><div class="flex gap-2"><input data-twofa-email-code class="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2" placeholder="邮箱验证码" /><button data-action="twofa-send" type="button" class="rounded-lg bg-slate-100 px-3 py-2 text-sm">发送验证码</button></div><button data-action="twofa-begin" type="button" class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">验证邮箱并显示二维码</button><div data-twofa-guide class="hidden grid gap-3"><img data-twofa-qr alt="2FA 绑定二维码" class="mx-auto h-52 w-52" /><p class="break-all rounded-lg bg-slate-50 p-3 text-xs text-slate-600" data-twofa-secret></p><input data-twofa-token class="rounded-lg border border-slate-200 px-3 py-2" placeholder="输入身份验证器中的 6 位验证码" /><button data-action="twofa-confirm" type="button" class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">完成绑定</button></div></div></div></div>');
    return;
  }
  security.find("h2").text("危险操作");
  security.children().first().find("div.w-8").text("05");
  security.find("h2").parent().find("p").text("退出会话前，请先保存尚未提交的个人资料。");
  security.children("div.grid").remove();
  const danger = security.children().last();
  danger.find("p").text("退出登录会结束当前会话，已保存的账号资料会保留。永久注销功能尚未接入，当前页面不会删除账号或数据。");
  danger.find("span").filter((_, element) => $(element).text().includes("SESSION_ID:")).remove();
}
