import { registerTelemetry } from 'ai';
import { LangSmithTelemetry } from 'langsmith/experimental/vercel';

/**
 * One global registration traces every generateText call in the process — both
 * agents, the judge, everything — with no per-call wiring and nothing to forget
 * when you add a third agent.
 *
 * A no-op unless LANGSMITH_TRACING=true, so the app runs fine without a key.
 */
let done = false;

export function initTracing() {
  if (done || process.env.LANGSMITH_TRACING !== 'true') return;
  registerTelemetry(LangSmithTelemetry({ projectName: process.env.LANGSMITH_PROJECT }));
  done = true;
  console.log(`langsmith tracing -> ${process.env.LANGSMITH_PROJECT ?? 'default'}`);
}
