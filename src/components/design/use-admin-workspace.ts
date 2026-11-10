"use client";

import { useEffect, type RefObject } from "react";
import { useRouter } from "next/navigation";

export function useAdminWorkspace(root: RefObject<HTMLDivElement | null>, enabled: boolean, html: string, notify: (message: string, title?: string) => void) {
  const router = useRouter();
  useEffect(() => {
    const scope = root.current;
    if (!enabled || !scope) return;
    let page = 1;
    let settingsBusy = false;
    const syncing = new Set<string>();
    const pageSize = 5;
    const search = scope.querySelector<HTMLInputElement>("[data-admin-queue-search]");
    const source = scope.querySelector<HTMLSelectElement>("[data-admin-source-filter]");
    const settingFields = [...scope.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-admin-setting]")];
    const settingInitial = settingFields.map(field => field.type === "checkbox" ? String((field as HTMLInputElement).checked) : field.value);
    let settingDirty = false;
    const updateSettingsBar = () => {
      const dirty = settingFields.some((field, index) => (field.type === "checkbox" ? String((field as HTMLInputElement).checked) : field.value) !== settingInitial[index]);
      const bar = scope.querySelector<HTMLElement>("[data-admin-settings-bar]");
      if (bar) { bar.classList.toggle("hidden", !dirty); bar.style.position = "fixed"; bar.style.bottom = "24px"; bar.style.left = "24px"; bar.style.right = "24px"; bar.style.zIndex = "45"; bar.style.maxWidth = "1192px"; bar.style.marginInline = "auto"; if (dirty && !settingDirty) { bar.classList.remove("settings-save-bar-enter"); void bar.offsetWidth; bar.classList.add("settings-save-bar-enter"); } }
      settingDirty = dirty;
    };
    const cards = [...scope.querySelectorAll<HTMLElement>("article[data-review-id]")];
    const filter = () => {
      const terms = (search?.value || "").normalize("NFKC").toLowerCase().trim().split(/\s+/).filter(Boolean);
      const matched = cards.filter(card => (!source?.value || card.dataset.adminSource === source.value) && terms.every(term => (card.dataset.adminSearch || "").normalize("NFKC").toLowerCase().includes(term)));
      const pageCount = Math.max(1, Math.ceil(matched.length / pageSize));
      page = Math.min(Math.max(1, page), pageCount);
      const visible = new Set(matched.slice((page - 1) * pageSize, page * pageSize));
      cards.forEach(card => card.classList.toggle("hidden", !visible.has(card)));
      scope.querySelector("[data-admin-empty-queue]")?.classList.toggle("hidden", matched.length > 0);
      const label = scope.querySelector("[data-admin-review-page-label]");
      if (label) label.textContent = `第 ${page} / ${pageCount} 页 · 共 ${matched.length} 项`;
      const prev = scope.querySelector<HTMLButtonElement>('[data-admin-queue-page="prev"]');
      const next = scope.querySelector<HTMLButtonElement>('[data-admin-queue-page="next"]');
      if (prev) prev.disabled = page <= 1;
      if (next) next.disabled = page >= pageCount;
    };
    const changed = () => { page = 1; filter(); };
    const clicked = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const syncButton=event.target.closest<HTMLButtonElement>("button[data-admin-source-sync]");
      if(syncButton){
        event.preventDefault();event.stopPropagation();const sourceId=syncButton.dataset.adminSourceSync||"";if(syncing.has(sourceId)||syncButton.disabled)return;syncing.add(sourceId);syncButton.disabled=true;syncButton.textContent="同步中…";syncButton.setAttribute("aria-busy","true");
        const message=syncButton.closest("[data-source-card]")?.querySelector<HTMLElement>("[data-source-sync-message]");if(message)message.textContent="正在连接数据源并抓取公开资料，请稍候…";
        fetch("/api/admin/sources/sync",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:sourceId}),signal:AbortSignal.timeout(180000)}).then(async response=>{const result=await response.json();if(message)message.textContent=result.message||"同步未完成，请刷新查看。";notify(result.message||"同步未完成。",response.ok?"数据源已同步":"同步未完成");router.refresh();}).catch(()=>{if(message)message.textContent="连接中断或等待超时，请刷新查看同步状态；请勿连续重复请求。";notify("连接中断或等待超时，请刷新查看同步状态。","同步状态待确认");}).finally(()=>{syncing.delete(sourceId);syncButton.disabled=false;syncButton.textContent="立即同步";syncButton.removeAttribute("aria-busy");});return;
      }
      const button = event.target.closest<HTMLButtonElement>("button[data-admin-queue-page], button[data-admin-refresh]");
      const settingsButton = event.target.closest<HTMLButtonElement>("button[data-admin-settings-save], button[data-admin-settings-test]");
      if (event.target.closest("[data-admin-settings-cancel]")) { event.preventDefault();event.stopPropagation();if(settingsBusy)return; settingFields.forEach((field, index) => { if (field.type === "checkbox") (field as HTMLInputElement).checked = settingInitial[index] === "true"; else field.value = settingInitial[index]; }); updateSettingsBar(); return; }
      if (settingsButton) {
        event.preventDefault();event.stopPropagation();if(settingsBusy)return;settingsBusy=true;settingsButton.disabled=true;
        const values = Object.fromEntries(settingFields.map(input => [input.name, input.type === "checkbox" ? (input as HTMLInputElement).checked : input.value]));
        const message = scope.querySelector<HTMLElement>("[data-admin-settings-message]");
        const endpoint = settingsButton.hasAttribute("data-admin-settings-test") ? "/api/admin/settings/test" : "/api/admin/settings";
        const payload = settingsButton.hasAttribute("data-admin-settings-test") ? { ...values, to: values.testTo } : values;
        if (settingsButton.hasAttribute("data-admin-settings-test")) delete payload.testTo;
        fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }).then(async response => {
          const result = await response.json();
          if (message) { message.textContent = result.message || "操作完成"; message.classList.remove("hidden"); }
          if (response.ok && !settingsButton.hasAttribute("data-admin-settings-test")) { settingFields.forEach((field, index) => { settingInitial[index] = field.type === "checkbox" ? String((field as HTMLInputElement).checked) : field.value; }); updateSettingsBar(); }
          notify(result.message || "操作完成", response.ok ? "操作成功" : "操作未完成");
        }).catch(() => notify("请求未完成，请稍后重试。", "连接失败")).finally(()=>{settingsBusy=false;settingsButton.disabled=false;});
        return;
      }
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      if (button.hasAttribute("data-admin-refresh")) {
        router.refresh();
        notify("正在读取最新管理数据。", "刷新数据");
        return;
      }
      page += button.dataset.adminQueuePage === "next" ? 1 : -1;
      filter();
      scope.querySelector("#moderation-queue")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    };
    const links = [...scope.querySelectorAll<HTMLAnchorElement>('nav[aria-label="治理模块分类"] [data-admin-section-link]')];
    const sections = links.map(link => scope.querySelector<HTMLElement>(link.hash)).filter((section): section is HTMLElement => !!section);
    let frame = 0;
    const updateActive = () => {
      frame = 0;
      const active = [...sections].reverse().find(section => section.getBoundingClientRect().top <= 140) || sections[0];
      links.forEach(link => {
        const selected = link.hash === `#${active?.id}`;
        link.classList.toggle("bg-surface-container-low", selected);
        link.classList.toggle("text-primary", selected);
        link.classList.toggle("text-on-surface-variant", !selected);
        if (selected) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(updateActive); };
    scope.addEventListener("click", clicked, true);
    search?.addEventListener("input", changed);
    source?.addEventListener("change", changed);
    settingFields.forEach(field => { field.addEventListener("input", updateSettingsBar); field.addEventListener("change", updateSettingsBar); });
    window.addEventListener("scroll", scroll, { passive: true });
    filter();
    updateActive();
    return () => {
      scope.removeEventListener("click", clicked, true);
      search?.removeEventListener("input", changed);
      source?.removeEventListener("change", changed);
      settingFields.forEach(field => { field.removeEventListener("input", updateSettingsBar); field.removeEventListener("change", updateSettingsBar); });
      window.removeEventListener("scroll", scroll);
      if (frame) cancelAnimationFrame(frame);
    };
  // Notification changes must not reset the queue filters or pagination.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, enabled, html, router]);
}
