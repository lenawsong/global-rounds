export function donutSpec() {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    background: null,
    data: { name: 'table' },
    transform: [
      { filter: 'datum.value > 0' }
    ],
    layer: [
      {
        mark: { type: 'arc', innerRadius: 74, outerRadius: 110, cornerRadius: 10 },
        encoding: {
          theta: { field: 'value', type: 'quantitative' },
          color: {
            field: 'label', type: 'nominal', legend: { title: null, orient: 'right' },
            scale: { range: ['#1f5be6','#20c997','#ffa94d','#ff6b6b','#845ef7','#0ea5e9'] }
          },
          tooltip: [
            { field: 'label', type: 'nominal' },
            { field: 'value', type: 'quantitative', format: ',.0f' }
          ]
        }
      }
    ],
    config: {
      view: { stroke: null },
      axis: { labelColor: '#334155', titleColor: '#334155', gridColor: '#e2e8f0' },
      legend: { labelColor: '#334155' }
    }
  };
}

export function horizontalBarSpec() {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    background: null,
    data: { name: 'table' },
    layer: [
      {
        mark: { type: 'bar', cornerRadiusEnd: 4 },
        encoding: {
          y: { field: 'label', type: 'ordinal', sort: '-x', axis: { labelLimit: 180 } },
          x: { field: 'value', type: 'quantitative', axis: { format: ',.0f' } },
          color: {
            field: 'label', type: 'nominal', legend: null,
            scale: { range: ['#1f5be6','#20c997','#ffa94d','#ff6b6b','#845ef7','#0ea5e9'] }
          },
          tooltip: [
            { field: 'label', type: 'nominal' },
            { field: 'value', type: 'quantitative', format: ',.0f' }
          ]
        }
      },
      {
        mark: { type: 'text', align: 'right', baseline: 'middle', dx: -6, fill: '#0b1f4d' },
        encoding: {
          y: { field: 'label', type: 'ordinal', sort: '-x' },
          x: { field: 'value', type: 'quantitative' },
          text: { field: 'value', type: 'quantitative', format: ',.0f' }
        }
      }
    ],
    config: {
      view: { stroke: null },
      axis: { labelColor: '#334155', titleColor: '#334155', gridColor: '#e2e8f0' }
    }
  };
}

export function simpleLineSpec() {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    background: null,
    data: { name: 'table' },
    layer: [
      {
        mark: { type: 'line', interpolate: 'monotone', strokeWidth: 2, point: { filled: true, size: 40 } },
        encoding: {
          x: { field: 'date', type: 'temporal', axis: { format: '%b %d' } },
          y: { field: 'value', type: 'quantitative', axis: { format: ',.0f' } },
          color: { value: '#1f5be6' },
          tooltip: [
            { field: 'date', type: 'temporal' },
            { field: 'value', type: 'quantitative', format: ',.0f' }
          ]
        }
      }
    ],
    config: {
      view: { stroke: null },
      axis: { labelColor: '#334155', titleColor: '#334155', gridColor: '#e2e8f0' },
      legend: { labelColor: '#334155' }
    }
  };
}
