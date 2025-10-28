import type { MenuDataItem } from '@ant-design/pro-components';
import type { RouteObject } from 'react-router-dom';
import { OverviewPage } from '../pages/OverviewPage';
import { OpsPage } from '../pages/OpsPage';
import { FinancePage } from '../pages/FinancePage';
import { InventoryPage } from '../pages/InventoryPage';
import { EngagementPage } from '../pages/EngagementPage';
import { ScenariosPage } from '../pages/ScenariosPage';
import { AskPage } from '../pages/AskPage';
import { AgentsPage } from '../pages/AgentsPage';
import { LexiconPage } from '../pages/LexiconPage';
import { NavigationMapPage } from '../pages/NavigationMapPage';
import { IntakePage } from '../pages/IntakePage';

export const appRoutes: RouteObject[] = [
  { path: '/', element: <OverviewPage /> },
  { path: '/ops', element: <OpsPage /> },
  { path: '/finance', element: <FinancePage /> },
  { path: '/inventory', element: <InventoryPage /> },
  { path: '/engagement', element: <EngagementPage /> },
  { path: '/intake', element: <IntakePage /> },
  { path: '/scenarios', element: <ScenariosPage /> },
  { path: '/ask', element: <AskPage /> },
  { path: '/agents', element: <AgentsPage /> },
  { path: '/lexicon', element: <LexiconPage /> },
  { path: '/navigation-map', element: <NavigationMapPage /> }
];

export const menuItems: MenuDataItem[] = [
  { path: '/', name: 'Overview', key: 'overview' },
  { path: '/ops', name: 'Ops', key: 'ops' },
  { path: '/finance', name: 'Finance', key: 'finance' },
  { path: '/inventory', name: 'Inventory', key: 'inventory' },
  { path: '/engagement', name: 'Engagement', key: 'engagement' },
  { path: '/intake', name: 'Intake', key: 'intake' },
  { path: '/scenarios', name: 'Scenarios', key: 'scenarios' },
  { path: '/ask', name: 'Ask', key: 'ask' },
  { path: '/agents', name: 'Agents', key: 'agents' },
  { path: '/lexicon', name: 'Lexicon', key: 'lexicon' },
  { path: '/navigation-map', name: 'Navigation Map', key: 'navigation-map' }
];
