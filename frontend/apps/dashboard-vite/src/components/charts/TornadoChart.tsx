import { useEffect, useMemo } from 'react';
import { Bar } from '@antv/g2plot';
import { useG2Plot } from '../../hooks/useG2Plot';

type TornadoDatum = {
  category: string;
  scenario: string;
  value: number;
};

type TornadoChartProps = {
  data: TornadoDatum[];
  scenarios: string[];
  height?: number;
};

function formatFixed(value: unknown, fractionDigits: number) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toFixed(fractionDigits);
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(fractionDigits) : (0).toFixed(fractionDigits);
}

export function TornadoChart({ data, scenarios, height = 360 }: TornadoChartProps) {
  const options = useMemo(
    () => ({
      data,
      isGroup: true,
      isStack: false,
      xField: 'value',
      yField: 'category',
      seriesField: 'scenario',
      height,
      color: ['#2563eb', '#9333ea', '#0ea5e9'],
      label: {
        position: 'right',
        formatter: (datum: TornadoDatum) => formatFixed(datum.value, 1),
        style: { fontWeight: 600, fill: '#0f172a' }
      },
      xAxis: {
        label: {
          formatter: (val: number | string) => formatFixed(val, 0),
          style: { fill: '#475569' }
        }
      },
      yAxis: {
        label: {
          style: { fill: '#1f2937', fontWeight: 500 }
        }
      },
      legend: {
        position: 'top'
      },
      interactions: [{ type: 'active-region' }],
      groupField: 'scenario',
      isRange: false,
      dodgePadding: 8
    }),
    [data, height, scenarios]
  );

  const { containerRef, plotRef } = useG2Plot(Bar, options);

  useEffect(() => {
    if (!plotRef.current) return;
    plotRef.current.changeData(data);
  }, [data, plotRef]);

  return <div ref={containerRef} style={{ minHeight: height }} />;
}
