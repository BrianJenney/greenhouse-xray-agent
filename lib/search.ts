const SCOPE = 'site:boards.greenhouse.io';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export type Job = { title: string; company: string; location: string; url: string };

export const scoped = (q: string) => (q.includes('site:') ? q : `${SCOPE} ${q}`);

export const googleUrl = (q: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(scoped(q))}`;

/**
 * Two ways to run the same Brave query:
 *
 * With BRAVE_API_KEY — the Brave Search API. Same engine, so the two-group
 * query works, with real concurrency. Free tier is 2,000 queries a month.
 * This is the one to use in a room.
 *
 * Without — scrape search.brave.com. Zero setup, but Brave rate-limits one IP
 * to roughly a search every 30s and escalates when pushed, so it dies on
 * shared wifi. Kept so the repo runs with nothing configured.
 */
async function html(query: string): Promise<string> {
	const key = process.env.BRAVE_API_KEY;
	if (key) {
		const r = await fetch(
			`https://api.search.brave.com/res/v1/web/search?count=20&q=${encodeURIComponent(query)}`,
			{ headers: { 'X-Subscription-Token': key, accept: 'application/json' } },
		);
		if (!r.ok) throw new Error(`Brave API ${r.status}: ${(await r.text()).slice(0, 120)}`);
		return r.text();
	}

	const r = await fetch(`https://search.brave.com/search?q=${encodeURIComponent(query)}`, {
		headers: { 'user-agent': UA },
	});
	const body = await r.text();
	// A rate limit is not "no results", and pretending it is sends the user off
	// to rewrite a query that was fine.
	if (r.status === 429 || /unusual traffic|are you a robot|captcha/i.test(body))
		throw new Error(
			'Brave is rate-limiting this IP. Wait a minute, or set BRAVE_API_KEY (free, 2,000/mo).',
		);
	return body;
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
