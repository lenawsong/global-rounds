import { useEffect, useMemo } from 'react';
import { Pie } from '@antv/g2plot';
import type { Datum } from './types';
import { useG2Plot } from '../../hooks/useG2Plot';

type DonutChartProps = {
  data: Datum[];
  height?: number;
  innerRadius?: number;
  onSliceClick?: (datum: Datum) => void;
};

export function DonutChart({ data, height = 280, innerRadius = 0.72, onSliceClick }: DonutChartProps) {
  const options = useMemo(
    () => ({
      data,
      angleField: 'value',
      colorField: 'label',
      radius: 1,
      innerRadius,
      height,
      legend: {
        position: 'right',
        itemName: {
          style: { fill: '#0f172a', fontWeight: 500 }
        }
      },
      label: {
        type: 'outer',
        offset: 12,
        content: (datum: Datum) => `${datum.label}: ${datum.value}`,
        style: { fontSize: 12, fontWeight: 500, fill: '#0f172a' },
        layout: [
          { type: 'limit-in-plot', cfg: { action: 'ellipsis' } },
          { type: 'overlap-adjust-position' }
        ]
      },
      labelLine: {
        style: { stroke: 'rgba(15,23,42,0.25)' }
      },
      interactions: [
        { type: 'element-active' },
        { type: 'association-tooltip' },
        { type: 'association-selected' }
      ],
      tooltip: {
        customContent: (title: string, items: any[]) => {
          const value = items?.[0]?.data?.value;
          return `<div style="padding: 12px 16px"><div style="font-weight:600;margin-bottom:4px">${title}</div><div style="color:#2563eb;font-size:16px;font-weight:600">${value?.toLocaleString?.() ?? value}</div></div>`;
        }
      },
      statistic: {
        title: { content: 'Total', style: { color: '#475569' } },
        content: {
          content: data.reduce((acc, cur) => acc + (cur.value ?? 0), 0).toLocaleString(),
          style: { fontSize: 18, fontWeight: 600, color: '#0f172a' }
        }
      },
      state: {
        active: {
          style: {
            shadowColor: 'rgba(37,99,235,0.45)',
            shadowBlur: 12
          }
        }
      },
      animation: { appear: { animation: 'wave-in', duration: 300 } }
    }),
    [data, height, innerRadius]
  );

  const { containerRef, plotRef } = useG2Plot(Pie, options);

  useEffect(() => {
    if (!plotRef.current || !onSliceClick) return;
    const plot = plotRef.current;
    const handler = (args: any) => {
      const datum: Datum | undefined = args?.data?.data;
      if (datum) {
        onSliceClick(datum);
      }
    };
    plot.on('element:click', handler);
    return () => {
      plot.off('element:click', handler);
    };
  }, [plotRef, onSliceClick]);

  return (
    <div
      ref={containerRef}
      style={{ minHeight: height }}
    />
  );
}
