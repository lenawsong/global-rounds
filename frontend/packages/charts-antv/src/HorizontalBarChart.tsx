'use client';

import * as React from 'react';
import { Bar, BarConfig } from '@ant-design/plots';
import { defaultColorRange, ensureNexusTheme } from './theme';

export interface BarDatum { label: string; value: number }

export function HorizontalBarChart({ data, height = 280 }: { data: BarDatum[]; height?: number }) {
  const config: BarConfig = {
    data,
    xField: 'value',
    yField: 'label',
    seriesField: 'label',
    color: defaultColorRange,
    label: {
      position: 'left',
      formatter: (d) => (d.value ?? 0).toLocaleString(),
      style: { fill: '#0f172a', fontWeight: 600 }
    },
    axis: {
      x: { labelFormatter: (v: number) => Number(v).toLocaleString(), grid: { line: { style: { stroke: 'rgba(148,163,184,0.3)', lineDash: [4, 4] } } } },
      y: { labelFormatter: (s: string) => s, title: null }
    },
    barStyle: { radius: [8, 8, 8, 8] },
    legend: false,
    animation: {
      appear: { animation: 'slide-in-left', duration: 350, easing: 'easeOutCubic' },
      enter: { animation: 'slide-in-left', duration: 350 }
    },
    tooltip: {
      shared: true,
      formatter: (datum) => ({ name: datum.label, value: (datum.value ?? 0).toLocaleString() })
    },
    appendPadding: [10, 30, 10, 10],
    theme: ensureNexusTheme(),
    height
  };
  return <Bar {...config} />;
}
