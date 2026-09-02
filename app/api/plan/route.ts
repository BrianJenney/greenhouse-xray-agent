import { searchAgent } from '@/lib/agents';

export const maxDuration = 30;

/** Step 1. Propose boolean queries, or reject. Nothing is searched here. */
export async function POST(req: Request) {
  const { request }: { request: string } = await req.json();
  const { output } = await searchAgent(request);
  console.log(`plan ${output.action} ${output.queries.length}q "${request.slice(0, 50)}"`);
  return Response.json(output);
}
