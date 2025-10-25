import { G2 } from '@ant-design/plots';

export const defaultColorRange = ['#2563eb', '#14b8a6', '#fbbf24', '#f97316', '#a855f7', '#38bdf8'];

let themeRegistered = false;

export function ensureNexusTheme(): string {
  if (!themeRegistered) {
    G2.registerTheme('nexus-nebula', {
      defaultColor: '#2563eb',
      defaultCategoryColor: defaultColorRange,
      background: 'transparent',
      colors10: defaultColorRange,
      colors20: defaultColorRange,
      view: {
        viewFill: 'rgba(15,23,42,0.02)',
        plotFill: 'transparent'
      },
      axis: {
        titleFill: '#1e293b',
        labelFill: '#334155',
        gridStroke: 'rgba(148, 163, 184, 0.3)',
        lineStroke: 'rgba(15, 23, 42, 0.1)'
      },
      legend: {
        titleFill: '#1e293b',
        itemLabelFill: '#334155'
      },
      tooltip: {
        titleFill: '#0f172a',
        markerStroke: '#ffffff',
        markerFill: '#2563eb'
      },
      label: {
        fill: '#0f172a',
        fontWeight: 500
      },
      innerLabel: {
        fill: '#0f172a',
        fontWeight: 600
      }
    });
    themeRegistered = true;
  }
  return 'nexus-nebula';
}
