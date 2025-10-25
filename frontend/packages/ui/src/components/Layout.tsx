import * as React from 'react';
import Link from 'next/link';

interface ShellProps {
  title: string;
  description?: string;
  primaryAction?: React.ReactNode;
  tabs?: { key: string; label: string; href: string }[];
  activeTab?: string;
}

export const Shell: React.FC<React.PropsWithChildren<ShellProps>> = ({
  title,
  description,
  primaryAction,
  tabs,
  activeTab,
  children
}) => (
  <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-16 pt-12">
      <header className="flex flex-col gap-4 rounded-[32px] border border-slate-200/80 bg-white/90 p-8 shadow-[0_32px_120px_-40px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{title}</h1>
            {description ? <p className="max-w-2xl text-base text-slate-500">{description}</p> : null}
          </div>
          {primaryAction}
        </div>
        {tabs?.length ? (
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            {tabs.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                className={[
                  'rounded-full px-4 py-2 transition',
                  activeTab === tab.key
                    ? 'bg-slate-900 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                ].join(' ')}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-4 rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Quick Links</p>
            <div className="flex flex-col gap-2 text-sm text-slate-600">
              <Link className="transition hover:text-slate-900" href="/">Overview</Link>
              <Link className="transition hover:text-slate-900" href="/ops">Ops</Link>
              <Link className="transition hover:text-slate-900" href="/finance">Finance</Link>
              <Link className="transition hover:text-slate-900" href="/inventory">Inventory</Link>
              <Link className="transition hover:text-slate-900" href="/engagement">Engagement</Link>
              <Link className="transition hover:text-slate-900" href="/scenarios">Scenarios</Link>
            </div>
          </div>
        </aside>
        <main className="flex flex-col gap-6">{children}</main>
      </div>
    </div>
  </div>
);

