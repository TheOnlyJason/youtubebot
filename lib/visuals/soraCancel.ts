import { getProject } from "@/lib/db";

export class SoraGenerationCancelledError extends Error {
  constructor() {
    super("Sora generation stopped by user.");
    this.name = "SoraGenerationCancelledError";
  }
}

export function isSoraGenerationCancelledError(e: unknown): boolean {
  return e instanceof SoraGenerationCancelledError;
}

export function isSoraCancelRequested(projectId: string): boolean {
  const p = getProject(projectId);
  return Boolean(
    p?.visualGeneration?.active && p.visualGeneration.cancelRequested === true,
  );
}

export function assertSoraNotCancelled(projectId: string): void {
  if (isSoraCancelRequested(projectId)) {
    throw new SoraGenerationCancelledError();
  }
}
