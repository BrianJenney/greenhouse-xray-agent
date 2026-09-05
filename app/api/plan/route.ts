import { searchAgent } from '@/lib/agents';
import { initTracing } from '@/lib/tracing';

initTracing();

export const maxDuration = 30;

type Turn = { role: 'user' | 'assistant'; content: string };

/** Step 1. Propose queries, or reject. Nothing is searched here. */
export async function POST(req: Request) {
  const { messages }: { messages: Turn[] } = await req.json();

  const { output } = await searchAgent(messages);

  console.log(`plan ${output.action} ${output.queries.length}q`);
  return Response.json(output);
}
