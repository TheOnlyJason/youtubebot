import Link from "next/link";
import { listProjects } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const projects = listProjects();
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
            Create original Shorts with a review-first workflow. Rendering uses FFmpeg on your machine.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
        >
          New Short project
        </Link>
      </div>

      <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
        <h2 className="text-sm font-medium text-[var(--muted)]">Saved projects</h2>
        {projects.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            No projects yet. Start with a new Short project.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-3 hover:border-[var(--card-border)] hover:bg-black/20"
                >
                  <div>
                    <p className="font-medium text-white">
                      {p.generatedScript?.title || p.form.topic || "Untitled project"}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {p.form.niche} · {p.form.duration}s · {p.form.language}
                    </p>
                  </div>
                  <StatusBadge project={p} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
