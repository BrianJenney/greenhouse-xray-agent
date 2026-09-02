// One live X-ray end to end. `npm run smoke ["your request"]`
import 'dotenv/config';
import { searchAgent, searchSummaryAgent } from '../lib/agents';
import { execute, withScope } from '../lib/greenhouse';

async function main() {
  const request = process.argv[2] ?? 'kubernetes platform work, no management';
  const { output: plan } = await searchAgent(request);
  console.log(`${request}  ->  ${plan.action}`);
  if (plan.action === 'reject') return console.log('  ' + plan.reason);

  for (const q of plan.queries) console.log('  ' + withScope(q));

  const { runs, results } = await execute(plan.queries);
  console.log(`\n${results.length} unique postings from ${runs.length} queries`);
  for (const r of runs) console.log(`  ${String(r.hits).padStart(2)}  ${r.query.slice(0, 78)}`);

  const { output: sum } = await searchSummaryAgent(request, results);
  console.log(`\n${sum.summary}\nGAPS: ${sum.gaps}\n`);
  const urls = new Set(results.map((r) => r.url));
  for (const p of sum.picks)
    console.log(`  ${urls.has(p.url) ? '✓' : '✗ INVENTED'} ${p.url}\n      ${p.why}`);
}
main();
