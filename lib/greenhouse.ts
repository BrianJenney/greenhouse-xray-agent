import assert from 'node:assert';

export type Hit = {
	title: string;
	company: string;
	url: string;
	snippet: string;
	/** Real posting location, fetched from Greenhouse. '' when unavailable. */
	location: string;
	/** Which of the user's queries surfaced this. */
	queries: string[];
};

/**
 * A location cannot go in the query — Google returns nothing for it, because
 * postings do not repeat the location in the text it indexes. So we search
 * without it and read the real location off each posting afterwards, free and
 * exact, from the board API the URL already tells us how to call.
 */
async function locate(url: string): Promise<string> {
	const m = url.match(/greenhouse\.io\/([^/]+)\/jobs\/(\d+)/);
	if (!m) return '';
	try {
		const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs/${m[2]}`);
		if (!r.ok) return '';
		const j = (await r.json()) as { location?: { name?: string } };
		return j.location?.name ?? '';
	} catch {
		return '';
	}
}

/**
 * Greenhouse and nothing else, and only this subdomain. site:*.greenhouse.io
 * looks more thorough and is worse: it pulls in the regional boards
 * (job-boards.eu, job-boards.anz), so a Bay Area search comes back European.
 * Added here so the agent cannot forget it.
 */
const SCOPE = 'site:boards.greenhouse.io ';
const PER_QUERY = 10;

export const withScope = (q: string) => (/\bsite:/i.test(q) ? q.trim() : SCOPE + q.trim());

/** "Job Application for Staff Engineer at Ramp" -> title + company. */
function split(raw: string) {
	const m = raw.match(
		/^(?:Job Application for )?(.+?)(?: at ([^|]+?))?(?:\s*[|-]\s.*)?$/,
	);
	return { title: (m?.[1] ?? raw).trim(), company: (m?.[2] ?? '').trim() };
}

/** One query -> one Google search -> the Greenhouse postings it found. */
async function runQuery(query: string): Promise<Hit[]> {
	const res = await fetch('https://google.serper.dev/search', {
		method: 'POST',
		headers: {
			'X-API-KEY': process.env.SERPER_API_KEY ?? '',
			'content-type': 'application/json',
		},
		body: JSON.stringify({ q: withScope(query), num: PER_QUERY }),
	});
	if (!res.ok) throw new Error(`serper ${res.status}: ${await res.text()}`);

	const { organic = [] } = (await res.json()) as {
		organic?: { title: string; link: string; snippet?: string }[];
	};
	// Google will happily return LinkedIn and YouTube. Only postings survive.
	return organic
		.filter(
			(o) =>
				o.link.includes('greenhouse.io/') && /\/jobs\/\d/.test(o.link),
		)
		.map((o) => ({
			...split(o.title),
			url: o.link,
			snippet: o.snippet ?? '',
			location: '',
			queries: [query],
		}));
}

const STATES =
	'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(
		' ',
	);

/**
 * US only. We have the real location, so this is a filter and not a hope —
 * putting "USA" in the query returns nothing, the same as any other location.
 *
 * Unknown locations are kept: a posting we could not resolve is not evidence
 * that it is foreign, and dropping it would hide real jobs.
 */
export function isUS(location: string): boolean {
	if (!location) return true;
	const l = location.toLowerCase();
	if (/\b(united states|usa|u\.s\.|us remote|remote us)\b/.test(l)) return true;
	if (STATES.some((st) => new RegExp(`,\\s*${st.toLowerCase()}\\b`).test(l))) return true;
	// "Remote" with no country named at all.
	if (/^remote$/.test(l.trim())) return true;
	return false;
}

export type Run = { query: string; hits: number };

/**
 * Every query at once. A posting several queries surfaced ranks first —
 * counting, not another model call.
 */
export async function execute(queries: string[]) {
	assert(process.env.SERPER_API_KEY, 'SERPER_API_KEY is not set');

	const all = await Promise.all(queries.map(runQuery));
	const byUrl = new Map<string, Hit>();
	const runs: Run[] = [];

	all.forEach((hits, i) => {
		runs.push({ query: queries[i], hits: hits.length });
		for (const h of hits) {
			const prev = byUrl.get(h.url);
			if (prev) prev.queries.push(queries[i]);
			else byUrl.set(h.url, h);
		}
	});

	const results = [...byUrl.values()].sort(
		(a, b) => b.queries.length - a.queries.length,
	);
	// Locations, in parallel. Free, and exact — the board API is derivable
	// straight from the URL Google gave us.
	await Promise.all(results.map(async (r) => void (r.location = await locate(r.url))));

	const us = results.filter((r) => isUS(r.location));
	return { runs, results: us, dropped: results.length - us.length };
}
