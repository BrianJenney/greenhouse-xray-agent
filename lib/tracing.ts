import { registerTelemetry } from 'ai';
import { Client } from 'langsmith';
import { LangSmithTelemetry } from 'langsmith/experimental/vercel';

/**
 * One global registration traces every generateText call in the process — both
 * agents and the eval judge — with no per-call wiring and nothing to forget
 * when you add a third agent.
 *
 * A no-op unless LANGSMITH_TRACING=true, so the app runs without a key.
 */
let client: Client | null = null;

export function initTracing() {
  if (client || process.env.LANGSMITH_TRACING !== 'true') return;
  client = new Client();
  registerTelemetry(LangSmithTelemetry({ client, projectName: process.env.LANGSMITH_PROJECT }));
  console.log(`langsmith tracing -> ${process.env.LANGSMITH_PROJECT ?? 'default'}`);
}

/**
 * Traces are batched and sent in the background. A short-lived script exits
 * before the batch goes out, so the run never appears and it looks like tracing
 * is broken. The server does not need this — it keeps running.
 */
export async function flushTracing() {
  await client?.awaitPendingTraceBatches();
}
