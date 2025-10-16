const savedApiBase = (() => {
  try {
    const value = window.localStorage.getItem('gr-api-base') || '';
    return value.includes('localhost') ? '' : value;
  } catch (error) {
    console.warn('Unable to access localStorage for API base persistence.', error);
    return '';
  }
})();

const runtimeOrigin = window.location.origin || '';
const datasetApiBase = document.body.dataset.apiBase?.trim() || '';
const cleanedSavedBase = savedApiBase;
const defaultApiBase =
  datasetApiBase ||
  (runtimeOrigin && !runtimeOrigin.includes('localhost') ? runtimeOrigin : '') ||
  cleanedSavedBase ||
  'http://localhost:8001';

const state = {
  data: null,
  tasks: [],
  lastTaskIds: new Set(),
  highlightedTaskIds: new Set(),
  complianceFilter: 'all',
  varianceMin: 0,
  shiftHours: 6.5,
  showPatient: true,
  showCaseManager: true,
  engagementSearch: '',
  selectedMetric: 'denial_rate',
  apiBase: defaultApiBase,
  apiOnline: false,
  statusTimer: null,
  inventoryForecast: [],
  agentActivity: [],
  activeTab: 'operations',
  moduleLastRun: {},
  activeHelpPanel: null,
  dataMode: 'initial',
  runningAgents: new Set(),
  isRunningAll: false,
  agentWorkTicker: null,
  agentWorkTick: 0,
  agentWorkStart: null,
  agentOverlayReleaseTimeout: null,
  agentWorkManual: null,
  agentWorkTimeline: [],
  agentWorkStepIndex: 0,
  agentWorkStepStart: null,
  chatMessages: [],
  chatLoading: false,
  chatModel: null,
  chatError: null,
  inventoryScenarioResult: null,
  inventoryScenarioInputs: {
    growthPercent: 0,
    leadTimeDelta: 0,
    skus: '',
  },
  commandInsights: null,
  commandError: null,
  commandLoading: false,
  analyticsSummary: null,
};

try {
  if (state.apiBase && state.apiBase !== savedApiBase) {
    window.localStorage.setItem('gr-api-base', state.apiBase);
  }
} catch (error) {
  console.warn('Unable to persist API base preference.', error);
}

const elements = {
  status: document.getElementById('data-status'),
  apiStatus: document.getElementById('api-status'),
  runAllButton: document.getElementById('run-agents-api'),
  reloadSample: document.getElementById('reload-sample'),
  dataFile: document.getElementById('data-file'),
  agentButtons: Array.from(document.querySelectorAll('[data-agent]')),
  complianceFilter: document.getElementById('compliance-filter'),
  workOrdersBody: document.querySelector('#work-orders tbody'),
  vendorOrdersBody: document.querySelector('#vendor-orders tbody'),
  inventoryForecastBody: document.querySelector('#inventory-forecast tbody'),
  complianceAlerts: document.getElementById('compliance-alerts'),
  varianceSlider: document.getElementById('variance-slider'),
  varianceValue: document.getElementById('variance-value'),
  underpaymentsBody: document.querySelector('#underpayments tbody'),
  documentationBody: document.querySelector('#documentation tbody'),
  agingBody: document.querySelector('#aging tbody'),
  shiftHours: document.getElementById('shift-hours'),
  staffingBody: document.querySelector('#staffing-plan tbody'),
  surgeAlerts: document.getElementById('surge-alerts'),
  engagementBody: document.querySelector('#engagement-table tbody'),
  showPatient: document.getElementById('show-patient'),
  showCaseManager: document.getElementById('show-case-manager'),
  engagementSearch: document.getElementById('engagement-search'),
  metricSelect: document.getElementById('metric-select'),
  metricCards: document.getElementById('metric-cards'),
  trendList: document.getElementById('trend-list'),
  statusTableBody: document.getElementById('agent-status-body'),
  agentActivity: document.getElementById('agent-activity'),
  taskStatusChips: document.getElementById('task-status-chips'),
  tabButtons: Array.from(document.querySelectorAll('.tab-button')),
  tabPanels: Array.from(document.querySelectorAll('.tab-panel')),
  toastStack: document.getElementById('toast-stack'),
  taskTableBody: document.getElementById('task-table-body'),
  taskSummary: document.getElementById('task-summary'),
  reactTaskCard: document.getElementById('react-task-card'),
  reactFinanceCard: document.getElementById('react-finance-card'),
  reactInventoryCard: document.getElementById('react-inventory-card'),
  reactRevenueMini: document.getElementById('react-revenue-mini'),
  reactSupplierMini: document.getElementById('react-supplier-mini'),
  scenarioForm: document.getElementById('inventory-scenario-form'),
  scenarioGrowth: document.getElementById('scenario-growth'),
  scenarioLead: document.getElementById('scenario-lead'),
  scenarioSkus: document.getElementById('scenario-skus'),
  scenarioRun: document.getElementById('scenario-run'),
  scenarioReset: document.getElementById('scenario-reset'),
  scenarioSummary: document.getElementById('scenario-summary'),
  scenarioCsv: document.getElementById('scenario-download-csv'),
  scenarioPdf: document.getElementById('scenario-download-pdf'),
  panelHelpButtons: new Map(),
  panelHelpPopovers: new Map(),
  panelRunDisplays: new Map(),
  orderingActionReorder: document.getElementById('action-ordering-reorder'),
  orderingActionExport: document.getElementById('action-ordering-export'),
  paymentsActionAppeal: document.getElementById('action-payments-appeal'),
  paymentsActionExport: document.getElementById('action-payments-export'),
  agentWorkOverlay: document.getElementById('agent-work-overlay'),
  agentWorkTitle: document.getElementById('agent-work-title'),
  agentWorkDetail: document.getElementById('agent-work-detail'),
  agentWorkSteps: document.getElementById('agent-work-steps'),
  agentProgress: document.getElementById('agent-progress'),
  agentProgressTrack: document.getElementById('agent-progress-track'),
  agentProgressBar: document.getElementById('agent-progress-bar'),
  agentProgressStep: document.getElementById('agent-progress-step'),
  agentProgressPercent: document.getElementById('agent-progress-percent'),
  agentProgressActive: document.getElementById('agent-progress-active'),
  chatPanel: document.getElementById('ask-dashboard-panel'),
  chatLog: document.getElementById('dashboard-chat-log'),
  chatForm: document.getElementById('dashboard-chat-form'),
  chatInput: document.getElementById('dashboard-chat-input'),
  chatSend: document.getElementById('dashboard-chat-send'),
  chatReset: document.getElementById('dashboard-chat-reset'),
  chatStatus: document.getElementById('dashboard-chat-status'),
};

const STATUS_CLASSES = ['status-offline', 'status-online', 'status-busy', 'status-error'];
const API_STATUS_COPY = {
  offline: 'API Offline',
  online: 'API Online',
  busy: 'Running Agents…',
  error: 'API Error',
};

const usdFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const decimalFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const AGENT_LABELS = {
  ordering: 'Ordering',
  payments: 'Payments',
  workforce: 'Workforce',
  engagement: 'Engagement',
  performance: 'Performance',
};

const AGENT_ORDER = Object.keys(AGENT_LABELS);

const AGENT_STEP_DEFAULT_MS = 3400;
const AGENT_STEP_TIMINGS = {
  ordering: [3400, 3600, 3400],
  payments: [3600, 3800, 3400],
  workforce: [3200, 3400, 3200],
  engagement: [2600, 2800, 2600],
  performance: [3000, 3200, 3000],
  finance: [3000, 3200, 3200],
};
const MIN_AGENT_OVERLAY_MS = 6000;

const AGENT_WORK_SUMMARY = {
  ordering: 'Synthesizing work orders, vendor picks, and compliance gaps.',
  payments: 'Reconciling denials, underpayments, and documentation queues.',
  workforce: 'Forecasting staffing loads and surge coverage.',
  engagement: 'Routing patient outreach and care-team escalations.',
  performance: 'Refreshing KPI snapshots and analytical trends.',
  finance: 'Modeling automation ROI, cash recovery, and DSO improvements.',
};

const AGENT_WORK_STEPS = {
  ordering: [
    'Collecting outstanding patient orders and compliance flags.',
    'Scoring vendor inventory against forecasted burn.',
    'Packaging reorder packet for supply partners.',
  ],
  payments: [
    'Reconciling claim expected vs. received payments.',
    'Prioritizing high-variance denials for appeal.',
    'Drafting documentation follow-ups for revenue cycle.',
  ],
  workforce: [
    'Aggregating workload signals across teams.',
    'Projecting headcount by shift and demand curve.',
    'Flagging surge scenarios for operations leads.',
  ],
  engagement: [
    'Reviewing patient replies and escalation keywords.',
    'Routing urgent outreach to case managers.',
    'Queuing proactive nudges for upcoming orders.',
  ],
  performance: [
    'Refreshing KPIs against latest transactional baseline.',
    'Analyzing trend deltas vs. historical targets.',
    'Highlighting material movements for leadership briefs.',
  ],
  finance: [
    'Reconciling finance KPIs against expected baseline.',
    'Projecting ROI from automation lifts and credits.',
    'Publishing cash and DSO updates to stakeholders.',
  ],
};

const CHART_COLORS = ['#1f5be6', '#20c997', '#ff6b6b', '#ffa94d', '#845ef7'];
const CHART_ALT_COLORS = ['#7b93ff', '#38d9a9', '#ff8787', '#ffc078', '#b197fc'];
const FINANCE_DSO_BASELINE = 45;
const INVENTORY_BASE_LEAD_TIME = 14;

const CHAT_HISTORY_LIMIT = 12;

const PANEL_HELP_CONFIG = {
  'agent-panel': {
    heading: 'Agent Control Center',
    dataSources: [
      'Automation API status endpoint (/api/agents/status) and run metadata snapshots.',
      'Recent job telemetry streamed from the orchestration backend.',
    ],
    actions: [
      'Kick off the full agent suite or a focused capability when data feels stale.',
      'Verify connectivity and run history before handing off updates to operations leads.',
    ],
    agents: [
      { key: 'ordering', description: 'Supply orchestration and compliance monitoring.' },
      { key: 'payments', description: 'Revenue integrity and claims QA.' },
      { key: 'workforce', description: 'Capacity planning and staffing forecasts.' },
      { key: 'engagement', description: 'Patient outreach and care-team escalations.' },
      { key: 'performance', description: 'Executive KPI pulse and trend spotting.' },
    ],
  },
  'insights-panel': {
    heading: 'Rail Insights',
    dataSources: [
      'Unified task queue snapshots from tasks.json and the live /api/tasks feed.',
      'Financial pulse metrics produced by the finance automation agent.',
      'Inventory forecast outputs across ordering and scenario planning endpoints.',
    ],
    actions: [
      'Glance at workload, ROI, and inventory pressure before drilling into detailed tables.',
      'Use the visuals to brief leaders on where to intervene or double down.',
    ],
    agents: [
      { key: 'ordering', description: 'Supplies inventory pressure and reorder signals.' },
      { key: 'payments', description: 'Feeds ROI context via denials and remits.' },
      { key: 'finance', description: 'Calculates labor savings, cash recovery, and DSO impact.' },
    ],
  },
  'inventory-scenario-panel': {
    heading: 'Inventory Scenario Planning',
    dataSources: [
      'Scenario API (/api/inventory/scenario) combining baseline and simulated forecasts.',
      'Inventory levels and usage data sets leveraged by the ordering agent.',
    ],
    actions: [
      'Adjust demand growth or lead times to stress-test supply planning.',
      'Share scenario deltas with procurement before committing to reorders.',
    ],
    agents: [
      { key: 'inventory_scenario', description: 'Simulated inventory response for planning what-if analysis.' },
    ],
  },
  'tasks-panel': {
    heading: 'Operations Inbox',
    dataSources: [
      'Unified task queue fed by agent escalations and human follow-ups.',
      'SLA thresholds from task_benchmarks.json to flag approaching deadlines.',
    ],
    actions: [
      'Prioritize high-severity or near-due items and assign owners.',
      'Update task status as work progresses to keep agents in sync.',
    ],
    agents: [
      { key: 'ordering', description: 'Raises supply gaps and compliance follow-ups.' },
      { key: 'payments', description: 'Escalates denial reviews and documentation requests.' },
      { key: 'workforce', description: 'Flags staffing adjustments when capacity drifts.' },
      { key: 'engagement', description: 'Surfaces patient replies that need human response.' },
    ],
  },
  'ordering-panel': {
    heading: 'Automated Ordering & Reordering',
    dataSources: [
      'Order pipeline snapshots (order_pipeline.csv) paired with compliance status history.',
      'Inventory telemetry (inventory_levels.csv) and vendor reorder heuristics.',
    ],
    actions: [
      'Filter by compliance to unblock holds before patient impact.',
      'Review vendor recommendations and push approved reorders downstream.',
    ],
    agents: [{ key: 'ordering', description: 'Generates work orders, vendor picks, and compliance alerts.' }],
  },
  'payments-panel': {
    heading: 'Payment Reconciliation',
    dataSources: [
      'Claims ledger variances (claims_ledger.csv) and remittance deltas.',
      'Payer documentation queues and outstanding AR aging summaries.',
    ],
    actions: [
      'Raise appeals or resubmissions on high-dollar gaps.',
      'Share documentation checklists so teams can clear requests quickly.',
    ],
    agents: [{ key: 'payments', description: 'Analyzes denials, underpayments, and documentation requirements.' }],
  },
  'performance-panel': {
    heading: 'Performance Tracking',
    dataSources: [
      'Operational KPI snapshot (operational_metrics.csv) across denial rate, first pass, and SLA.',
      'Trend modeling sourced from the revenue performance engine.',
    ],
    actions: [
      'Swap the focus metric to investigate dips or spikes.',
      'Brief service line owners on trend shifts surfaced here.',
    ],
    agents: [{ key: 'performance', description: 'Curates KPI snapshots and narrative trend insights.' }],
  },
  'engagement-panel': {
    heading: 'Mobile Patient Engagement',
    dataSources: [
      'Patient outreach log (patient_contacts.csv) covering SMS, email, and portal pings.',
      'Case manager escalations synchronized from the care portal.',
    ],
    actions: [
      'Filter for urgent replies that require human outreach.',
      'Confirm case managers receive handoffs on blocked orders.',
    ],
    agents: [{ key: 'engagement', description: 'Drafts and routes patient and care-team messaging.' }],
  },
  'workforce-panel': {
    heading: 'Predictive Workforce Management',
    dataSources: [
      'Volume projections from patient_usage.csv and order_pipeline.csv.',
      'Task benchmarks that convert workload into headcount scenarios.',
    ],
    actions: [
      'Tune shift hours to test staffing sensitivity.',
      'Escalate surge alerts to scheduling before coverage gaps appear.',
    ],
    agents: [{ key: 'workforce', description: 'Models staffing plans and surge outlooks.' }],
  },
  'ask-dashboard-panel': {
    heading: 'Ask the Dashboard',
    dataSources: [
      'Aggregated dashboard state covering ordering, payments, workforce, engagement, and KPIs.',
      'Responses grounded by the backend Ollama model exposed at /api/dashboard/ask.',
    ],
    actions: [
      'Interrogate compliance holds, payment gaps, or staffing surges without leaving the board.',
      'Request summaries or next best actions before briefing stakeholders.',
    ],
    agents: [],
  },
};

if (state.apiBase) {
  try {
    window.localStorage.setItem('gr-api-base', state.apiBase);
  } catch (error) {
    console.warn('Unable to persist API base URL.', error);
  }
}

function setDataStatus(message) {
  if (elements.status && typeof message === 'string') {
    elements.status.textContent = message;
  }
}

function setApiStatus(status, detail) {
  if (!elements.apiStatus) {
    return;
  }
  STATUS_CLASSES.forEach((cls) => elements.apiStatus.classList.remove(cls));
  elements.apiStatus.classList.add(`status-${status}`);
  elements.apiStatus.textContent = API_STATUS_COPY[status] || status;
  if (detail) {
    elements.apiStatus.title = detail;
  } else {
    elements.apiStatus.removeAttribute('title');
  }
}

function setButtonLoading(button, isLoading) {
  if (!button) {
    return;
  }
  button.disabled = isLoading;
  button.classList.toggle('is-loading', isLoading);
}

function isoToday() {
  return new Date().toISOString().split('T')[0];
}

