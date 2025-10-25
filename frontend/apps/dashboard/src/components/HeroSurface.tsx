'use client';

import * as React from 'react';

export function HeroSurface() {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    let chart: any;
    async function load() {
      const mod = await import('echarts');
      await import('echarts-gl');
      const container = ref.current;
      if (!container) return;
      const echarts = (mod as any).default ?? mod;
      chart = echarts.init(container);
      const data: [number, number, number][] = [];
      for (let i = 0; i <= 20; i += 1) {
        for (let j = 0; j <= 20; j += 1) {
          const x = i / 2;
          const y = j / 2;
          const z = Math.sin(x) * Math.cos(y) * 6 + Math.cos(x / 2) * 4;
          data.push([x, y, z]);
        }
      }
      chart.setOption({
        tooltip: {},
        visualMap: {
          show: false,
          min: -10,
          max: 10,
          inRange: {
            color: ['#0ea5e9', '#2563eb', '#a855f7']
          }
        },
        xAxis3D: { type: 'value' },
        yAxis3D: { type: 'value' },
        zAxis3D: { type: 'value' },
        grid3D: {
          viewControl: { projection: 'perspective', autoRotate: true, autoRotateSpeed: 15 },
          boxHeight: 80,
          light: {
            main: { intensity: 1.6, shadow: true },
            ambient: { intensity: 0.4 }
          }
        },
        series: [
          {
            type: 'surface',
            data,
            shading: 'color',
            itemStyle: { opacity: 0.9 }
          }
        ]
      });
    }
    load();
    return () => {
      if (chart) {
        chart.dispose();
      }
    };
  }, []);

  return <div ref={ref} className="h-[360px] w-full rounded-2xl bg-slate-900/5" />;
}
