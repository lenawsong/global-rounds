import { useEffect, useMemo } from 'react';
import { Column } from '@antv/g2plot';
import { useG2Plot } from '../../hooks/useG2Plot';

type HistogramDatum = {
  label: string;
  value: number;
};

type HistogramChartProps = {
  data: HistogramDatum[];
  height?: number;
  annotations?: { type: 'line'; value: number; text: string }[];
};

export function HistogramChart({ data, height = 320, annotations = [] }: HistogramChartProps) {
  const options = useMemo(
    () => ({
      data,
      xField: 'label',
      yField: 'value',
      columnWidthRatio: 0.6,
      height,
      color: '#2563eb',
      label: {
        position: 'top',
        style: { fill: '#0f172a', fontWeight: 600 }
      },
      xAxis: {
        label: {
          autoHide: true,
          style: { fill: '#475569' }
        }
      },
      yAxis: {
        label: {
          style: { fill: '#475569' }
        }
      },
      tooltip: {
        shared: true,
        showMarkers: false
      },
      annotations: annotations.map((annotation) => ({
        type: 'line',
        start: [annotation.value, 'min'],
        end: [annotation.value, 'max'],
        style: { stroke: '#f97316', lineDash: [4, 4] },
        text: {
          content: annotation.text,
          style: { stroke: '#f97316', fontWeight: 600 }
        }
      }))
    }),
    [data, height, annotations]
  );

  const { containerRef, plotRef } = useG2Plot(Column, options);

  useEffect(() => {
    if (!plotRef.current) return;
    plotRef.current.changeData(data);
  }, [data, plotRef]);

  return <div ref={containerRef} style={{ minHeight: height }} />;
}
