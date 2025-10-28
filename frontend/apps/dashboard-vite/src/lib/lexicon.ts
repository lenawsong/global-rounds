import sampleLexicon from '../sample/kpi_lexicon.json';

const API_BASE = (import.meta.env.VITE_API_BASE || __API_BASE__).replace(/\/$/, '');

const SAMPLE_TERMS: Record<string, string> =
  (sampleLexicon as { terms?: Record<string, string> }).terms ?? {};

export async function loadLexiconTerms(): Promise<Record<string, string>> {
  try {
    const res = await fetch('/sample/kpi_lexicon.json');
    if (res.ok) {
      const data = await res.json();
      if (data?.terms) return data.terms as Record<string, string>;
    }
  } catch {
    /* ignore */
  }

  try {
    const res = await fetch(`${API_BASE}/data/kpi_lexicon.json`);
    if (res.ok) {
      const data = await res.json();
      if (data?.terms) return data.terms as Record<string, string>;
    }
  } catch {
    /* ignore */
  }

  return { ...SAMPLE_TERMS };
}

export async function expandLexicon(roots: string[], depth: number) {
  const terms = await loadLexiconTerms();
  const body = {
    terms,
    root_terms: roots,
    depth,
    case_insensitive: true
  };
  try {
    const res = await fetch(`${API_BASE}/api/lexicon/expand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    return res.json() as Promise<{ closure: Record<string, string> }>;
  } catch {
    return expandLexiconOffline(terms, roots, depth);
  }
}

export function buildLexiconGraph(closure: Record<string, string>) {
  const nodes = Object.keys(closure).map((term) => ({
    id: term,
    label: term,
    definition: closure[term]
  }));
  const edges: { source: string; target: string }[] = [];
  const terms = new Set(Object.keys(closure));
  Object.entries(closure).forEach(([term, definition]) => {
    const tokens = definition.toLowerCase().match(/[a-z0-9_]+/g) || [];
    tokens.forEach((token) => {
      if (token !== term && terms.has(token)) {
        edges.push({ source: term, target: token });
      }
    });
  });
  return { nodes, edges };
}

function expandLexiconOffline(
  terms: Record<string, string>,
  roots: string[],
  depth: number
): { closure: Record<string, string> } {
  const normalizedTerms = new Map<string, { term: string; definition: string }>();
  Object.entries({ ...SAMPLE_TERMS, ...terms }).forEach(([term, definition]) => {
    normalizedTerms.set(term.toLowerCase(), { term, definition });
  });

  const queue: Array<{ key: string; remaining: number }> = [];
  const visited = new Set<string>();
  const closure: Record<string, string> = {};

  roots.forEach((root) => {
    const key = root.toLowerCase();
    queue.push({ key, remaining: depth });
  });

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    if (visited.has(current.key)) continue;
    const entry = normalizedTerms.get(current.key);
    if (!entry) continue;

    visited.add(current.key);
    closure[entry.term] = entry.definition;

    if (current.remaining <= 0) continue;
    const tokens = entry.definition.toLowerCase().match(/[a-z0-9_]+/g) || [];
    tokens.forEach((token) => {
      if (!visited.has(token) && normalizedTerms.has(token)) {
        queue.push({ key: token, remaining: current.remaining - 1 });
      }
    });
  }

  return { closure };
}