function formatRunTimestamp(value) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function formatAgentName(agent) {
  if (!agent) {
    return 'Agent';
  }
  if (AGENT_LABELS[agent]) {
    return AGENT_LABELS[agent];
  }
  return String(agent)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function orderAgents(collection) {
  if (!collection) {
    return [];
  }
  const values = Array.isArray(collection) ? collection : Array.from(collection);
  const set = new Set(values.map((value) => String(value).toLowerCase()));
  return AGENT_ORDER.filter((agent) => set.has(agent));
}

function buildAgentTimeline(agentList) {
  const list = Array.isArray(agentList) ? agentList : [];
  if (!list.length) {
    return [];
  }
  const timeline = [];
  list.forEach((agent) => {
    const steps = AGENT_WORK_STEPS[agent] || [AGENT_WORK_SUMMARY[agent] || 'Preparing insights.'];
    const durations = AGENT_STEP_TIMINGS[agent] || [];
    const label = formatAgentName(agent);
    steps.forEach((text, index) => {
      const duration = Number.isFinite(durations[index]) ? durations[index] : AGENT_STEP_DEFAULT_MS;
      timeline.push({
        agent,
        label,
        text,
        duration,
      });
    });
  });
  return timeline;
}

function stopAgentProgressTicker() {
  if (state.agentWorkTicker) {
    window.clearInterval(state.agentWorkTicker);
    state.agentWorkTicker = null;
  }
}

function ensureAgentProgressTicker(timeline) {
  const steps = Array.isArray(timeline) ? timeline : [];
  if (!steps.length) {
    stopAgentProgressTicker();
    return;
  }
  if (!state.agentWorkTicker) {
    state.agentWorkStepStart = state.agentWorkStepStart || Date.now();
    state.agentWorkTicker = window.setInterval(() => advanceAgentProgress(), 140);
  }
}

function advanceAgentProgress() {
  const timeline = Array.isArray(state.agentWorkTimeline) ? state.agentWorkTimeline : [];
  if (!timeline.length) {
    stopAgentProgressTicker();
    return;
  }

  const lastIndex = timeline.length - 1;
  const now = Date.now();
  const index = Math.min(Math.max(state.agentWorkStepIndex || 0, 0), lastIndex);
  const entry = timeline[index] || timeline[lastIndex];
  const duration = Number.isFinite(entry?.duration) ? entry.duration : AGENT_STEP_DEFAULT_MS;
  const start = state.agentWorkStepStart || now;
  const elapsed = now - start;

  if (index >= lastIndex) {
    const hasActiveAgents = state.runningAgents instanceof Set && state.runningAgents.size > 0;
    const cap = hasActiveAgents ? 0.9 : 0.99;
    const fraction = Math.min(elapsed / duration, cap);
    state.agentWorkTick = index + Math.max(0, Math.min(fraction, 0.99));
    if (!hasActiveAgents && fraction >= cap) {
      stopAgentProgressTicker();
    }
  } else if (elapsed >= duration) {
    state.agentWorkStepIndex = index + 1;
    state.agentWorkStepStart = now;
    state.agentWorkTick = state.agentWorkStepIndex;
  } else {
    const fraction = Math.min(elapsed / duration, 0.96);
    state.agentWorkTick = index + Math.max(0, fraction);
  }

  updateAgentOverlay();
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getPanelAgents(config) {
  if (!config || !Array.isArray(config.agents)) {
    return [];
  }
  return config.agents
    .map((entry) => (typeof entry === 'string' ? entry : entry?.key))
    .filter(Boolean);
}

function getHelpElements(panelId) {
  return {
    trigger: elements.panelHelpButtons?.get(panelId) || null,
    popover: elements.panelHelpPopovers?.get(panelId) || null,
  };
}

function closeActiveHelp() {
  if (!state.activeHelpPanel) {
    return;
  }
  const { trigger, popover } = getHelpElements(state.activeHelpPanel);
  if (trigger) {
    trigger.setAttribute('aria-expanded', 'false');
  }
  if (popover) {
    popover.hidden = true;
  }
  state.activeHelpPanel = null;
}

function parseNumericValue(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9.-]/g, '');
    if (!normalized) {
      return 0;
    }
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatChartNumber(value) {
  if (!Number.isFinite(value)) {
    return '0';
  }
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  if (abs >= 10) {
    return value.toFixed(0);
  }
  if (abs >= 1) {
    return value.toFixed(1);
  }
  return value.toFixed(2);
}

function getInsightTasks() {
  if (Array.isArray(state.tasks) && state.tasks.length) {
    return state.tasks;
  }
  const embedded = state.data?.tasks;
  if (Array.isArray(embedded)) {
    return embedded;
  }
  if (embedded && Array.isArray(embedded.tasks)) {
    return embedded.tasks;
  }
  return [];
}

function computeTaskInsightsFromState(tasks = getInsightTasks()) {
  const counts = tasks.reduce(
    (acc, task) => {
      const status = String(task?.status || '').toLowerCase();
      if (status === 'open') {
        acc.open += 1;
      } else if (status === 'in_progress') {
        acc.inProgress += 1;
      } else if (status === 'closed') {
        acc.closed += 1;
      }
      const type = String(task?.task_type || '').toLowerCase();
      if (type === 'sla_breach' && status !== 'closed') {
        acc.slaBreaches += 1;
      }
      return acc;
    },
    { open: 0, inProgress: 0, closed: 0, slaBreaches: 0 },
  );

  return {
    total: counts.open + counts.inProgress + counts.closed,
    slaBreaches: counts.slaBreaches,
    dataset: [
      { label: 'Open', value: counts.open, color: CHART_COLORS[0] },
      { label: 'In Progress', value: counts.inProgress, color: CHART_COLORS[1] },
      { label: 'Closed', value: counts.closed, color: CHART_COLORS[2] },
    ],
  };
}

function computeFinanceInsightsFromState(finance = state.data?.finance) {
  const snapshotArray = Array.isArray(finance?.latest_snapshot)
    ? finance.latest_snapshot
    : finance?.latest_snapshot
    ? [finance.latest_snapshot]
    : [];
  const snapshot = snapshotArray[0];
  if (!snapshot) {
    return {
      dataset: [],
      meta: {
        snapshotDate: null,
        baselineDso: FINANCE_DSO_BASELINE,
      },
    };
  }

  const laborMinutes = parseNumericValue(snapshot.labor_minutes_saved);
  const laborHours = Number.isFinite(laborMinutes) ? laborMinutes / 60 : 0;
  const cash = parseNumericValue(snapshot.projected_cash_recovered);
  const dsoCurrent = parseNumericValue(snapshot.dso);
  const dsoImprovement = Math.max(FINANCE_DSO_BASELINE - dsoCurrent, 0);

  return {
    dataset: [
      {
        label: 'Labor hrs saved',
        value: Number.isFinite(laborHours) ? Number(laborHours.toFixed(2)) : 0,
        displayValue: Number.isFinite(laborHours) ? formatHoursLabel(laborHours) : '0 hrs',
        color: CHART_COLORS[0],
      },
      {
        label: 'Projected cash ($K)',
        value: Number.isFinite(cash) ? Number((cash / 1000).toFixed(2)) : 0,
        displayValue: formatCurrencyCompact(cash),
        color: CHART_COLORS[1],
      },
      {
        label: 'DSO improvement',
        value: Number.isFinite(dsoImprovement) ? Number(dsoImprovement.toFixed(2)) : 0,
        displayValue: `${dsoImprovement.toFixed(1)} days`,
        color: CHART_COLORS[2],
      },
    ].filter((item) => Number.isFinite(item.value)),
    meta: {
      snapshotDate: snapshot.date ?? null,
      baselineDso: FINANCE_DSO_BASELINE,
    },
  };
}

function computeInventoryInsightsFromState(entries = state.inventoryForecast) {
  const list = Array.isArray(entries)
    ? entries
    : Object.entries(entries || {}).map(([sku, details]) => ({ supply_sku: sku, ...(details || {}) }));
  const counts = computeInventoryActionCounts(list);
  const dataset = buildInventoryDataset(counts).filter((item) => item.value > 0);
  return {
    dataset,
    totalSkus: list.length,
    scenarioAvailable: Boolean(state.inventoryScenarioResult),
  };
}

function computeCommandInsightsFallback() {
  return {
    tasks: computeTaskInsightsFromState(),
    finance: computeFinanceInsightsFromState(),
    inventory: computeInventoryInsightsFromState(),
  };
}

function getCommandInsights() {
  if (!state.commandInsights) {
    state.commandInsights = computeCommandInsightsFallback();
  }
  return state.commandInsights;
}

function getCommandTaskInsights() {
  return getCommandInsights().tasks;
}

function getCommandFinanceInsights() {
  return getCommandInsights().finance;
}

function getCommandInventoryInsights() {
  return getCommandInsights().inventory;
}

function normalizeCommandInsights(payload) {
  const fallback = computeCommandInsightsFallback();
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const normalizeSegments = (segments = [], defaults = []) =>
    Array.isArray(segments)
      ? segments.map((segment, index) => ({
          label: String(segment?.label ?? ''),
          value: Number(segment?.value) || 0,
          displayValue:
            segment?.displayValue !== undefined && segment?.displayValue !== null
              ? String(segment.displayValue)
              : undefined,
          color: segment?.color || defaults[index % defaults.length] || CHART_COLORS[index % CHART_COLORS.length],
        }))
      : [];

  const tasks = payload.tasks
    ? {
        total: Number(payload.tasks.total) || 0,
        slaBreaches: Number(payload.tasks.slaBreaches) || 0,
        dataset: normalizeSegments(payload.tasks.dataset, [
          '#38bdf8',
          '#22d3ee',
          '#14b8a6',
        ]),
      }
    : fallback.tasks;

  const finance = payload.finance
    ? {
        dataset: normalizeSegments(payload.finance.dataset, ['#22d3ee', '#38bdf8', '#facc15']),
        meta: {
          snapshotDate: payload.finance?.meta?.snapshotDate ?? null,
          baselineDso:
            Number(payload.finance?.meta?.baselineDso) || fallback.finance.meta.baselineDso || FINANCE_DSO_BASELINE,
        },
      }
    : fallback.finance;

  const inventory = payload.inventory
    ? {
        dataset: normalizeSegments(payload.inventory.dataset, ['#f97316', '#fb7185', '#22c55e']),
        totalSkus: Number(payload.inventory.totalSkus) || 0,
        scenarioAvailable: Boolean(payload.inventory.scenarioAvailable),
      }
    : fallback.inventory;

  return { tasks, finance, inventory };
}

function toggleChartState(canvas, emptyElement, hasData) {
  if (canvas) {
    canvas.hidden = !hasData;
  }
  if (emptyElement) {
    emptyElement.hidden = hasData;
  }
}

function updateChartLegend(element, items, { emptyMessage = 'No data yet.' } = {}) {
  if (!element) {
    return;
  }
  if (!items || !items.length) {
    element.innerHTML = `<li class="chart-empty-row">${escapeHtml(emptyMessage)}</li>`;
    return;
  }
  element.innerHTML = items
    .map((item) => {
      const color = item.color || CHART_COLORS[0];
      const valueText =
        item.displayValue !== undefined && item.displayValue !== null
          ? item.displayValue
          : formatChartNumber(item.value);
      return `
        <li>
          <span class="swatch" style="--swatch-color:${color}"></span>
          <span class="label">${escapeHtml(item.label)}</span>
          <span class="value">${escapeHtml(String(valueText))}</span>
        </li>
      `;
    })
    .join('');
}

function getEmbedApi() {
  const api = window.CommandInsightsEmbed || null;
  if (!api) return null;
  // Direct shape: { renderTaskCard, renderFinanceCard, renderInventoryCard }
  if (typeof api.renderTaskCard === 'function') {
    return api;
  }
  // IIFE export shape: { CommandInsightsEmbed: { ..api } }
  if (api.CommandInsightsEmbed && typeof api.CommandInsightsEmbed.renderTaskCard === 'function') {
    return api.CommandInsightsEmbed;
  }
  return null;
}

async function refreshAnalytics({ silent = true } = {}) {
  // Try to fetch analytics summary if the backend supports it.
  // Do NOT use callApi here to avoid flipping apiOnline if the route is missing.
  try {
    const base = (state.apiBase || '').replace(/\/$/, '');
    if (!base) return;
    const url = `${base}/api/analytics/summary`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      return; // not supported; keep existing summary or fallback
    }
    const json = await response.json();
    if (json && typeof json === 'object') {
      const revenue = Array.isArray(json.revenueByCategory) ? json.revenueByCategory : [];
      const suppliers = Array.isArray(json.supplierReliability) ? json.supplierReliability : [];
      state.analyticsSummary = { revenueByCategory: revenue, supplierReliability: suppliers };
      renderRevenueMini();
      renderSupplierMini();
    }
  } catch (error) {
    if (!silent) {
      console.warn('Analytics summary not available:', error);
    }
  }
}

function buildRevenueDemoData() {
  // 30 days of synthetic revenue across 4 categories
  const categories = ['Supplies', 'Devices', 'Services', 'Other'];
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const rows = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    categories.forEach((category, index) => {
      const base = 5000 + index * 1800;
      const wave = Math.sin((i / 30) * Math.PI * 2 + index) * 800;
      const noise = (i % 7) * 50;
      rows.push({ date, category, revenue: Math.max(0, Math.round(base + wave + noise)) });
    });
  }
  return rows;
}

function buildSupplierDemoData() {
  // 12 suppliers with plausible scores
  const regions = ['NE', 'SE', 'MW', 'SW', 'NW'];
  const rows = Array.from({ length: 12 }).map((_, i) => {
    const onTime = 0.75 + Math.random() * 0.22; // 75-97%
    const dispute = 0.02 + Math.random() * 0.1; // 2-12%
    const defect = 0.01 + Math.random() * 0.06; // 1-7%
    return {
      supplierId: `SUP-${String(i + 1).padStart(3, '0')}`,
      supplierName: `Supplier ${i + 1}`,
      onTimePct: Math.min(0.99, Number(onTime.toFixed(3))),
      disputeRate: Number(dispute.toFixed(3)),
      defectRate: Number(defect.toFixed(3)),
      region: regions[i % regions.length],
    };
  });
  return rows;
}

function renderRevenueMini() {
  const container = elements.reactRevenueMini;
  if (!container) return;
  const embed = getEmbedApi();
  const live = Array.isArray(state.analyticsSummary?.revenueByCategory) && state.analyticsSummary.revenueByCategory.length > 0;
  const data = live ? state.analyticsSummary.revenueByCategory : buildRevenueDemoData();
  let reactMounted = false;
  if (embed?.renderRevenueMini) {
    try {
      embed.renderRevenueMini(container, { data, loading: false, live });
      container.classList.add('react-mounted');
      reactMounted = true;
    } catch (error) {
      console.error('Failed to render React revenue mini', error);
    }
  }
  if (!reactMounted) {
    container.classList.remove('react-mounted');
  }
}

function renderSupplierMini() {
  const container = elements.reactSupplierMini;
  if (!container) return;
  const embed = getEmbedApi();
  const live = Array.isArray(state.analyticsSummary?.supplierReliability) && state.analyticsSummary.supplierReliability.length > 0;
  const data = live ? state.analyticsSummary.supplierReliability : buildSupplierDemoData();
  let reactMounted = false;
  if (embed?.renderSupplierMini) {
    try {
      embed.renderSupplierMini(container, { data, loading: false, live });
      container.classList.add('react-mounted');
      reactMounted = true;
    } catch (error) {
      console.error('Failed to render React supplier mini', error);
    }
  }
  if (!reactMounted) {
    container.classList.remove('react-mounted');
  }
}

function setInsightFallback(container, { headline, copy }) {
  if (!container) {
    return;
  }
  const fallback = container.querySelector('.insight-react-fallback');
  if (!fallback) {
    return;
  }
  const headlineEl = fallback.querySelector('.insight-react-headline');
  if (headlineEl && typeof headline === 'string') {
    headlineEl.textContent = headline;
  }
  const copyEl = fallback.querySelector('.insight-react-copy');
  if (copyEl && typeof copy === 'string') {
    copyEl.textContent = copy;
  }
}

function renderInsightFallback(container, { eyebrow, headline, copy, items }) {
  if (!container) {
    return;
  }
  container.classList.remove('react-mounted');
  const fallback = container.querySelector('.insight-react-fallback');
  if (!fallback) {
    return;
  }
  const eyebrowEl = fallback.querySelector('.insight-react-eyebrow');
  if (eyebrowEl && typeof eyebrow === 'string') {
    eyebrowEl.textContent = eyebrow;
  }
  const headlineEl = fallback.querySelector('.insight-react-headline');
  if (headlineEl && typeof headline === 'string') {
    headlineEl.textContent = headline;
  }
  const copyEl = fallback.querySelector('.insight-react-copy');
  if (copyEl && typeof copy === 'string') {
    copyEl.textContent = copy;
  }
  let list = fallback.querySelector('ul');
  if (!list) {
    list = document.createElement('ul');
    fallback.appendChild(list);
  }
  list.innerHTML = '';
  (items || []).forEach((item) => {
    const li = document.createElement('li');
    li.innerHTML = item;
    list.appendChild(li);
  });
}

function ensureCanvas(container, id) {
  try {
    const fallback = container.querySelector('.insight-react-fallback');
    if (!fallback) return null;
    let canvas = fallback.querySelector(`#${id}`);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = id;
      canvas.className = 'chart-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      fallback.appendChild(canvas);
    }
    return canvas;
  } catch (_) {
    return null;
  }
}

