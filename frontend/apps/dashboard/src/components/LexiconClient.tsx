'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, Card, CardBody, CardSubtle, CardTitle, Shell } from '@gr/ui';
import { expandLexicon } from '../lib/lexicon';

export function LexiconClient() {
  const [roots, setRoots] = React.useState('dso, denial_rate, sla');
  const [depth, setDepth] = React.useState(2);
  const [closure, setClosure] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  async function handleExpand() {
    setError(null);
    try {
      const list = roots.split(',').map((s) => s.trim()).filter(Boolean);
      if (!list.length) {
        setClosure({});
        return;
      }
      const result = await expandLexicon(list, depth);
      setClosure(result?.closure || {});
    } catch (err) {
      console.error(err);
      setError('Expansion failed. Check API and try again.');
    }
  }

  return (
    <Shell
      title="KPI Lexicon"
      description="Recursive definitions for key metrics; not only the terms but also the words in their definitions."
      tabs={[
        { key: 'overview', label: 'Overview', href: '/' },
        { key: 'ops', label: 'Ops', href: '/ops' },
        { key: 'finance', label: 'Finance', href: '/finance' },
        { key: 'inventory', label: 'Inventory', href: '/inventory' },
        { key: 'engagement', label: 'Engagement', href: '/engagement' },
        { key: 'scenarios', label: 'Scenarios', href: '/scenarios' },
        { key: 'lexicon', label: 'Lexicon', href: '/lexicon' }
      ]}
      activeTab="lexicon"
    >
      <section className="grid gap-6">
        <Card>
          <CardTitle>Expand terms</CardTitle>
          <CardSubtle>Enter comma‑separated roots and a depth. We will recursively expand from definitions.</CardSubtle>
          <CardBody>
            <form
              className="grid gap-3 md:grid-cols-[1fr_140px_140px]"
              onSubmit={(e) => {
                e.preventDefault();
                handleExpand();
              }}
            >
              <input className="rounded-lg border border-slate-200 px-3 py-2" value={roots} onChange={(e) => setRoots(e.target.value)} />
              <input className="rounded-lg border border-slate-200 px-3 py-2" type="number" min={0} max={6} value={depth} onChange={(e) => setDepth(Number(e.target.value))} />
              <Button type="submit">Expand</Button>
            </form>
            <div className="mt-3 text-sm text-slate-500">
              <Link className="text-blue-600 transition hover:text-blue-800" href="/lexicon/graph">View as graph →</Link>
            </div>
            {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
          </CardBody>
        </Card>
        <Card>
          <CardTitle>Closure</CardTitle>
          <CardBody>
            {!Object.keys(closure).length ? (
              <p className="text-sm text-slate-500">No terms expanded yet.</p>
            ) : (
              <div className="grid gap-2 text-sm text-slate-700">
                {Object.keys(closure).sort().map((term) => (
                  <div key={term}><strong className="text-slate-900">{term}</strong>: {closure[term]}</div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </section>
    </Shell>
  );
}
