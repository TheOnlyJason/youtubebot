import { displayProjectState } from "@/lib/projectStatus";
import type { Project } from "@/types";

const styles: Record<string, string> = {
  Draft: "bg-zinc-700 text-zinc-100",
  "Script Ready": "bg-indigo-900/80 text-indigo-100",
  "Voice Ready": "bg-sky-900/80 text-sky-100",
  "Visuals Ready": "bg-violet-900/80 text-violet-100",
  Rendering: "bg-amber-900/80 text-amber-100",
  Rendered: "bg-emerald-900/80 text-emerald-100",
  Approved: "bg-green-900/80 text-green-100",
  "Render error": "bg-red-900/80 text-red-100",
};

export function StatusBadge({ project }: { project: Project }) {
  const label = displayProjectState(project);
  const cls = styles[label] ?? "bg-zinc-700 text-zinc-100";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}
