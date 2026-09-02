import { searchAgent } from '@/lib/agents';
import { initTracing } from '@/lib/tracing';

initTracing();

export const maxDuration = 30;

type Turn = { role: 'user' | 'assistant'; content: string };

/** Step 1. Propose queries, or reject. Nothing is searched here. */
export async function POST(req: Request) {
  const { messages }: { messages: Turn[] } = await req.json();
  const { output } = await searchAgent(messages);
  const last = messages.at(-1)?.content ?? '';
  console.log(`plan ${output.action} ${output.queries.length}q "${last.slice(0, 50)}"`);
  return Response.json(output);
}
