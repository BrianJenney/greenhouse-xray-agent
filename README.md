# Greenhouse X-ray — class starting point

> **Branches**
> - `main` — this one. Runs end to end, four things stubbed as `TODO(n)`.
> - `fixed` — the finished version. For when you are stuck, not before.

```bash
cp .env.example .env.local   # one proxy key, nothing else
npm install && npm run dev
```

## Your TODOs

**TODO(1) — `lib/agents.ts`.** The summary agent has a one-line system prompt.
Run `npm run smoke` first: it looks fine, because the zod field descriptions are
carrying it. Write the prompt that guarantees the behaviour instead of hoping
for it.

**TODO(2) — `app/api/plan/route.ts`.** The page already posts the whole
conversation. The route throws all of it away except the first message, so
"make it staff level" starts over. Pass it through and teach the agent to
refine.

**TODO(3) / TODO(4) — `evals/run.ts`.** Two missing cases: one request naming a
salary, one naming a city. Both are real ways this returns nothing.

A case is a request, an action, and a rubric. That is the whole contract.

## What already works

Read these before you start — they are the parts worth stealing.

Type what you want. **searchAgent** either rejects the request or writes up to 5
**Google X-ray queries** against `site:boards.greenhouse.io`. Those come back to
you first — edit any, remove any — and only then do they run. Top 5 results per
query, merged; **searchSummaryAgent** reads them and picks what is worth opening.

Two small things are the model's job: write the queries, and review the results.

## Run

```bash
cp .env.example .env.local   # OPENAI_API_KEY, OPENAI_BASE_URL, SERPER_API_KEY
npm run dev                  # app at /, slides at /slides

npx tsx evals/queries.ts "kubernetes work, no management"   # queries only, no search
npm run eval                 # 8 cases
```

## Conversation

The plan route takes the whole conversation, not one line. Proposed queries go
back in as assistant turns, so a follow-up refines instead of restarting:

```
you:   senior backend engineer, golang
agent: "Senior Backend Engineer" golang -intern
       "Golang Engineer" -intern            ...

you:   actually make it staff level and add kubernetes
agent: "Staff Backend Engineer" golang kubernetes -intern
       "Platform Engineer" kubernetes golang -intern       ...
```

## Tracing

`lib/tracing.ts` — one `registerTelemetry()` traces every model call in the
process, both agents and the eval judge, with nothing to wire per call. A no-op
unless `LANGSMITH_TRACING=true`.

## Two routes

```
POST /api/plan     { messages }
  searchAgent -> { action: 'reject', reason }         nothing runs
              -> { action: 'search', queries[<=5] }   shown to the user

  [ user edits / removes ]

POST /api/execute  { request, queries }
  each query -> Google, scoped to site:boards.greenhouse.io, top 5
  merge by URL, rank by how many queries surfaced it
  searchSummaryAgent -> { summary, picks[], gaps }
  URLs that do not resolve are dropped before render
  zero results -> a message saying so, and the summary agent is not called
```

## The queries

```
site:boards.greenhouse.io ("Backend Engineer" OR "Senior Backend Engineer") golang -intern
```

Ordinary Google syntax — quoted titles, `OR` groups, parentheses, `-`
exclusions. `site:` is added in `lib/greenhouse.ts` so the agent cannot forget
it. Every query in the UI links to that exact search on google.com, so you can
check the agent by hand.

It fails one way: **over-constraining.** Google needs one page containing
everything you asked for, and when none exists you get zero results and no
error. Four rules, each measured, each in the prompt:

| Rule | Broken |
|---|---|
| Common titles only | `"Backend Engineer"` → 10 · `"Golang Engineer"` → **0** |
| No city, state or country | `("Product Designer" OR "UX Designer")` → 10 · same query `+ London` → **0** |
| No salary or pay figure | postings do not publish them |
| Don't repeat a technology already in the titles | `("Golang Engineer" …) golang` → **0** |

Express seniority with exclusions (`-senior -staff`) or the ordinary `Senior X`
form, never by inventing a rarer title. A constraint that cannot go in a query
is **not** a reason to reject — say it in `interpretation` and let the user
filter. Rejecting gives them nothing instead of a list they can scan.

## Location

A location cannot go in the query — Google returns nothing for it, because
postings do not repeat the location in the text it indexes. So we search
without it, then read each posting's **real** location from the Greenhouse
board API, which the result URL already tells us how to call. Free, exact, and
it turns location from a hope into a filter:

- non-US postings are dropped in code (`isUS` in `lib/greenhouse.ts`), and the
  UI says how many
- unknown locations are kept — a posting we could not resolve is not evidence
  that it is foreign
- the real location goes to the summary agent, so it ranks by place instead of
  telling you to "verify the location"

Scope stays `site:boards.greenhouse.io`. `site:*.greenhouse.io` looks more
thorough and is worse: it pulls in `job-boards.eu` and `job-boards.anz`, so a
Bay Area search comes back European.

## Search

Keyless. The query goes to Brave, Greenhouse job URLs are pulled out of the
response, and each posting is read back from the public Greenhouse board API —
which gives the real title, company and location for free.

Brave rate-limits to about one search per 30 seconds per IP. That is the cost
of no key, and on shared wifi you take turns.

> Serper was the alternative and is gone: its free tier rejects this query
> shape outright — `400 Query pattern not allowed for free accounts` — on
> anything with two OR groups and more than a couple of titles. DuckDuckGo and
> Bing serve a challenge page instead of results.

## Evals

A case is a request, an expected action, and a rubric — that is the whole
contract. The code assertions are only the two things worth failing a build
over: a literal `AND` in a query, and a URL the summary agent invented. The
judge grades taste, on a different model, and a grading it will not commit to is
dropped rather than counted.

## Not here yet

No auth, no rate limiting, no caching, no persistence, no tracing. Timing goes
to `console.log` in `app/api/agent/route.ts` — that's the line we replace with
LangSmith during class.

## Why not Crawl4AI (or any browser)

Tried it. Crawl4AI drives a real headless Chromium, so if anything gets past
Google's bot wall, it does. Same two-group query, three engines:

| Engine | With Crawl4AI |
|---|---|
| Google | 200, **0 postings** — challenge page |
| DuckDuckGo | 302 → challenge page |
| Brave | 12 postings |

Google is a dead end even with a browser. Brave works — but plain `fetch` was
already getting the same result from Brave in one HTTP call, without Python,
Playwright, a Chromium download, and a Docker REST server (the npm `crawl4ai`
package is just a client for that server). Crawl4AI earns its place when the
target renders with JavaScript. Search result pages come back as HTML and the
Greenhouse board API comes back as JSON; neither needs a browser.

The one thing the browser did buy: it got past a 429 that plain `fetch` was
stuck on, because a real browser session looks less like a script. That is a
reason to run Brave through a browser *if* the rate limit becomes the blocker
in class — not a reason to crawl.
