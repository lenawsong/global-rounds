import '../styles/globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Nexus Health',
  description: 'Durable medical equipment, delivered with care.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-30 border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold text-slate-900">Nexus Health</Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/">Home</Link>
              <Link href="/login">Login</Link>
              <a href="/command-center/dashboard/" className="text-blue-700">Legacy Dashboard</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}

