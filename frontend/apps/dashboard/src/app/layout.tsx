import '../styles/globals.css';
import type { Metadata } from 'next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Link from 'next/link';
import * as React from 'react';

export const metadata: Metadata = {
  title: 'GR Command Center',
  description: 'Operator cockpit'
};

const client = new QueryClient();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-30 border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold text-slate-900">Command Center</Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/ops">Ops</Link>
              <Link href="/finance">Finance</Link>
              <Link href="/inventory">Inventory</Link>
              <Link href="/engagement">Engmt</Link>
              <Link href="/scenarios">Scenarios</Link>
            </nav>
          </div>
        </header>
        <QueryClientProvider client={client}>
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </QueryClientProvider>
      </body>
    </html>
  );
}

