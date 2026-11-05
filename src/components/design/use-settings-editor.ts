"use client";

import { useEffect, type RefObject } from "react";
import { useRouter } from "next/navigation";

export function useSettingsEditor(root: RefObject<HTMLDivElement | null>, enabled: boolean, html: string, notify: (message: string, title?: string) => void) {
  const router = useRouter();
  useEffect(() => {
    const scope = root.current;
    if (!enabled || !scope) return;
    const fields = [...scope.querySelectorAll<HTMLInputElement>("[data-settings-field]")];
    const initial = fields.map(field => field.value);
    const fileInput = scope.querySelector<HTMLInputElement>("[data-avatar-file]");
    const avatar = scope.querySelector<HTMLImageElement>("[data-settings-avatar]");
    const initialAvatar = avatar?.src || "";
    const bar = scope.querySelector<HTMLElement>("[data-settings-save-bar]");
    let file: File | null = null;
    let preview = "";
    let busy = false;
    const update = () => {
      const dirty = !!file || fields.some((field,index) => field.value !== initial[index]);
      bar?.classList.toggle("hidden", !dirty);
      if (bar) { bar.style.position = "fixed"; bar.style.bottom = "24px"; bar.style.left = "24px"; bar.style.right = "24px"; bar.style.zIndex = "45"; bar.style.maxWidth = "1192px"; bar.style.marginInline = "auto"; }
    };
    const changed = async (event: Event) => {
      if (event.target === fileInput) {
        const selected = fileInput?.files?.[0];
        if (!selected) return;
        if (selected.size > 2*1024*1024 || !["image/png","image/jpeg","image/webp"].includes(selected.type)) {
          notify("请选择不超过 2MB 的 JPG、PNG 或 WebP 图片。", "头像格式不支持");
          if(fileInput) fileInput.value="";
          return;
        }
        try { const bitmap = await createImageBitmap(selected); bitmap.close(); }
        catch { notify("图片无法读取，请重新选择。", "头像上传失败"); return; }
        file = selected;
        if(preview) URL.revokeObjectURL(preview);
        preview = URL.createObjectURL(selected);
        if(avatar) avatar.src = preview;
      }
      update();
    };
    const clicked = async (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLButtonElement>("button[data-action]");
      const action = button?.dataset.action;
      if (!button || !["save-settings","upload-avatar","discard-settings"].includes(action || "")) return;
      event.preventDefault(); event.stopPropagation();
      if (busy) return;
      if(action === "upload-avatar") { fileInput?.click(); return; }
      if(action === "discard-settings") {
        fields.forEach((field,index)=>{field.value=initial[index];});
        file=null; if(fileInput)fileInput.value="";
        if(avatar)avatar.src=initialAvatar;
        if(preview){URL.revokeObjectURL(preview);preview="";}
        update(); return;
      }
      const form = new FormData();
      fields.forEach(field=>form.set(field.dataset.settingsField!,field.value));
      if(file) form.set("avatar",file);
      busy=true;button.disabled=true;
      try {
        const response=await fetch("/api/settings",{method:"POST",body:form});
        const result=await response.json();
        if(!response.ok)throw new Error(result.message||"保存失败，请重试。");
        fields.forEach((field,index)=>{initial[index]=field.value;});file=null;
        update();notify("头像与个人资料已保存。","保存成功");router.refresh();
      } catch(error) { notify(error instanceof Error?error.message:"保存失败，请重试。","保存未完成"); }
      finally { busy=false;button.disabled=false; }
    };
    scope.addEventListener("click",clicked,true);
    scope.addEventListener("input",changed);
    scope.addEventListener("change",changed);
    update();
    return()=>{scope.removeEventListener("click",clicked,true);scope.removeEventListener("input",changed);scope.removeEventListener("change",changed);if(preview)URL.revokeObjectURL(preview);};
  // notify is an event callback; editor state is reset only when the server markup changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[root,enabled,html,router]);
}
