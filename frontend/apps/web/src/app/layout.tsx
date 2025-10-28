import '../styles/globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';
const LEGACY_DASHBOARD_URL =
  process.env.NEXT_PUBLIC_LEGACY_DASHBOARD_URL || 'http://localhost:8001/command-center/dashboard/';

export const metadata: Metadata = {
  title: 'Nexus Health',
  description: 'Durable medical equipment, delivered with care.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 font-sans text-slate-900">
        <header className="sticky top-0 z-30 border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold text-slate-900">
              Nexus Health
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/">Home</Link>
              <Link href="/login">Login</Link>
              <a href={DASHBOARD_URL} className="text-blue-700" target="_blank" rel="noreferrer">
                Command Center
              </a>
              <a href={LEGACY_DASHBOARD_URL} className="text-slate-600" target="_blank" rel="noreferrer">
                Legacy Dashboard
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
