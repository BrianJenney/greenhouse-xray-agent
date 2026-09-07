# Greenhouse job search agent

> **Want to build this with me?** I'm running a 2-day workshop on building
> agents and setting up a RAG pipeline. **[Sign up here](https://form.typeform.com/to/qyEMw7Ao).**

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

## What you need before you start

Three accounts. Two are free; OpenAI needs a few dollars of credit. Ten
minutes total.

### 1. OpenAI — the models

The agents run on `gpt-5.4-mini` and `gpt-5.4`.

1. Sign up at **https://platform.openai.com**
2. **Billing → Add credit.** $5 is plenty; a full search costs about a cent.
3. **API keys → Create new secret key.** Copy it — it is shown once.

```
OPENAI_API_KEY=sk-...
```

> **In the workshop** you get a key for the Parsity proxy instead, plus
> `OPENAI_BASE_URL=https://parsity-litellm.fly.dev/v1`. Same code, no OpenAI
> account needed. Use unprefixed model names on the proxy — `openai/...`
> aliases return "invalid model ID".

### 2. Firecrawl — search and scrape

One call searches Google scoped to Greenhouse and returns every result page
already cleaned to markdown.

1. Sign up at **https://firecrawl.dev** (free, no card)
2. **Dashboard → API Keys → copy**

```
FIRECRAWL_API_KEY=fc-...
```

Free tier: 500 credits and **10 requests a minute**. Each query is one
request, so a 4-query search is 4 of them. Use your own key — you cannot share
one with a room.

### 3. LangSmith — see what the agent saw

Every model call traced: the prompt it got, the tokens, the cost, the latency.
Optional, but you will not understand why the agent did something without it.

1. Sign up at **https://smith.langchain.com** (free, no card)
2. **Settings → API Keys → Create API Key**

```
LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_API_KEY=lsv2_...
LANGSMITH_PROJECT=greenhouse-xray
```

`LANGSMITH_ENDPOINT` is required — without it nothing is sent, silently.

### Then

```bash
cp .env.example .env.local   # paste the keys in
npm install && npm run dev   # http://localhost:3000
```

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
