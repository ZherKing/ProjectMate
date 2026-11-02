import { createOpenAI } from "@ai-sdk/openai";

export const aiProvider = createOpenAI({
  apiKey: process.env.AI_API_KEY,
  baseURL: process.env.AI_BASE_URL,
});

export const aiModel = aiProvider(process.env.AI_MODEL ?? "gpt-4o-mini");
