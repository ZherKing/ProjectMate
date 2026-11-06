import { createOpenAI } from "@ai-sdk/openai";

function getAiConfig() {
  return {
    apiKey: process.env.AI_API_KEY?.trim() ?? "",
    baseURL: process.env.AI_BASE_URL?.trim() || "https://api.deepseek.com",
    modelName: process.env.AI_MODEL?.trim() || "deepseek-chat",
  };
}

export function requireAiModel() {
  const { apiKey, baseURL, modelName } = getAiConfig();
  if (!apiKey) throw new Error("AI_API_KEY 尚未配置。请在服务器 .env 或 .env.local 文件中设置 DeepSeek API Key。");
  return createOpenAI({ apiKey, baseURL })(modelName);
}

export function isAiConfigured() {
  return Boolean(getAiConfig().apiKey);
}

export function getAiModelName() { return getAiConfig().modelName; }
