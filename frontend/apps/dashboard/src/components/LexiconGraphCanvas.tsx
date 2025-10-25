'use client';

import * as React from 'react';

export default function LexiconGraphCanvas({ data }: { data: { nodes: any[]; edges: any[] } }) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    let graph: any;
    let mounted = true;
    async function render() {
      const container = ref.current;
      if (!container) return;
      const mod = await import('@antv/g6');
      const G6 = (mod as any).default ?? mod;
      if (!mounted) return;
      if (graph) graph.destroy();
      graph = new G6.Graph({
        container,
        width: container.clientWidth,
        height: 480,
        layout: { type: 'radial', preventOverlap: true, unitRadius: 120 },
        defaultNode: {
          style: {
            stroke: '#2563eb',
            fill: '#eff6ff',
            lineWidth: 1.5,
            radius: 16
          },
          labelCfg: { style: { fill: '#0f172a', fontSize: 12, fontWeight: 500 } }
        },
        defaultEdge: {
          style: { stroke: 'rgba(37, 99, 235, 0.45)', lineAppendWidth: 4 }
        },
        modes: {
          default: ['drag-canvas', 'zoom-canvas', 'drag-node']
        }
      });
      graph.data(data);
      graph.render();
      graph.on('node:mouseenter', (evt: any) => {
        graph.setItemState(evt.item, 'hover', true);
      });
      graph.on('node:mouseleave', (evt: any) => {
        graph.setItemState(evt.item, 'hover', false);
      });
    }
    render();
    return () => {
      mounted = false;
      if (graph) {
        graph.destroy();
        graph = null;
      }
    };
  }, [data]);

  return <div ref={ref} className="h-[480px] w-full" />;
}
