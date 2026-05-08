import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-[var(--card-border)] bg-[var(--card)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="text-lg font-semibold tracking-tight text-white">
            SafeShorts Studio
          </Link>
          <nav className="flex items-center gap-4 text-sm text-[var(--muted)]">
            <Link href="/" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link href="/projects/new" className="hover:text-white transition-colors">
              New project
            </Link>
            <Link href="/youtube-helper" className="hover:text-white transition-colors">
              YouTube helper
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">{children}</main>
    </div>
  );
}
