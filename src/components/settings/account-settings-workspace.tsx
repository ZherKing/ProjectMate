"use client";
import dynamic from"next/dynamic";
const Panel=dynamic(()=>import("./account-settings-panel").then(module=>module.AccountSettingsPanel),{loading:()=> <section className="pm-todo-board"><p className="pm-file-loading" role="status">正在加载个人设置…</p></section>});
export function AccountSettingsWorkspace({section}:{section:string}){return <Panel section={section}/>;}
