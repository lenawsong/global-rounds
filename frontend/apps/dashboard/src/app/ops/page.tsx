import { Card, CardTitle, CardSubtle } from '@gr/ui';
import { VegaChart, Specs } from '@gr/charts';

const sample = [
  { label: 'Open', value: 42 },
  { label: 'In Progress', value: 18 },
  { label: 'Closed', value: 57 }
];

export default function OpsPage() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardTitle>Unified Queue</CardTitle>
        <CardSubtle>Distribution by status.</CardSubtle>
        <div className="mt-3">
          <VegaChart spec={Specs.donutSpec()} data={{ table: sample }} />
        </div>
      </Card>
      <Card>
        <CardTitle>Compliance Mix</CardTitle>
        <CardSubtle>Clear vs Hold vs Unknown.</CardSubtle>
        <div className="mt-3">
          <VegaChart spec={Specs.donutSpec()} data={{ table: [
            { label: 'Clear', value: 88 },
            { label: 'Hold', value: 7 },
            { label: 'Unknown', value: 5 }
          ] }} />
        </div>
      </Card>
    </div>
  );
}

