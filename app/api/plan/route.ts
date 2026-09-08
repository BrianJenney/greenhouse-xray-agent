import { searchAgent } from '@/lib/agents';
import { initTracing } from '@/lib/tracing';

initTracing();

export const maxDuration = 30;

type Turn = { role: 'user' | 'assistant'; content: string };

/** Step 1. Propose queries, or reject. Nothing is searched here. */
export async function POST(req: Request) {
  const { messages }: { messages: Turn[] } = await req.json();

  // TODO(2): follow-up questions. The page already sends `messages` as a
  // conversation and pushes each proposal back in as an assistant turn — but
  // this route reads only the first message, so there is no conversation yet.
  //
  // Pass the whole array through, then let the agent ask ONE clarifying
  // question when the request is too vague to search ("data" — analyst,
  // engineer, or scientist?) instead of guessing. That needs a third action
  // in planSchema alongside search and reject, and the page needs to render it
  // as a question with the input focused, so the answer lands as the next
  // user turn and the agent sees both.
  const { output } = await searchAgent(messages.slice(0, 1)); // TODO(2): messages

  console.log(`plan ${output.action} ${output.queries.length}q`);
  return Response.json(output);
}
