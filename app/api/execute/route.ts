import { searchSummaryAgent } from '@/lib/agents';
import { search } from '@/lib/search';
import { initTracing } from '@/lib/tracing';

initTracing();

export const maxDuration = 60;

type Msg = { role: 'user' | 'assistant'; content: string };

/** Step 2. Search, fetch the pages, clean them, hand the text to the agent. */
export async function POST(req: Request) {
	const { messages, queries }: { messages: Msg[]; queries: string[] } =
		await req.json();
	const request = messages.find((m) => m.role === 'user')?.content ?? '';

	let pages, searched;
	try {
		({ pages, searched } = await search(queries));
	} catch (e) {
		return Response.json({ error: e instanceof Error ? e.message : String(e) });
	}

	if (!pages.length)
		return Response.json({
			pages: [],
			picks: [],
			empty: 'Nothing matched. Widen the titles, or drop a keyword.',
		});

	const { output } = await searchSummaryAgent(request, pages);

	// The agent can only pick from what it read, but it can still invent a URL.
	const known = new Set(pages.map((p) => p.url));
	const picks = output.picks.filter((p) => known.has(p.url));

	console.log(
		`execute ${searched} urls, ${pages.length} pages read, ${picks.length} picks`,
	);
	return Response.json({
		pages: pages.map(({ url, title }) => ({ url, title })),
		summary: output.summary,
		gaps: output.gaps,
		picks,
	});
}
