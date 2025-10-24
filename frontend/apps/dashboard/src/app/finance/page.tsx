import { Card, CardTitle, CardSubtle } from '@gr/ui';
import { VegaChart, Specs } from '@gr/charts';

const bars = [
  { label: 'Underpayments', value: 12 },
  { label: 'Denials', value: 7 },
  { label: 'Docs Needed', value: 4 }
];

export default function FinancePage() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardTitle>Finance Pulse</CardTitle>
        <CardSubtle>Key weekly metrics.</CardSubtle>
        <div className="mt-3">
          <VegaChart spec={Specs.horizontalBarSpec()} data={{ table: bars }} />
        </div>
      </Card>
      <Card>
        <CardTitle>SLA Risk Trend</CardTitle>
        <CardSubtle>Past‑due tasks by day.</CardSubtle>
        <div className="mt-3">
          <VegaChart spec={Specs.simpleLineSpec()} data={{ table: [
            { date: '2025-10-01', value: 3 },
            { date: '2025-10-02', value: 5 },
            { date: '2025-10-03', value: 4 },
            { date: '2025-10-04', value: 6 }
          ] }} />
        </div>
      </Card>
    </div>
  );
}

