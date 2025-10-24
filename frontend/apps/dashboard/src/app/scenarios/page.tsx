import { Card, CardTitle, CardSubtle } from '@gr/ui';

export default function ScenariosPage() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardTitle>Inventory Scenarios</CardTitle>
        <CardSubtle>What‑if planning for demand growth and lead times.</CardSubtle>
      </Card>
    </div>
  );
}

