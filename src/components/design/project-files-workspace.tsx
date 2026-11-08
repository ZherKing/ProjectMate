"use client";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { ProjectFilesPanel } from "./project-files-panel";

const FilesPanel = dynamic(() => import("./project-files-panel").then(module => module.ProjectFilesPanel), {
  loading: () => <div className="pm-files-stack" aria-busy="true"><section className="pm-todo-board pm-files-document-placeholder"><p className="pm-file-loading" role="status">正在加载文档区…</p></section><section className="pm-todo-board pm-files-code-placeholder"><p className="pm-file-loading">正在加载代码区…</p></section></div>,
});

export function ProjectFilesWorkspace(props: ComponentProps<typeof ProjectFilesPanel>) {
  return <FilesPanel {...props} />;
}
