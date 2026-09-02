import { searchSummaryAgent } from '@/lib/agents';
import { execute } from '@/lib/greenhouse';

export const maxDuration = 60;

/** Step 2. Run the queries the user kept, then summarise what came back. */
export async function POST(req: Request) {
  const { request, queries }: { request: string; queries: string[] } = await req.json();

  const t = Date.now();
  let runs, results;
  try {
    ({ runs, results } = await execute(queries));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) });
  }
  // Nothing matched: say so. Do not spend a summary call describing an empty
  // list, and never hand the UI a blank screen.
  if (!results.length)
    return Response.json({
      runs,
      found: 0,
      summary: '',
      gaps: '',
      picks: [],
      empty:
        'No Greenhouse postings matched. These queries are probably too specific — drop a technology or a seniority word and run them again.',
    });

  const { output } = await searchSummaryAgent(request, results);

  // The agent can only pick from what came back, but it can still invent a URL.
  // Anything that does not resolve is dropped rather than rendered.
  const byUrl = new Map(results.map((r) => [r.url, r]));
  const picks = output.picks
    .filter((p) => byUrl.has(p.url))
    .map((p) => ({ ...p, hit: byUrl.get(p.url)! }));

  console.log(`execute ${Date.now() - t}ms ${results.length} results, ${picks.length} picks`);
  return Response.json({ runs, found: results.length, summary: output.summary, gaps: output.gaps, picks });
}
