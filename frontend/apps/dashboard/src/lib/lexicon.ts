const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8001').replace(/\/$/, '');

export async function loadLexiconTerms(): Promise<Record<string, string>> {
  try {
    const res = await fetch('/sample/kpi_lexicon.json');
    if (res.ok) {
      const data = await res.json();
      if (data?.terms) return data.terms as Record<string, string>;
    }
  } catch {/* ignore */}
  try {
    const res = await fetch(`${API_BASE}/data/kpi_lexicon.json`);
    if (res.ok) {
      const data = await res.json();
      if (data?.terms) return data.terms as Record<string, string>;
    }
  } catch {/* ignore */}
  return {};
}

export async function expandLexicon(roots: string[], depth: number) {
  const terms = await loadLexiconTerms();
  const body = {
    terms,
    root_terms: roots,
    depth,
    case_insensitive: true
  } as any;
  const res = await fetch(`${API_BASE}/api/lexicon/expand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ closure: Record<string, string> }>;
}

export function buildLexiconEdges(closure: Record<string, string>) {
  const nodes = Object.keys(closure).map((term) => ({ id: term, label: term }));
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
