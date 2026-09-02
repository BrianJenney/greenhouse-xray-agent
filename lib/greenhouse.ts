import assert from 'node:assert';

export type Hit = {
	title: string;
	company: string;
	url: string;
	snippet: string;
	/** Which of the user's queries surfaced this. */
	queries: string[];
};

/** Every query is scoped to Greenhouse. Added here so the agent cannot forget. */
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
			queries: [query],
		}));
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
	return { runs, results };
}
