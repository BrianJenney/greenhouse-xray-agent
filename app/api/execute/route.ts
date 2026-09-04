import { searchSummaryAgent } from '@/lib/agents';
import { search } from '@/lib/search';
import { initTracing } from '@/lib/tracing';

initTracing();

export const maxDuration = 60;

type Msg = { role: 'user' | 'assistant'; content: string };

/** Step 2. Run the queries the user kept, then summarise what came back. */
export async function POST(req: Request) {
  const { messages, queries }: { messages: Msg[]; queries: string[] } = await req.json();
  const request = messages.find((m) => m.role === 'user')?.content ?? '';

  let found;
  try {
    found = await search(queries);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) });
  }

  const { jobs, dropped } = found;
  if (!jobs.length)
    return Response.json({
      jobs: [],
      dropped,
      picks: [],
      empty: dropped
        ? `Every match was outside the US (${dropped} dropped).`
        : 'Nothing matched. Widen the titles, or drop a keyword.',
    });

  const { output } = await searchSummaryAgent(request, jobs);

  // The agent can only pick from what came back, but it can still invent a
  // URL. Anything that does not resolve is dropped rather than rendered.
  const byUrl = new Map(jobs.map((j) => [j.url, j]));
  const picks = output.picks.filter((p) => byUrl.has(p.url)).map((p) => ({ ...p, job: byUrl.get(p.url)! }));

  console.log(`execute ${jobs.length} jobs, ${dropped} non-US, ${picks.length} picks`);
  return Response.json({ jobs, dropped, summary: output.summary, gaps: output.gaps, picks });
}
