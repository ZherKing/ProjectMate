import { createOpenAI } from "@ai-sdk/openai";

const apiKey = process.env.AI_API_KEY?.trim() ?? "";
const baseURL = process.env.AI_BASE_URL?.trim() || "https://api.deepseek.com";
const modelName = process.env.AI_MODEL?.trim() || "deepseek-chat";

export const aiProvider = createOpenAI({ apiKey, baseURL });

export const aiModel = aiProvider(modelName);

export function requireAiModel() {
  if (!process.env.AI_API_KEY?.trim()) throw new Error("AI_API_KEY 尚未配置。请在服务器 .env 文件中设置 DeepSeek API Key。");
  return aiModel;
}

export function isAiConfigured() {
  return apiKey.length > 0;
}

export function getAiModelName() { return modelName; }
