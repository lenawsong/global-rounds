import { useEffect, useRef } from 'react';
import type { Plot } from '@antv/g2plot';

export function useG2Plot<T extends Plot<any>>(PlotClass: new (container: HTMLElement, options: any) => T, options: any) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<T | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (plotRef.current) {
      plotRef.current.update(options);
      return;
    }

    const plot = new PlotClass(container, options);
    plot.render();
    plotRef.current = plot;

    return () => {
      plot.destroy();
      plotRef.current = null;
    };
  }, [PlotClass, options]);

  return { containerRef, plotRef };
}
