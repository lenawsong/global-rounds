import { useEffect, useMemo } from 'react';
import { RingProgress } from '@antv/g2plot';
import { useG2Plot } from '../../hooks/useG2Plot';

type RadialProgressProps = {
  progress: number;
  label: string;
  height?: number;
  color?: string;
};

export function RadialProgress({ progress, label, height = 160, color = '#2563eb' }: RadialProgressProps) {
  const options = useMemo(
    () => ({
      height,
      autoFit: true,
      percent: progress,
      color: [color, '#e2e8f0'],
      innerRadius: 0.85,
      radius: 0.98,
      statistic: {
        title: {
          formatter: () => `${Math.round(progress * 100)}%`,
          style: { color: '#0f172a', fontSize: 18, fontWeight: 600 }
        },
        content: {
          formatter: () => label,
          style: { color: '#475569' }
        }
      }
    }),
    [progress, label, height, color]
  );

  const { containerRef, plotRef } = useG2Plot(RingProgress, options);

  useEffect(() => {
    if (!plotRef.current) return;
    plotRef.current.update({ percent: progress });
  }, [progress, plotRef]);

  return <div ref={containerRef} style={{ width: '100%', minHeight: height }} />;
}
