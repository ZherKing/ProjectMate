import { generateText } from "ai";
import { aiModel } from "./provider";
import { listProjectTasks, saveCoachReport } from "@/lib/db/tasks";

export async function runProjectCoach(projectId: string, question = "") {
  const tasks = listProjectTasks(projectId);
  const urgent = tasks.filter((task) => task.priority === "高" && task.status !== "已完成");
  const fallback = "当前共有 " + tasks.length + " 个任务，其中 " + urgent.length + " 个高优先级任务未完成。建议先处理接口联调和异常回退任务，再推进展示材料。";
  if (!process.env.AI_API_KEY) {
    saveCoachReport(projectId, fallback, "本地规则分析");
    return fallback;
  }

  const result = await generateText({
    model: aiModel,
    prompt: "你是项目教练。请根据以下任务给出一句简洁、可执行的项目风险建议：\n" + JSON.stringify(tasks) + "\n用户问题：" + question,
  });
  saveCoachReport(projectId, result.text, "AI 模型分析");
  return result.text;
}
