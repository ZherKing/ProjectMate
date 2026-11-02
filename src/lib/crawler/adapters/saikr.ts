import * as cheerio from "cheerio";
import type { CompetitionSourceAdapter, RawCompetition } from "../types";

const sourceUrl = "https://www.saikr.com/contests";

export class SaikrAdapter implements CompetitionSourceAdapter {
  sourceName = "赛氪";

  canHandle(url: string) {
    return url.includes("saikr.com");
  }

  async fetchAndParse(url = sourceUrl): Promise<RawCompetition[]> {
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
}
