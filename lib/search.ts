const SCOPE = 'site:boards.greenhouse.io';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export type Job = { title: string; company: string; location: string; url: string };

export const scoped = (q: string) => (q.includes('site:') ? q : `${SCOPE} ${q}`);

export const googleUrl = (q: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(scoped(q))}`;

/**
 * No key, no account. Brave rate-limits to roughly one search per 30s per IP,
 * which is the price of keyless — and it is the only engine that runs the full
 * two-group query. Serper's free tier rejects it outright ("Query pattern not
 * allowed for free accounts"), DuckDuckGo and Bing serve a challenge page.
 */
async function html(query: string): Promise<string> {
	const r = await fetch(`https://search.brave.com/search?q=${encodeURIComponent(query)}`, {
		headers: { 'user-agent': UA },
	});
	if (r.status === 429)
		throw new Error('Rate limited by Brave — wait about 30 seconds and search again.');
	return r.text();
}

/** Greenhouse job URLs, wherever they appear in the response. */
const jobUrls = (body: string) => [
  ...new Set(body.match(/https?:\/\/boards\.greenhouse\.io\/[a-z0-9_-]+\/jobs\/\d+/gi) ?? []),
];

/**
 * The posting itself, from the board API the URL tells us how to call. Free,
 * and it gives the real location — which cannot go in the search query, because
 * Google returns nothing for a location.
 */
async function hydrate(url: string): Promise<Job | null> {
  const m = url.match(/greenhouse\.io\/([^/]+)\/jobs\/(\d+)/i);
  if (!m) return null;
  try {
    const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs/${m[2]}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { title?: string; location?: { name?: string } };
    if (!j.title) return null;
    return { title: j.title, company: m[1], location: j.location?.name ?? '', url };
  } catch {
    return null;
  }
}

const STATES =
  'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(
    ' ',
  );

/** Unknown locations are kept — unresolvable is not evidence of foreign. */
export function isUS(location: string): boolean {
  const l = location.toLowerCase().trim();
  if (!l || l === 'remote') return true;
  if (/\b(united states|usa|u\.s\.)\b/.test(l)) return true;
  return STATES.some((s) => new RegExp(`,\\s*${s.toLowerCase()}\\b`).test(l));
}

export async function search(queries: string[]) {
  const bodies = await Promise.all(queries.map((q) => html(scoped(q))));
  const urls = [...new Set(bodies.flatMap(jobUrls))];
  const jobs = (await Promise.all(urls.map(hydrate))).filter((j): j is Job => j !== null);
  const us = jobs.filter((j) => isUS(j.location));
  return { jobs: us, dropped: jobs.length - us.length, searched: urls.length };
}
