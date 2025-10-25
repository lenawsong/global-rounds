'use client';

import * as React from 'react';
import { Bar, BarConfig } from '@ant-design/plots';
import { defaultColorRange } from './theme';

export interface BarDatum { label: string; value: number }

export function HorizontalBarChart({ data, height = 280 }: { data: BarDatum[]; height?: number }) {
  const config: BarConfig = {
    data,
    xField: 'value',
    yField: 'label',
    seriesField: 'label',
    color: defaultColorRange,
    label: { position: 'left', formatter: (d) => d.value?.toLocaleString?.() ?? String(d.value) },
    axis: {
      x: { labelFormatter: (v: number) => Number(v).toLocaleString() },
      y: { labelFormatter: (s: string) => s }
    },
    height
  };
  return <Bar {...config} />;
}

