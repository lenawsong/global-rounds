import '../styles/globals.css';
import type { Metadata } from 'next';
import { Providers } from './providers';
import Link from 'next/link';
import * as React from 'react';

export const metadata: Metadata = {
  title: 'GR Command Center',
  description: 'Operator cockpit'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 font-sans text-slate-900">
        <Providers>
          <div className="min-h-screen">
            <header className="sticky top-0 z-30 bg-white/95 shadow-sm backdrop-blur border-b border-slate-200">
              <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4">
                <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white">GR</span>
                  Command Center
                </Link>
                <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <Link className="transition hover:text-slate-900" href="/">Overview</Link>
                  <Link className="transition hover:text-slate-900" href="/ops">Ops</Link>
                  <Link className="transition hover:text-slate-900" href="/finance">Finance</Link>
                  <Link className="transition hover:text-slate-900" href="/inventory">Inventory</Link>
                  <Link className="transition hover:text-slate-900" href="/engagement">Engagement</Link>
                  <Link className="transition hover:text-slate-900" href="/scenarios">Scenarios</Link>
                  <Link className="transition hover:text-slate-900" href="/ask">Ask</Link>
                  <Link className="transition hover:text-slate-900" href="/agents">Agents</Link>
                  <Link className="transition hover:text-slate-900" href="/lexicon">Lexicon</Link>
                  <a className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 transition hover:border-slate-300 hover:text-slate-900" href="/command-center/patient/intake.html">New Intake</a>
                </nav>
              </div>
            </header>
            <main>{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
