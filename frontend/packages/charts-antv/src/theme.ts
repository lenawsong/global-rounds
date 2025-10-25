export const defaultColorRange = ['#2563eb', '#14b8a6', '#fbbf24', '#f97316', '#a855f7', '#38bdf8'];

export function ensureNexusTheme() {
  return {
    colors10: defaultColorRange,
    colors20: defaultColorRange,
    background: 'transparent',
    styleSheet: {
      brandColor: '#2563eb',
      paletteQualitative10: defaultColorRange,
      paletteQualitative20: defaultColorRange,
      labelFill: '#0f172a',
      labelLineWidth: 1,
      axisLineBorderColor: 'rgba(15, 23, 42, 0.1)',
      axisTitleFill: '#1e293b',
      axisTickStroke: 'rgba(15, 23, 42, 0.12)',
      gridLineStroke: 'rgba(148, 163, 184, 0.3)'
    }
  };
}
