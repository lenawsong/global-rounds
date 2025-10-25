'use client';

import * as React from 'react';
import { DualAxes, DualAxesConfig } from '@ant-design/plots';
import { ensureNexusTheme } from './theme';

export interface ParetoDatum { label: string; value: number }

export function DualAxesPareto({ data, height = 280 }: { data: ParetoDatum[]; height?: number }) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((acc, d) => acc + (d.value || 0), 0) || 1;
  let cum = 0;
  const line = sorted.map((d) => { cum += d.value || 0; return { label: d.label, pct: (cum / total) * 100 }; });
  const config: DualAxesConfig = {
    data: [sorted, line],
    xField: 'label',
    yField: ['value', 'pct'],
    geometryOptions: [
      {
        geometry: 'column',
        columnWidthRatio: 0.5,
        label: { position: 'top', style: { fill: '#0f172a', fontWeight: 600 }, formatter: (datum) => (datum.value ?? 0).toLocaleString() },
        color: '#2563eb'
      },
      {
        geometry: 'line',
        smooth: true,
        color: '#14b8a6',
        lineStyle: { lineWidth: 2 },
        point: { size: 4, shape: 'circle' },
        yAxis: { min: 0, max: 100 }
      }
    ],
    tooltip: { shared: true, showMarkers: true },
    theme: ensureNexusTheme(),
    height
  };
  return <DualAxes {...config} />;
}
