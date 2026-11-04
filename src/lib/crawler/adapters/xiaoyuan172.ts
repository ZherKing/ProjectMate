import * as cheerio from "cheerio";
import type { CompetitionSourceAdapter, RawCompetition } from "../types";

const defaultUrl = "http://bisai.172xiaoyuan.com/kaifayingyong/";

export class Xiaoyuan172Adapter implements CompetitionSourceAdapter {
  sourceName = "172校园赛事网";

  canHandle(url: string) {
    return url.includes("172xiaoyuan.com");
  }

  async fetchAndParse(url = defaultUrl): Promise<RawCompetition[]> {
    const pageCount = Math.max(1, Math.min(Number(process.env.XIAOYUAN172_MAX_PAGES ?? 3), 10));
    const pages = await Promise.all(
      Array.from({ length: pageCount }, (_, index) => {
        const pageUrl = index === 0 ? url : new URL(`list_29_${index + 1}.html`, url).toString();
        return this.fetchPage(pageUrl);
      }),
    );
    return pages.flatMap(({ html, pageUrl }) => this.parse(html, pageUrl));
  }

  private async fetchPage(pageUrl: string) {
    const response = await fetch(pageUrl, {
      headers: { "user-agent": process.env.CRAWLER_USER_AGENT ?? "ProjectMateBot/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("172校园赛事网请求失败：" + response.status);
    return { html: await response.text(), pageUrl };
  }

  parse(html: string, pageUrl = defaultUrl): RawCompetition[] {
    const $ = cheerio.load(html);
    const output: RawCompetition[] = [];
    const seen = new Set<string>();
    $(".xnlist").each((_, element) => {
      const link = $(element).find(".zwlist a[href]").first();
      const name = link.text().replace(/\s+/g, " ").trim();
      const href = link.attr("href");
      if (!href || name.length < 4) return;
      const sourceUrl = new URL(href, pageUrl).toString();
      if (seen.has(sourceUrl)) return;
      seen.add(sourceUrl);
      const summary = $(element).find(".zwlist p").text().replace(/\s+/g, " ").trim();
      const publishedAt = $(element).find(".tit_time").text().match(/\d{4}-\d{2}-\d{2}/)?.[0];
      const deadline = summary.match(/(?:报名|报名截止|截止时间|项目征集时间)[^。；;]{0,30}(20\d{2})年(\d{1,2})月(\d{1,2})日/);
      const deadlineTime = deadline ? Date.UTC(Number(deadline[1]), Number(deadline[2]) - 1, Number(deadline[3])) : undefined;
      output.push({
        externalId: sourceUrl,
        platform: this.sourceName,
        name,
        season: name.match(/20\d{2}(?:-20\d{2})?/)?.[0],
        status: deadlineTime != null && deadlineTime >= Date.now() ? "报名中" : "待核验",
        sourceUrl,
      });
      if (publishedAt) output[output.length - 1].season ??= publishedAt.slice(0, 4);
    });
    return output;
  }
}
