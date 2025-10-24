;(function(){
  function ensureHost(container, id, height){
    if(!container) return null;
    var host = container.querySelector('#'+id);
    if(!host){
      host = document.createElement('div');
      host.id = id;
      host.style.width = '100%';
      host.style.height = (height || 280) + 'px';
      host.style.borderRadius = '14px';
      host.style.border = '1px solid rgba(17,42,94,0.08)';
      host.style.background = '#fff';
      container.appendChild(host);
    }
    return host;
  }

  function hasVega(){ return !!(window.vegaEmbed && window.vega && window.vegaLite); }

  async function renderDonut(container, segments, opts){
    if(!hasVega() || !container) return false;
    var data = (segments||[]).map(function(s){ return {label: s.label, value: Number(s.value)||0, color: s.color}; });
    var spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      background: null,
      data: { values: data },
      transform: [ { filter: 'datum.value > 0' } ],
      encoding: { color: { field: 'label', type: 'nominal', legend: null, scale: null } },
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
    try {
      await window.vegaEmbed(container, spec, { actions:false, renderer: 'canvas' });
      return true;
    } catch(e){ console.warn('Vega donut failed', e); return false; }
  }

  async function renderBarsHorizontal(container, dataset){
    if(!hasVega() || !container) return false;
    var data = (dataset||[]).map(function(d){ return {label: d.label, value: Number(d.value)||0, color: d.color}; });
    var spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      background: null,
      data: { values: data },
      mark: { type: 'bar', cornerRadiusEnd: 3 },
      encoding: {
        y: { field: 'label', type: 'ordinal', sort: '-x', axis: { labelLimit: 150 } },
        x: { field: 'value', type: 'quantitative' },
        color: { field: 'label', type: 'nominal', legend: null }
      },
      view: { stroke: null }
    };
    try { await window.vegaEmbed(container, spec, { actions:false, renderer:'canvas' }); return true; }
    catch(e){ console.warn('Vega bars H failed', e); return false; }
  }

  async function renderBars(container, dataset){
    if(!hasVega() || !container) return false;
    var data = (dataset||[]).map(function(d){ return {label: d.label, value: Number(d.value)||0, color: d.color}; });
    var spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      background: null,
      data: { values: data },
      mark: { type: 'bar', cornerRadiusTopLeft: 3, cornerRadiusTopRight: 3 },
      encoding: {
        x: { field: 'label', type: 'ordinal', axis: { labelAngle: 0 } },
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'label', type: 'nominal', legend: null }
      },
      view: { stroke: null }
    };
    try { await window.vegaEmbed(container, spec, { actions:false, renderer:'canvas' }); return true; }
    catch(e){ console.warn('Vega bars failed', e); return false; }
  }

  async function renderRevenueMini(container, rows){
    if(!hasVega() || !container) return false;
    var spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      background: null,
      data: { values: rows || [] },
      transform: [ { calculate: 'toDate(datum.date)', as: 'ds' } ],
      encoding: {
        x: { field: 'ds', type: 'temporal', axis: { format: '%b %d' } },
        y: { field: 'revenue', type: 'quantitative', stack: 'normalize' },
        color: { field: 'category', type: 'nominal', legend: null }
      },
      mark: { type: 'area', interpolate: 'monotone' },
      view: { stroke: null }
    };
    try { await window.vegaEmbed(container, spec, { actions:false, renderer:'canvas' }); return true; }
    catch(e){ console.warn('Vega revenue mini failed', e); return false; }
  }

  async function renderSupplierMini(container, rows){
    if(!hasVega() || !container) return false;
    var spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      background: null,
      data: { values: rows || [] },
      mark: { type: 'bar', cornerRadiusTopLeft: 2, cornerRadiusTopRight: 2 },
      encoding: {
        x: { field: 'supplierName', type: 'ordinal', axis: { labelAngle: -30 } },
        y: { field: 'onTimePct', type: 'quantitative' },
        color: { field: 'region', type: 'nominal' }
      },
      view: { stroke: null }
    };
    try { await window.vegaEmbed(container, spec, { actions:false, renderer:'canvas' }); return true; }
    catch(e){ console.warn('Vega supplier mini failed', e); return false; }
  }

  window.WorldViz = {
    ensureHost: ensureHost,
    renderDonut: renderDonut,
    renderBarsHorizontal: renderBarsHorizontal,
    renderBars: renderBars,
    renderRevenueMini: renderRevenueMini,
    renderSupplierMini: renderSupplierMini,
    renderLine: async function(container, rows, xField, yField, colorField){
      if(!hasVega() || !container) return false;
      var spec = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        background: null,
        data: { values: rows || [] },
        mark: { type: 'line', interpolate: 'monotone' },
        encoding: {
          x: { field: xField||'date', type: 'temporal' },
          y: { field: yField||'value', type: 'quantitative' },
          color: colorField ? { field: colorField, type: 'nominal' } : undefined
        },
        view: { stroke: null }
      };
      try { await window.vegaEmbed(container, spec, { actions:false, renderer:'canvas' }); return true; }
      catch(e){ console.warn('Vega line failed', e); return false; }
    },
    renderHeatmap: async function(container, rows, xField, yField, valueField){
      if(!hasVega() || !container) return false;
      var spec = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        background: null,
        data: { values: rows || [] },
        mark: 'rect',
        encoding: {
          x: { field: xField||'x', type: 'ordinal' },
          y: { field: yField||'y', type: 'ordinal' },
          color: { field: valueField||'value', type: 'quantitative' }
        },
        view: { stroke: null }
      };
      try { await window.vegaEmbed(container, spec, { actions:false, renderer:'canvas' }); return true; }
      catch(e){ console.warn('Vega heatmap failed', e); return false; }
    }
  };
})();
