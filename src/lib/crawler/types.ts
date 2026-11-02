export type RawCompetition = {
  externalId?: string;
  platform: string;
  name: string;
  season?: string;
  trackName?: string;
  status?: string;
  registrationEnd?: string;
  sourceUrl: string;
};

export interface CompetitionSourceAdapter {
  sourceName: string;
  canHandle(url: string): boolean;
  fetchAndParse(url: string): Promise<RawCompetition[]>;
}
