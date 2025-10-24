import Link from 'next/link';
import { Card, CardTitle, CardSubtle, Button } from '@gr/ui';

export default function Page() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardTitle>Welcome</CardTitle>
        <CardSubtle>Choose a module to begin.</CardSubtle>
        <div className="mt-4 flex gap-3">
          <Link href="/ops" className="inline-flex"><Button>Open Ops</Button></Link>
          <a href="/command-center/dashboard/" className="inline-flex"><Button variant="secondary">Legacy</Button></a>
        </div>
      </Card>
    </div>
  );
}

