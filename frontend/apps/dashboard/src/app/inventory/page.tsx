import { Card, CardTitle, CardSubtle } from '@gr/ui';
import { VegaChart, Specs } from '@gr/charts';

const inventory = [
  { label: 'Reorder', value: 12 },
  { label: 'Watch', value: 8 },
  { label: 'Healthy', value: 20 }
];

export default function InventoryPage() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardTitle>Inventory Actions</CardTitle>
        <CardSubtle>SKU guidance.</CardSubtle>
        <div className="mt-3">
          <VegaChart spec={Specs.horizontalBarSpec()} data={{ table: inventory }} />
        </div>
      </Card>
    </div>
  );
}

