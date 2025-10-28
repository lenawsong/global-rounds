'use client';

import { useEffect, useRef } from 'react';

type GraphData = {
  nodes: Array<{ id: string; label: string; definition?: string }>;
  edges: Array<{ source: string; target: string }>;
};

type LexiconGraphViewProps = {
  data: GraphData;
  loading?: boolean;
  height?: number;
  onNodeFocus?: (nodeId: string) => void;
  onGraphReady?: (graph: any) => void;
};

export function LexiconGraphView({
  data,
  loading,
  height = 480,
  onNodeFocus,
  onGraphReady
}: LexiconGraphViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    async function render() {
      const container = containerRef.current;
      if (!container) return;
      const mod = await import('@antv/g6');
      if (!mounted) return;
      const G6 = (mod as any).default ?? mod;
      if (graphRef.current) {
        graphRef.current.destroy();
      }
      const graph = new G6.Graph({
        container,
        width: container.clientWidth,
        height,
        layout: {
          type: 'force',
          preventOverlap: true,
          nodeSpacing: 40,
          linkDistance: 120
        },
        defaultNode: {
          type: 'circle',
          size: 38,
          style: {
            stroke: '#2563eb',
            fill: '#eff6ff',
            lineWidth: 1.5
          },
          labelCfg: {
            position: 'bottom',
            style: { fill: '#0f172a', fontSize: 12, fontWeight: 500 }
          }
        },
        defaultEdge: {
          type: 'quadratic',
          style: { stroke: 'rgba(37,99,235,0.45)', lineAppendWidth: 4, endArrow: true }
        },
        modes: {
          default: ['drag-canvas', 'zoom-canvas', 'drag-node']
        },
        animate: true,
        fitView: true
      });
      graph.data(data);
      graph.render();
      graphRef.current = graph;
      if (onGraphReady) {
        onGraphReady(graph);
      }
      if (onNodeFocus) {
        graph.on('node:click', (evt: any) => {
          const nodeId = evt?.item?.getID?.();
          if (nodeId) onNodeFocus(nodeId);
        });
      }
    }

    render();
    return () => {
      mounted = false;
      if (graphRef.current) {
        graphRef.current.destroy();
        graphRef.current = null;
      }
    };
  }, [data, height, onNodeFocus]);

  return (
    <div
      ref={containerRef}
      style={{ height, borderRadius: 16, position: 'relative', overflow: 'hidden', background: '#fff' }}
    >
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
          Building graph…
        </div>
      ) : !data?.nodes?.length ? (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
          No terms to visualize.
        </div>
      ) : null}
    </div>
  );
}