function prepareCanvas(canvas) {
  if (!canvas) {
    return null;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(rect.width || canvas.clientWidth || canvas.width || 260, 1);
  const height = Math.max(rect.height || canvas.clientHeight || canvas.height || 180, 1);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (dpr !== 1) {
    ctx.scale(dpr, dpr);
  }
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

function hexToRgb(hex) {
  if (typeof hex !== 'string') {
    return null;
  }
  const normalized = hex.trim().replace('#', '');
  if (normalized.length !== 6) {
    return null;
  }
  const bigint = Number.parseInt(normalized, 16);
  if (Number.isNaN(bigint)) {
    return null;
  }
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function colorWithAlpha(hex, alpha) {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return hex;
  }
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeAlpha})`;
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const absWidth = Math.abs(width);
  const absHeight = Math.abs(height);
  const r = Math.min(Math.max(radius, 0), absWidth / 2, absHeight / 2);
  const signX = width >= 0 ? 1 : -1;
  const signY = height >= 0 ? 1 : -1;
  ctx.beginPath();
  ctx.moveTo(x + r * signX, y);
  ctx.lineTo(x + width - r * signX, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r * signY);
  ctx.lineTo(x + width, y + height - r * signY);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r * signX, y + height);
  ctx.lineTo(x + r * signX, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r * signY);
  ctx.lineTo(x, y + r * signY);
  ctx.quadraticCurveTo(x, y, x + r * signX, y);
  ctx.closePath();
}

function drawHorizontalBarChart(canvas, dataset, options = {}) {
  const prepared = prepareCanvas(canvas);
  if (!prepared) {
    return;
  }
  const { ctx, width, height } = prepared;
  const bars = Array.isArray(dataset) ? dataset.filter((item) => Number.isFinite(item?.value)) : [];
  if (!bars.length) {
    return;
  }

  const paddingLeft = options.paddingLeft ?? 150;
  const paddingRight = options.paddingRight ?? 40;
  const paddingTop = options.paddingTop ?? 32;
  const paddingBottom = options.paddingBottom ?? 32;
  const trackRadius = options.cornerRadius ?? 10;
  const barGap = options.barGap ?? 18;
  const maxValue = options.maxValue ?? Math.max(...bars.map((item) => Math.abs(item.value)), 1);
  const axisSteps = options.axisSteps ?? 4;

  const chartWidth = Math.max(width - paddingLeft - paddingRight, 20);
  const chartHeight = Math.max(height - paddingTop - paddingBottom, 20);
  const count = bars.length;
  const totalGap = barGap * Math.max(count - 1, 0);
  const baseHeight = Math.min(42, Math.max((chartHeight - totalGap) / Math.max(count, 1), 18));
  const offsetY = paddingTop + Math.max((chartHeight - (baseHeight * count + totalGap)) / 2, 0);

  ctx.save();

  // backdrop panel for contrast
  ctx.fillStyle = 'rgba(15, 32, 79, 0.04)';
  roundedRectPath(ctx, paddingLeft - 18, paddingTop - 18, chartWidth + 36, chartHeight + 36, 18);
  ctx.fill();

  // grid & ticks
  ctx.strokeStyle = 'rgba(15, 32, 79, 0.08)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  for (let i = 0; i <= axisSteps; i += 1) {
    const ratio = axisSteps === 0 ? 0 : i / axisSteps;
    const x = paddingLeft + chartWidth * ratio;
    ctx.beginPath();
    ctx.moveTo(x, paddingTop - 6);
    ctx.lineTo(x, paddingTop + chartHeight + 6);
    ctx.stroke();
    const tickValue = maxValue * ratio;
    ctx.font = '11px "Inter", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(11, 31, 77, 0.55)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.setLineDash([]);
    ctx.fillText(formatChartNumber(tickValue), x, paddingTop + chartHeight + 10);
    ctx.setLineDash([4, 6]);
  }
  ctx.setLineDash([]);

  bars.forEach((item, index) => {
    const value = item.value ?? 0;
    const barLength = maxValue === 0 ? 0 : Math.max((Math.abs(value) / maxValue) * chartWidth, 0);
    const barY = offsetY + index * (baseHeight + barGap);
    const barX = paddingLeft;
    const color = item.color || CHART_COLORS[index % CHART_COLORS.length];

    ctx.fillStyle = 'rgba(15, 32, 79, 0.08)';
    roundedRectPath(ctx, barX, barY, chartWidth, baseHeight, trackRadius);
    ctx.fill();

    if (barLength > 0) {
      const gradient = ctx.createLinearGradient(barX, barY, barX + barLength, barY);
      gradient.addColorStop(0, colorWithAlpha(color, 0.92));
      gradient.addColorStop(1, colorWithAlpha(color, 0.72));
      ctx.fillStyle = gradient;
      roundedRectPath(ctx, barX, barY, barLength, baseHeight, trackRadius);
      ctx.fill();
    }

    ctx.fillStyle = '#0b1f4d';
    ctx.font = '600 13px "Inter", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    const valueText =
      item.displayValue !== undefined && item.displayValue !== null
        ? item.displayValue
        : formatChartNumber(value);
    ctx.fillText(String(valueText), paddingLeft + chartWidth, barY + baseHeight / 2);

    ctx.textAlign = 'right';
    ctx.font = '600 13px "Inter", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(11, 31, 77, 0.82)';
    ctx.fillText(String(item.label ?? ''), paddingLeft - 14, barY + baseHeight / 2);
  });

  ctx.restore();
}

function drawDonutChart(canvas, segments, options = {}) {
  const prepared = prepareCanvas(canvas);
  if (!prepared) {
    return;
  }
  const { ctx, width, height } = prepared;
  const total = segments.reduce((sum, item) => sum + (item.value || 0), 0);
  if (total <= 0) {
    return;
  }
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY) - 12;
  let startAngle = -Math.PI / 2;
  ctx.save();
  segments.forEach((segment, index) => {
    const value = segment.value || 0;
    if (value <= 0) {
      return;
    }
    const slice = (value / total) * Math.PI * 2;
    const color = segment.color || CHART_COLORS[index % CHART_COLORS.length];
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.fillStyle = color;
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fill();
    startAngle += slice;
  });
  const innerRadius = radius * 0.58;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#0b1f4d';
  ctx.font = '600 16px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = options.centerLabel || total.toString();
  ctx.fillText(label, centerX, centerY - 6);
  const subLabel = options.centerSubLabel || '';
  if (subLabel) {
    ctx.fillStyle = '#4b5563';
    ctx.font = '12px "Inter", system-ui, sans-serif';
    ctx.fillText(subLabel, centerX, centerY + 12);
  }
  ctx.restore();
}

function drawBarChart(canvas, dataset, options = {}) {
  const prepared = prepareCanvas(canvas);
  if (!prepared) {
    return;
  }
  const { ctx, width, height } = prepared;
  const bars = Array.isArray(dataset) ? dataset.filter((item) => Number.isFinite(item.value)) : [];
  if (!bars.length) {
    return;
  }

  const grouped = bars.some((item) => item.group);
  const padding = options.padding ?? 32;
  const spacing = options.spacing ?? 24;
  const areaWidth = width - padding * 2;
  const chartHeight = height - padding * 2.2;

  ctx.save();
  ctx.font = '12px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'center';

  if (!grouped) {
    const barWidth = Math.max((areaWidth - spacing * (bars.length - 1)) / bars.length, 28);
    const maxValue = Math.max(...bars.map((item) => item.value), 1);
    bars.forEach((item, index) => {
      const scaled = maxValue === 0 ? 0 : (item.value / maxValue) * chartHeight;
      const barHeight = Math.max(scaled, 3);
      const x = padding + index * (barWidth + spacing);
      const y = height - padding - barHeight;
      const color = item.color || CHART_COLORS[index % CHART_COLORS.length];
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barWidth, barHeight);
      ctx.fillStyle = '#0b1f4d';
      ctx.textBaseline = 'bottom';
      const valueText =
        item.displayValue !== undefined && item.displayValue !== null ? item.displayValue : formatChartNumber(item.value);
      ctx.fillText(valueText, x + barWidth / 2, y - 6);
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#4b5563';
      ctx.fillText(item.label, x + barWidth / 2, height - padding + 6);
    });
    ctx.restore();
    return;
  }

  const groupOrder = [];
  const groupMap = new Map();
  const seriesOrder = [];
  bars.forEach((item) => {
    const groupKey = item.group || item.label;
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, []);
      groupOrder.push(groupKey);
    }
    groupMap.get(groupKey).push(item);
    const seriesKey = item.series || item.label;
    if (!seriesOrder.includes(seriesKey)) {
      seriesOrder.push(seriesKey);
    }
  });

  const groupSpacing = options.groupSpacing ?? spacing;
  const seriesSpacing = options.seriesSpacing ?? 16;
  const groupCount = groupOrder.length;
  const maxSeries = seriesOrder.length;
  const totalGroupWidth = areaWidth - groupSpacing * Math.max(groupCount - 1, 0);
  const groupWidth = Math.max(totalGroupWidth / Math.max(groupCount, 1), maxSeries * 24 + (maxSeries - 1) * seriesSpacing);
  const totalSeriesWidth = groupWidth - seriesSpacing * Math.max(maxSeries - 1, 0);
  const barWidth = Math.max(totalSeriesWidth / Math.max(maxSeries, 1), 20);

  const maxValue = Math.max(...bars.map((item) => item.value), 1);

  groupOrder.forEach((groupKey, groupIndex) => {
    const items = groupMap.get(groupKey) || [];
    const groupX = padding + groupIndex * (groupWidth + groupSpacing);
    const usableWidth = barWidth * maxSeries + seriesSpacing * Math.max(maxSeries - 1, 0);
    const offset = (groupWidth - usableWidth) / 2;

    seriesOrder.forEach((seriesKey, seriesIndex) => {
      const item = items.find((entry) => (entry.series || entry.label) === seriesKey);
      const value = item ? item.value : 0;
      const scaled = maxValue === 0 ? 0 : (value / maxValue) * chartHeight;
      const barHeight = Math.max(scaled, value > 0 ? 3 : 0);
      const x = groupX + offset + seriesIndex * (barWidth + seriesSpacing);
      const y = height - padding - barHeight;
      const color = item?.color || CHART_COLORS[seriesIndex % CHART_COLORS.length];
      ctx.fillStyle = color;
      if (barHeight > 0) {
        ctx.fillRect(x, y, barWidth, barHeight);
      }
      if (value > 0) {
        ctx.fillStyle = '#0b1f4d';
        ctx.textBaseline = 'bottom';
        const valueText = item && item.displayValue !== undefined && item.displayValue !== null
          ? item.displayValue
          : formatChartNumber(value);
        ctx.fillText(valueText, x + barWidth / 2, y - 6);
      }
    });

    ctx.textBaseline = 'top';
    ctx.fillStyle = '#4b5563';
    ctx.fillText(groupKey, groupX + groupWidth / 2, height - padding + 6);
  });

  ctx.restore();
}

function togglePanelHelp(panelId) {
  if (!panelId) {
    return;
  }
  if (state.activeHelpPanel === panelId) {
    closeActiveHelp();
    return;
  }
  const { trigger, popover } = getHelpElements(panelId);
  if (!trigger || !popover) {
    return;
  }
  closeActiveHelp();
  popover.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  state.activeHelpPanel = panelId;
  if (typeof popover.focus === 'function') {
    popover.focus({ preventScroll: true });
  }
}

function handleGlobalHelpDismiss(event) {
  if (!state.activeHelpPanel) {
    return;
  }
  const { trigger, popover } = getHelpElements(state.activeHelpPanel);
  if (trigger && trigger.contains(event.target)) {
    return;
  }
  if (popover && popover.contains(event.target)) {
    return;
  }
  closeActiveHelp();
}

function handleGlobalHelpKeydown(event) {
  if (event.key === 'Escape') {
    closeActiveHelp();
  }
}

function buildHelpContent(panelId, panelElement, config) {
  const heading = config?.heading || panelElement.querySelector('h2')?.textContent || 'Module context';
  const headingId = `panel-help-${panelId}-heading`;
  const dataSources = Array.isArray(config?.dataSources)
    ? config.dataSources
    : config?.dataSources
    ? [config.dataSources]
    : [];
  const actions = Array.isArray(config?.actions)
    ? config.actions
    : config?.actions
    ? [config.actions]
    : [];
  const agents = Array.isArray(config?.agents) ? config.agents : [];

  const dataList = dataSources
    .filter(Boolean)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  const actionList = actions
    .filter(Boolean)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  const agentList = agents
    .map((entry) => {
      if (typeof entry === 'string') {
        return { key: entry, description: '' };
      }
      return { key: entry?.key, description: entry?.description || '' };
    })
    .filter((entry) => entry.key)
    .map((entry) => {
      const label = formatAgentName(entry.key);
      const detail = entry.description ? ` — ${escapeHtml(entry.description)}` : '';
      return `<li><strong>${escapeHtml(label)}</strong>${detail}</li>`;
    })
    .join('');

  const sections = [];
  if (dataList) {
    sections.push(
      `<div class="panel-help-section"><h4>Data sources</h4><ul>${dataList}</ul></div>`
    );
  }
  if (actionList) {
    sections.push(
      `<div class="panel-help-section"><h4>Suggested actions</h4><ul>${actionList}</ul></div>`
    );
  }
  if (agentList) {
    sections.push(
      `<div class="panel-help-section"><h4>Agents</h4><ul>${agentList}</ul></div>`
    );
  }

  const markup = `<div class="panel-help-heading" id="${headingId}">${escapeHtml(heading)}</div>${sections.join('')}`;

  return { headingId, markup };
}

function initializePanelHelp() {
  if (!elements || !PANEL_HELP_CONFIG) {
    return;
  }

  Object.entries(PANEL_HELP_CONFIG).forEach(([panelId, config]) => {
    const panel = document.getElementById(panelId);
    if (!panel) {
      return;
    }
    const infoButton = panel.querySelector(`.panel-info[data-panel="${panelId}"]`);
    const popover = panel.querySelector(`#panel-help-${panelId}`);
    const lastRun = panel.querySelector(`[data-panel-run="${panelId}"]`);

    if (infoButton && popover) {
      const { headingId, markup } = buildHelpContent(panelId, panel, config);
      popover.innerHTML = markup;
      popover.setAttribute('aria-labelledby', headingId);
      popover.setAttribute('tabindex', '-1');
      infoButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        togglePanelHelp(panelId);
      });
      infoButton.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          closeActiveHelp();
        }
      });
      elements.panelHelpButtons.set(panelId, infoButton);
      elements.panelHelpPopovers.set(panelId, popover);
    }

    popover?.addEventListener('click', (event) => event.stopPropagation());

    if (lastRun) {
      elements.panelRunDisplays.set(panelId, lastRun);
    }
  });

  document.addEventListener('click', handleGlobalHelpDismiss);
  document.addEventListener('keydown', handleGlobalHelpKeydown);
  updatePanelLastRun();
}

function getLatestRunForAgents(agentKeys) {
  if (!Array.isArray(agentKeys) || !agentKeys.length) {
    return null;
  }
  let latest = null;
  agentKeys.forEach((agent) => {
    const value = state.moduleLastRun?.[agent];
    if (!value) {
      return;
    }
    const numeric = new Date(value).getTime();
    if (Number.isNaN(numeric)) {
      return;
    }
    if (!latest || numeric > latest.timestamp) {
      latest = { agent, timestamp: numeric, value };
    }
  });
  return latest;
}

function updatePanelLastRun() {
  if (!(elements.panelRunDisplays instanceof Map)) {
    return;
  }
  elements.panelRunDisplays.forEach((element, panelId) => {
    if (!element) {
      return;
    }
    const config = PANEL_HELP_CONFIG[panelId];
    const agents = getPanelAgents(config);
    const latest = getLatestRunForAgents(agents);
    if (latest) {
      const formatted = formatRunTimestamp(latest.value);
      const label = formatAgentName(latest.agent);
      element.textContent = `Last run ${formatted}`;
      element.title = agents.length > 1 ? `Latest: ${label} agent` : `${label} agent`;
    } else if (state.dataMode === 'sample') {
      element.textContent = 'Last run — (sample dataset)';
      element.title = 'Static sample data loaded from disk.';
    } else if (state.dataMode === 'file') {
      element.textContent = 'Last run — (custom data)';
      element.title = 'Data supplied via manual file upload.';
    } else {
      element.textContent = 'Last run —';
      element.title = 'No agent run recorded yet.';
    }
  });
}

function updateModuleLastRunFromStatuses(statuses) {
  if (!Array.isArray(statuses)) {
    return;
  }
  if (!state.moduleLastRun || typeof state.moduleLastRun !== 'object') {
    state.moduleLastRun = {};
  }
  statuses.forEach((status) => {
    if (status?.agent) {
      state.moduleLastRun[status.agent] = status.last_run || null;
    }
  });
}

function formatRunningAgentList(agentIds) {
  if (!Array.isArray(agentIds) || !agentIds.length) {
    return '';
  }
  if (agentIds.length === 1) {
    return formatAgentName(agentIds[0]);
  }
  const labels = agentIds.map((agent) => formatAgentName(agent));
  const tail = labels.pop();
  return `${labels.join(', ')} & ${tail}`;
}

function composeAgentNarrativeSteps() {
  return AGENT_ORDER.flatMap((agent) => {
    const steps = AGENT_WORK_STEPS[agent] || [AGENT_WORK_SUMMARY[agent] || 'Preparing insights.'];
    return steps.map((text) => ({ agent, text }));
  });
}

function renderAgentStepList(stepItems) {
  const stepsEl = elements.agentWorkSteps;
  if (!stepsEl) {
    return;
  }
  stepsEl.innerHTML = stepItems
    .map((item) => {
      const classes = ['agent-step'];
      if (item.status === 'active') {
        classes.push('is-active');
      }
      if (item.status === 'complete') {
        classes.push('is-complete');
      }
      const label = item.label || formatAgentName(item.agent || '');
      return `<li class="${classes.join(' ')}"><span class="agent-step-label">${escapeHtml(label)}</span><span class="agent-step-text">${escapeHtml(item.text)}</span></li>`;
    })
    .join('');
}

function updateAgentProgress(stepItems, { activeFraction = 0 } = {}) {
  const container = elements.agentProgress;
  const bar = elements.agentProgressBar;
  const track = elements.agentProgressTrack;
  const stepLabel = elements.agentProgressStep;
  const percentLabel = elements.agentProgressPercent;
  const activeLabel = elements.agentProgressActive;

  const items = Array.isArray(stepItems) ? stepItems : [];
  if (!container || !bar || !track) {
    return;
  }
  if (!items.length) {
    container.hidden = true;
    container.setAttribute('hidden', 'true');
    track.setAttribute('aria-valuenow', '0');
    bar.style.width = '0%';
    if (percentLabel) {
      percentLabel.textContent = '0%';
    }
    if (stepLabel) {
      stepLabel.textContent = 'Step 0 of 0';
    }
    if (activeLabel) {
      activeLabel.hidden = true;
      activeLabel.textContent = '';
    }
    return;
  }

  const total = items.length;
  const completed = items.filter((item) => item.status === 'complete').length;
  const active = items.find((item) => item.status === 'active');
  const currentStep = active ? Math.min(total, completed + 1) : total;

  let fraction = 0;
  if (total > 0) {
    const cappedFraction = Math.max(0, Math.min(activeFraction, active && currentStep === total ? 0.92 : 0.98));
    fraction = Math.max(0, Math.min(1, (completed + cappedFraction) / total));
  }
  let percent = Math.round(fraction * 100);
  if (!active && completed >= total) {
    percent = 100;
  }

  container.hidden = false;
  container.removeAttribute('hidden');
  bar.style.width = `${percent}%`;
  track.setAttribute('aria-valuenow', String(percent));
  if (container.classList) {
    container.classList.toggle('is-complete', percent >= 100);
  }
  if (percentLabel) {
    percentLabel.textContent = `${percent}%`;
  }
  if (stepLabel) {
    stepLabel.textContent = `Step ${currentStep} of ${total}`;
  }
  if (activeLabel) {
    if (active) {
      activeLabel.hidden = false;
      const agentLabel = formatAgentName(active.agent || '');
      activeLabel.textContent = agentLabel
        ? `${agentLabel}: ${active.text}`
        : active.text || '';
    } else if (completed >= total) {
      activeLabel.hidden = false;
      activeLabel.textContent = 'Finishing touches…';
    } else {
      activeLabel.hidden = true;
      activeLabel.textContent = '';
    }
  }
}

function updateAgentOverlay() {
  const overlay = elements.agentWorkOverlay;
  if (!overlay) {
    return;
  }
  if (state.agentWorkManual && Array.isArray(state.agentWorkManual.steps)) {
    stopAgentProgressTicker();
    state.agentWorkTimeline = [];
    state.agentWorkStepIndex = 0;
    state.agentWorkStepStart = null;
    state.agentWorkTick = 0;
    const manual = state.agentWorkManual;
    overlay.hidden = false;
    if (elements.agentWorkTitle) {
      elements.agentWorkTitle.textContent = manual.title || 'Agents are preparing insights…';
    }
    if (elements.agentWorkDetail) {
      elements.agentWorkDetail.textContent = manual.detail || '';
    }
    renderAgentStepList(manual.steps);
    updateAgentProgress(manual.steps, { activeFraction: 0.95 });
    return;
  }
  const running = state.runningAgents instanceof Set
    ? Array.from(state.runningAgents)
    : Array.isArray(state.runningAgents)
    ? state.runningAgents
    : [];
  if (!running.length) {
    if (state.agentOverlayReleaseTimeout) {
      return;
    }
    stopAgentProgressTicker();
    state.agentWorkTimeline = [];
    state.agentWorkStepIndex = 0;
    state.agentWorkStepStart = null;
    state.agentWorkTick = 0;
    if (state.dataMode === 'sample') {
      renderAgentOverlayPreview();
      return;
    }
    overlay.hidden = true;
    updateAgentProgress([]);
    return;
  }
  overlay.hidden = false;

  const titleEl = elements.agentWorkTitle;
  const detailEl = elements.agentWorkDetail;
  const isSuite = Boolean(state.isRunningAll);
  const runningCopy = formatRunningAgentList(running);

  if (!state.agentWorkTimeline.length) {
    const ordered = orderAgents(running);
    state.agentWorkTimeline = buildAgentTimeline(ordered);
    state.agentWorkStepIndex = 0;
    state.agentWorkStepStart = Date.now();
    state.agentWorkTick = 0;
  }

  if (titleEl) {
    if (isSuite) {
      titleEl.textContent = 'Running full automation suite…';
    } else if (running.length === 1) {
      titleEl.textContent = `${formatAgentName(running[0])} agent is in progress…`;
    } else {
      titleEl.textContent = 'Multiple agents are in progress…';
    }
  }

  if (detailEl) {
    detailEl.textContent = runningCopy ? `Working through ${runningCopy}.` : 'Synthesizing insights…';
  }

  const timeline = state.agentWorkTimeline;
  const totalSteps = timeline.length;
  if (!totalSteps) {
    const fallback = [{ agent: running[0], label: formatAgentName(running[0]), text: 'Synthesizing insights.', status: 'active' }];
    renderAgentStepList(fallback);
    updateAgentProgress(fallback, { activeFraction: 0 });
    return;
  }

  state.agentWorkStepIndex = Math.min(state.agentWorkStepIndex, Math.max(totalSteps - 1, 0));

  let rawTick = Number.isFinite(state.agentWorkTick) ? state.agentWorkTick : 0;
  rawTick = Math.max(0, Math.min(rawTick, totalSteps - 0.01));
  const lastIndex = Math.max(totalSteps - 1, 0);
  const activeIndex = totalSteps ? Math.min(Math.floor(rawTick), lastIndex) : 0;
  const activeFraction = totalSteps ? Math.max(0, Math.min(rawTick - activeIndex, 0.99)) : 0;

  const rendered = timeline.map((entry, index) => {
    let status = 'pending';
    if (index < activeIndex) {
      status = 'complete';
    } else if (index === activeIndex) {
      status = 'active';
    }
    return {
      agent: entry.agent,
      label: entry.label,
      text: entry.text,
      status,
    };
  });
  renderAgentStepList(rendered);
  updateAgentProgress(rendered, { activeFraction });
  ensureAgentProgressTicker(timeline);
}

