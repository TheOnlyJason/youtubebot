/** Skip rights checkbox + human review checklist (local dev / trusted workflow). */
export function fastModeEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_FAST_MODE === "true" ||
    process.env.FAST_MODE === "true"
  );
}
