'use client';

import * as React from 'react';
import { Pie, PieConfig } from '@ant-design/plots';
import { defaultColorRange, ensureNexusTheme } from './theme';

export interface DonutDatum { label: string; value: number }

export function DonutChart({ data, height = 280 }: { data: DonutDatum[]; height?: number }) {
  const total = data.reduce((acc, d) => acc + (d.value || 0), 0);
  const config: PieConfig = {
    data,
    angleField: 'value',
    colorField: 'label',
    color: defaultColorRange,
    legend: { position: 'right', color: { title: false }, itemValue: { formatter: (text, item) => `${item.value?.value?.toLocaleString?.() ?? item.value?.value}` } },
    radius: 1,
    innerRadius: 0.72,
    label: { text: 'value', position: 'outside', formatter: (d) => (d.value ?? 0).toLocaleString() },
    interactions: [{ type: 'element-highlight' }, { type: 'legend-highlight' }],
    tooltip: { items: [{ channel: 'color' }, { channel: 'y', valueFormatter: (v: number) => (v ?? 0).toLocaleString() }] },
    animation: { appear: { animation: 'wave-in', duration: 350, easing: 'easeOutCubic' } },
    theme: ensureNexusTheme(),
    appendPadding: 20,
    statistic: {
      title: {
        formatter: () => 'Total'
      },
      content: {
        style: { fontSize: 20, fontWeight: 600, lineHeight: 1, color: '#0f172a' },
        formatter: () => total.toLocaleString()
      }
    },
    height
  };
  return <Pie {...config} />;
}
