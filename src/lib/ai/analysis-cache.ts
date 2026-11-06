import { sqlite } from "@/lib/db/client";
import { initializeDatabase } from "@/lib/db/initialize";

export type SavedCompetitionAnalysis = { analysis: string; generatedAt: number; model: string };
export function getCompetitionAnalysis(competitionId: string, trackId: string, sourceUpdatedAt: number): SavedCompetitionAnalysis | null {
  initializeDatabase();
  const row = sqlite.prepare("SELECT analysis,generated_at AS generatedAt,model FROM competition_ai_analyses WHERE competition_id=? AND track_id=? AND source_updated_at=?").get(competitionId,trackId,sourceUpdatedAt) as SavedCompetitionAnalysis | undefined;
  return row ?? null;
}
export function saveCompetitionAnalysis(input: {competitionId:string;trackId:string;sourceUpdatedAt:number;analysis:string;model:string}) {
  initializeDatabase();
  sqlite.prepare("INSERT INTO competition_ai_analyses(competition_id,track_id,source_updated_at,analysis,model,generated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(competition_id,track_id) DO UPDATE SET source_updated_at=excluded.source_updated_at,analysis=excluded.analysis,model=excluded.model,generated_at=excluded.generated_at").run(input.competitionId,input.trackId,input.sourceUpdatedAt,input.analysis,input.model,Date.now());
}
