export type SiteNode = {
  id: string;
  label: string;
  path: string | null;
  description: string;
  tags?: string[];
  links?: string[];
};

export const siteNodes: SiteNode[] = [
  {
    id: 'dashboard-shell',
    label: 'Dashboard Shell',
    path: null,
    description: 'Mixed-layout chrome with global filters, ProLayout navigation, and Nexus Health theming.',
    tags: ['layout', 'navigation'],
    links: ['overview', 'ops', 'finance', 'inventory', 'engagement', 'intake', 'scenarios', 'ask', 'agents', 'lexicon', 'navigation-map']
  },
  {
    id: 'overview',
    label: 'Overview',
    path: '/overview',
    description: 'Executive pulse across labor savings, breach risk, backlog velocity, and run-rate forecasts.',
    tags: ['metrics', 'antv']
  },
  {
    id: 'ops',
    label: 'Ops',
    path: '/ops',
    description: 'Operations backlog, breach ladder, and SLA automation for Command Center teams.',
    tags: ['sla', 'tasks']
  },
  {
    id: 'finance',
    label: 'Finance',
    path: '/finance',
    description: 'Revenue recovery, cash acceleration, and payer mix visualizations.',
    tags: ['finance', 'collections']
  },
  {
    id: 'inventory',
    label: 'Inventory',
    path: '/inventory',
    description: 'Predictive inventory dashboard with lead times, replenishment alerts, and agent levers.',
    tags: ['inventory', 'forecasting']
  },
  {
    id: 'engagement',
    label: 'Engagement',
    path: '/engagement',
    description: 'Patient/provider engagement funnel, outreach efficiency, and satisfaction drivers.',
    tags: ['engagement', 'outreach']
  },
  {
    id: 'intake',
    label: 'Intake',
    path: '/intake',
    description: 'Structured patient intake workflow with document upload and autofill guardrails.',
    tags: ['intake', 'upload', 'automation']
  },
  {
    id: 'scenarios',
    label: 'Scenarios',
    path: '/scenarios',
    description: 'Scenario sandbox for demand shocks, staffing deltas, and reimbursement proposals.',
    tags: ['simulation', 'planning']
  },
  {
    id: 'ask',
    label: 'Ask',
    path: '/ask',
    description: 'Ask-the-dashboard conversational agent with Nexus knowledge embeddings.',
    tags: ['llm', 'assistant']
  },
  {
    id: 'agents',
    label: 'Agents',
    path: '/agents',
    description: 'Automation agent roster, run history, and uptime status.',
    tags: ['automation', 'agents']
  },
  {
    id: 'lexicon',
    label: 'Lexicon',
    path: '/lexicon',
    description: 'Lexicon explorer with recursive term expansion and AntV G6 relationship graph.',
    tags: ['knowledge', 'graph'],
    links: ['lexicon-graph']
  },
  {
    id: 'navigation-map',
    label: 'Navigation Map',
    path: '/navigation-map',
    description: 'Interactive sitemap showing how pages map to Nexus business workflows.',
    tags: ['map', 'antv']
  },
  {
    id: 'lexicon-graph',
    label: 'Lexicon Graph',
    path: '/lexicon',
    description: 'Node graph of KPI definitions—links back into the Lexicon for deeper reading.',
    tags: ['graph'],
    links: ['lexicon']
  }
];

export const siteEdges = siteNodes.flatMap((node) =>
  node.links?.map((target) => ({ source: node.id, target })) ?? []
);
