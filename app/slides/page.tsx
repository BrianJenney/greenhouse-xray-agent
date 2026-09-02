'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const SLIDES: { title: string; tutorial: string; production: string; where: string }[] = [
  {
    title: 'Two agents, one job',
    tutorial: 'One agent with a search tool. It decides everything, every turn.',
    production:
      'searchAgent writes boolean queries or rejects. searchSummaryAgent reads what matched and picks. Neither can do the other one\'s job, and neither can search.',
    where: 'lib/agents.ts',
  },
  {
    title: 'Human in the middle',
    tutorial: 'Agent searches immediately. You get whatever it decided to run.',
    production:
      'Candidates go to the user first. Remove one, edit another, then press run. The cheapest correction in the system is the one the user makes before you spend anything.',
    where: 'app/page.tsx',
  },
  {
    title: 'Let someone else run it',
    tutorial: 'Invent a query language, then write the parser for it.',
    production:
      'One exact job title per query, no OR, no parens. The five queries ARE the OR. Every query in the UI links to the same Google search, so anyone can check the agent by hand.',
    where: 'lib/greenhouse.ts -> withSite',
  },
  {
    title: 'Reject before you spend',
    tutorial: 'Everything reaches the expensive path.',
    production:
      'A rejection stops at the first agent — no searches, no summary. Injection, "write my cover letter", and questions about pay all die there.',
    where: 'lib/agents.ts -> searchAgent',
  },
  {
    title: 'Free until it is not',
    tutorial: 'Scrape a search engine. It worked on my laptop.',
    production:
      'site:boards.greenhouse.io looks right and is not — Google honours it alone, then silently drops it once you add terms and hands back YouTube. The real scope is the phrase every posting carries: "Job Application for". No error told us; only running it did.',
    where: 'SERPER_API_KEY',
  },
  {
    title: 'Trust nothing it returns',
    tutorial: 'Render whatever the model said.',
    production:
      'The summary agent returns job ids. Any id that does not resolve to a real result is dropped before render — the one hallucination that would put a fake job in front of a user.',
    where: 'app/api/agent/route.ts',
  },
  {
    title: 'Empty is a result',
    tutorial: 'No matches, so render nothing. User stares at a blank pane.',
    production:
      'Zero results says so, lists the queries that found nothing, and links each to Google. The summary agent is never asked to describe an empty list — that call is wasted and its output is nonsense.',
    where: 'app/api/execute/route.ts',
  },
  {
    title: 'Make it admit the gaps',
    tutorial: 'Summary says the results look great. They do not.',
    production:
      'The schema has a required "gaps" field, so it has to name what the user asked for that the results miss. A summary that cannot say "this went badly" is decoration.',
    where: 'lib/agents.ts -> summarySchema',
  },
  {
    title: 'Assert what you can',
    tutorial: 'Ask an LLM judge whether every answer was good.',
    production:
      'A case is a request, an action and a rubric. Code checks only two things worth failing over: a literal AND, and a URL the summary agent invented. The judge grades taste, and a grading it will not commit to is dropped.',
    where: 'evals/run.ts',
  },
  {
    title: 'Still missing',
    tutorial: 'Ship it.',
    production:
      'No auth, no rate limit, no caching, no persistence, no tracing. Timing goes to console.log — we swap that for LangSmith together today.',
    where: 'app/api/agent/route.ts',
  },
];

export default function Slides() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, SLIDES.length - 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  const s = SLIDES[i];
  return (
    <main className="flex h-dvh flex-col px-6 py-4 text-sm uppercase">
      <div className="flex justify-between border-b border-[var(--scr-dim)] pb-1">
        <span>TWO AGENTS / TUTORIAL VS PRODUCTION</span>
        <span className="text-[var(--scr-dim)]">
          SCR {String(i + 1).padStart(2, '0')} OF {String(SLIDES.length).padStart(2, '0')}
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-8">
        <h1 className="text-3xl text-[var(--scr-hi)]">{s.title}</h1>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="border border-[var(--scr-dim)] p-4">
            <div className="mb-2 text-xs text-[var(--scr-warn)]">** TUTORIAL</div>
            <p className="normal-case">{s.tutorial}</p>
          </div>
          <div className="border border-[var(--scr-fg)] p-4">
            <div className="mb-2 text-xs">&gt;&gt; PRODUCTION</div>
            <p className="normal-case text-[var(--scr-hi)]">{s.production}</p>
          </div>
        </div>

        <div className="text-[var(--scr-dim)]">FILE... {s.where}</div>
      </div>

      <div className="flex justify-between border-t border-[var(--scr-dim)] pt-2 pl-12 text-xs text-[var(--scr-dim)]">
        <span>F7=PREV F8=NEXT (ARROW KEYS)</span>
        <Link href="/" className="underline">
          F3=EXIT TO AGENT
        </Link>
      </div>
    </main>
  );
}
