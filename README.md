# Greenhouse job search agent

> **Want to build this with me?** I'm running a 2-day workshop on building
> agents and setting up a RAG pipeline. **[Sign up here](https://form.typeform.com/to/EDuBEz4U).**

Type what you want. One agent writes boolean queries (or rejects the request),
you pick which to run, they run, and a second agent reads the postings and tells
you which are worth opening.

```
"ai engineer, llm and rag"
   │
   ▼  searchAgent          reject, or 1–5 boolean queries
   │
   ▼  you                  remove or edit any, then run
   │
   ▼  Firecrawl            search Greenhouse, pages come back as markdown
   │
   ▼  searchSummaryAgent   picks, why, and what the results missed
```

## Setup

Three free accounts, no cards.

| | For |
|---|---|
| Parsity LiteLLM proxy | the LLM — key handed out in class |
| [Firecrawl](https://firecrawl.dev) | search + scrape in one call |
| [LangSmith](https://smith.langchain.com) | see what the agent saw |

```bash
cp .env.example .env.local   # paste the three keys in
npm install && npm run dev   # http://localhost:3000
```

Firecrawl's free tier is **10 requests a minute, one per query.** Use your own
key; you cannot share one with a room.

## How to write one of these

Everything is in `lib/agents.ts`. An agent is a function that calls a model
with a schema and some examples:

```ts
export const searchAgent = (messages) =>
  generateText({
    model: model('gpt-5.4-mini'),
    output: Output.object({ schema: planSchema }),
    system: `Respond as in these examples.\n\n${shotsBlock}`,
    messages,
  });
```

**Schema first.** Never ask for text you then have to parse. Ask for the shape
you want back and let zod refuse anything else:

```ts
const planSchema = z.object({
  action: z.enum(['search', 'reject']),
  reason: z.string(),                       // making it explain improves the answer
  queries: z.array(z.string()).min(1).max(5),
});
```

**Examples, not prose.** The search agent has no system prompt. `PLAN_SHOTS` is
a list of `{ request, output }` pairs and each `reason` states the rule that
example exists to teach. When the agent misbehaves, add an example — do not
add a paragraph. Watch one example over-generalise: the "we do not hire
juniors" shot also rejects "entry level".

**Reject before you spend.** The first agent runs on the small model and
decides whether to do anything at all. Junk, injection, and "who is the CEO"
stop there for a fraction of a cent.

**Human in the loop.** Queries go to the screen before they run. That is the
cheapest correction in the whole system.

**Trust nothing back.** The summary agent returns URLs; anything not in the
pages it was actually given is dropped before render.

## Evals

`npm run eval` with the dev server running. A case is a request, the action it
should take, and a rubric a second model grades against:

```ts
{ request: 'senior backend engineer, golang', action: 'search',
  rubric: 'Titles cover backend engineering; keywords carry golang and Go.' }
```

The judge is not deterministic — read the reasoning, not just the score.

## Branches

`main` runs, with four `TODO(n)` markers to fill in. `fixed` is the finished
version.
