'use client';

import { useState } from 'react';
import type { Plan } from '@/lib/agents';
import { googleUrl } from '@/lib/search';

type Msg = { role: 'user' | 'assistant'; content: string };

type Pick = {
	url: string;
	title: string;
	company: string;
	location: string;
	why: string;
};
type Results = {
	pages: { url: string; title: string }[];
	summary: string;
	gaps: string;
	picks: Pick[];
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
		// TODO(2): to support follow-up questions, accumulate here instead of
		// starting fresh — `[...messages, { role: 'user', content: text }]` — so
		// the agent's question and the user's answer both reach the next call.
		const next: Msg[] = [{ role: 'user', content: text }];
		setInput('');
		setPlan(null);
		setResults(null);
		setBusy('plan');

		// The whole conversation goes over the wire. What the server does with it
		// is the server's business — see app/api/plan/route.ts.
		const p = await post<Plan>('/api/plan', { messages: next });
		setMessages([
			...next,
			{ role: 'assistant', content: p.queries?.join('\n') || p.reason },
		]);
		setPlan(p);
		setQueries(p.queries ?? []);
		setBusy('');
	}

	async function run() {
		setBusy('run');
		setResults(await post<Results>('/api/execute', { messages, queries }));
		setBusy('');
	}

	return (
		<main className='flex h-dvh flex-col px-8 py-5 text-base uppercase'>
			<div
				className={`flex justify-between border-b border-[var(--scr-dim)] pb-1`}
			>
				<span>GREENHOUSE X-RAY</span>
				<span className={dim}>SEARCH AGENT · SUMMARY AGENT</span>
			</div>

			<form
				onSubmit={(e: React.FormEvent) => {
					e.preventDefault();
					if (input.trim() && !busy) propose(input);
				}}
				className='flex gap-2 py-3'
			>
				<span className='py-1'>===&gt;</span>
				<input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder='what are you looking for?'
					className='flex-1 px-3 py-2 text-lg normal-case'
					autoFocus
				/>
				<button
					disabled={!!busy}
					className='px-4 py-2 disabled:opacity-40'
				>
					{busy === 'plan' ? '...' : 'PROPOSE'}
				</button>
			</form>

			<div className='flex-1 space-y-5 overflow-y-auto'>
				{!messages.length && !busy && (
					<div className='space-y-1'>
						<div className={dim}>TRY ONE:</div>
						{EXAMPLES.map((e) => (
							<button
								key={e}
								onClick={() => propose(e)}
								className='block w-full border-0 px-0 text-left normal-case hover:text-[var(--scr-hi)]'
							>
								{e}
							</button>
						))}
					</div>
				)}

				{plan?.action === 'reject' && (
					<Panel
						warn
						label='REJECTED BY SEARCH AGENT'
						note='NOTHING WAS SEARCHED'
					>
						{plan.reason}
					</Panel>
				)}

				{plan?.action === 'search' && results && !results.error && (
					<div className={dim}>
						RAN {queries.length} QUERIES —{' '}
						<button
							onClick={() => setResults(null)}
							className='border-0 px-0 underline'
						>
							EDIT
						</button>
					</div>
				)}

				{plan?.action === 'search' && !results && (
					<div>
						<div className={dim}>
							QUERIES — EDIT OR REMOVE, THEN RUN. site: IS ADDED
							FOR YOU.
						</div>
						{queries.map((q, i) => (
							<div
								key={i}
								className='flex items-start gap-3 py-2'
							>
								<button
									onClick={() =>
										setQueries(
											queries.filter((_, n) => n !== i),
										)
									}
									className='border-0 px-0 pt-2 text-[var(--scr-warn)]'
								>
									[X]
								</button>
								{/* textarea, not input: a real boolean is two lines on a
								    projector and clipping it hides the point of the demo */}
								<textarea
									value={q}
									rows={2}
									onChange={(e) =>
										setQueries(
											queries.map((x, n) =>
												n === i ? e.target.value : x,
											),
										)
									}
									className='flex-1 resize-none px-3 py-2 text-lg normal-case leading-snug'
								/>
								<a
									href={googleUrl(q)}
									target='_blank'
									rel='noreferrer'
									className={`pt-2 text-sm underline ${dim}`}
								>
									GOOGLE
								</a>
							</div>
						))}

						<button
							onClick={run}
							disabled={!!busy || !queries.length}
							className='mt-3 px-4 py-2 disabled:opacity-40'
						>
							{busy === 'run'
								? 'RUNNING...'
								: `RUN ${queries.length}`}
						</button>
					</div>
				)}

				{results?.error && (
					<Panel warn label='SEARCH FAILED'>
						{results.error}
					</Panel>
				)}
				{results?.empty && (
					<Panel warn label='NO RESULTS'>
						{results.empty}
					</Panel>
				)}

				{results && !results.error && !results.empty && (
					<>
						<Panel
							label='SUMMARY AGENT'
							note={`GAPS: ${results.gaps}`}
						>
							{results.summary}
						</Panel>

						<div>
							<div className={dim}>
								{results.picks.length} PICKS FROM{' '}
								{results.pages.length} PAGES READ
							</div>
							<table className='w-full'>
								<tbody>
									{results.picks.map((p) => (
										<tr key={p.url} className='align-top'>
											<td className='w-48 py-2'>
												{p.company}
											</td>
											<td className='py-2 normal-case'>
												<a
													href={p.url}
													target='_blank'
													rel='noreferrer'
													className='underline'
												>
													{p.title}
												</a>
												<div
													className={`text-sm ${dim}`}
												>
													{p.location} — {p.why}
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

			<div
				className={`flex justify-between border-t border-[var(--scr-dim)] pt-2 pl-12 text-xs ${dim}`}
			>
				<span>F3=EXIT — AGENT PROPOSES, YOU CURATE, THEN IT RUNS</span>
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
		<div className='border p-3' style={{ borderColor: `${c}` }}>
			<div className='text-xs' style={{ color: c }}>
				{warn ? '** ' : ''}
				{label}
			</div>
			<p className='py-2 text-lg normal-case leading-relaxed text-[var(--scr-hi)]'>{children}</p>
			{note && (
				<p className='text-sm normal-case text-[var(--scr-warn)]'>
					{note}
				</p>
			)}
		</div>
	);
}
