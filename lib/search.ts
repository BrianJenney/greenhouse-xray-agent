import boards from '@/data/boards.json';

export type Job = { title: string; company: string; location: string; url: string; text: string };

/** Shown next to each query so the user can run it on Google themselves. */
export const googleUrl = (q: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(`site:boards.greenhouse.io ${q}`)}`;

// ---------------------------------------------------------------- postings

const strip = (h: string) =>
  h.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').slice(0, 1500);

let cache: Promise<Job[]> | null = null;

/**
 * Every board at once. Free, no key, no rate limit — ~100 boards, ~13k
 * postings, about a second. Cached for the life of the process; restart the
 * dev server to refresh.
 */
export function jobs(): Promise<Job[]> {
  cache ??= Promise.all(
    boards.map(async ({ slug, name }) => {
      try {
        const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
        const { jobs } = (await r.json()) as { jobs: Record<string, unknown>[] };
        return jobs.map<Job>((j) => ({
          title: String(j.title),
          company: name,
          location: String((j.location as { name?: string } | null)?.name ?? ''),
          url: String(j.absolute_url),
          text: strip(String(j.content ?? '')),
        }));
      } catch {
        return []; // one dead board must not take the search down
      }
    }),
  ).then((all) => all.flat());
  return cache;
}

// ---------------------------------------------------------------- boolean

type Node =
  | { op: 'and' | 'or'; kids: Node[] }
  | { op: 'not'; kid: Node }
  | { op: 'term'; text: string };

/** AND, OR, NOT, -, parentheses, "phrases". Adjacent terms are ANDed. */
export function parse(input: string): Node {
  const tokens = input.match(/"[^"]*"|[()]|-[^\s()]+|[^\s()]+/g) ?? [];
  let i = 0;

  function primary(): Node {
    const t = tokens[i++];
    if (t === '(') {
      const n = expr();
      if (tokens[i] === ')') i++;
      return n;
    }
    if (t === 'NOT') return { op: 'not', kid: primary() };
    if (t.startsWith('-') && t.length > 1) return { op: 'not', kid: { op: 'term', text: t.slice(1) } };
    return { op: 'term', text: t.replace(/^"|"$/g, '') };
  }

  function expr(): Node {
    const kids = [primary()];
    let op: 'and' | 'or' = 'and';
    while (i < tokens.length && tokens[i] !== ')') {
      if (tokens[i] === 'AND') i++;
      else if (tokens[i] === 'OR') {
        i++;
        op = 'or';
      }
      kids.push(primary());
    }
    return kids.length === 1 ? kids[0] : { op, kids };
  }

  return tokens.length ? expr() : { op: 'term', text: '' };
}

const res = new Map<string, RegExp>();

/** Whole-word: "go" must not match "category" or "golang". */
function has(hay: string, term: string) {
  const t = term.toLowerCase().trim();
  if (!t) return true;
  let re = res.get(t);
  if (!re) {
    re = new RegExp(`(?<![a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`);
    res.set(t, re);
  }
  return re.test(hay);
}

export function matches(node: Node, hay: string): boolean {
  if (node.op === 'term') return has(hay, node.text);
  if (node.op === 'not') return !matches(node.kid, hay);
  const f = node.op === 'and' ? 'every' : 'some';
  return node.kids[f]((k) => matches(k, hay));
}

// ---------------------------------------------------------------- search

const STATES =
  'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(
    ' ',
  );

/**
 * Unknown locations are kept — unresolvable is not evidence of foreign.
 * Location strings are free text: "Remote - US", "Remote, Canada; Remote, US",
 * "Mountain View, CA US". Any US signal anywhere in the string counts.
 */
export function isUS(location: string) {
  const l = location.toLowerCase().trim();
  if (!l || l === 'remote') return true;
  if (/\b(united states|usa|u\.s\.?|us|north america)\b/.test(l)) return true;
  // A state code only counts after a comma: "London OR Dublin" is not Oregon,
  // "Montréal, Canada" is not California.
  return STATES.some((s) => new RegExp(`,\\s*${s.toLowerCase()}\\b`).test(l));
}

export async function search(queries: string[]) {
  const all = await jobs();
  const trees = queries.map(parse);

  // Title carries the signal; description is boilerplate. Both are searched,
  // but a title hit ranks first.
  const hits = all
    .map((job) => {
      const title = ` ${job.title.toLowerCase()} `;
      const full = `${title}${job.text.toLowerCase()} `;
      const inTitle = trees.filter((t) => matches(t, title)).length;
      const inAny = trees.filter((t) => matches(t, full)).length;
      return { job, score: inTitle * 10 + inAny };
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score);

  const us = hits.filter((h) => isUS(h.job.location)).map((h) => h.job);
  return { jobs: us.slice(0, 40), dropped: hits.length - us.length, scanned: all.length };
}
