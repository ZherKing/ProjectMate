"use client";

import { useEffect, type RefObject } from "react";
import { useRouter } from "next/navigation";

export function useAdminWorkspace(root: RefObject<HTMLDivElement | null>, enabled: boolean, html: string, notify: (message: string, title?: string) => void) {
  const router = useRouter();
  useEffect(() => {
    const scope = root.current;
    if (!enabled || !scope) return;
    let page = 1;
    const pageSize = 5;
    const search = scope.querySelector<HTMLInputElement>("[data-admin-queue-search]");
    const source = scope.querySelector<HTMLSelectElement>("[data-admin-source-filter]");
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
      const button = event.target.closest<HTMLButtonElement>("button[data-admin-queue-page], button[data-admin-refresh]");
      const settingsButton = event.target.closest<HTMLButtonElement>("button[data-admin-settings-save], button[data-admin-settings-test]");
      if (settingsButton) {
        event.preventDefault();
        const values = Object.fromEntries([...scope.querySelectorAll<HTMLInputElement>("[data-admin-setting]")].map(input => [input.name, input.type === "checkbox" ? input.checked : input.value]));
        const message = scope.querySelector<HTMLElement>("[data-admin-settings-message]");
        const endpoint = settingsButton.hasAttribute("data-admin-settings-test") ? "/api/admin/settings/test" : "/api/admin/settings";
        const payload = settingsButton.hasAttribute("data-admin-settings-test") ? { ...values, to: values.testTo } : values;
        if (settingsButton.hasAttribute("data-admin-settings-test")) delete payload.testTo;
        fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }).then(async response => {
          const result = await response.json();
          if (message) { message.textContent = result.message || "操作完成"; message.classList.remove("hidden"); }
          notify(result.message || "操作完成", response.ok ? "操作成功" : "操作未完成");
        }).catch(() => notify("请求未完成，请稍后重试。", "连接失败"));
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
    window.addEventListener("scroll", scroll, { passive: true });
    filter();
    updateActive();
    return () => {
      scope.removeEventListener("click", clicked, true);
      search?.removeEventListener("input", changed);
      source?.removeEventListener("change", changed);
      window.removeEventListener("scroll", scroll);
      if (frame) cancelAnimationFrame(frame);
    };
  // Notification changes must not reset the queue filters or pagination.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, enabled, html, router]);
}
