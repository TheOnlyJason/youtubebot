import { randomUUID } from "node:crypto";
import type { CaptionLine, Scene, SceneKind } from "@/types";

const MAX_CHARS_PER_LINE = 36;

/** Split long text into short mobile-friendly caption lines */
export function splitCaptionText(text: string): CaptionLine[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [{ text: "" }];
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (next.length > MAX_CHARS_PER_LINE && current) {
      lines.push(current);
      current = w;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.map((text) => ({ text }));
}

export function scriptToFlatCaptionLines(fullScript: string): CaptionLine[] {
  const sentences = fullScript
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: CaptionLine[] = [];
  for (const s of sentences) {
    out.push(...splitCaptionText(s));
  }
  return out.length ? out : [{ text: fullScript.trim() }];
}

const SCENE_ORDER: SceneKind[] = [
  "hook",
  "point1",
  "point2",
  "point3",
  "ending",
];

/** Assign caption text per scene from structured script */
export function buildDefaultScenesFromScript(input: {
  hook: string;
  mainPoints: [string, string, string];
  ending: string;
  ctaLine: string;
  targetDuration: number;
}): Scene[] {
  const parts = [
    input.hook,
    input.mainPoints[0],
    input.mainPoints[1],
    input.mainPoints[2],
    `${input.ending}${input.ctaLine ? ` ${input.ctaLine}` : ""}`,
  ];
  const weights = parts.map((p) => Math.max(1, p.length));
  const sum = weights.reduce((a, b) => a + b, 0);
  return SCENE_ORDER.map((kind, i) => ({
    id: randomUUID(),
    kind,
    caption: parts[i],
    durationSeconds: Math.max(
      2,
      Math.round((input.targetDuration * weights[i]) / sum),
    ),
    motion: (["zoom_in", "pan", "fade", "none", "zoom_in"] as const)[i % 5],
    media: { sourceType: "animated_bg" as const },
    visualSuggestion: undefined,
  }));
}

/** Regenerate caption strings on scenes from full script lines (even distribution) */
export function distributeCaptionLinesToScenes(
  scenes: Scene[],
  lines: CaptionLine[],
): Scene[] {
  if (!scenes.length) return scenes;
  const flat = lines.map((l) => l.text).filter(Boolean);
  if (!flat.length) return scenes;
  const perScene: string[][] = scenes.map(() => []);
  flat.forEach((text, idx) => {
    perScene[idx % scenes.length].push(text);
  });
  return scenes.map((s, i) => ({
    ...s,
    caption: perScene[i].join(" ").trim() || s.caption,
  }));
}
