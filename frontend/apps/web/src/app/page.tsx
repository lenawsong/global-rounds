import { Button, Card, CardBody, CardSubtle, CardTitle, Metric } from '@gr/ui';

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL ||
  process.env.NEXT_PUBLIC_COMMAND_CENTER_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '/dashboard');
const DASHBOARD_BASE = DASHBOARD_URL.replace(/\/$/, '');
const LEGACY_DASHBOARD_URL =
  process.env.NEXT_PUBLIC_LEGACY_DASHBOARD_URL || 'http://localhost:8001/command-center/dashboard/';
const INTAKE_URL = process.env.NEXT_PUBLIC_INTAKE_URL || `${DASHBOARD_BASE}/intake`;

export default function Page() {
  return (
    <div className="space-y-12">
      <section className="overflow-hidden rounded-[40px] border border-slate-200/60 bg-white/90 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.45)]">
        <div className="grid items-center gap-8 px-10 py-16 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-6">
            <BadgePill>Automation Rail</BadgePill>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
              Durable medical equipment operations, orchestrated to perfection.
            </h1>
            <p className="text-lg text-slate-600">
              Global Rounds synchronizes intake, documentation, fulfillment, and revenue cycle in a single command center
              built for six-figure SaaS deployments.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href={`${DASHBOARD_BASE}/ops`} className="inline-flex" target="_blank" rel="noreferrer">
                <Button>Explore dashboard</Button>
              </a>
              <a href={INTAKE_URL} className="inline-flex" target="_blank" rel="noreferrer">
                <Button variant="secondary">New intake</Button>
              </a>
              <a href={LEGACY_DASHBOARD_URL} className="inline-flex" target="_blank" rel="noreferrer">
                <Button variant="ghost">Legacy view</Button>
              </a>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Metric label="AI approvals" value="92%" sublabel="Orders auto-cleared without manual review" />
            <Metric label="Time to fulfill" value="< 24h" sublabel="Median across last 30 days" />
            <Metric label="Denial lift" value="-38%" sublabel="Reduction in payer denials after launch" />
            <Metric label="ROI" value="$412k" sublabel="Annualized savings from automations" />
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardTitle>Command Center Modules</CardTitle>
          <CardSubtle>Operational, financial, inventory, engagement, and scenario insights with real-time data pipelines.</CardSubtle>
          <CardBody>
            <ul className="grid gap-3 text-sm text-slate-600">
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-500" />Ops orchestration with compliance guards</li>
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />Finance pulse and denial intelligence</li>
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" />Inventory forecasting with scenario planning</li>
              <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-500" />Patient engagement heatmaps and escalations</li>
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardTitle>Integrations</CardTitle>
          <CardSubtle>FastAPI backend, SQL/CSV data sources, payer connectors, and partner networks.</CardSubtle>
          <CardBody>
            <div className="grid gap-3 text-sm text-slate-600">
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-4 py-3">FastAPI automation rail</div>
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-4 py-3">Brightree / Kyron ingests</div>
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-4 py-3">Payer eligibility & remits</div>
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-4 py-3">Patient SMS & email</div>
            </div>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

function BadgePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.3em] text-slate-500">
      {children}
    </span>
  );
}
