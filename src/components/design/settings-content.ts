import type { CheerioAPI } from "cheerio";

export type SettingsSection = "profile" | "security" | "connections" | "notifications" | "danger";

const modules = [
  { key: "profile", href: "/settings", title: "账号资料", description: "管理头像、昵称、学校和个人技能。" },
  { key: "security", href: "/settings/security", title: "安全与登录", description: "管理密码、身份验证器和一次性恢复码。" },
  { key: "connections", href: "/settings/connections", title: "外部连接与 MCP", description: "管理GitHub身份绑定和本站MCP授权入口。" },
  { key: "notifications", href: "/settings/notifications", title: "通知偏好", description: "设置通知邮箱和Webhook，查看组队通知投递记录。" },
  { key: "danger", href: "/settings/danger", title: "危险操作", description: "结束本设备会话或验证身份后永久注销账号。" },
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
  sidebar.children().first().children().first().remove();
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
  sidebar.children().eq(1).find("p").text("个人资料修改后需要保存。安全操作需要验证身份；通知仅发送到你已验证并启用的通道。");
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

  connections.remove();
  security.remove();
  content.append('<div data-settings-workspace></div>');
}
