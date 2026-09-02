// Show the Google queries the agent writes, without running any search.
// `npx tsx evals/queries.ts ["your request"]`
import 'dotenv/config';
import { searchAgent } from '../lib/agents';
import { withScope } from '../lib/greenhouse';

async function main() {
  const reqs = process.argv.slice(2);
  for (const req of reqs.length ? reqs : ['kubernetes platform work, no management']) {
    const { output } = await searchAgent(req);
    console.log(`\n${req}  ->  ${output.action}${output.reason ? `  (${output.reason})` : ''}`);
    for (const q of output.queries) {
      console.log('  ' + q + (/\b(AND|OR)\b|[()]/.test(q) ? '   !! operator, returns nothing' : ''));
      console.log('    https://www.google.com/search?q=' + encodeURIComponent(withScope(q)));
    }
  }
}
main();
