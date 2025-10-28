import { useEffect, useMemo } from 'react';
import { Bar } from '@antv/g2plot';
import type { Datum } from './types';
import { useG2Plot } from '../../hooks/useG2Plot';

type HorizontalBarChartProps = {
  data: Datum[];
  height?: number;
  showValues?: boolean;
  colorField?: string;
};

export function HorizontalBarChart({
  data,
  height = 320,
  showValues = true,
  colorField = 'label'
}: HorizontalBarChartProps) {
  const options = useMemo(
    () => ({
      data,
      xField: 'value',
      yField: 'label',
      seriesField: colorField,
      isStack: false,
      height,
      color: ['#2563eb', '#9333ea', '#0ea5e9', '#22c55e', '#f97316'],
      label: showValues
        ? {
            position: 'right',
            style: { fontWeight: 600, fill: '#0f172a' }
          }
        : undefined,
      xAxis: {
        nice: true,
        label: {
          style: { fill: '#475569' }
        }
      },
      yAxis: {
        label: {
          style: { fill: '#1f2937', fontWeight: 500 }
        }
      },
      tooltip: {
        shared: true,
        showMarkers: false
      },
      animation: {
        appear: { animation: 'scale-in-x', duration: 300 }
      }
    }),
    [data, height, showValues, colorField]
  );

  const { containerRef, plotRef } = useG2Plot(Bar, options);

  useEffect(() => {
    if (!plotRef.current) return;
    plotRef.current.changeData(data);
  }, [data, plotRef]);

  return <div ref={containerRef} style={{ minHeight: height }} />;
}