function clearAgentOverlay() {
  stopAgentProgressTicker();
  state.agentWorkTimeline = [];
  state.agentWorkTick = 0;
  state.agentWorkStart = null;
  state.agentWorkStepIndex = 0;
  state.agentWorkStepStart = null;
  state.agentWorkManual = null;
  const overlay = elements.agentWorkOverlay;
  if (!overlay) {
    return;
  }
  if (state.dataMode === 'sample') {
    renderAgentOverlayPreview();
  } else {
    overlay.hidden = true;
    updateAgentProgress([]);
  }
}

function scheduleAgentOverlayRelease(force = false) {
  if (state.agentOverlayReleaseTimeout) {
    window.clearTimeout(state.agentOverlayReleaseTimeout);
    state.agentOverlayReleaseTimeout = null;
  }
  const start = state.agentWorkStart || Date.now();
  const now = Date.now();
  const elapsed = now - start;
  const wait = force ? 0 : Math.max(0, MIN_AGENT_OVERLAY_MS - elapsed);
  if (wait <= 0) {
    clearAgentOverlay();
    return;
  }
  state.agentOverlayReleaseTimeout = window.setTimeout(() => {
    state.agentOverlayReleaseTimeout = null;
    clearAgentOverlay();
  }, wait);
}

function renderAgentOverlayPreview() {
  stopAgentProgressTicker();
  state.agentWorkTimeline = [];
  state.agentWorkStepIndex = 0;
  state.agentWorkStepStart = null;
  state.agentWorkTick = 0;
  const overlay = elements.agentWorkOverlay;
  const titleEl = elements.agentWorkTitle;
  const detailEl = elements.agentWorkDetail;
  if (!overlay) {
    return;
  }
  overlay.hidden = false;
  if (titleEl) {
    titleEl.textContent = 'Agents coordinate on every run.';
  }
  if (detailEl) {
    detailEl.textContent = 'Connect the automation API to watch live progress in real time.';
  }
  const previewSteps = composeAgentNarrativeSteps().map((entry) => ({
    agent: entry.agent,
    label: formatAgentName(entry.agent),
    text: entry.text,
    status: 'pending',
  }));
  if (previewSteps.length) {
    previewSteps[0].status = 'active';
  }
  renderAgentStepList(previewSteps);
  updateAgentProgress(previewSteps);
}

function startAgentRun(agent, options = {}) {
  if (!(state.runningAgents instanceof Set)) {
    const existing = Array.isArray(state.runningAgents) ? state.runningAgents : [];
    state.runningAgents = new Set(existing);
  }
  if (state.agentOverlayReleaseTimeout) {
    window.clearTimeout(state.agentOverlayReleaseTimeout);
    state.agentOverlayReleaseTimeout = null;
  }
  state.agentWorkManual = null;
  const { suite = false } = options;
  if (suite) {
    state.isRunningAll = true;
    state.runningAgents.clear();
    AGENT_ORDER.forEach((item) => state.runningAgents.add(item));
  } else if (agent) {
    state.runningAgents.add(agent);
  }
  const ordered = orderAgents(state.runningAgents);
  const now = Date.now();
  state.agentWorkStart = now;
  state.agentWorkTimeline = buildAgentTimeline(ordered);
  state.agentWorkStepIndex = 0;
  state.agentWorkStepStart = now;
  state.agentWorkTick = 0;
  stopAgentProgressTicker();
  updateAgentOverlay();
}

function finishAgentRun(agent, options = {}) {
  if (!(state.runningAgents instanceof Set)) {
    const existing = Array.isArray(state.runningAgents) ? state.runningAgents : [];
    state.runningAgents = new Set(existing);
  }
  const { clearAll = false, force = false } = options;
  if (clearAll) {
    state.runningAgents.clear();
    state.isRunningAll = false;
  } else if (agent) {
    state.runningAgents.delete(agent);
    if (state.runningAgents.size === 0) {
      state.isRunningAll = false;
    }
  }
  if (state.runningAgents.size === 0) {
    stopAgentProgressTicker();
    state.agentWorkTimeline = [];
    state.agentWorkStepIndex = 0;
    state.agentWorkStepStart = null;
    state.agentWorkTick = 0;
    const syncLabel = clearAll
      ? 'Automation suite'
      : agent
      ? formatAgentName(agent)
      : 'Automation suite';
    const narrative = composeAgentNarrativeSteps().map((entry) => ({
      agent: entry.agent,
      label: formatAgentName(entry.agent),
      text: entry.text,
      status: 'complete',
    }));
    narrative.push({
      agent: agent || null,
      label: syncLabel,
      text: 'Syncing updates to the dashboard.',
      status: 'active',
    });
    state.agentWorkManual = {
      title: state.isRunningAll || clearAll
        ? 'Automation suite wrapping up…'
        : `${syncLabel} agent wrapping up…`,
      detail: `${syncLabel} results are syncing to the dashboard…`,
      steps: narrative,
    };
    updateAgentOverlay();
    scheduleAgentOverlayRelease(force);
  } else {
    const ordered = orderAgents(state.runningAgents);
    state.agentWorkTimeline = buildAgentTimeline(ordered);
    state.agentWorkStepIndex = 0;
    state.agentWorkStepStart = Date.now();
    state.agentWorkTick = 0;
    stopAgentProgressTicker();
    updateAgentOverlay();
  }
}

function setQuickActionState(button, enabled, enabledTitle, disabledTitle) {
  if (!button) {
    return;
  }
  button.disabled = !enabled;
  if (enabled) {
    button.removeAttribute('aria-disabled');
  } else {
    button.setAttribute('aria-disabled', 'true');
  }
  const title = enabled ? enabledTitle : disabledTitle;
  if (title) {
    button.title = title;
  } else {
    button.removeAttribute('title');
  }
}

function downloadFile(filename, mimeType, content) {
  try {
    const blob = new Blob([content], { type: mimeType });
    downloadBlob(filename, blob);
  } catch (error) {
    console.error('Failed to download file', error);
    notify('Unable to generate the requested download.', 'error');
  }
}

function downloadBlob(filename, blob) {
  try {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  } catch (error) {
    console.error('Failed to download blob', error);
    notify('Unable to download the generated file.', 'error');
  }
}

function escapeCsv(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const string = String(value);
  if (/[",\n]/.test(string)) {
    return `"${string.replace(/"/g, '""')}"`;
  }
  return string;
}

function underpaymentsForActions(payments = state.data?.payments) {
  const underpayments = Array.isArray(payments?.underpayments) ? payments.underpayments : [];
  return underpayments.filter((row) => {
    const variance = Number(row?.variance ?? 0);
    if (Number.isNaN(variance)) {
      return false;
    }
    return variance >= state.varianceMin;
  });
}

function updateOrderingActions(ordering) {
  const reorderButton = elements.orderingActionReorder;
  const exportButton = elements.orderingActionExport;
  const vendorOrders = Array.isArray(ordering?.vendor_reorders) ? ordering.vendor_reorders : [];
  const alerts = Array.isArray(ordering?.compliance_alerts) ? ordering.compliance_alerts : [];

  if (reorderButton) {
    const count = vendorOrders.length;
    const apiReady = state.apiOnline;
    reorderButton.textContent = count
      ? `Reorder ${count} SKU${count > 1 ? 's' : ''}`
      : 'Reorder now';
    setQuickActionState(
      reorderButton,
      count > 0 && apiReady,
      'Push vendor picks into a reorder packet.',
      apiReady
        ? 'Run the ordering agent to generate vendor recommendations.'
        : 'Start the automation API to submit reorders.'
    );
  }

  if (exportButton) {
    const count = alerts.length;
    const apiReady = state.apiOnline;
    exportButton.textContent = count
      ? `Export ${count} alert${count > 1 ? 's' : ''}`
      : 'Export compliance PDF';
    setQuickActionState(
      exportButton,
      count > 0 && apiReady,
      'Generate a printable compliance alert packet.',
      apiReady
        ? 'Run the ordering agent to surface compliance alerts.'
        : 'Start the automation API to export compliance packets.'
    );
  }
}

function updatePaymentsActions(payments) {
  const appealButton = elements.paymentsActionAppeal;
  const exportButton = elements.paymentsActionExport;
  const filtered = underpaymentsForActions(payments);

  if (appealButton) {
    const count = filtered.length;
    appealButton.textContent = count
      ? `Launch appeals triage (${count})`
      : 'Launch appeals triage';
    setQuickActionState(
      appealButton,
      count > 0,
      'Start the appeals workflow for high-variance claims.',
      'Adjust the variance threshold or rerun the payments agent.'
    );
  }

  if (exportButton) {
    const count = filtered.length;
    exportButton.textContent = count
      ? `Export variance CSV (${count})`
      : 'Export variance CSV';
    setQuickActionState(
      exportButton,
      count > 0,
      'Download a CSV of underpayments meeting the current threshold.',
      'Adjust the variance threshold or rerun the payments agent.'
    );
  }
}

async function handleOrderingReorder() {
  const vendorOrders = Array.isArray(state.data?.ordering?.vendor_reorders)
    ? state.data.ordering.vendor_reorders
    : [];
  if (!vendorOrders.length) {
    notify('No vendor recommendations are available yet.', 'info');
    return;
  }
  if (!state.apiOnline) {
    notify('Start the automation API to submit reorders.', 'error');
    return;
  }

  const button = elements.orderingActionReorder;
  setButtonLoading(button, true);
  const created = [];
  try {
    for (const row of vendorOrders) {
      const quantity = Number(row?.suggested_order_qty ?? 0);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        continue;
      }
      const body = {
        patient_id: row.patient_id || `inventory-${String(row.supply_sku || 'sku').toLowerCase()}`,
        supply_sku: row.supply_sku,
        quantity: Math.round(quantity),
        priority: 'urgent',
        delivery_mode: row.delivery_mode || 'warehouse',
        requested_date: isoToday(),
        notes: row.rationale || 'Auto-generated reorder from Command Center.',
      };
      const response = await callApi('/api/portal/orders', {
        method: 'POST',
        body,
      });
      created.push(response);
    }

    if (!created.length) {
      notify('No vendor recommendations contained a valid quantity to submit.', 'info');
      return;
    }

    const summary = created
      .slice(0, 3)
      .map((order) => `${order.supply_sku}×${order.quantity}`)
      .join(', ');

    notify(
      `Submitted ${created.length} reorder${created.length > 1 ? 's' : ''} to the portal.${
        summary ? ` Top picks: ${summary}.` : ''
      }`,
      'success',
    );
    addAgentActivity({
      title: 'Reorder Packet Submitted',
      message: summary || 'Vendor recommendations pushed to the portal.',
      timestamp: new Date().toISOString(),
    });
    state.dataMode = 'live';
    await refreshStatus({ silent: true });
    await loadInventoryForecast({ silent: true });
    document.getElementById('vendor-orders')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) {
    handleApiError(error);
  } finally {
    setButtonLoading(button, false);
  }
}

