export type Page = { url: string; title: string; text: string };

/** Shown next to each query so the user can run it on Google themselves. */
export const googleUrl = (q: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(`site:boards.greenhouse.io ${q}`)}`;

/**
 * One call does the whole thing: Google-backed search scoped to Greenhouse,
 * and each result's page fetched and cleaned to markdown. Works without a key
 * at a low rate limit; FIRECRAWL_API_KEY raises it.
 *
 * Every other route was tried and measured: scraping any engine gets a
 * challenge page, Serper's free tier rejects OR groups, Brave rate-limits per
 * IP, and Google's own Custom Search API is closed to new projects.
 */
export async function search(queries: string[]) {
  const key = process.env.FIRECRAWL_API_KEY;
  const runs = await Promise.all(
    queries.map(async (query) => {
      const r = await fetch('https://api.firecrawl.dev/v2/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify({
          query,
          limit: 8,
          includeDomains: ['boards.greenhouse.io'],
          scrapeOptions: { formats: ['markdown'], onlyMainContent: true },
        }),
      });
      if (r.status === 429)
        throw new Error(
          'Firecrawl rate limit: the free tier allows 10 requests a minute, and each query is one. Wait a minute, or run fewer queries.',
        );
      if (!r.ok) throw new Error(`Firecrawl ${r.status}: ${(await r.text()).slice(0, 120)}`);
      const d = (await r.json()) as {
        data?: { web?: { url: string; title?: string; markdown?: string }[] };
      };
      return d.data?.web ?? [];
    }),
  );

  const seen = new Map<string, Page>();
  for (const hit of runs.flat()) {
    const url = hit.url.split('?')[0];
    if (seen.has(url) || !hit.markdown) continue;
    // Markdown is already clean; just cap it so ten pages fit one prompt.
    seen.set(url, { url, title: hit.title ?? url, text: hit.markdown.slice(0, 4000) });
  }
  return { pages: [...seen.values()], searched: runs.flat().length };
}
