import Firecrawl from '@mendable/firecrawl-js';

export type Page = { url: string; title: string; text: string };

/** Shown next to each query so the user can run it on Google themselves. */
export const googleUrl = (q: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(`site:boards.greenhouse.io ${q}`)}`;

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });

/**
 * One call does the whole thing: Google-backed search scoped to Greenhouse,
 * and each result's page fetched and cleaned to markdown.
 *
 * Free tier is 10 requests a minute and each query is one request.
 */
export async function search(queries: string[]) {
  const runs = await Promise.all(
    queries.map((query) =>
      firecrawl.search(query, {
        limit: 8,
        includeDomains: ['boards.greenhouse.io'],
        scrapeOptions: { formats: ['markdown'], onlyMainContent: true },
      }),
    ),
  );

  // With scrapeOptions each hit is a scraped Document: url and title sit on
  // metadata, the clean text on markdown.
  const hits = runs.flatMap((r) => r.web ?? []);
  const seen = new Map<string, Page>();
  for (const hit of hits) {
    if (!('markdown' in hit) || !hit.markdown) continue;
    const url = (hit.metadata?.sourceURL ?? hit.metadata?.url ?? '').split('?')[0];
    if (!url || seen.has(url)) continue;
    // Markdown is already clean; cap it so ten pages fit one prompt.
    seen.set(url, { url, title: hit.metadata?.title ?? url, text: hit.markdown.slice(0, 4000) });
  }
  return { pages: [...seen.values()], searched: hits.length };
}
