'use client';

import * as React from 'react';
import { Rose, RoseConfig } from '@ant-design/plots';
import { ensureNexusTheme } from './theme';

export interface RoseDatum { label: string; value: number }

export function RoseChart({ data, height = 280 }: { data: RoseDatum[]; height?: number }) {
  const config: RoseConfig = {
    data,
    xField: 'label',
    yField: 'value',
    isStack: false,
    seriesField: 'label',
    legend: { position: 'right' },
    radius: 1,
    innerRadius: 0.3,
    label: {
      text: 'value',
      formatter: (d) => `${d.label}: ${(d.value ?? 0).toLocaleString()}`,
      style: { fontSize: 12, fill: '#0f172a' }
    },
    animation: { appear: { animation: 'grow-in-y', duration: 350 } },
    tooltip: {
      formatter: (datum) => ({ name: datum.label, value: (datum.value ?? 0).toLocaleString() })
    },
    theme: ensureNexusTheme(),
    appendPadding: 20,
    height
  };
  return <Rose {...config} />;
}