async function handleOrderingComplianceExport() {
  const alerts = Array.isArray(state.data?.ordering?.compliance_alerts)
    ? state.data.ordering.compliance_alerts
    : [];
  if (!alerts.length) {
    notify('No compliance alerts to export right now.', 'info');
    return;
  }
  if (!state.apiOnline || !state.apiBase) {
    notify('Start the automation API to export compliance packets.', 'error');
    return;
  }

  const button = elements.orderingActionExport;
  setButtonLoading(button, true);
  try {
    const base = state.apiBase.replace(/\/$/, '');
    const response = await fetch(`${base}/api/compliance/report`, {
      method: 'POST',
      headers: {
        Accept: 'application/pdf',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ alerts }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to generate compliance PDF.');
    }
    const blob = await response.blob();
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const filename = `compliance-alerts-${timestamp}.pdf`;
    downloadBlob(filename, blob);
    notify(`Exported ${alerts.length} compliance alert${alerts.length > 1 ? 's' : ''} to PDF.`, 'success');
    addAgentActivity({
      title: 'Compliance Packet Exported',
      message: `${alerts.length} alert${alerts.length > 1 ? 's' : ''} downloaded as ${filename}.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Compliance export failed', error);
    notify(error?.message || 'Failed to export compliance packet.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

function handlePaymentsAppeal() {
  const filtered = underpaymentsForActions();
  if (!filtered.length) {
    notify('No underpayments meet the current threshold.', 'info');
    return;
  }
  const top = filtered
    .slice(0, 3)
    .map((row) => {
      const varianceValue = Number(row?.variance ?? 0);
      const varianceDisplay = Number.isFinite(varianceValue)
        ? usdFormatter.format(varianceValue)
        : String(row?.variance ?? 'n/a');
      return `${row.claim_id || 'Unknown'} (${varianceDisplay})`;
    })
    .join(', ');
  notify(
    `Appeals triage started for ${filtered.length} claim${filtered.length > 1 ? 's' : ''}. ${top ? `Focus: ${top}.` : ''}`,
    'success'
  );
  addAgentActivity({
    title: 'Appeals Triage Initiated',
    message: top || 'Review high-variance claims in the payments panel.',
    timestamp: new Date().toISOString(),
  });
  document.getElementById('underpayments')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function handlePaymentsExport() {
  const filtered = underpaymentsForActions();
  if (!filtered.length) {
    notify('No underpayments to export with the current filters.', 'info');
    return;
  }
  const header = ['Claim', 'Patient', 'Payer', 'Expected', 'Received', 'Variance', 'Status'];
  const rows = filtered.map((row) => [
    row.claim_id,
    row.patient_id,
    row.payer,
    row.expected,
    row.received,
    row.variance,
    row.status,
  ]);
  const csv = [header, ...rows]
    .map((line) => line.map((cell) => escapeCsv(cell)).join(','))
    .join('\n');
  downloadFile('underpayment-variance.csv', 'text/csv', csv);
  notify(`Exported ${filtered.length} underpayment${filtered.length > 1 ? 's' : ''} to CSV.`, 'success');
}

function formatCurrency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return escapeHtml(value ?? '');
  }
  return usdFormatter.format(numeric);
}

function formatCurrencyCompact(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '$0';
  }
  const abs = Math.abs(numeric);
  if (abs >= 1_000_000_000) {
    return `$${(numeric / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `$${(numeric / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1000) {
    return `$${(numeric / 1000).toFixed(1)}k`;
  }
  return usdFormatter.format(numeric);
}

function formatHeadcount(hours, shiftHours) {
  const numericHours = Number(hours);
  const numericShift = Number(shiftHours);
  if (!Number.isFinite(numericHours) || !Number.isFinite(numericShift) || numericShift === 0) {
    return escapeHtml(hours ?? '');
  }
  return decimalFormatter.format(numericHours / numericShift);
}

function formatQuantity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return escapeHtml(value ?? '');
  }
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatHoursLabel(value) {
  if (!Number.isFinite(value)) {
    return '0 hrs';
  }
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return `${(value / 1000).toFixed(1)}k hrs`;
  }
  return `${value.toFixed(1)} hrs`;
}

function updateData(data, message, options = {}) {
  const { merge = false } = options;
  if (merge && state.data) {
    state.data = { ...state.data, ...data };
  } else if (merge) {
    state.data = { ...data };
  } else {
    state.data = data;
    state.inventoryScenarioResult = null;
  }
  if (data?.inventory_forecast) {
    state.inventoryForecast = Object.entries(data.inventory_forecast).map(([sku, details]) => ({
      supply_sku: sku,
      ...(details || {}),
    }));
  }
  if (Array.isArray(data?.tasks)) {
    state.tasks = data.tasks.map((task) => ({ ...task }));
    state.lastTaskIds = new Set(state.tasks.map((task) => task.id));
  } else if (!merge && !data?.tasks && state.dataMode !== 'live') {
    state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
  }
  if (message) {
    setDataStatus(message);
  }
  renderAll();
  renderScenarioSummary();
  refreshCommandInsights({ silent: true });
}

function renderAll() {
  renderOrdering();
  renderInventoryForecast();
  renderPayments();
  renderWorkforce();
  renderEngagement();
  renderPerformance();
  renderTasks();
  renderInsights();
  renderAgentActivity();
  renderChat();
}

function renderInsights() {
  renderTaskInsights();
  renderFinanceInsights();
  renderInventoryInsights();
  renderRevenueMini();
  renderSupplierMini();
  validateInsightHeights();
}

function validateInsightHeights() {
  try {
    const ids = ['react-revenue-mini', 'react-supplier-mini', 'react-task-card', 'react-finance-card', 'react-inventory-card'];
    const nodes = ids.map((id) => document.getElementById(id)).filter(Boolean);
    const report = nodes.map((el) => ({ id: el.id, h: el.offsetHeight }));
    if (typeof console !== 'undefined') {
      console.info('[InsightsHeight]', report);
    }
    // If any automation card is taller than the tallest mini by > 40px, try to collapse extra height.
    const ref = Math.max(
      document.getElementById('react-revenue-mini')?.offsetHeight || 0,
      document.getElementById('react-supplier-mini')?.offsetHeight || 0,
    );
    let adjusted = false;
    ['react-task-card', 'react-finance-card', 'react-inventory-card'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const h = el.offsetHeight;
      if (ref > 0 && h - ref > 40) {
        el.style.height = `${ref}px`; // pin to mini height
        el.style.minHeight = '0';
        el.style.alignItems = 'stretch';
        adjusted = true;
      }
    });
    // Nudge ECharts to recompute layout if we changed sizes
    if (adjusted) {
      window.setTimeout(() => {
        try { window.dispatchEvent(new Event('resize')); } catch (_) {}
      }, 0);
    }
  } catch (e) {
    // no-op
  }
}

function renderTaskInsights() {
  const container = elements.reactTaskCard;
  if (!container) {
    return;
  }
  container.style.height = '380px';
  container.style.minHeight = '0';
  container.style.alignItems = 'stretch';
  const embed = getEmbedApi();
  const insight = getCommandTaskInsights();
  let reactMounted = false;
  if (embed?.renderTaskCard) {
    try {
      embed.renderTaskCard(container, {
        insight,
        loading: Boolean(state.commandLoading),
        error: state.commandError,
      });
      // Verify paint before declaring React mounted
      window.setTimeout(() => {
        try {
          const hasCanvas = !!container.querySelector('canvas');
          const hasArticle = !!container.querySelector('article');
          if (hasCanvas || hasArticle) {
            container.classList.add('react-mounted');
            reactMounted = true;
          } else {
            renderInsightFallback(container, {
              eyebrow: 'Unified queue',
              headline: fallbackHeadline,
              copy: fallbackCopy,
              items: breakdown,
            });
            const canvas = ensureCanvas(container, 'insight-task-canvas');
            if (canvas) {
              const segments = Array.isArray(insight?.dataset)
                ? insight.dataset.map((s, i) => ({
                    label: s.label,
                    value: Number(s.value) || 0,
                    color: s.color || CHART_COLORS[i % CHART_COLORS.length],
                  }))
                : [];
              drawDonutChart(canvas, segments, {
                centerLabel: total > 0 ? total.toLocaleString() : '0',
                centerSubLabel: 'tasks',
              });
            }
          }
        } catch (_) {}
      }, 60);
    } catch (error) {
      console.error('Failed to render React task card', error);
    }
  }

  const total = Number(insight?.total ?? 0);
  const fallbackHeadline = total > 0 ? `${total.toLocaleString()} tasks` : 'No active tasks';
  const fallbackCopy = state.commandError
    || (total > 0
      ? 'Unified queue snapshot available.'
      : 'Run the agents to populate the unified queue.');
  const breakdown = Array.isArray(insight?.dataset)
    ? insight.dataset.map((segment) => {
        const value = Number(segment?.value ?? 0);
        return `<strong>${escapeHtml(segment?.label || '')}:</strong> ${value.toLocaleString()} tasks`;
      })
    : [];
  if (insight?.slaBreaches) {
    breakdown.unshift(`<strong>SLA breaches:</strong> ${Number(insight.slaBreaches).toLocaleString()}`);
  }
  if (!reactMounted) {
    container.classList.remove('react-mounted');
    renderInsightFallback(container, {
      eyebrow: 'Unified queue',
      headline: fallbackHeadline,
      copy: fallbackCopy,
      items: breakdown,
    });
    const canvas = ensureCanvas(container, 'insight-task-canvas');
    if (canvas) {
      try {
        const segments = Array.isArray(insight?.dataset)
          ? insight.dataset.map((s, i) => ({
              label: s.label,
              value: Number(s.value) || 0,
              color: s.color || CHART_COLORS[i % CHART_COLORS.length],
            }))
          : [];
        drawDonutChart(canvas, segments, {
          centerLabel: total > 0 ? total.toLocaleString() : '0',
          centerSubLabel: 'tasks',
        });
      } catch (_) {}
    }
  }
}

function renderFinanceInsights() {
  const container = elements.reactFinanceCard;
  if (!container) {
    return;
  }
  container.style.height = '380px';
  container.style.minHeight = '0';
  container.style.alignItems = 'stretch';
  const embed = getEmbedApi();
  const insight = getCommandFinanceInsights();
  let reactMounted = false;
  if (embed?.renderFinanceCard) {
    try {
      embed.renderFinanceCard(container, {
        insight,
        loading: Boolean(state.commandLoading),
        error: state.commandError,
      });
      // Verify paint before declaring React mounted
      window.setTimeout(() => {
        try {
          const hasArticle = !!container.querySelector('article');
          if (hasArticle) {
            container.classList.add('react-mounted');
            reactMounted = true;
          } else {
            renderInsightFallback(container, {
              eyebrow: 'Finance pulse',
              headline,
              copy,
              items: metrics,
            });
            const canvas = ensureCanvas(container, 'insight-finance-canvas');
            if (canvas) {
              const bars = Array.isArray(insight?.dataset)
                ? insight.dataset.map((s, i) => ({
                    label: s.label,
                    value: Number(s.value) || 0,
                    color: s.color || CHART_COLORS[i % CHART_COLORS.length],
                    displayValue: s.displayValue,
                  }))
                : [];
              drawHorizontalBarChart(canvas, bars, { paddingTop: 18, paddingBottom: 24 });
            }
          }
        } catch (_) {}
      }, 60);
    } catch (error) {
      console.error('Failed to render React finance card', error);
    }
  }

  if (!reactMounted) {
    container.classList.remove('react-mounted');
  }
  const baseline = insight?.meta?.baselineDso ?? FINANCE_DSO_BASELINE;
  const snapshot = insight?.meta?.snapshotDate || null;
  const segmentTotal = Array.isArray(insight?.dataset)
    ? insight.dataset.reduce((acc, segment) => acc + Number(segment?.value ?? 0), 0)
    : 0;
  const headline = segmentTotal > 0 ? `Savings snapshot (${formatChartNumber(segmentTotal)})` : 'No measurable impact yet';
  const copy = state.commandError
    || (snapshot
      ? `As of ${new Date(snapshot).toLocaleDateString()} • DSO baseline ${baseline} days.`
      : `DSO baseline ${baseline} days.`);
  const metrics = Array.isArray(insight?.dataset)
    ? insight.dataset.map((segment) => {
        const value = Number(segment?.value ?? 0);
        const label = segment?.displayValue || formatChartNumber(value);
        return `<strong>${escapeHtml(segment?.label || '')}:</strong> ${escapeHtml(String(label))}`;
      })
    : [];
  if (!reactMounted) {
    renderInsightFallback(container, {
      eyebrow: 'Finance pulse',
      headline,
      copy,
      items: metrics,
    });
    const canvas = ensureCanvas(container, 'insight-finance-canvas');
    if (canvas) {
      try {
        const bars = Array.isArray(insight?.dataset)
          ? insight.dataset.map((s, i) => ({
              label: s.label,
              value: Number(s.value) || 0,
              color: s.color || CHART_COLORS[i % CHART_COLORS.length],
              displayValue: s.displayValue,
            }))
          : [];
        drawHorizontalBarChart(canvas, bars, { paddingTop: 18, paddingBottom: 24 });
      } catch (_) {}
    }
  }
}

function renderInventoryInsights() {
  const container = elements.reactInventoryCard;
  if (!container) {
    return;
  }
  container.style.height = '380px';
  container.style.minHeight = '0';
  container.style.alignItems = 'stretch';
  const scenario = state.inventoryScenarioResult;
  const baseInsight = scenario ? buildScenarioInventoryInsight(scenario) : getCommandInventoryInsights();
  const embed = getEmbedApi();
  let reactMounted = false;
  if (embed?.renderInventoryCard) {
    try {
      embed.renderInventoryCard(container, {
        insight: baseInsight,
        loading: Boolean(state.commandLoading),
        error: state.commandError,
      });
      // Verify paint before declaring React mounted
      window.setTimeout(() => {
        try {
          const hasArticle = !!container.querySelector('article');
          if (hasArticle) {
            container.classList.add('react-mounted');
            reactMounted = true;
          } else {
            renderInsightFallback(container, {
              eyebrow: 'Inventory actions',
              headline,
              copy,
              items: metrics,
            });
            const canvas = ensureCanvas(container, 'insight-inventory-canvas');
            if (canvas) {
              const bars = Array.isArray(baseInsight?.dataset)
                ? baseInsight.dataset.map((s, i) => ({
                    label: s.label,
                    value: Number(s.value) || 0,
                    color: s.color || CHART_COLORS[i % CHART_COLORS.length],
                  }))
                : [];
              drawBarChart(canvas, bars, { padding: 28 });
            }
          }
        } catch (_) {}
      }, 60);
    } catch (error) {
      console.error('Failed to render React inventory card', error);
    }
  }
  // Only show the non-React fallback when React failed to mount
  if (!reactMounted) {
    container.classList.remove('react-mounted');
  }
  const totalSkus = Number(baseInsight?.totalSkus ?? 0);
  const headline = totalSkus > 0 ? 'Prioritized SKU guidance' : 'Inventory steady';
  const copy = state.commandError
    || (scenario
      ? 'Scenario projections ready.'
      : totalSkus > 0
        ? `Tracking ${totalSkus.toLocaleString()} SKU${totalSkus === 1 ? '' : 's'} across the forecast.`
        : 'No active recommendations. Run the ordering agent to refresh.');
  const metrics = Array.isArray(baseInsight?.dataset)
    ? baseInsight.dataset.map((segment) => {
        const value = Number(segment?.value ?? 0);
        return `<strong>${escapeHtml(segment?.label || '')}:</strong> ${value.toLocaleString()} SKUs`;
      })
    : [];
  if (!reactMounted) {
    // Ensure fallback is visible only when React isn't mounted
    container.classList.remove('react-mounted');
    renderInsightFallback(container, {
      eyebrow: 'Inventory actions',
      headline,
      copy,
      items: metrics,
    });
    const canvas = ensureCanvas(container, 'insight-inventory-canvas');
    if (canvas) {
      try {
        const bars = Array.isArray(baseInsight?.dataset)
          ? baseInsight.dataset.map((s, i) => ({
              label: s.label,
              value: Number(s.value) || 0,
              color: s.color || CHART_COLORS[i % CHART_COLORS.length],
            }))
          : [];
        drawBarChart(canvas, bars, { padding: 28 });
      } catch (_) {}
    }
  }
}

function computeInventoryActionCounts(entries) {
  if (!Array.isArray(entries)) {
    entries = Object.values(entries || {});
  }
  return entries.reduce((acc, entry) => {
    const key = String(entry?.action || 'buffer_ok').toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildInventoryDataset(counts, { prefix } = {}) {
  const actions = ['reorder', 'watch', 'buffer_ok'];
  const dataset = actions.map((action, index) => ({
    key: action,
    label: `${prefix ? `${prefix} ` : ''}${action === 'buffer_ok' ? 'Buffer OK' : action.charAt(0).toUpperCase() + action.slice(1)}`,
    value: counts[action] || 0,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));
  const miscKeys = Object.keys(counts || {}).filter((key) => !actions.includes(key));
  if (miscKeys.length) {
    const miscTotal = miscKeys.reduce((sum, key) => sum + (counts[key] || 0), 0);
    dataset.push({
      key: 'other',
      label: `${prefix ? `${prefix} ` : ''}Other`,
      value: miscTotal,
      color: CHART_ALT_COLORS[3],
    });
  }
  return dataset;
}

function buildScenarioInventoryInsight(scenario) {
  const scenarioEntries = Object.entries(scenario.scenario || {}).map(([sku, detail]) => ({
    supply_sku: sku,
    ...(detail || {}),
  }));
  const counts = computeInventoryActionCounts(scenarioEntries);
  const dataset = buildInventoryDataset(counts);
  return {
    dataset,
    totalSkus: scenarioEntries.length,
    scenarioAvailable: true,
  };
}

function renderScenarioSummary() {
  if (!elements.scenarioSummary) {
    return;
  }
  const scenario = state.inventoryScenarioResult;
  const hasScenario = Boolean(scenario);
  if (elements.scenarioCsv) {
    elements.scenarioCsv.disabled = !hasScenario;
    if (hasScenario) {
      elements.scenarioCsv.removeAttribute('aria-disabled');
    } else {
      elements.scenarioCsv.setAttribute('aria-disabled', 'true');
    }
  }
  if (elements.scenarioPdf) {
    elements.scenarioPdf.disabled = !hasScenario;
    if (hasScenario) {
      elements.scenarioPdf.removeAttribute('aria-disabled');
    } else {
      elements.scenarioPdf.setAttribute('aria-disabled', 'true');
    }
  }
  if (!scenario) {
    elements.scenarioSummary.classList.add('empty-state');
    elements.scenarioSummary.innerHTML = 'Run a scenario to compare baseline vs. simulated inventory actions.';
    return;
  }
  elements.scenarioSummary.classList.remove('empty-state');
  const growth = Number(scenario.growth_percent ?? state.inventoryScenarioInputs.growthPercent ?? 0);
  const lead = Number(scenario.lead_time_delta ?? state.inventoryScenarioInputs.leadTimeDelta ?? 0);
  const applied = Number(scenario.lead_time_applied ?? INVENTORY_BASE_LEAD_TIME + lead);
  const skuCount = Array.isArray(scenario.skus) ? scenario.skus.length : 0;
  const timestamp = scenario.generated_at ? formatRunTimestamp(scenario.generated_at) : '—';
  const deltaEntries = Object.entries(scenario.deltas || {}).map(([sku, detail]) => ({
    sku,
    forecastDelta: parseNumericValue(detail?.forecast_units),
    bufferDelta: parseNumericValue(detail?.recommended_buffer),
  }));
  deltaEntries.sort((a, b) => Math.abs(b.forecastDelta) - Math.abs(a.forecastDelta));
  const top = deltaEntries.slice(0, 3);
  const skuLine = skuCount ? `${skuCount} SKU${skuCount === 1 ? '' : 's'} in focus.` : 'All SKUs considered.';
  const leadLine = lead === 0 ? `Lead time remains ${applied} days.` : `Lead time adjusted ${lead >= 0 ? '+' : ''}${lead} days (to ${applied} days).`;
  const summaryHeader = `Scenario generated ${timestamp}. Demand growth ${growth}%. ${leadLine} ${skuLine}`;
  if (!top.length) {
    elements.scenarioSummary.innerHTML = `<p>${escapeHtml(summaryHeader)}</p><p>No SKU-level deltas vs. baseline.</p>`;
    return;
  }
  const listItems = top
    .map((entry) => {
      const forecastLabel = entry.forecastDelta === 0 ? 'no change' : `${entry.forecastDelta > 0 ? '+' : ''}${entry.forecastDelta.toFixed(1)} units`;
      const bufferLabel = entry.bufferDelta === 0 ? 'buffer steady' : `buffer ${entry.bufferDelta > 0 ? '+' : ''}${entry.bufferDelta.toFixed(1)}`;
      return `<li><strong>${escapeHtml(entry.sku)}</strong> → ${forecastLabel}, ${bufferLabel}</li>`;
    })
    .join('');
  elements.scenarioSummary.innerHTML = `<p>${escapeHtml(summaryHeader)}</p><ul>${listItems}</ul>`;
}

function collectScenarioSkus(input) {
  if (!input) {
    return [];
  }
  return input
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function syncScenarioInputsFromState() {
  if (elements.scenarioGrowth) {
    elements.scenarioGrowth.value = state.inventoryScenarioInputs.growthPercent;
  }
  if (elements.scenarioLead) {
    elements.scenarioLead.value = state.inventoryScenarioInputs.leadTimeDelta;
  }
  if (elements.scenarioSkus) {
    elements.scenarioSkus.value = state.inventoryScenarioInputs.skus;
  }
}

async function handleInventoryScenarioSubmit(event) {
  event.preventDefault();
  if (!state.apiOnline) {
    notify('Start the automation API to run scenarios.', 'error');
    return;
  }
  const growth = Number(elements.scenarioGrowth?.value ?? state.inventoryScenarioInputs.growthPercent);
  const lead = Number(elements.scenarioLead?.value ?? state.inventoryScenarioInputs.leadTimeDelta);
  const skusText = elements.scenarioSkus?.value ?? state.inventoryScenarioInputs.skus;
  state.inventoryScenarioInputs = {
    growthPercent: Number.isFinite(growth) ? growth : 0,
    leadTimeDelta: Number.isFinite(lead) ? lead : 0,
    skus: skusText || '',
  };
  syncScenarioInputsFromState();
  const skus = collectScenarioSkus(skusText);
  await runInventoryScenario({
    growthPercent: state.inventoryScenarioInputs.growthPercent,
    leadTimeDelta: state.inventoryScenarioInputs.leadTimeDelta,
    skus,
  });
}

function handleInventoryScenarioReset() {
  state.inventoryScenarioInputs = {
    growthPercent: 0,
    leadTimeDelta: 0,
    skus: '',
  };
  state.inventoryScenarioResult = null;
  if (state.moduleLastRun && typeof state.moduleLastRun === 'object') {
    delete state.moduleLastRun.inventory_scenario;
  }
  syncScenarioInputsFromState();
  renderScenarioSummary();
  renderInventoryInsights();
  updatePanelLastRun();
}

async function runInventoryScenario({ growthPercent, leadTimeDelta, skus }) {
  if (!elements.scenarioRun) {
    return;
  }
  const button = elements.scenarioRun;
  setButtonLoading(button, true);
  try {
    const payload = {
      growth_percent: Number.isFinite(growthPercent) ? growthPercent : 0,
      lead_time_delta: Number.isFinite(leadTimeDelta) ? leadTimeDelta : 0,
    };
    if (Array.isArray(skus) && skus.length) {
      payload.skus = skus;
    }
    const scenario = await callApi('/api/inventory/scenario', {
      method: 'POST',
      body: payload,
    });
    state.inventoryScenarioResult = scenario;
    state.moduleLastRun = state.moduleLastRun || {};
    state.moduleLastRun.inventory_scenario = scenario.generated_at || new Date().toISOString();
    renderScenarioSummary();
    renderInventoryInsights();
    updatePanelLastRun();
    notify('Inventory scenario ready. Charts updated.', 'success');
  } catch (error) {
    handleApiError(error);
  } finally {
    setButtonLoading(button, false);
  }
}

function renderOrdering() {
  const ordering = state.data?.ordering;
  updateOrderingActions(ordering);
  if (!ordering) {
    if (elements.workOrdersBody) {
      elements.workOrdersBody.innerHTML = '<tr><td colspan="6">Run the ordering agent to populate this table.</td></tr>';
    }
    if (elements.vendorOrdersBody) {
      elements.vendorOrdersBody.innerHTML = '<tr><td colspan="3">Vendor suggestions will appear once the agent runs.</td></tr>';
    }
    if (elements.complianceAlerts) {
      elements.complianceAlerts.innerHTML = '';
    }
    renderInventoryForecast();
    return;
  }

  const workOrders = Array.isArray(ordering.patient_work_orders) ? ordering.patient_work_orders : [];
  const vendorOrders = Array.isArray(ordering.vendor_reorders) ? ordering.vendor_reorders : [];
  const alerts = Array.isArray(ordering.compliance_alerts) ? ordering.compliance_alerts : [];

  const filtered = workOrders.filter((row) => {
    if (state.complianceFilter === 'all') {
      return true;
    }
    return row.compliance_status === state.complianceFilter;
  });

  if (elements.workOrdersBody) {
    elements.workOrdersBody.innerHTML = filtered.length
      ? filtered
          .map(
            (row) => `
        <tr>
          <td>${escapeHtml(row.patient_id)}</td>
          <td>${escapeHtml(row.supply_sku)}</td>
          <td>${escapeHtml(row.required_date)}</td>
          <td>${escapeHtml(row.quantity)}</td>
          <td><span class="badge ${badgeClass(row.compliance_status)}">${escapeHtml(row.compliance_status)}</span></td>
          <td>${escapeHtml(row.notes || '')}</td>
        </tr>
      `,
          )
          .join('')
      : `<tr><td colspan="6">${workOrders.length ? 'No work orders match the selected filter.' : 'No work orders generated yet.'}</td></tr>`;
  }

  if (elements.vendorOrdersBody) {
    elements.vendorOrdersBody.innerHTML = vendorOrders.length
      ? vendorOrders
          .map(
            (row) => `
        <tr>
          <td>${escapeHtml(row.supply_sku)}</td>
          <td>${escapeHtml(row.suggested_order_qty)}</td>
          <td>${escapeHtml(row.rationale)}</td>
        </tr>
      `,
          )
          .join('')
      : '<tr><td colspan="3">No vendor recommendations at this time.</td></tr>';
  }

  if (elements.complianceAlerts) {
    elements.complianceAlerts.innerHTML = alerts.length
      ? alerts
          .map(
            (alert) => `
          <div class="alert-item">
            <strong>${escapeHtml(alert.severity || 'info').toUpperCase()}</strong> — ${escapeHtml(alert.message)}
            ${alert.metadata?.notes ? `<div>${escapeHtml(alert.metadata.notes)}</div>` : ''}
          </div>
        `,
          )
          .join('')
      : '<div class="alert-item neutral">No compliance alerts.</div>';
  }

  renderInventoryForecast();
  updateOrderingActions(ordering);
}

function renderInventoryForecast() {
  if (!elements.inventoryForecastBody) {
    return;
  }
  const source = state.inventoryForecast;
  const entries = Array.isArray(source)
    ? source
    : Object.entries(source || {}).map(([sku, details]) => ({ supply_sku: sku, ...(details || {}) }));
  if (!entries.length) {
    elements.inventoryForecastBody.innerHTML = '<tr><td colspan="5">Run the ordering agent to generate a fresh forecast.</td></tr>';
    return;
  }
  elements.inventoryForecastBody.innerHTML = entries
    .map((row) => {
      const actionClass = inventoryActionClass(row.action);
      const actionLabel = String(row.action || 'watch').replace(/_/g, ' ');
      return `
        <tr>
          <td>${escapeHtml(row.supply_sku || '')}</td>
          <td>${formatQuantity(row.on_hand)}</td>
          <td>${formatQuantity(row.forecast_units)}</td>
          <td>${formatQuantity(row.recommended_buffer)}</td>
          <td><span class="${actionClass}">${escapeHtml(actionLabel)}</span></td>
        </tr>
      `;
    })
    .join('');
}

function renderAgentActivity() {
  if (!elements.agentActivity) {
    return;
  }
  if (!state.agentActivity.length) {
    elements.agentActivity.innerHTML = '<li>No runs yet. Trigger an agent to see a summary.</li>';
    return;
  }
  elements.agentActivity.innerHTML = state.agentActivity
    .map((entry) => {
      const time = formatRunTimestamp(entry.timestamp);
      return `
        <li>
          <strong>${escapeHtml(entry.title)}</strong>
          <span>${escapeHtml(entry.message)}</span>
          <time>${escapeHtml(time)}</time>
        </li>
      `;
    })
    .join('');
}

function buildChatContext() {
  return {
    data: state.data || {},
    inventory_forecast: state.inventoryForecast || [],
    tasks: Array.isArray(state.tasks) ? state.tasks : [],
    agent_activity: Array.isArray(state.agentActivity) ? state.agentActivity : [],
    metadata: {
      data_mode: state.dataMode,
      active_tab: state.activeTab,
      selected_metric: state.selectedMetric,
      module_last_run: state.moduleLastRun,
      api_online: state.apiOnline,
    },
  };
}

function formatChatContent(text) {
  if (text === null || text === undefined) {
    return '';
  }
  return escapeHtml(String(text)).replace(/\n/g, '<br />');
}

function setChatControlsDisabled(disabled) {
  if (elements.chatSend) {
    elements.chatSend.disabled = disabled;
    elements.chatSend.classList.toggle('is-loading', disabled);
  }
  if (elements.chatReset) {
    elements.chatReset.disabled = disabled;
  }
  if (elements.chatInput) {
    elements.chatInput.disabled = false;
  }
}

function summarizeTopItems(items, limit = 3, formatter = (item) => String(item)) {
  if (!Array.isArray(items) || !items.length) {
    return [];
  }
  return items.slice(0, limit).map(formatter);
}

function buildLocalDashboardAnswer(question) {
  const sections = [];
  const addSection = (title, lines) => {
    const filtered = (lines || []).filter(Boolean);
    if (!filtered.length) {
      return;
    }
    sections.push(`${title}\n${filtered.join('\n')}`);
  };

  const data = state.data || {};
  const tasksSource = Array.isArray(state.tasks) && state.tasks.length
    ? state.tasks
    : Array.isArray(data.tasks) ? data.tasks : [];
  if (tasksSource.length) {
    const counts = tasksSource.reduce(
      (acc, task) => {
        const status = String(task.status || '').toLowerCase();
        if (status === 'closed') {
          acc.closed += 1;
        } else if (status === 'in_progress') {
          acc.progress += 1;
        } else {
          acc.open += 1;
        }
        if (String(task.priority || '').toLowerCase() === 'high') {
          acc.high += 1;
        }
        return acc;
      },
      { open: 0, progress: 0, closed: 0, high: 0 },
    );
    const lines = [
      `${tasksSource.length} tasks tracked — open ${counts.open}, in-progress ${counts.progress}, closed ${counts.closed}, high priority ${counts.high}.`,
    ];
    const spotlight = summarizeTopItems(tasksSource, 3, (task) => {
      const status = String(task.status || 'status').toLowerCase();
      const due = task.due_at ? new Date(task.due_at).toLocaleString() : 'no due date';
      return `• ${task.id || task.title || 'Task'} (${status}) — due ${due}`;
    });
    lines.push(...spotlight);
    addSection('Tasks', lines);
  }

  const ordering = data.ordering || {};
  const orderingLines = [];
  const workOrders = Array.isArray(ordering.patient_work_orders) ? ordering.patient_work_orders : [];
  if (workOrders.length) {
    orderingLines.push(`${workOrders.length} patient work orders in queue.`);
    orderingLines.push(...summarizeTopItems(workOrders, 3, (row) => {
      const sku = row.supply_sku || 'SKU';
      const qty = row.quantity ?? '—';
      const patient = row.patient_id || 'Patient';
      const status = row.compliance_status || 'status unknown';
      return `• ${patient} / ${sku} — qty ${qty}, compliance ${status}`;
    }));
  }
  const complianceAlerts = Array.isArray(ordering.compliance_alerts) ? ordering.compliance_alerts : [];
  if (complianceAlerts.length) {
    orderingLines.push(`${complianceAlerts.length} compliance alerts raised.`);
  }
  addSection('Ordering', orderingLines);

  const inventory = Array.isArray(state.inventoryForecast)
    ? state.inventoryForecast
    : Array.isArray(data.inventory_forecast)
    ? data.inventory_forecast
    : [];
  if (inventory && Object.keys(inventory).length) {
    const entries = Array.isArray(inventory) ? inventory : Object.values(inventory || {});
    if (entries.length) {
      const counts = entries.reduce((acc, entry) => {
        const action = String(entry?.action || 'watch').toLowerCase();
        acc[action] = (acc[action] || 0) + 1;
        return acc;
      }, {});
      const summary = Object.entries(counts)
        .map(([action, count]) => `${action.replace('_', ' ')} ${count}`)
        .join(', ');
      const lines = [`Inventory actions: ${summary}.`];
      lines.push(...summarizeTopItems(entries, 3, (entry) => {
        const sku = entry.supply_sku || entry.sku || 'SKU';
        const action = String(entry.action || 'watch').replace(/_/g, ' ');
        const onHand = entry.on_hand ?? '—';
        const forecast = entry.forecast_units ?? entry.forecast ?? '—';
        return `• ${sku}: ${action} (on hand ${onHand}, forecast ${forecast})`;
      }));
      addSection('Inventory', lines);
    }
  }

  const payments = data.payments || {};
  const paymentsLines = [];
  const underpayments = Array.isArray(payments.underpayments) ? payments.underpayments : [];
  if (underpayments.length) {
    paymentsLines.push(`${underpayments.length} underpayments flagged.`);
    paymentsLines.push(...summarizeTopItems(underpayments, 3, (row) => {
      const claim = row.claim_id || 'Claim';
      const payer = row.payer || 'payer';
      const variance = row.variance || row.amount || 'variance';
      return `• ${claim} (${payer}) variance ${variance}`;
    }));
  }
  const documentation = Array.isArray(payments.documentation_queue) ? payments.documentation_queue : [];
  if (documentation.length) {
    paymentsLines.push(`${documentation.length} documentation tasks outstanding.`);
  }
  addSection('Payments', paymentsLines);

  const workforce = data.workforce || {};
  const workforceLines = [];
  const staffingPlan = Array.isArray(workforce.staffing_plan) ? workforce.staffing_plan : [];
  if (staffingPlan.length) {
    workforceLines.push(`${staffingPlan.length} staffing plan entries modeled.`);
    workforceLines.push(...summarizeTopItems(staffingPlan, 3, (row) => {
      return `• ${row.team || 'Team'} week ${row.week_start || '—'}: ${row.hours_needed || '—'} hrs needed (headcount ${row.recommended_headcount || '—'})`;
    }));
  }
  const surgeAlerts = Array.isArray(workforce.surge_alerts) ? workforce.surge_alerts : [];
  if (surgeAlerts.length) {
    workforceLines.push(`${surgeAlerts.length} surge alerts projected.`);
  }
  addSection('Workforce', workforceLines);

  const engagement = data.engagement || {};
  const engagementLines = [];
  const patientMsgs = Array.isArray(engagement.patient_messages) ? engagement.patient_messages : [];
  if (patientMsgs.length) {
    engagementLines.push(`${patientMsgs.length} patient messages queued.`);
  }
  const caseMsgs = Array.isArray(engagement.case_manager_messages) ? engagement.case_manager_messages : [];
  if (caseMsgs.length) {
    engagementLines.push(`${caseMsgs.length} case manager escalations drafted.`);
  }
  addSection('Engagement', engagementLines);

  const performance = data.performance || {};
  const performanceLines = [];
  const latestPerformance = Array.isArray(performance.latest_snapshot) ? performance.latest_snapshot[0] : performance.latest_snapshot;
  if (latestPerformance && typeof latestPerformance === 'object') {
    const metrics = [];
    ['denial_rate', 'first_pass_rate', 'dso', 'delivery_sla', 'resupply_cadence'].forEach((key) => {
      if (latestPerformance[key] !== undefined && latestPerformance[key] !== null && latestPerformance[key] !== '') {
        metrics.push(`${formatMetricName(key)} ${latestPerformance[key]}`);
      }
    });
    if (metrics.length) {
      performanceLines.push(`Latest performance snapshot: ${metrics.join(', ')}.`);
    }
  }
  addSection('Performance', performanceLines);

  const finance = data.finance || {};
  const financeLines = [];
  const financeSnapshot = Array.isArray(finance.latest_snapshot) ? finance.latest_snapshot[0] : finance.latest_snapshot;
  if (financeSnapshot) {
    if (financeSnapshot.projected_cash_recovered) {
      financeLines.push(`Projected cash recovered ${financeSnapshot.projected_cash_recovered}.`);
    }
    if (financeSnapshot.labor_minutes_saved) {
      financeLines.push(`Labor minutes saved ${financeSnapshot.labor_minutes_saved}.`);
    }
    if (financeSnapshot.dso) {
      financeLines.push(`DSO ${financeSnapshot.dso}.`);
    }
  }
  addSection('Finance', financeLines);

  const activityLines = [];
  if (Array.isArray(state.agentActivity) && state.agentActivity.length) {
    activityLines.push(`${state.agentActivity.length} recent agent activities logged.`);
    activityLines.push(...summarizeTopItems(state.agentActivity, 3, (entry) => {
      return `• ${entry.title || 'Agent run'} — ${entry.message || ''}`;
    }));
  }
  addSection('Agent Activity', activityLines);

  const contextPieces = [];
  if (state.dataMode) {
    contextPieces.push(`Data mode: ${state.dataMode}.`);
  }
  if (state.apiOnline === false) {
    contextPieces.push('Backend API currently offline; using cached data.');
  }
  addSection('Context', contextPieces);

  const introLines = ['LLM service is offline, generating a direct summary from dashboard data.'];
  if (question) {
    introLines.push(`Prompt: ${question}`);
  }

  return [introLines.join(' '), '', ...sections].filter(Boolean).join('\n');
}

function autosizeChatInput() {
  if (!elements.chatInput) {
    return;
  }
  const input = elements.chatInput;
  input.style.height = 'auto';
  const maxHeight = 160;
  input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`;
}

function pruneChatHistory(limit = 40) {
  if (!Array.isArray(state.chatMessages)) {
    return;
  }
  if (state.chatMessages.length > limit) {
    state.chatMessages = state.chatMessages.slice(-limit);
  }
}

function renderChat() {
  if (!elements.chatLog) {
    return;
  }

  elements.chatLog.innerHTML = '';
  const messages = Array.isArray(state.chatMessages) ? state.chatMessages : [];

  if (!messages.length && !state.chatLoading) {
    const placeholder = document.createElement('div');
    placeholder.className = 'chat-placeholder';
    placeholder.textContent = 'Ask for summaries, blockers, or recommended actions.';
    elements.chatLog.appendChild(placeholder);
  } else {
    messages.forEach((message) => {
      const wrapper = document.createElement('div');
      wrapper.className = `chat-message chat-${message.role || 'assistant'}`;
      if (message.error) {
        wrapper.classList.add('is-error');
      }
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble';
      bubble.innerHTML = formatChatContent(message.content || '');
      wrapper.appendChild(bubble);
      elements.chatLog.appendChild(wrapper);
    });

    if (state.chatLoading) {
      const pending = document.createElement('div');
      pending.className = 'chat-message chat-assistant is-pending';
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble';
      bubble.innerHTML = '<span class="typing-indicator"><span></span><span></span><span></span></span>';
      pending.appendChild(bubble);
      elements.chatLog.appendChild(pending);
    }
  }

  elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
  setChatControlsDisabled(state.chatLoading);

  if (elements.chatStatus) {
    elements.chatStatus.classList.remove('pill-error');
    if (state.chatLoading) {
      elements.chatStatus.textContent = 'Thinking…';
    } else if (state.chatError) {
      elements.chatStatus.textContent = 'Error';
      elements.chatStatus.classList.add('pill-error');
    } else {
      elements.chatStatus.textContent = 'Ready';
    }
  }
}

async function sendChatMessage(prompt) {
  if (!prompt || state.chatLoading) {
    return;
  }
  const trimmed = prompt.trim();
  if (!trimmed) {
    return;
  }

  const userMessage = { role: 'user', content: trimmed };
  state.chatMessages = [...(state.chatMessages || []), userMessage];
  state.chatError = null;
  pruneChatHistory();

  if (elements.chatInput) {
    elements.chatInput.value = '';
    autosizeChatInput();
  }

  state.chatLoading = true;
  renderChat();

  const history = state.chatMessages
    .slice(-CHAT_HISTORY_LIMIT)
    .map((message) => ({ role: message.role || 'assistant', content: message.content || '' }));

  try {
    const payload = {
      messages: history,
      context: buildChatContext(),
    };
    const response = await callApi('/api/dashboard/ask', {
      method: 'POST',
      body: payload,
      silent: true,
    });
    const assistant = response?.message;
    if (assistant?.content) {
      const messageRole = assistant.role && assistant.role !== 'system' ? assistant.role : 'assistant';
      state.chatMessages = [
        ...state.chatMessages,
        { role: messageRole, content: assistant.content },
      ];
      state.chatModel = response?.model || state.chatModel;
      state.chatError = null;
      pruneChatHistory();
    } else {
      const fallback = 'The assistant did not return a response.';
      state.chatMessages = [
        ...state.chatMessages,
        { role: 'assistant', content: fallback, error: true },
      ];
      state.chatError = fallback;
      pruneChatHistory();
    }
  } catch (error) {
    const detail = error?.message || 'Unable to reach Ask the Dashboard right now.';
    if (/Unable to reach API/.test(detail)) {
      const fallback = buildLocalDashboardAnswer(trimmed);
      state.chatMessages = [
        ...state.chatMessages,
        { role: 'assistant', content: fallback },
      ];
      state.chatModel = 'local-offline';
      state.chatError = null;
      pruneChatHistory();
      notify('Backend offline. Responding with local dashboard summary.', 'info');
    } else {
      state.chatMessages = [
        ...state.chatMessages,
        { role: 'assistant', content: detail, error: true },
      ];
      state.chatError = detail;
      pruneChatHistory();
      notify(detail, 'error');
    }
  } finally {
    state.chatLoading = false;
    renderChat();
    elements.chatInput?.focus();
  }
}

async function handleChatSubmit(event) {
  event.preventDefault();
  if (!elements.chatInput) {
    return;
  }
  const value = elements.chatInput.value.trim();
  if (!value || state.chatLoading) {
    return;
  }
  await sendChatMessage(value);
}

function handleChatKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    const target = event.target;
    if (target?.value?.trim() && !state.chatLoading) {
      event.preventDefault();
      sendChatMessage(target.value);
    }
  }
}

function resetChat() {
  if (state.chatLoading) {
    return;
  }
  state.chatMessages = [];
  state.chatModel = null;
  state.chatError = null;
  if (elements.chatInput) {
    elements.chatInput.value = '';
    autosizeChatInput();
    elements.chatInput.focus();
  }
  renderChat();
}

function attachChatListeners() {
  if (elements.chatForm) {
    elements.chatForm.addEventListener('submit', handleChatSubmit);
  }
  if (elements.chatReset) {
    elements.chatReset.addEventListener('click', (event) => {
      event.preventDefault();
      resetChat();
    });
  }
  if (elements.chatInput) {
    elements.chatInput.addEventListener('input', autosizeChatInput);
    elements.chatInput.addEventListener('keydown', handleChatKeydown);
    autosizeChatInput();
  }
  renderChat();
}

function renderPayments() {
  const payments = state.data?.payments;
  updatePaymentsActions(payments);
  if (!payments) {
    if (elements.varianceValue) {
      elements.varianceValue.textContent = formatCurrency(state.varianceMin);
    }
    if (elements.underpaymentsBody) {
      elements.underpaymentsBody.innerHTML = '<tr><td colspan="7">Run the payments agent to view reconciliation insights.</td></tr>';
    }
    if (elements.documentationBody) {
      elements.documentationBody.innerHTML = '';
    }
    if (elements.agingBody) {
      elements.agingBody.innerHTML = '';
    }
    return;
  }

  const underpayments = Array.isArray(payments.underpayments) ? payments.underpayments : [];
  const documentationQueue = Array.isArray(payments.documentation_queue) ? payments.documentation_queue : [];
  const outstanding = Array.isArray(payments.outstanding_summary) ? payments.outstanding_summary : [];

  const filteredUnderpayments = underpayments.filter((row) => {
    const variance = Number(row.variance);
    return !Number.isNaN(variance) && variance >= state.varianceMin;
  });

  if (elements.varianceValue) {
    elements.varianceValue.textContent = formatCurrency(state.varianceMin);
  }

  if (elements.underpaymentsBody) {
    elements.underpaymentsBody.innerHTML = filteredUnderpayments.length
      ? filteredUnderpayments
          .map(
            (row) => `
        <tr>
          <td>${escapeHtml(row.claim_id)}</td>
          <td>${escapeHtml(row.patient_id)}</td>
          <td>${escapeHtml(row.payer)}</td>
          <td>${formatCurrency(row.expected)}</td>
          <td>${formatCurrency(row.received)}</td>
          <td>${formatCurrency(row.variance)}</td>
          <td>${escapeHtml(row.status)}</td>
        </tr>
      `,
          )
          .join('')
      : '<tr><td colspan="7">No underpayments meet the current variance threshold.</td></tr>';
  }

  if (elements.documentationBody) {
    elements.documentationBody.innerHTML = documentationQueue.length
      ? documentationQueue
          .map(
            (row) => `
        <tr>
          <td>${escapeHtml(row.claim_id)}</td>
          <td>${escapeHtml(row.payer)}</td>
          <td>${escapeHtml(row.denial_code)}</td>
          <td>${escapeHtml(row.requested_docs)}</td>
          <td>${escapeHtml(row.status)}</td>
        </tr>
      `,
          )
          .join('')
      : '<tr><td colspan="5">No documentation requests pending.</td></tr>';
  }

  if (elements.agingBody) {
    elements.agingBody.innerHTML = outstanding.length
      ? outstanding
          .map(
            (row) => `
        <tr>
          <td>${escapeHtml(row.aging_bucket)}</td>
          <td>${formatCurrency(row.outstanding)}</td>
        </tr>
      `,
          )
          .join('')
      : '<tr><td colspan="2">All balances are clear.</td></tr>';
  }

  updatePaymentsActions(payments);
}

function renderWorkforce() {
  const workforce = state.data?.workforce;
  if (!workforce) {
    if (elements.staffingBody) {
      elements.staffingBody.innerHTML = '<tr><td colspan="4">Run the workforce agent to forecast staffing needs.</td></tr>';
    }
    if (elements.surgeAlerts) {
      elements.surgeAlerts.innerHTML = '<li>No surge alerts generated.</li>';
    }
    if (elements.shiftHours) {
      elements.shiftHours.value = state.shiftHours;
    }
    return;
  }

  const staffingPlan = Array.isArray(workforce.staffing_plan) ? workforce.staffing_plan : [];
  const surgeAlerts = Array.isArray(workforce.surge_alerts) ? workforce.surge_alerts : [];

  if (elements.shiftHours) {
    elements.shiftHours.value = state.shiftHours;
  }

  if (elements.staffingBody) {
    elements.staffingBody.innerHTML = staffingPlan.length
      ? staffingPlan
          .map((row) => {
            const hours = Number(row.hours_needed);
            const hoursDisplay = Number.isFinite(hours) ? decimalFormatter.format(hours) : escapeHtml(row.hours_needed ?? '');
            const headcount = formatHeadcount(hours, state.shiftHours);
            return `
        <tr>
          <td>${escapeHtml(row.team)}</td>
          <td>${escapeHtml(row.week_start)}</td>
          <td>${hoursDisplay}</td>
          <td>${headcount}</td>
        </tr>
      `;
          })
          .join('')
      : '<tr><td colspan="4">No staffing needs identified.</td></tr>';
  }

  if (elements.surgeAlerts) {
    elements.surgeAlerts.innerHTML = surgeAlerts.length
      ? surgeAlerts
          .map(
            (alert) => `
        <li>
          <strong>${escapeHtml(alert.team)}</strong> — Week of ${escapeHtml(alert.week_start)}<br />
          ${escapeHtml(alert.message)} (Hours ${escapeHtml(alert.hours)}, baseline ${escapeHtml(alert.baseline_hours)})
        </li>
      `,
          )
          .join('')
      : '<li>No surges projected.</li>';
  }
}

function renderEngagement() {
  const engagement = state.data?.engagement;
  if (!engagement) {
    if (elements.engagementBody) {
      elements.engagementBody.innerHTML = '<tr><td colspan="6">Run the engagement agent to surface outreach messages.</td></tr>';
    }
    if (elements.showPatient) {
      elements.showPatient.checked = state.showPatient;
    }
    if (elements.showCaseManager) {
      elements.showCaseManager.checked = state.showCaseManager;
    }
    return;
  }

  const rows = [];
  if (state.showPatient && Array.isArray(engagement.patient_messages)) {
    engagement.patient_messages.forEach((row) => rows.push({ type: 'Patient', ...row }));
  }
  if (state.showCaseManager && Array.isArray(engagement.case_manager_messages)) {
    engagement.case_manager_messages.forEach((row) => rows.push({ type: 'Case Manager', ...row }));
  }

  if (elements.showPatient) {
    elements.showPatient.checked = state.showPatient;
  }
  if (elements.showCaseManager) {
    elements.showCaseManager.checked = state.showCaseManager;
  }

  const filtered = rows.filter((row) => {
    if (!state.engagementSearch) {
      return true;
    }
    const term = state.engagementSearch.toLowerCase();
    return (
      (row.patient_id && row.patient_id.toLowerCase().includes(term)) ||
      (row.message && row.message.toLowerCase().includes(term)) ||
      (row.order_id && row.order_id.toLowerCase().includes(term))
    );
  });

  if (elements.engagementBody) {
    elements.engagementBody.innerHTML = filtered.length
      ? filtered
          .map(
            (row) => `
        <tr>
          <td>${escapeHtml(row.type)}</td>
          <td>${escapeHtml(row.patient_id || '')}</td>
          <td>${escapeHtml(row.channel || '')}</td>
          <td>${escapeHtml(row.destination || '')}</td>
          <td>${escapeHtml(row.order_id || '')}</td>
          <td>${escapeHtml(row.message || '')}</td>
        </tr>
      `,
          )
          .join('')
      : '<tr><td colspan="6">No messages match your filters.</td></tr>';
  }
}

function renderPerformance() {
  const performance = state.data?.performance;
  if (!performance) {
    if (elements.metricCards) {
      elements.metricCards.innerHTML = '<div class="empty-state">Run the performance agent to populate KPI cards.</div>';
    }
    if (elements.trendList) {
      elements.trendList.innerHTML = '';
    }
    if (elements.metricSelect) {
      elements.metricSelect.value = state.selectedMetric;
    }
    return;
  }

  const snapshotArray = Array.isArray(performance.latest_snapshot)
    ? performance.latest_snapshot
    : performance.latest_snapshot
    ? [performance.latest_snapshot]
    : [];
  const snapshot = snapshotArray[0] || null;
  const trends = Array.isArray(performance.trend_summary) ? performance.trend_summary : [];

  if (elements.metricSelect) {
    elements.metricSelect.value = state.selectedMetric;
  }

  if (elements.metricCards) {
    if (!snapshot) {
      elements.metricCards.innerHTML = '<div class="empty-state">No KPI snapshot available.</div>';
    } else {
      elements.metricCards.innerHTML = Object.entries(snapshot)
        .filter(([key]) => key !== 'date')
        .map(([metric, value]) => {
          const trend = trends.find((entry) => entry.metric === metric);
          const delta = trend ? trend.change : null;
          const hasDelta = delta && delta !== '0' && delta !== '0.0' && delta !== '0%';
          const positive = hasDelta ? isPositiveMetric(metric, delta) : true;
          const badgeClassName = hasDelta ? (positive ? 'up' : 'down') : 'neutral';
          const badgeLabel = hasDelta ? `${positive ? '▲' : '▼'} ${escapeHtml(delta)}` : '—';
          return `
            <div class="card">
              <h4>${formatMetricName(metric)}</h4>
              <div class="value">${escapeHtml(value)}</div>
              <div class="delta">
                <span class="badge ${badgeClassName}">${badgeLabel}</span>
              </div>
              <div class="meta">As of ${escapeHtml(snapshot.date || '')}</div>
            </div>
          `;
        })
        .join('');
    }
  }

  if (elements.trendList) {
    const selectedTrends = trends.filter((trend) => trend.metric === state.selectedMetric);
    elements.trendList.innerHTML = selectedTrends.length
      ? selectedTrends
          .map(
            (trend) => `
        <li>
          <h4>${formatMetricName(trend.metric)}</h4>
          <div>${escapeHtml(trend.period)}</div>
          <div class="delta">Change: ${escapeHtml(trend.change)}</div>
        </li>
      `,
          )
          .join('')
      : '<li class="empty-state">No trend data for the selected metric.</li>';
  }
}

function renderTasks() {
  if (!elements.taskTableBody) {
    return;
  }

  const tasks = state.tasks || [];
  const highlightIds = state.highlightedTaskIds || new Set();
  const counts = tasks.reduce(
    (acc, task) => {
      const status = String(task.status || '').toLowerCase();
      if (status === 'in_progress') {
        acc.inProgress += 1;
      } else if (status === 'closed') {
        acc.closed += 1;
      } else {
        acc.open += 1;
      }
      if (String(task.task_type || '').toLowerCase() === 'sla_breach' && status !== 'closed') {
        acc.slaBreaches += 1;
      }
      const cycle = Number(task.cycle_time_secs);
      if (Number.isFinite(cycle) && cycle > 0) {
        acc.cycleSamples.push(cycle);
      }
      return acc;
    },
    { open: 0, inProgress: 0, closed: 0, slaBreaches: 0, cycleSamples: [] },
  );
  const cycleSamples = counts.cycleSamples;
  const avgCycleSecs = cycleSamples.length
    ? Math.round(cycleSamples.reduce((sum, value) => sum + value, 0) / cycleSamples.length)
    : null;
  updateTaskStatusChips({
    open: counts.open,
    inProgress: counts.inProgress,
    closed: counts.closed,
    slaBreaches: counts.slaBreaches,
    avgCycleSecs,
  });

  if (elements.taskSummary) {
    elements.taskSummary.textContent = `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`;
  }

  if (!tasks.length) {
    elements.taskTableBody.innerHTML = '<tr><td colspan="7">No open tasks at this time.</td></tr>';
    return;
  }

  elements.taskTableBody.innerHTML = tasks
    .map((task) => {
      const status = String(task.status || '').toLowerCase();
      const statusClass = `status-${status}`;
      const dueAt = task.due_at ? new Date(task.due_at).toLocaleString() : '—';
      const metadata = task.metadata || {};
      const noteParts = [];
      if (task.breach_reason) {
        noteParts.push(task.breach_reason);
      }
      if (metadata.notes) {
        noteParts.push(metadata.notes);
      }
      if (Array.isArray(metadata.ai_notes) && metadata.ai_notes.length) {
        noteParts.push(metadata.ai_notes.join('; '));
      }
      if (metadata.message) {
        noteParts.push(metadata.message);
      }
      if (task.cycle_time_secs) {
        noteParts.push(`Cycle ${formatCycleTime(task.cycle_time_secs)}`);
      }
      const noteSource = noteParts.length ? noteParts.join(' • ') : '—';
      const actions = renderTaskActions(task);
      const highlightClass = highlightIds.has(task.id) ? 'task-row task-row-new' : 'task-row';
      const slaClass = String(task.task_type || '').toLowerCase() === 'sla_breach' ? ' task-row-sla' : '';
      return `
        <tr class="${highlightClass}${slaClass}" data-task-id="${task.id}">
          <td>${escapeHtml(task.title)}</td>
          <td>${escapeHtml(task.task_type)}</td>
          <td>${escapeHtml(task.priority)}</td>
          <td><span class="status-tag ${statusClass}">${escapeHtml(task.status)}</span></td>
          <td>${escapeHtml(dueAt)}</td>
          <td>${escapeHtml(noteSource)}</td>
          <td>${actions}</td>
        </tr>
      `;
    })
    .join('');

  document.querySelectorAll('[data-task-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const { taskId, taskAction } = button.dataset;
      handleTaskAction(taskId, taskAction);
    });
  });

  if (highlightIds.size) {
    setTimeout(() => {
      state.highlightedTaskIds = new Set();
      document.querySelectorAll('.task-row-new').forEach((row) => row.classList.remove('task-row-new'));
    }, 2000);
  }
}

function updateTaskStatusChips({ open, inProgress, closed, slaBreaches = 0, avgCycleSecs = null }) {
  if (!elements.taskStatusChips) {
    return;
  }
  const cycleLabel = formatCycleTime(avgCycleSecs);
  elements.taskStatusChips.innerHTML = `
    <span class="chip chip-open">Open ${open}</span>
    <span class="chip chip-progress">In Progress ${inProgress}</span>
    <span class="chip chip-closed">Closed ${closed}</span>
    <span class="chip chip-sla">SLA Breaches ${slaBreaches}</span>
    <span class="chip chip-cycle">Avg Cycle ${cycleLabel}</span>
  `;
}


function badgeClass(status) {
  if (status === 'clear') {
    return 'up';
  }
  if (status === 'hold') {
    return 'down';
  }
  return '';
}

function inventoryActionClass(action) {
  const normalized = String(action || '').toLowerCase();
  if (normalized === 'reorder') {
    return 'badge down';
  }
  if (normalized === 'watch') {
    return 'badge neutral';
  }
  return 'badge up';
}

function addAgentActivity(entries) {
  const list = Array.isArray(entries) ? entries : [entries];
  if (!list.length) {
    return;
  }
  const now = new Date().toISOString();
  const enriched = list.map((item) => ({
    title: item.title,
    message: item.message,
    timestamp: item.timestamp || now,
  }));
  state.agentActivity = [...enriched, ...state.agentActivity].slice(0, 8);
  renderAgentActivity();
}

function summarizeAgentRun(agent, payload) {
  const name = formatAgentName(agent);
  let message = 'Run completed.';
  if (agent === 'ordering') {
    const orders = Array.isArray(payload?.patient_work_orders) ? payload.patient_work_orders.length : 0;
    const alerts = Array.isArray(payload?.compliance_alerts) ? payload.compliance_alerts.length : 0;
    const vendors = Array.isArray(payload?.vendor_reorders) ? payload.vendor_reorders.length : 0;
    message = `${orders} work orders, ${alerts} alerts, ${vendors} vendor recommendations`;
  } else if (agent === 'payments') {
    const under = Array.isArray(payload?.underpayments) ? payload.underpayments.length : 0;
    const docs = Array.isArray(payload?.documentation_queue) ? payload.documentation_queue.length : 0;
    message = `${under} underpayments, ${docs} documentation tasks`;
  } else if (agent === 'workforce') {
    const plan = Array.isArray(payload?.staffing_plan) ? payload.staffing_plan.length : 0;
    const surges = Array.isArray(payload?.surge_alerts) ? payload.surge_alerts.length : 0;
    message = `${plan} staffing rows, ${surges} surge alerts`;
  } else if (agent === 'engagement') {
    const notifications = Array.isArray(payload?.patient_notifications) ? payload.patient_notifications.length : 0;
    const caseNotes = Array.isArray(payload?.case_manager_messages) ? payload.case_manager_messages.length : 0;
    message = `${notifications} patient messages, ${caseNotes} case manager notes`;
  } else if (agent === 'performance') {
    const latest = Array.isArray(payload?.latest_snapshot) ? payload.latest_snapshot[0] : undefined;
    message = latest
      ? `Denial rate ${latest.denial_rate}, first pass ${latest.first_pass_rate}`
      : 'Performance snapshot refreshed.';
  } else if (agent === 'finance') {
    const latest = Array.isArray(payload?.latest_snapshot) ? payload.latest_snapshot[0] : undefined;
    message = latest
      ? `Cash recovered ${latest.projected_cash_recovered}, labor saved ${latest.labor_minutes_saved} min`
      : 'Financial pulse refreshed.';
  }

  return {
    title: `${name} Agent`,
    message,
    timestamp: new Date().toISOString(),
  };
}

function setActiveTab(tab) {
  const target = tab || 'operations';
  state.activeTab = target;
  (elements.tabButtons || []).forEach((button) => {
    const isActive = button.dataset.tab === target;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });
  (elements.tabPanels || []).forEach((panel) => {
    const isActive = panel.id === `tab-${target}`;
    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
  });
}

function formatMetricName(metric) {
  return metric
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCycleTime(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) {
    return '—';
  }
  if (value >= 86400) {
    return `${(value / 86400).toFixed(1)} d`;
  }
  if (value >= 3600) {
    return `${(value / 3600).toFixed(1)} h`;
  }
  return `${Math.max(1, Math.round(value / 60))} min`;
}

function isPositiveMetric(metric, delta) {
  if (!delta) {
    return true;
  }
  const numeric = parseFloat(String(delta).replace('%', ''));
  if (Number.isNaN(numeric)) {
    return true;
  }
  const higherIsBetter = ['first_pass_rate', 'delivery_sla'];
  if (higherIsBetter.includes(metric)) {
    return numeric >= 0;
  }
  return numeric <= 0;
}

async function callApi(path, { method = 'GET', body, silent = false } = {}) {
  if (!state.apiBase) {
    throw new Error('API base URL is not configured.');
  }

  const base = state.apiBase.replace(/\/$/, '');
  const url = `${base}${path}`;
  const options = {
    method,
    headers: {
      Accept: 'application/json',
    },
  };

  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch (networkError) {
    state.apiOnline = false;
    if (!silent) {
      setApiStatus('offline', `Unable to reach ${state.apiBase}`);
    }
    throw new Error(`Unable to reach API at ${state.apiBase}. Start the backend server to enable agent runs.`);
  }

  let payload = {};
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (parseError) {
      if (!silent) {
        setApiStatus('error', 'Invalid response from API');
      }
      throw new Error('Received invalid JSON from the automation API.');
    }
  }

  if (!response.ok) {
    const detail = payload?.detail || response.statusText || 'API request failed.';
    if (response.status === 404 || response.status === 503) {
      state.apiOnline = false;
      const message =
        detail && detail !== 'Not Found'
          ? detail
          : 'Automation API endpoint is not available. Using sample data until the backend is deployed.';
      if (!silent) {
        setApiStatus('offline', message);
      }
      throw new Error(message);
    }
    state.apiOnline = true;
    if (!silent) {
      setApiStatus('error', detail);
    }
    throw new Error(detail);
  }

  state.apiOnline = true;
  if (!silent) {
    setApiStatus('online', `Connected to ${state.apiBase}`);
  }
  return payload;
}

