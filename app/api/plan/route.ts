import { searchAgent } from '@/lib/agents';
import { initTracing } from '@/lib/tracing';

initTracing();

export const maxDuration = 30;

/**
 * Step 1. Propose queries, or reject. Nothing is searched here.
 *
 * TODO(2): this takes one string. Change it to take the conversation.
 */
export async function POST(req: Request) {
  const { request }: { request: string } = await req.json();
  const { output } = await searchAgent(request);
  console.log(`plan ${output.action} ${output.queries.length}q "${request.slice(0, 50)}"`);
  return Response.json(output);
}
