import { randomBytes } from "node:crypto";
import { sqlite } from "./client";
import { initializeDatabase } from "./initialize";
import { hashPassword } from "@/lib/auth/password";
import { saveProjectFile } from "@/lib/files/store";

const prefix = "pm-review-v1-";
const judgeId = prefix + "judge";
const marker = prefix + "complete";
const labels = ["Web校园协作创新赛", "AI学习助手设计赛", "开源数据可视化挑战", "智能生活应用设计赛", "绿色校园创意挑战", "无障碍网页创新赛", "教育产品原型挑战", "开发者工具创作赛"];
const skills = ["React、TypeScript、Next.js", "Python、FastAPI、SQL", "Figma、UI、UX、产品设计", "数据分析、Python、可视化", "Java、Spring、后端开发", "React、CSS、无障碍设计", "测试、TypeScript、自动化测试"];

/** Explicitly opt-in fixture import, intended for a review deployment, never an account reset. */
export function importReviewDemo() {
  if (!/^(true|1)$/i.test(process.env.DEMO_DATA_ENABLED || "")) return { enabled:false, created:false };
  const email=(process.env.DEMO_ACCOUNT_EMAIL||"judge@projectmate.local").trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254)throw new Error("演示账号邮箱配置无效。");
  const admins=(process.env.ADMIN_EMAILS||"").toLowerCase().split(',').map(s=>s.trim());
  if(admins.includes(email))throw new Error("演示账号不能列入管理员白名单。");
  initializeDatabase();
  const user=sqlite.prepare("SELECT id,email,deleted_at AS deleted FROM users WHERE id=? OR lower(email)=?").all(judgeId,email) as Array<{id:string;email:string;deleted:number|null}>;
  if(user.some(u=>u.id!==judgeId||u.email.toLowerCase()!==email||u.deleted))throw new Error("演示账号与已有账号冲突或已注销，未覆盖任何账号。");
  if(sqlite.prepare("SELECT key FROM site_settings WHERE key=?").get(marker))return {enabled:true,created:false,email};
  const password=process.env.DEMO_ACCOUNT_PASSWORD||"";
  if(!user.length&&(password.length<12||password.length>128))throw new Error("首次导入需设置12至128位DEMO_ACCOUNT_PASSWORD。");
  const now=Date.now(),day=86400000;
  const accountHash=hashPassword(user.length?randomBytes(24).toString('hex'):password);
  const lockedHash=hashPassword(randomBytes(48).toString('hex'));
  const projectIds=Array.from({length:9},(_,i)=>prefix+'project-'+i);
  const titles=["【演示】ProjectMate 赛事协作工作台","【演示】CampusLearn 学习伙伴","【演示】EcoBoard 校园数据看板","【演示】校园问答应用小队","【演示】无障碍阅读伙伴","【演示】绿色出行可视化小队","【演示】课程资料整理工具","【演示】开源贡献入门平台","【演示】开发者效率工具箱"];
  sqlite.transaction(()=>{
    sqlite.prepare("INSERT OR IGNORE INTO users(id,email,name,password_hash,role,created_at) VALUES(?,?,?,?,'user',?)").run(judgeId,email,"评审体验官（演示）",accountHash,now-14*day);
    for(let i=0;i<7;i++)sqlite.prepare("INSERT OR IGNORE INTO users(id,email,name,password_hash,role,created_at) VALUES(?,?,?,?,'user',?)").run(prefix+'member-'+i,`review-member-${i}@projectmate.invalid`,['前端小林','后端小周','设计小许','数据小陈','后端小李','体验小吴','测试小苏'][i]+'（演示）',lockedHash,now-(12-i)*day);
    const putProfile=sqlite.prepare("INSERT OR IGNORE INTO profiles(user_id,school,education,roles,skills,interests,weekly_hours,updated_at) VALUES(?,?,?,?,?,?,?,?)");
    putProfile.run(judgeId,"演示资料 · 不代表真实院校","本科（演示）","前端开发、产品设计",skills[0],"AI、Web、校园、协作、学习、可视化",12,now);
    for(let i=0;i<7;i++)putProfile.run(prefix+'member-'+i,"演示资料 · 不代表真实院校","演示成员",['前端开发','后端开发','产品设计','数据分析','后端开发','前端开发','测试'][i],skills[i],"AI、校园、开源",8+i*2,now);
    for(let i=0;i<8;i++){
      const competitionId=prefix+'competition-'+i;
      sqlite.prepare("INSERT OR IGNORE INTO competitions(id,platform,name,season,status,source_url,updated_at,review_status,review_note) VALUES(?,?,?,?,?,?,?,?,?)").run(competitionId,"演示数据",'【演示】'+labels[i],"演示赛季",i===6?'已结束':i===7?'即将报名':'报名中','https://example.com/projectmate-review/'+i,now-i*3600000,'approved',"仅供评审体验的虚构赛事，不属于官方活动，请勿报名或支付。");
      for(let k=0;k<2;k++)sqlite.prepare("INSERT OR IGNORE INTO competition_tracks(id,competition_id,name,description,deadline) VALUES(?,?,?,?,?)").run(competitionId+'-track-'+k,competitionId,k===0?"AI Web 应用开发（演示赛道）":"数据与交互设计（演示赛道）","演示资料：围绕校园真实需求完成应用原型、使用说明与测试记录。此处为虚构赛题，无官方报名资格或奖项。",now+((i===6?-4:2+i*2)+k)*day);
    }
    for(let i=0;i<9;i++){
      const owner=i<2?judgeId:prefix+'member-'+(i===2?1:(i-3)%7);
      sqlite.prepare("INSERT OR IGNORE INTO recruitment_projects(id,creator_id,competition_id,track_name,title,description,roles,weekly_hours,status,max_members,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(projectIds[i],owner,prefix+'competition-'+i%8,"AI Web 应用开发（演示赛道）",titles[i],"【演示数据】"+['打通赛事检索、能力匹配、团队待办与成果整理。当前正在验证主要流程，欢迎体验任务、讨论与文件版本。','提供课程资料整理和学习计划原型，当前已完成基础交互，正在完善测试与文档。','围绕校园节能数据实现可视化原型，展示多项目切换与普通成员权限。'][i%3]+" 项目与成员均为评审示例，不代表真实招募或成果。",i%3===0?'前端开发、后端开发':i%3===1?'产品设计、前端开发':'数据分析、后端开发',[10,15,8,10,20,12,6,10,15][i],i===8?'暂停招募':'招募中',i===7?1:i<3?7:5,now-(14-i)*day);
      if(i<3){
        for(let m=0;m<4;m++){const member=prefix+'member-'+((m+i)%7);if(member!==owner)sqlite.prepare("INSERT OR IGNORE INTO project_members(project_id,user_id,role,joined_at) VALUES(?,?,?,?)").run(projectIds[i],member,m===1?'管理员':'成员',now-(10-m)*day);}
        if(owner!==judgeId)sqlite.prepare("INSERT OR IGNORE INTO project_members(project_id,user_id,role,joined_at) VALUES(?,?,'成员',?)").run(projectIds[i],judgeId,now-7*day);
      }
    }
    const tasks=['梳理赛题与用户场景','完成导航及核心页面原型','实现项目权限检查','联调赛事筛选与收藏','设计团队邀请流程','补充异常提示与空状态','完成文件上传与版本阅读','检查手机端布局','整理测试用例与回归记录','完善AI分析输入边界','录制功能演示与整理讲稿','编写部署与使用说明'];
    for(let p=0;p<3;p++)for(let i=0;i<12;i++)sqlite.prepare("INSERT OR IGNORE INTO project_tasks(id,project_id,title,notes,status,priority,assignee,created_at) VALUES(?,?,?,?,?,?,?,?)").run(projectIds[p]+'-task-'+i,projectIds[p],tasks[i],"【演示待办】验收要点：页面可操作、数据可保存、失败有提示。可编辑此条体验保存与进度同步。",i<(p===0?5:p===1?8:2)?'已完成':i%3===0?'进行中':'待分配',i%4===0?'高':i%4===3?'低':'中',i%3===0?'评审体验官（演示）':['前端小林','后端小周','设计小许'][i%3]+'（演示）',now-(12-i)*day);
    const lines=['这里是演示讨论空间，所有成员与对话均为虚构示例。','需求文档已整理，请先确认页面路径与团队分工。','接口和权限测试通过后，再更新任务状态。','我会补充手机端布局与空数据状态的检查。','建议先完成最小可演示流程，避免同时扩展过多功能。','本轮需要验证文件上传、历史版本和代码阅读。','遇到异常请附上复现步骤，不要在讨论中粘贴密钥。','待办完成后记得标记，整体进度会同步更新。','演示视频应展示实际流程，示例报告需要明确标注。','本页消息会保存在数据库中，刷新后可以继续查看。'];
    for(let p=0;p<3;p++)for(let i=0;i<(p===0?40:12);i++)sqlite.prepare("INSERT OR IGNORE INTO project_discussion_messages(project_id,user_id,body,request_id,created_at) VALUES(?,?,?,?,?)").run(projectIds[p],i%4===0?judgeId:prefix+'member-'+((i%3+p)%7),'【演示】'+lines[i%lines.length],projectIds[p]+'-message-'+i,now-3*day+i*600000);
    for(let p=0;p<3;p++)sqlite.prepare("INSERT OR IGNORE INTO project_ai_reports(id,project_id,summary,source,created_at) VALUES(?,?,?,?,?)").run(projectIds[p]+'-report',projectIds[p],"【预置演示报告，非实时模型输出】\n\n依据示例任务：目前需要继续完善权限检查、异常反馈和交付文档。\n\n建议：\n1. 优先推进高优先级未完成任务，明确负责人及验收条件。\n2. 对邀请、讨论和文件版本进行成员权限回归。\n3. 汇总使用说明、测试记录和演示脚本。\n\n实际AI分析需要服务器配置模型密钥，由创建者主动发起；本报告不代表外部模型质量或真实项目成果。","预置演示报告",now-day);
    sqlite.exec("CREATE TABLE IF NOT EXISTS favorites(user_id TEXT NOT NULL,item_key TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,item_key))");
    for(let i=0;i<5;i++)sqlite.prepare("INSERT OR IGNORE INTO favorites VALUES(?,?,?)").run(judgeId,prefix+'competition-'+i,now-i*day);
    sqlite.prepare("INSERT OR IGNORE INTO user_project_preferences(user_id,project_id,updated_at) VALUES(?,?,?)").run(judgeId,projectIds[0],now);
    for(let i=5;i<7;i++)sqlite.prepare("INSERT OR IGNORE INTO team_applications(id,project_id,applicant_id,message,status,created_at) VALUES(?,?,?,?,?,?)").run(prefix+'application-'+i,projectIds[0],prefix+'member-'+i,"【演示申请】希望参与页面体验与测试，可在成员架构体验通过或拒绝。",'待审核',now-(7-i)*3600000);
    for(let i=0;i<4;i++)sqlite.prepare("INSERT OR IGNORE INTO notifications(id,user_id,project_id,type,title,message,href,data,event_key,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(prefix+'notice-'+i,judgeId,projectIds[0],'demo.review',['【演示】欢迎体验ProjectMate','【演示】收到入队申请','【演示】任务与讨论已准备','【演示】文档及代码可阅读'][i],"此条为预置站内演示通知，不会向外发送邮件或Webhook。请在项目空间体验相关功能。",i===3?'/projects/files?project='+projectIds[0]:i===1?'/projects/members?project='+projectIds[0]:'/projects?project='+projectIds[0],'{}',prefix+'notice-'+i,now-i*3600000);
  }).immediate();
  // File writes use the normal version/permission checks. Existing paths are never overwritten.
  const documents=[
    ['项目说明.md','# ProjectMate 演示项目\n\n> 演示数据，不代表真实参赛成果。\n\n## 目标\n体验赛事发现、组队、任务、讨论及文档代码管理。\n\n## 分工\n创建者维护目标，成员按岗位协作，管理员处理邀请与申请。\n'],
    ['需求与验收清单.md','# 演示需求与验收\n\n- 搜索与收藏赛事\n- 发布可编辑招募草稿\n- 审核演示入队申请\n- 标记任务并查看进度\n- 讨论消息刷新后保留\n- 阅读代码与历史版本\n'],
    ['测试记录.md','# 演示测试记录\n\n此文件为演示文档，不代表自动化测试的实际执行报告。\n\n| 模块 | 体验要点 |\n|---|---|\n| 讨论 | 空输入提示、消息保存 |\n| 文件 | 上传、预览、下载和版本 |\n| 权限 | 创建者/普通成员区别 |\n'],
  ];
  const files=[...documents.map(([path,content])=>({path,content,kind:'document' as const})),
    {path:'src/app/page.tsx',kind:'code' as const,content:'// 演示代码，仅供阅读，不在服务器执行\nexport default function DemoPage() {\n  return <main>校园协作应用原型</main>;\n}\n'},
    {path:'src/lib/progress.ts',kind:'code' as const,content:'// 演示任务完成率计算\nexport function progress(done: number, total: number) {\n  return total > 0 ? Math.round(done / total * 100) : 0;\n}\n'},
    {path:'README.md',kind:'code' as const,content:'# 演示代码目录\n\n所有文件均为评审体验的示例，非独立可运行软件。\n'},
  ];
  sqlite.transaction(()=>{
  if(sqlite.prepare("SELECT key FROM site_settings WHERE key=?").get(marker))return;
  for(const file of files){const found=sqlite.prepare("SELECT id FROM project_files WHERE project_id=? AND path=? AND kind=?").get(projectIds[0],file.path,file.kind);if(found)continue;saveProjectFile({projectId:projectIds[0],userId:judgeId,path:file.path,kind:file.kind,bytes:Buffer.from(file.content)});if(file.path==='项目说明.md')saveProjectFile({projectId:projectIds[0],userId:judgeId,path:file.path,kind:file.kind,bytes:Buffer.from(file.content+'\n## 更新记录\n演示v2：补充讨论、版本阅读及报告下载体验。\n')});}
  sqlite.prepare("INSERT OR IGNORE INTO site_settings(key,value,updated_at) VALUES(?,?,?)").run(marker,JSON.stringify({version:1,email,createdAt:now}),now);
  }).immediate();
  return {enabled:true,created:true,email,projects:9,competitions:8};
}
