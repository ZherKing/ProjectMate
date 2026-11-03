import { sqlite } from "./client";
import { initializeDatabase } from "./initialize";
import { hashPassword } from "@/lib/auth/password";

const seedCompetitions = [
  ["c4-ai-2025", "中国高校计算机大赛", "2025 全球 AI 智能体应用创新大赛"],
  ["ccf-bdci-2025", "中国计算机学会", "2025 CCF 大数据与计算智能大赛"],
  ["tianchi-agent-2025", "阿里天池", "天池医疗领域垂直 Agent 微调挑战"],
];

export function seedDatabase() {
  initializeDatabase();
  const userCount = sqlite.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
  if (userCount.count === 0) {
    sqlite.prepare(
      "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run("demo-user", "demo@projectmate.local", "林星宇", hashPassword("projectmate-demo"), Date.now());
  }
  const count = sqlite.prepare("SELECT COUNT(*) AS count FROM competitions").get() as { count: number };
  if (count.count === 0) {
    const insert = sqlite.prepare(
      "INSERT INTO competitions (id, platform, name, season, status, source_url, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    const insertMany = sqlite.transaction(() => {
      for (const [id, platform, name] of seedCompetitions) {
        insert.run(id, platform, name, "2025", "报名中", "https://example.com/competitions/" + id, Date.now());
      }
    });
    insertMany();
  }

  const taskCount = sqlite.prepare("SELECT COUNT(*) AS count FROM project_tasks").get() as { count: number };
  if (taskCount.count === 0) {
    const insertTask = sqlite.prepare("INSERT INTO project_tasks (id, project_id, title, status, priority, assignee, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
    insertTask.run("task-104", "demo-project", "实时数据流渲染与画布性能优化", "进行中", "高", "陈雨欣", Date.now());
    insertTask.run("task-108", "demo-project", "异常告警拦截及多路回退管道", "需紧急修复", "高", "周子涵", Date.now());
    insertTask.run("task-112", "demo-project", "赛事展示视频字幕与 PPT 渲染", "待分配", "低", null, Date.now());
  }
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seedDatabase();
  console.log("Competition seed completed.");
}
