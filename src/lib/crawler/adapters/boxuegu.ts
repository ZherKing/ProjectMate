import type { CompetitionSourceAdapter, RawCompetition, RawCompetitionTrack } from "../types";

const defaultApiUrl = "https://gateway.boxuegu.com/portal-marketing/competition/track/list";

type BoxueguTrack = {
  id?: number | string;
  name?: string;
  introduce?: string;
  registEndTime?: string;
  applyStatus?: number;
};

type BoxueguPayload = {
  code?: number;
  data?: {
    id?: number | string;
    name?: string;
    year?: number | string;
    competitionTracks?: BoxueguTrack[];
  };
};

export class BoxueguAdapter implements CompetitionSourceAdapter {
  sourceName = "传智杯";

  canHandle(url: string) {
    return url.includes("boxuegu.com");
  }

  async fetchAndParse(): Promise<RawCompetition[]> {
    const apiUrl = process.env.BOXUEGU_TRACK_API_URL?.trim() || defaultApiUrl;
    const response = await fetch(apiUrl, {
      headers: { "user-agent": process.env.CRAWLER_USER_AGENT ?? "ProjectMateBot/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("传智杯赛事接口请求失败：" + response.status);
    const payload = await response.json() as BoxueguPayload;
    if(payload.code !== undefined && payload.code !== 200) throw new Error("传智杯接口返回异常状态");
    return this.parseApi(payload);
  }

  parseApi(payload: BoxueguPayload): RawCompetition[] {
    const data = payload.data;
    if (!data?.id || !data.name) return [];
    const sourceUrl = "https://www.boxuegu.com/matchTrack/";
    const tracks: RawCompetitionTrack[] = (data.competitionTracks ?? [])
      .filter((track): track is BoxueguTrack & { id: number | string; name: string } => track.id != null && !!track.name)
      .map((track) => ({
        externalId: String(track.id),
        name: track.name.trim(),
        description: track.introduce?.trim(),
        deadline: track.registEndTime,
      }));
    return [{
      externalId: String(data.id),
      platform: this.sourceName,
      name: data.name.trim(),
      season: data.year == null ? undefined : String(data.year),
      status: tracks.some((track) => track.deadline && track.deadline >= new Date().toISOString().slice(0, 10)) ? "报名中" : "待确认",
      sourceUrl,
      tracks,
    }];
  }
}
