import Link from "next/link";
import { ArrowUpRight, ClipboardList, FileText, Users } from "lucide-react";
import type { ProjectOverviewData } from "@/lib/db/project-overview";

export function ProjectOverviewPanel({ data }: { data: ProjectOverviewData | null }) {
  if (!data) return <section className="pm-todo-board" aria-labelledby="overview-empty-title"><div className="pm-todo-heading"><h2 id="overview-empty-title">项目概览</h2></div><div className="pm-todo-empty pm-overview-empty"><Users size={28} /><p>暂无可访问的项目，请创建组队项目或通过邀请加入项目。</p><Link href="/teams?create=1" className="pm-button-primary">创建组队项目</Link></div></section>;
  const { project, viewerRole } = data;
  const suffix = `?project=${encodeURIComponent(project.id)}`;
  return <div className="pm-overview-stack" data-project-overview>
    <section className="pm-todo-board" aria-labelledby="overview-project-title">
      <div className="pm-todo-heading"><div><h2 id="overview-project-title"><span className="pm-todo-section-number" aria-hidden="true">01</span>项目简介</h2><p>项目目标、关联赛事与投入安排。</p></div><span className="pm-overview-project-status">{project.status}</span></div>
      <div className="pm-overview-description"><FileText size={20} aria-hidden="true" /><p>{project.description?.trim() || "暂无项目简介。"}</p></div>
      <dl className="pm-overview-facts"><div><dt>关联比赛</dt><dd>{project.competitionName || "暂无已核验赛事信息"}</dd></div><div><dt>目标赛道</dt><dd>{project.trackName || "暂无赛道信息"}</dd></div><div><dt>每周投入</dt><dd>{project.weeklyHours ? `${project.weeklyHours} 小时 / 周` : "暂未填写"}</dd></div></dl>
    </section>
    <section className="pm-todo-board" aria-labelledby="overview-tasks-title">
      <div className="pm-todo-heading"><div><h2 id="overview-tasks-title"><span className="pm-todo-section-number" aria-hidden="true">02</span>接下来要做</h2><p>优先展示高优先级待办，最多显示 5 项。</p></div><div className="pm-todo-tools"><span data-overview-task-count>{data.remaining} 项未完成 / 共 {data.totalTasks} 项</span><Link className="pm-button-outline" href={`/projects/tasks${suffix}`}>进入任务看板<ArrowUpRight size={14} /></Link></div></div>
      <div className="pm-todo-list">{data.tasks.map(task => <article className="pm-todo-item pm-overview-task" key={task.id} data-overview-task>
        <div className="pm-todo-item-top"><span className="pm-todo-icon"><ClipboardList size={21} /></span><div className="pm-todo-item-copy"><h3>{task.title}</h3><p className="pm-overview-task-notes">{task.notes || "暂无备注"}</p><div className="pm-overview-task-meta"><span>优先级：{task.priority}</span><span>负责人：{task.assignee || "待分配"}</span></div></div><span className="pm-todo-status">{task.status}</span></div>
      </article>)}{!data.tasks.length && <div className="pm-overview-inline-empty"><ClipboardList size={24} /><p>{data.totalTasks ? "当前待办已全部完成，可前往任务看板安排下一步。" : viewerRole === "创建者" ? "还没有待办事项，前往任务看板添加第一条任务。" : "还没有待办事项，等待创建者添加任务。"}</p></div>}</div>
    </section>
    <section className="pm-todo-board" aria-labelledby="overview-team-title">
      <div className="pm-todo-heading"><div><h2 id="overview-team-title"><span className="pm-todo-section-number" aria-hidden="true">03</span>团队速览</h2><p>查看参与当前项目的队友与权限。</p></div><div className="pm-todo-tools"><span data-overview-member-count>共 {data.memberCount} 位成员 · {data.adminCount} 位管理员</span><Link className="pm-button-outline" href={`/projects/members${suffix}`}>{viewerRole === "成员" ? "查看成员" : "管理成员"}<ArrowUpRight size={14} /></Link></div></div>
      <div className="pm-overview-members">{data.members.map(member => <div className="pm-overview-member" key={member.id}><span className="pm-member-avatar"><span aria-hidden="true">{member.name?.trim().slice(0, 1) || <Users size={20} />}</span>{member.avatarVersion !== null && <img src={`/api/avatars/${encodeURIComponent(member.id)}?v=${member.avatarVersion}`} alt="" />}</span><div><p title={member.name || "未设置昵称"}>{member.name || "未设置昵称"}</p><span>{member.role}</span></div></div>)}</div>
      {data.memberCount > data.members.length && <p className="pm-overview-more-members">其余 {data.memberCount - data.members.length} 位队友可在成员架构中查看。</p>}
    </section>
  </div>;
}
