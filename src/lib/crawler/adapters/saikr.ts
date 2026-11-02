import * as cheerio from "cheerio";
import type { CompetitionSourceAdapter, RawCompetition } from "../types";

const sourceUrl = "https://www.saikr.com/contests";

export class SaikrAdapter implements CompetitionSourceAdapter {
  sourceName = "赛氪";

  canHandle(url: string) {
    return url.includes("saikr.com");
  }

  async fetchAndParse(url = sourceUrl): Promise<RawCompetition[]> {
    const apiUrl = process.env.SAIKR_API_URL;
    if (apiUrl) {
      const response = await fetch(apiUrl, {
        headers: { "user-agent": process.env.CRAWLER_USER_AGENT ?? "ProjectMateBot/1.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error("赛事接口请求失败：" + response.status);
      return this.parseApi(await response.json(), apiUrl);
    }
    const response = await fetch(url, {
      headers: { "user-agent": process.env.CRAWLER_USER_AGENT ?? "ProjectMateBot/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("赛事来源请求失败：" + response.status);
    const html = await response.text();
    return this.parse(html, url);
  }

  parse(html: string, pageUrl = sourceUrl): RawCompetition[] {
    const $ = cheerio.load(html);
    const output: RawCompetition[] = [];
    const seen = new Set<string>();

    $("a[href]").each((_, element) => {
      const href = $(element).attr("href") ?? "";
      const title = $(element).text().replace(/\s+/g, " ").trim();
      if (title.length < 6 || title.length > 120) return;
      if (!/(contest|competition|match|event)/i.test(href + " " + title)) return;
      const source = new URL(href, pageUrl).toString();
      if (seen.has(source)) return;
      seen.add(source);
      output.push({
        externalId: source,
        platform: this.sourceName,
        name: title,
        status: "公开赛事",
        sourceUrl: source,
      });
    });

    return output.slice(0, 200);
  }

  parseApi(payload: unknown, apiUrl: string): RawCompetition[] {
    const rows: unknown[] = [];
    const visit = (value: unknown) => {
      if (Array.isArray(value)) {
        for (const item of value) visit(item);
        return;
      }
      if (!value || typeof value !== "object") return;
      const item = value as Record<string, unknown>;
      const name = item.name ?? item.title ?? item.contest_name ?? item.contestName;
      const id = item.id ?? item.contest_id ?? item.contestId;
      if (typeof name === "string" && name.trim().length >= 4 && id != null) rows.push(item);
      for (const child of Object.values(item)) visit(child);
    };
    visit(payload);
    const seen = new Set<string>();
    return rows.flatMap((value) => {
      const item = value as Record<string, unknown>;
      const id = String(item.id ?? item.contest_id ?? item.contestId);
      if (seen.has(id)) return [];
      seen.add(id);
      return [{
        externalId: id,
        platform: this.sourceName,
        name: String(item.name ?? item.title ?? item.contest_name ?? item.contestName),
        status: String(item.status ?? item.state ?? "公开赛事"),
        sourceUrl: String(item.url ?? item.link ?? apiUrl),
      }];
    });
  }
}
