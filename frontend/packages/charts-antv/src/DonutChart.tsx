'use client';

import * as React from 'react';
import { Pie, PieConfig } from '@ant-design/plots';
import { defaultColorRange } from './theme';

export interface DonutDatum { label: string; value: number }

export function DonutChart({ data, height = 280 }: { data: DonutDatum[]; height?: number }) {
  const config: PieConfig = {
    data,
    angleField: 'value',
    colorField: 'label',
    color: defaultColorRange,
    legend: { position: 'right', color: { title: false } },
    radius: 1,
    innerRadius: 0.72,
    label: { text: 'value', position: 'outside', formatter: (d) => d.value?.toLocaleString?.() ?? String(d.value) },
    interactions: [{ type: 'element-highlight' }, { type: 'legend-highlight' }],
    tooltip: { items: [{ channel: 'color' }, { channel: 'y', valueFormatter: (v: number) => (v ?? 0).toLocaleString() }] },
    height
  };
  return <Pie {...config} />;
}

