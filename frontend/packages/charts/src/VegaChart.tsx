import * as React from 'react';
// Consumers will install react-vega/vega-lite at runtime
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ReactVega = require('react-vega');

export interface VegaChartProps {
  spec: any;
  data?: Record<string, unknown>;
  height?: number;
}

export function VegaChart({ spec, data = {}, height = 280 }: VegaChartProps) {
  const final = React.useMemo(() => ({ ...spec, height }), [spec, height]);
  const { VegaLite } = ReactVega;
  return <VegaLite spec={final} data={data} actions={false} renderer="canvas" />;
}

