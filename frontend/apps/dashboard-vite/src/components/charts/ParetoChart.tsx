import { useEffect, useMemo } from 'react';
import { DualAxes } from '@antv/g2plot';
import { useG2Plot } from '../../hooks/useG2Plot';

type ParetoDatum = {
  label: string;
  value: number;
  cumulative?: number;
};

type ParetoChartProps = {
  data: ParetoDatum[];
  height?: number;
};

export function ParetoChart({ data, height = 320 }: ParetoChartProps) {
  const cumulativeData = useMemo(() => {
    const total = data.reduce((acc, cur) => acc + cur.value, 0);
    let running = 0;
    return data.map((item) => {
      running += item.value;
      return {
        label: item.label,
        cumulative: Number(((running / total) * 100).toFixed(2)),
        value: item.value
      };
    });
  }, [data]);

  const options = useMemo(
    () => ({
      data: [data, cumulativeData],
      xField: 'label',
      yField: ['value', 'cumulative'],
      geometryOptions: [
        {
          geometry: 'column',
          color: '#2563eb',
          label: {
            position: 'top',
            style: { fill: '#0f172a', fontWeight: 600 }
          }
        },
        {
          geometry: 'line',
          color: '#f97316',
          lineStyle: { lineWidth: 2 },
          point: {
            size: 4,
            shape: 'circle',
            style: { stroke: '#fff', lineWidth: 1 }
          },
          label: {
            position: 'top',
            formatter: ({ cumulative }: ParetoDatum) => `${cumulative?.toFixed?.(1)}%`,
            style: { fill: '#f97316', fontWeight: 600 }
          }
        }
      ],
      height,
      meta: {
        value: { alias: 'Count' },
        cumulative: { alias: 'Cumulative %' }
      },
      yAxis: {
        value: {
          title: { text: 'Count' },
          label: { style: { fill: '#475569' } }
        },
        cumulative: {
          title: { text: 'Cumulative %' },
          label: { formatter: (val: number) => `${val}%`, style: { fill: '#475569' } },
          grid: null
        }
      },
      tooltip: {
        shared: true,
        showMarkers: false
      }
    }),
    [data, cumulativeData, height]
  );

  const { containerRef, plotRef } = useG2Plot(DualAxes, options);

  useEffect(() => {
    if (!plotRef.current) return;
    plotRef.current.changeData([data, cumulativeData]);
  }, [data, cumulativeData, plotRef]);

  return <div ref={containerRef} style={{ minHeight: height }} />;
}
