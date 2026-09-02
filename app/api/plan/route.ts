import { searchAgent } from '@/lib/agents';
import { initTracing } from '@/lib/tracing';

initTracing();

export const maxDuration = 30;

type Turn = { role: 'user' | 'assistant'; content: string };

/** Step 1. Propose queries, or reject. Nothing is searched here. */
export async function POST(req: Request) {
  const { messages }: { messages: Turn[] } = await req.json();

  // TODO(2): the page sends the whole conversation and we throw away all but
  // the first message, so "make it staff level" starts from scratch instead of
  // refining what was just proposed. Pass `messages` straight through, then
  // tell the agent in its system prompt to start from the queries already on
  // the table and change only what was asked. Those queries are already in
  // here as assistant turns — that is what makes a refinement possible.
  const { output } = await searchAgent(messages.slice(0, 1));

  console.log(`plan ${output.action} ${output.queries.length}q`);
  return Response.json(output);
}