async function refreshStatus({ silent = true } = {}) {
  if (!state.apiBase) {
    return;
  }
  try {
    const statuses = await callApi('/api/agents/status', { method: 'GET', silent });
    renderStatusRows(Array.isArray(statuses) ? statuses : []);
    await refreshSnapshot({ silent: true });
    await refreshTasks({ silent: true });
    await refreshCommandInsights({ silent: true });
  } catch (error) {
    if (!silent) {
      handleApiError(error);
    }
  }
}

async function refreshSnapshot({ silent = false } = {}) {
  if (!state.apiOnline) {
    return;
  }
  try {
    const snapshot = await callApi('/api/last-run', { method: 'GET', silent });
    if (snapshot && typeof snapshot === 'object' && Object.keys(snapshot).length > 0) {
      updateData(snapshot, silent ? null : 'Live data refreshed from automation API.', { merge: true });
      state.dataMode = 'live';
      updatePanelLastRun();
    }
  } catch (error) {
    if (!silent) {
      handleApiError(error);
    }
  }
}

async function refreshTasks({ silent = false } = {}) {
  if (!state.apiOnline) {
    return;
  }
  try {
    const response = await callApi('/api/tasks', { method: 'GET', silent });
    const tasks = Array.isArray(response.tasks) ? response.tasks : [];
    const previousIds = new Set(Array.from(state.lastTaskIds ?? []));
    const newTasks = tasks.filter((task) => !previousIds.has(task.id));
    state.tasks = tasks;
    state.lastTaskIds = new Set(tasks.map((task) => task.id));
    state.highlightedTaskIds = new Set(newTasks.map((task) => task.id));
    renderTasks();
    renderTaskInsights();
    if (!silent && newTasks.length) {
      const highPriority = newTasks.filter((task) => String(task.priority || '').toLowerCase() === 'high');
      const message = highPriority.length
        ? `${newTasks.length} new tasks (${highPriority.length} high priority).`
        : `${newTasks.length} new tasks added.`;
      notify(message, highPriority.length ? 'error' : 'info');
    }
  } catch (error) {
    if (!silent) {
      handleApiError(error);
    }
  }
}

