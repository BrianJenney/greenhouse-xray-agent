// Show the Google queries the agent writes, without running any search.
// `npx tsx evals/queries.ts ["your request"]`
import 'dotenv/config';
import { flushTracing, initTracing } from '../lib/tracing';
import { searchAgent } from '../lib/agents';
import { withScope } from '../lib/greenhouse';

initTracing();

async function main() {
  const reqs = process.argv.slice(2);
  for (const req of reqs.length ? reqs : ['kubernetes platform work, no management']) {
    const { output } = await searchAgent([{ role: "user", content: req }]);
    console.log(`\n${req}  ->  ${output.action}${output.reason ? `  (${output.reason})` : ''}`);
    for (const q of output.queries) {
      console.log('  ' + q);
      console.log('    https://www.google.com/search?q=' + encodeURIComponent(withScope(q)));
    }
  }
}
main().then(flushTracing);
