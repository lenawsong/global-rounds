import { Card, CardSubtle, CardTitle, Button } from '@gr/ui';
import Link from 'next/link';

export default function Page() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardTitle>Global Rounds Command Center</CardTitle>
        <CardSubtle>Your operational cockpit for intake‑to‑fulfillment.</CardSubtle>
        <div className="mt-4 flex gap-3">
          <Link href="/ops" className="inline-flex"><Button>Open Dashboard</Button></Link>
          <a href="/command-center/dashboard/" className="inline-flex"><Button variant="secondary">Legacy</Button></a>
        </div>
      </Card>
      <Card>
        <CardTitle>Patient Intake</CardTitle>
        <CardSubtle>Start a supply request and upload documents.</CardSubtle>
        <div className="mt-4 flex gap-3">
          <a className="inline-flex" href="/command-center/patient/intake.html"><Button>New Intake</Button></a>
        </div>
      </Card>
    </div>
  );
}