async function refreshCommandInsights({ silent = true } = {}) {
  state.commandLoading = true;
  if (!state.apiBase) {
    state.commandInsights = computeCommandInsightsFallback();
    state.commandError = 'API base URL is not configured.';
    state.commandLoading = false;
    renderTaskInsights();
    renderFinanceInsights();
    renderInventoryInsights();
    return;
  }
  try {
    const payload = await callApi('/api/command/insights', { method: 'GET', silent });
    if (payload && typeof payload === 'object') {
      state.commandInsights = normalizeCommandInsights(payload);
      state.commandError = null;
    }
  } catch (error) {
    state.commandError = error?.message || 'Unable to load automation insights.';
    state.commandInsights = computeCommandInsightsFallback();
    if (!silent) {
      handleApiError(error);
      return;
    }
    console.warn('Failed to refresh command insights', error);
  } finally {
    state.commandLoading = false;
    renderTaskInsights();
    renderFinanceInsights();
    renderInventoryInsights();
  }
}

function handleApiError(error) {
  console.error(error);
  const message = error?.message || 'Unexpected error contacting the automation API.';
  setDataStatus(message);
  finishAgentRun(null, { clearAll: true });
  if (!state.apiOnline) {
    setApiStatus('offline', message);
  } else {
    setApiStatus('error', message);
  }
  notify(message, 'error', { duration: 5000 });
}

