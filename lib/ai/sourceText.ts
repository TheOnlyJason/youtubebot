import type { GeneratedScript, LyricSourceKind, Project, ProjectForm } from "@/types";

/** Primary text the user provided (DM thread, Reddit post, etc.) */
export function getSourceText(form: ProjectForm, script?: GeneratedScript | null): string {
  const fromForm = form.sourceText?.trim();
  if (fromForm) return fromForm;
  const fromScript = script?.sourceText?.trim();
  if (fromScript) return fromScript;
  return form.topic.trim();
}

export function getLyricSourceKind(
  form: ProjectForm,
  script?: GeneratedScript | null,
): LyricSourceKind {
  return form.lyricSourceKind ?? script?.lyricSourceKind ?? "reddit";
}

export function defaultTitleFromSource(text: string): string {
  const line =
    text
      .split(/\n/)
      .map((l) => l.trim())
      .find(Boolean) ?? "Untitled song";
  return line.length > 80 ? `${line.slice(0, 77)}…` : line;
}

export function requireSourceText(form: ProjectForm): string {
  const text = getSourceText(form);
  if (text.length < 20) {
    throw new Error(
      "Paste your message thread or Reddit story (at least a few lines) before generating a song.",
    );
  }
  return text;
}

export function isMusicFromSourceProject(project: Project): boolean {
  return (
    project.form.contentType === "music_lyrics" ||
    project.generatedScript?.contentType === "music_lyrics"
  );
}
