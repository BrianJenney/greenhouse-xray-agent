# Greenhouse X-ray — two agents

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
"Senior Backend Engineer" golang -intern
"Staff Backend Engineer" golang -intern
"Golang Engineer" -intern
```

**One quoted job title, then any technologies as bare words, then
`-exclusions`.** No OR, no parentheses — the five queries *are* the OR, results
merge, and a posting several queries found ranks first. Every query in the UI
links to the same search on google.com so you can check the agent by hand.

Four rules the prompt has to teach, each learned by getting zero results:

- **Carry the technology.** `"Senior Backend Engineer" -intern` finds the right
  title doing the wrong work. Golang has to be in the query.
- **Keep queries short.** Title + at most two bare words. Stacking seniority,
  a technology, a city and a salary finds no page containing all of it —
  silence, not an error. Never put a salary in a query.
- **Titles, not skills** in the quoted part. Postings say "Backend Engineer",
  never "someone who knows Go".
- **Staff and Principal are IC titles.** "No management" excludes
  `-manager -director -head -vp`, not those.

### The scoping trick

`site:boards.greenhouse.io` looks right and is not. Google honours it alone, then
**silently drops it** the moment you add search terms — you get YouTube and
LinkedIn back, with no error. What actually pins results to Greenhouse is the
phrase every posting page carries in its title:

```
"Job Application for" greenhouse "AI Engineer" -intern
```

`withScope()` adds that; results are then filtered to URLs matching
`greenhouse.io/*/jobs/<id>`. And **`OR` or parentheses anywhere in a scoped
query returns zero results** — no error, just nothing. That one is an eval
assertion now, because it costs an afternoon to find.

## Search provider

Serper (Google results, 2,500 free credits, no card) via `SERPER_API_KEY`.

> Keyless engines do not work for this. DuckDuckGo's HTML endpoint returns an
> anomaly challenge after a handful of requests and Mojeek serves a captcha —
> both fine for one manual search, both dead in a classroom. Greenhouse itself
> has no cross-board search: `?q=`, `?search=`, `/v1/boards`,
> `my.greenhouse.io/api/jobs/search` are all ignored or 404.

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
