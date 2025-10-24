export function donutSpec() {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    background: null,
    data: { name: 'table' },
    transform: [{ filter: 'datum.value > 0' }],
    encoding: { color: { field: 'label', type: 'nominal', legend: null } },
    layer: [
      {
        mark: { type: 'arc', innerRadius: 70, outerRadius: 110, cornerRadius: 8 },
        encoding: {
          theta: { field: 'value', type: 'quantitative' },
          color: { field: 'label', type: 'nominal' }
        }
      }
    ],
    view: { stroke: null }
  };
}

export function horizontalBarSpec() {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    background: null,
    data: { name: 'table' },
    mark: { type: 'bar', cornerRadiusEnd: 3 },
    encoding: {
      y: { field: 'label', type: 'ordinal', sort: '-x' },
      x: { field: 'value', type: 'quantitative' },
      color: { field: 'label', type: 'nominal', legend: null }
    },
    view: { stroke: null }
  };
}

export function simpleLineSpec() {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    background: null,
    data: { name: 'table' },
    mark: { type: 'line', interpolate: 'monotone' },
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' }
    },
    view: { stroke: null }
  };
}

