'use client';

import * as React from 'react';
import { Rose, RoseConfig } from '@ant-design/plots';

export interface RoseDatum { label: string; value: number }

export function RoseChart({ data, height = 280 }: { data: RoseDatum[]; height?: number }) {
  const config: RoseConfig = {
    data,
    xField: 'label',
    yField: 'value',
    isStack: false,
    seriesField: 'label',
    legend: false,
    height
  };
  return <Rose {...config} />;
}

