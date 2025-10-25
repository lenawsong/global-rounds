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
      { geometry: 'column', label: { position: 'top' } },
      { geometry: 'line', smooth: true, yAxis: { min: 0, max: 100 } }
    ],
    theme: ensureNexusTheme(),
    height
  };
  return <DualAxes {...config} />;
}
