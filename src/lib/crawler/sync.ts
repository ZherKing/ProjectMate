import type { RawCompetition } from "./types";

export async function syncCompetitions(): Promise<RawCompetition[]> {
  // 后续接入赛氪、传智杯和华为 ICT 的来源适配器。
  return [];
}

if (process.argv[1]?.endsWith("sync.ts")) {
  await syncCompetitions();
  console.log("Competition sync placeholder completed.");
}
