'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Plan } from '@/lib/agents';
import { googleUrl, type Job } from '@/lib/search';

type Msg = { role: 'user' | 'assistant'; content: string };

type Results = {
  jobs: Job[];
  dropped: number;
  summary: string;
  gaps: string;
  picks: { url: string; why: string; job: Job }[];
  empty?: string;
  error?: string;
};

const EXAMPLES = [
  'senior backend engineer, golang',
  'kubernetes platform work, no management',
  'machine learning, new grad',
  'product designer in london',
  'rewrite my resume for a stripe role',
];

const post = <T,>(path: string, body: unknown): Promise<T> =>
  fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json());

const dim = 'text-[var(--scr-dim)]';

export default function Page() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [queries, setQueries] = useState<string[]>([]);
  const [results, setResults] = useState<Results | null>(null);
  const [busy, setBusy] = useState<'' | 'plan' | 'run'>('');

  async function propose(text: string) {
    const next: Msg[] = [...messages, { role: 'user', content: text }];
    setInput('');
    setPlan(null);
    setResults(null);
    setBusy('plan');

    // The whole conversation goes over the wire. What the server does with it
    // is the server's business — see app/api/plan/route.ts.
    const p = await post<Plan>('/api/plan', { messages: next });
    setMessages([...next, { role: 'assistant', content: p.queries?.join('\n') || p.reason }]);
    setPlan(p);
    setQueries(p.queries ?? []);
    setBusy('');
  }

  async function run() {
    setBusy('run');
    setResults(await post<Results>('/api/execute', { messages, queries }));
    setBusy('');
  }

  const reset = () => {
    setMessages([]);
    setPlan(null);
    setResults(null);
    setInput('');
  };

  return (
    <main className="flex h-dvh flex-col px-6 py-4 text-sm uppercase">
      <div className={`flex justify-between border-b border-[var(--scr-dim)] pb-1`}>
        <span>GREENHOUSE X-RAY</span>
        <span className={dim}>SEARCH AGENT · SUMMARY AGENT</span>
      </div>

      <form
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          if (input.trim() && !busy) propose(input);
        }}
        className="flex gap-2 py-3"
      >
        <span className="py-1">===&gt;</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={messages.length ? 'refine it' : 'what are you looking for?'}
          className="flex-1 px-2 py-1 normal-case"
          autoFocus
        />
        <button disabled={!!busy} className="px-3 py-1 disabled:opacity-40">
          {busy === 'plan' ? '...' : messages.length ? 'REFINE' : 'PROPOSE'}
        </button>
        {messages.length > 0 && (
          <button type="button" onClick={reset} className="px-3 py-1">
            NEW
          </button>
        )}
      </form>

      <div className="flex-1 space-y-5 overflow-y-auto">
        {!messages.length && !busy && (
          <div className="space-y-1">
            <div className={dim}>TRY ONE:</div>
            {EXAMPLES.map((e) => (
              <button
                key={e}
                onClick={() => propose(e)}
                className="block w-full border-0 px-0 text-left normal-case hover:text-[var(--scr-hi)]"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {plan?.action === 'reject' && (
          <Panel warn label="REJECTED BY SEARCH AGENT" note="NOTHING WAS SEARCHED">
            {plan.reason}
          </Panel>
        )}

        {plan?.action === 'search' && (
          <div>
            <div className={dim}>
              QUERIES — EDIT OR REMOVE, THEN RUN. site: IS ADDED FOR YOU.
            </div>
            {queries.map((q, i) => (
              <div key={i} className="flex items-baseline gap-2 py-1">
                <button
                  onClick={() => setQueries(queries.filter((_, n) => n !== i))}
                  className="border-0 px-0 text-[var(--scr-warn)]"
                >
                  [X]
                </button>
                <input
                  value={q}
                  onChange={(e) => setQueries(queries.map((x, n) => (n === i ? e.target.value : x)))}
                  className="flex-1 px-2 py-0.5 normal-case"
                />
                <a
                  href={googleUrl(q)}
                  target="_blank"
                  rel="noreferrer"
                  className={`text-xs underline ${dim}`}
                >
                  GOOGLE
                </a>
              </div>
            ))}

            <button
              onClick={run}
              disabled={!!busy || !queries.length}
              className="mt-2 px-3 py-1 disabled:opacity-40"
            >
              {busy === 'run' ? 'RUNNING...' : `RUN ${queries.length}`}
            </button>
          </div>
        )}

        {results?.error && <Panel warn label="SEARCH FAILED">{results.error}</Panel>}
        {results?.empty && <Panel warn label="NO RESULTS">{results.empty}</Panel>}

        {results && !results.error && !results.empty && (
          <>
            <Panel label="SUMMARY AGENT" note={`GAPS: ${results.gaps}`}>
              {results.summary}
            </Panel>

            <div>
              <div className={dim}>
                {results.picks.length} PICKS OF {results.jobs.length} US POSTINGS
                {results.dropped ? ` · ${results.dropped} NON-US DROPPED` : ''}
              </div>
              <table className="w-full">
                <tbody>
                  {results.picks.map((p) => (
                    <tr key={p.url} className="align-top">
                      <td className="w-40 py-1">{p.job.company}</td>
                      <td className="py-1 normal-case">
                        <a href={p.url} target="_blank" rel="noreferrer" className="underline">
                          {p.job.title}
                        </a>
                        <div className={`text-xs ${dim}`}>
                          {p.job.location ? `${p.job.location} — ` : ''}
                          {p.why}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className={`flex justify-between border-t border-[var(--scr-dim)] pt-2 pl-12 text-xs ${dim}`}>
        <span>F3=EXIT — AGENT PROPOSES, YOU CURATE, THEN IT RUNS</span>
        <Link href="/slides" className="underline">
          F1=SLIDES
        </Link>
      </div>
    </main>
  );
}

function Panel({
  label,
  note,
  warn,
  children,
}: {
  label: string;
  note?: string;
  warn?: boolean;
  children: React.ReactNode;
}) {
  const c = warn ? 'var(--scr-warn)' : 'var(--scr-dim)';
  return (
    <div className="border p-3" style={{ borderColor: `${c}` }}>
      <div className="text-xs" style={{ color: c }}>
        {warn ? '** ' : ''}
        {label}
      </div>
      <p className="py-1 normal-case text-[var(--scr-hi)]">{children}</p>
      {note && <p className="text-xs normal-case text-[var(--scr-warn)]">{note}</p>}
    </div>
  );
}
