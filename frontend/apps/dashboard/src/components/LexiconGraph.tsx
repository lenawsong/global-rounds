'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Button, Card, CardBody, CardSubtle, CardTitle, Shell } from '@gr/ui';
import { expandLexicon, buildLexiconEdges } from '../lib/lexicon';

const GraphCanvas = dynamic(() => import('./LexiconGraphCanvas'), { ssr: false });

export function LexiconGraph() {
  const [roots, setRoots] = React.useState('dso, denial_rate, sla');
  const [graphData, setGraphData] = React.useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [error, setError] = React.useState<string | null>(null);

  async function buildGraph() {
    setError(null);
    try {
      const list = roots.split(',').map((s) => s.trim()).filter(Boolean);
      if (!list.length) {
        setGraphData({ nodes: [], edges: [] });
        return;
      }
      const { closure } = await expandLexicon(list, 2);
      setGraphData(buildLexiconEdges(closure));
    } catch (err) {
      console.error(err);
      setError('Unable to build lexicon graph.');
    }
  }

  React.useEffect(() => {
    buildGraph();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Shell
      title="Lexicon Graph"
      description="Relationship map showing how KPI terms reference each other."
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
          <CardTitle>Graph roots</CardTitle>
          <CardSubtle>Use the same roots as the textual lexicon expansion.</CardSubtle>
          <CardBody className="space-y-4">
            <form
              className="flex flex-wrap gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                buildGraph();
              }}
            >
              <input className="flex-1 rounded-lg border border-slate-200 px-3 py-2" value={roots} onChange={(e) => setRoots(e.target.value)} />
              <Button type="submit">Build graph</Button>
            </form>
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          </CardBody>
        </Card>
        <Card>
          <CardTitle>Term relationships</CardTitle>
          <CardBody>
            <GraphCanvas data={graphData} />
          </CardBody>
        </Card>
      </section>
    </Shell>
  );
}
