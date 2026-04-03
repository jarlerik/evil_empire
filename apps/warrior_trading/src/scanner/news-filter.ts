import type { AlpacaClient } from "../alpaca/client.js";
import { createLogger } from "../utils/logger.js";
import type { GapCandidate } from "./gap-scanner.js";

const log = createLogger("scanner:news");

export interface NewsCandidate extends GapCandidate {
  hasCatalyst: boolean;
  headline: string | null;
}

// Keywords that suggest a real catalyst vs. routine noise
const CATALYST_KEYWORDS = [
  "fda",
  "approval",
  "earnings",
  "beat",
  "revenue",
  "contract",
  "partnership",
  "acquisition",
  "merger",
  "ipo",
  "offering",
  "buyback",
  "upgrade",
  "initiated",
  "patent",
  "trial",
  "phase",
  "breakthrough",
  "guidance",
  "raised",
  "increased",
  "record",
];

function isCatalystHeadline(headline: string): boolean {
  const lower = headline.toLowerCase();
  return CATALYST_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function filterByNews(
  client: AlpacaClient,
  candidates: GapCandidate[]
): Promise<NewsCandidate[]> {
  if (candidates.length === 0) return [];

  const symbols = candidates.map((c) => c.symbol);
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const results: NewsCandidate[] = [];

  // Fetch news for all candidate symbols
  // Alpaca news API accepts comma-separated symbols
  const BATCH_SIZE = 20;
  const newsMap = new Map<string, { headline: string; isCatalyst: boolean }>();

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);

    try {
      const response = await client.getNews({
        symbols: batch.join(","),
        start: yesterday.toISOString(),
        end: now.toISOString(),
        limit: 50,
        sort: "desc",
      });

      const articles = response.news ?? [];
      for (const article of articles) {
        for (const sym of article.symbols) {
          if (!newsMap.has(sym)) {
            newsMap.set(sym, {
              headline: article.headline,
              isCatalyst: isCatalystHeadline(article.headline),
            });
          }
        }
      }
    } catch (err) {
      log.warn("News fetch failed for batch", {
        symbols: batch.join(","),
        error: String(err),
      });
    }
  }

  for (const candidate of candidates) {
    const news = newsMap.get(candidate.symbol);
    results.push({
      ...candidate,
      hasCatalyst: news?.isCatalyst ?? false,
      headline: news?.headline ?? null,
    });
  }

  log.info("News filter complete", {
    total: results.length,
    withCatalyst: results.filter((r) => r.hasCatalyst).length,
  });

  return results;
}