function notify(message, variant = 'info', options = {}) {
  if (!elements.toastStack || !message) {
    return;
  }

  while (elements.toastStack.children.length >= 4) {
    const first = elements.toastStack.firstElementChild;
    if (first) {
      first.remove();
    } else {
      break;
    }
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${variant}`;
  toast.setAttribute('role', variant === 'error' ? 'alert' : 'status');
  toast.setAttribute('tabindex', '0');
  toast.textContent = message;
  toast.addEventListener('click', () => dismissToast(toast));

  elements.toastStack.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  const duration = options.duration ?? 4000;
  window.setTimeout(() => dismissToast(toast), duration);
}

function dismissToast(toast) {
  if (!toast || toast.dataset.dismissed) {
    return;
  }
  toast.dataset.dismissed = 'true';
  toast.classList.remove('visible');
  const remove = () => {
    toast.removeEventListener('transitionend', remove);
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  };
  toast.addEventListener('transitionend', remove, { once: true });
  window.setTimeout(remove, 500);
}

function renderTaskActions(task) {
  const status = String(task.status || '').toLowerCase();
  const actions = [];
  if (status === 'open') {
    actions.push(`<button class="ghost" type="button" data-task-id="${task.id}" data-task-action="ack">Acknowledge</button>`);
  }
  if (status === 'open' || status === 'in_progress') {
    actions.push(`<button class="ghost" type="button" data-task-id="${task.id}" data-task-action="close">Close</button>`);
  }
  return actions.join(' ');
}

async function handleTaskAction(taskId, action) {
  if (!taskId || !action) {
    return;
  }
  try {
    let message = '';
    if (action === 'ack') {
      await callApi(`/api/tasks/${taskId}/acknowledge`, {
        method: 'POST',
        body: {},
      });
      message = `Task ${taskId} acknowledged.`;
    } else if (action === 'close') {
      await callApi(`/api/tasks/${taskId}/status`, {
        method: 'POST',
        body: { status: 'closed' },
      });
      message = `Task ${taskId} closed.`;
    } else {
      return;
    }
    notify(message, action === 'close' ? 'success' : 'info');
    await refreshTasks({ silent: true });
  } catch (error) {
    handleApiError(error);
  }
}

function renderStatusRows(statuses) {
  if (!elements.statusTableBody) {
    return;
  }
  if (!statuses.length) {
    elements.statusTableBody.innerHTML = '<tr><td colspan="3">No runs yet.</td></tr>';
    updatePanelLastRun();
    return;
  }

  const lookup = Object.fromEntries(statuses.map((item) => [item.agent, item]));
  updateModuleLastRunFromStatuses(statuses);
  if (statuses.some((status) => status?.last_run)) {
    state.dataMode = 'live';
  }
  const rows = AGENT_ORDER.map((agent) => {
    const entry = lookup[agent];
    if (!entry) {
      return `
        <tr>
          <td>${formatAgentName(agent)}</td>
          <td>—</td>
          <td>0</td>
        </tr>
      `;
    }
    return `
      <tr>
        <td>${formatAgentName(agent)}</td>
        <td>${formatRunTimestamp(entry.last_run)}</td>
        <td>${escapeHtml(entry.records ?? 0)}</td>
      </tr>
    `;
  }).join('');

  elements.statusTableBody.innerHTML = rows;
  updatePanelLastRun();
}

function startStatusPolling() {
  if (state.statusTimer) {
    return;
  }
  state.statusTimer = window.setInterval(() => {
    refreshStatus({ silent: true });
    refreshAnalytics({ silent: true });
  }, 30000);
}

async function loadSample() {
  try {
    const response = await fetch(`../data/dashboard_sample.json?cache=${Date.now()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch sample data.');
    }
    const json = await response.json();
    updateData(json, 'Sample data loaded.');
    state.dataMode = 'sample';
    updatePanelLastRun();
    updateAgentOverlay();
    if (json.inventory_forecast) {
      state.inventoryForecast = Object.entries(json.inventory_forecast).map(([sku, details]) => ({
        supply_sku: sku,
        ...(details || {}),
      }));
      renderInventoryForecast();
    }
  } catch (error) {
    console.error(error);
    setDataStatus('Unable to load sample data. Check console for details.');
  }
}

async function loadInventoryForecast({ silent = false } = {}) {
  try {
    const response = await callApi('/api/inventory/forecast', { silent: true });
    const entries = Array.isArray(response)
      ? response
      : Object.entries(response || {}).map(([sku, details]) => ({ supply_sku: sku, ...(details || {}) }));
    state.inventoryForecast = entries;
    state.inventoryScenarioResult = null;
    renderInventoryForecast();
    renderScenarioSummary();
    renderInventoryInsights();
  } catch (error) {
    state.inventoryForecast = [];
    renderInventoryForecast();
    renderScenarioSummary();
    renderInventoryInsights();
    if (!silent) {
      handleApiError(error);
    }
  }
}

async function runAllAgents() {
  if (!elements.runAllButton) {
    return;
  }
  setButtonLoading(elements.runAllButton, true);
  setApiStatus('busy', 'Running full agent suite…');
  setDataStatus('Running all agents via backend…');
  startAgentRun(null, { suite: true });
  try {
    const response = await callApi('/api/run-all', {
      method: 'POST',
      body: { as_of: isoToday() },
    });
    const message = `Agents completed at ${formatRunTimestamp(response.run_at)}.`;
    updateData(response.payload, message);
    setApiStatus('online', message);
    state.dataMode = 'live';
    updatePanelLastRun();
    await refreshStatus({ silent: true });
    await loadInventoryForecast({ silent: true });
    if (response.payload) {
      const activityEntries = Object.entries(response.payload)
        .filter(([, payload]) => payload)
        .map(([agent, payload]) => summarizeAgentRun(agent, payload));
      addAgentActivity(activityEntries);
    }
    notify('All agents completed successfully.', 'success');
  } catch (error) {
    handleApiError(error);
  } finally {
    setButtonLoading(elements.runAllButton, false);
    finishAgentRun(null, { clearAll: true });
  }
}

async function runSingleAgent(agent, button) {
  if (!agent) {
    return;
  }
  setButtonLoading(button, true);
  const agentLabel = formatAgentName(agent);
  setApiStatus('busy', `Running ${agentLabel}…`);
  setDataStatus(`Running ${agentLabel} agent…`);
  startAgentRun(agent);
  try {
    const response = await callApi('/api/agents/run', {
      method: 'POST',
      body: { agents: [agent], as_of: isoToday() },
    });
    const message = `${agentLabel} completed at ${formatRunTimestamp(response.run_at)}.`;
    updateData(response.payload || {}, message, { merge: true });
    setApiStatus('online', message);
    state.dataMode = 'live';
    updatePanelLastRun();
    await refreshStatus({ silent: true });
    if (agent === 'ordering') {
      await loadInventoryForecast({ silent: true });
    }
    if (response.payload) {
      const payload = response.payload[agent] || response.payload;
      addAgentActivity(summarizeAgentRun(agent, payload));
    }
    notify(`${agentLabel} agent completed successfully.`, 'success');
  } catch (error) {
    handleApiError(error);
  } finally {
    setButtonLoading(button, false);
    finishAgentRun(agent);
  }
}

function attachEventListeners() {
  elements.reloadSample?.addEventListener('click', () => loadSample());

  elements.runAllButton?.addEventListener('click', () => runAllAgents());

  elements.agentButtons.forEach((button) => {
    button.addEventListener('click', () => runSingleAgent(button.dataset.agent, button));
  });

  elements.orderingActionReorder?.addEventListener('click', () => handleOrderingReorder());
  elements.orderingActionExport?.addEventListener('click', () => handleOrderingComplianceExport());
  elements.paymentsActionAppeal?.addEventListener('click', () => handlePaymentsAppeal());
  elements.paymentsActionExport?.addEventListener('click', () => handlePaymentsExport());

  (elements.tabButtons || []).forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const target = button.dataset.tab || 'operations';
      setActiveTab(target);
    });
  });

  elements.complianceFilter?.addEventListener('change', (event) => {
    state.complianceFilter = event.target.value;
    renderOrdering();
  });

  elements.varianceSlider?.addEventListener('input', (event) => {
    state.varianceMin = Number(event.target.value) || 0;
    renderPayments();
  });

  elements.shiftHours?.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    state.shiftHours = Number.isFinite(value) ? value : 6.5;
    renderWorkforce();
  });

  elements.showPatient?.addEventListener('change', (event) => {
    state.showPatient = event.target.checked;
    renderEngagement();
  });

  elements.showCaseManager?.addEventListener('change', (event) => {
    state.showCaseManager = event.target.checked;
    renderEngagement();
  });

  elements.engagementSearch?.addEventListener('input', (event) => {
    state.engagementSearch = event.target.value;
    renderEngagement();
  });

  elements.metricSelect?.addEventListener('change', (event) => {
    state.selectedMetric = event.target.value;
    renderPerformance();
  });

  elements.scenarioForm?.addEventListener('submit', handleInventoryScenarioSubmit);
  elements.scenarioReset?.addEventListener('click', () => handleInventoryScenarioReset());
  elements.scenarioGrowth?.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    state.inventoryScenarioInputs.growthPercent = Number.isFinite(value) ? value : 0;
  });
  elements.scenarioLead?.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    state.inventoryScenarioInputs.leadTimeDelta = Number.isFinite(value) ? value : 0;
  });
  elements.scenarioSkus?.addEventListener('input', (event) => {
    state.inventoryScenarioInputs.skus = event.target.value;
  });

  elements.scenarioCsv?.addEventListener('click', () => handleScenarioCsvExport());
  elements.scenarioPdf?.addEventListener('click', () => handleScenarioPdfExport());

  elements.dataFile?.addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const parsed = JSON.parse(loadEvent.target.result);
        updateData(parsed, `Loaded data from ${file.name}`);
        state.dataMode = 'file';
        updatePanelLastRun();
      } catch (error) {
        console.error('Failed to parse JSON', error);
        setDataStatus('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  });

  attachChatListeners();
  syncScenarioInputsFromState();
  renderScenarioSummary();
}

initializePanelHelp();
updateAgentOverlay();
setApiStatus('offline', 'Automation API not detected yet.');
attachEventListeners();
setActiveTab(state.activeTab);
loadSample();
startStatusPolling();
refreshStatus({ silent: true });
loadInventoryForecast({ silent: true });
refreshAnalytics({ silent: true });

window.addEventListener('command-insights-ready', () => {
  renderInsights();
});

function ensureCommandInsightsReady(retries = 30) {
  if (getEmbedApi()) {
    renderInsights();
    return;
  }
  if (retries > 0) {
    window.setTimeout(() => ensureCommandInsightsReady(retries - 1), 150);
  }
}

if (window.CommandInsightsEmbedReady || getEmbedApi()) {
  renderInsights();
} else {
  ensureCommandInsightsReady();
}
function handleScenarioCsvExport() {
  const scenario = state.inventoryScenarioResult;
  if (!scenario) {
    notify('Run a scenario to export results.', 'info');
    return;
  }
  const rows = buildScenarioRows(scenario);
  if (!rows.length) {
    notify('Scenario did not produce any SKU-level changes.', 'info');
    return;
  }
  const header = [
    'sku',
    'baseline_action',
    'scenario_action',
    'baseline_forecast_units',
    'scenario_forecast_units',
    'forecast_delta',
    'baseline_buffer_units',
    'scenario_buffer_units',
    'buffer_delta',
  ];
  const csvLines = [header, ...rows]
    .map((row) => row.map((cell) => escapeCsv(cell)).join(','))
    .join('\n');
  downloadFile('inventory-scenario.csv', 'text/csv', csvLines);
}

function handleScenarioPdfExport() {
  const scenario = state.inventoryScenarioResult;
  if (!scenario) {
    notify('Run a scenario to export results.', 'info');
    return;
  }
  const growth = Number(scenario.growth_percent ?? state.inventoryScenarioInputs.growthPercent ?? 0);
  const lead = Number(scenario.lead_time_delta ?? state.inventoryScenarioInputs.leadTimeDelta ?? 0);
  const applied = Number(scenario.lead_time_applied ?? INVENTORY_BASE_LEAD_TIME + lead);
  const skuCount = Array.isArray(scenario.skus) ? scenario.skus.length : 0;
  const timestamp = scenario.generated_at ? formatRunTimestamp(scenario.generated_at) : '—';
  const lines = [
    'Scenario generated: ' + timestamp,
    'Demand growth: ' + growth + '%',
    'Lead time delta: ' + (lead >= 0 ? '+' : '') + lead + ' days (applied ' + applied + 'd)',
    skuCount ? 'SKUs in focus: ' + skuCount + ' (' + scenario.skus.join(', ') + ')' : 'SKUs in focus: all forecast SKUs',
    '',
  ];
  const deltaEntries = Object.entries(scenario.deltas || {}).map(([sku, detail]) => ({
    sku,
    forecastDelta: parseNumericValue(detail?.forecast_units),
    bufferDelta: parseNumericValue(detail?.recommended_buffer),
  }));
  deltaEntries.sort((a, b) => Math.abs(b.forecastDelta) - Math.abs(a.forecastDelta));
  const top = deltaEntries.slice(0, 5);
  if (!top.length) {
    lines.push('No SKU-level deltas vs baseline.');
  } else {
    lines.push('Top SKU deltas:');
    top.forEach((entry) => {
      const forecastLabel = entry.forecastDelta === 0
        ? 'forecast ±0'
        : 'forecast ' + (entry.forecastDelta >= 0 ? '+' : '') + entry.forecastDelta.toFixed(2);
      const bufferLabel = entry.bufferDelta === 0
        ? 'buffer steady'
        : 'buffer ' + (entry.bufferDelta >= 0 ? '+' : '') + entry.bufferDelta.toFixed(2);
      lines.push('- ' + entry.sku + ': ' + forecastLabel + ', ' + bufferLabel);
    });
  }
  const blob = createScenarioPdfDocument('Inventory Scenario Summary', lines);
  downloadBlob('inventory-scenario-summary.pdf', blob);
}

function buildScenarioRows(scenario) {
  const baseline = scenario.baseline || {};
  const simulated = scenario.scenario || {};
  const deltas = scenario.deltas || {};
  const skus = new Set([...Object.keys(baseline), ...Object.keys(simulated)]);
  const rows = [];
  skus.forEach((sku) => {
    const base = baseline[sku] || {};
    const sim = simulated[sku] || {};
    const delta = deltas[sku] || {};
    rows.push([
      sku,
      base.action || '—',
      sim.action || '—',
      formatScenarioNumber(base.forecast_units),
      formatScenarioNumber(sim.forecast_units),
      formatScenarioDelta(delta.forecast_units),
      formatScenarioNumber(base.recommended_buffer),
      formatScenarioNumber(sim.recommended_buffer),
      formatScenarioDelta(delta.recommended_buffer),
    ]);
  });
  rows.sort((a, b) => Math.abs(parseFloat(b[5] || '0')) - Math.abs(parseFloat(a[5] || '0')));
  return rows;
}

function formatScenarioNumber(value) {
  const numeric = parseNumericValue(value);
  if (!Number.isFinite(numeric)) {
    return '';
  }
  if (Math.abs(numeric) >= 100) {
    return numeric.toFixed(0);
  }
  if (Math.abs(numeric) >= 10) {
    return numeric.toFixed(1);
  }
  return numeric.toFixed(2);
}

function formatScenarioDelta(value) {
  const numeric = parseNumericValue(value);
  if (!Number.isFinite(numeric)) {
    return '';
  }
  const magnitude = formatScenarioNumber(Math.abs(numeric));
  if (!magnitude) {
    return '';
  }
  if (numeric === 0) {
    return '0';
  }
  return (numeric > 0 ? '+' : '') + magnitude;
}

function createScenarioPdfDocument(title, lines) {
  const encoder = new TextEncoder();
  const textLines = [title, '', ...lines];
  const contentParts = ['BT', '/F1 12 Tf', '12 TL', '72 760 Td'];
  textLines.forEach((line, index) => {
    const escaped = escapePdfText(line || '');
    if (index === 0) {
      contentParts.push('(' + escaped + ') Tj');
    } else {
      contentParts.push('T*');
      contentParts.push('(' + escaped + ') Tj');
    }
  });
  contentParts.push('ET');
  const contentStream = contentParts.join('\n');
  const contentLength = encoder.encode(contentStream).length;
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    '4 0 obj\n<< /Length ' + contentLength + ' >>\nstream\n' + contentStream + '\nendstream\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj) => {
    offsets.push(pdf.length);
    pdf += obj;
  });
  const xrefOffset = pdf.length;
  pdf += 'xref\n0 ' + (objects.length + 1) + '\n';
  pdf += '0000000000 65535 f \n';
  offsets.forEach((offset) => {
    pdf += String(offset).padStart(10, '0') + ' 00000 n \n';
  });
  pdf += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\n';
  pdf += 'startxref\n' + xrefOffset + '\n%%EOF';
  return new Blob([pdf], { type: 'application/pdf' });
}

function escapePdfText(text) {
  if (!text) {
    return '';
  }
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}
