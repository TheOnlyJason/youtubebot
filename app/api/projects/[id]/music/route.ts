import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { adaptSourceToSongScript, composeSongFromSource } from "@/lib/ai/composeSong";
import { extFromMime, generateLyriaMusic } from "@/lib/ai/lyria";
import { defaultTitleFromSource, isMusicFromSourceProject } from "@/lib/ai/sourceText";
import { getProject, saveProject } from "@/lib/db";
import { ensureDir, uploadsDir } from "@/lib/paths";
import type { LyriaModelId } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  let project = getProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    instrumental?: boolean;
    model?: LyriaModelId;
    asPrimaryAudio?: boolean;
    /** Adapt messages/reddit → lyrics + scenes before Lyria (default true for music projects) */
    adaptFromSource?: boolean;
    sourceText?: string;
  };

  const isMusic = isMusicFromSourceProject(project);
  const adaptFromSource = body.adaptFromSource !== false && isMusic;

  if (body.sourceText?.trim()) {
    project = {
      ...project,
      form: {
        ...project.form,
        sourceText: body.sourceText.trim(),
        topic: project.form.topic.trim() || defaultTitleFromSource(body.sourceText),
      },
    };
  }

  try {
    let adapted = project;
    let lyriaResult;

    if (adaptFromSource) {
      const composed = await composeSongFromSource(project, {
        instrumental: body.instrumental === true,
        model: body.model,
      });
      adapted = composed.project;
      lyriaResult = composed.lyria;
    } else {
      lyriaResult = await generateLyriaMusic(project, {
        instrumental: body.instrumental === true,
        model: body.model,
      });
    }

    const ext = extFromMime(lyriaResult.mimeType);
    const base = path.join(uploadsDir(), "projects", id);
    ensureDir(base);
    const filename = `lyria${ext}`;
    fs.writeFileSync(path.join(base, filename), lyriaResult.audio);
    const relative = path
      .join("uploads", "projects", id, filename)
      .replace(/\\/g, "/");

    const asPrimary = body.asPrimaryAudio !== false;
    const lyricsNote = lyriaResult.lyricsText.slice(0, 12000);

    const next = {
      ...adapted,
      generatedScript: adapted.generatedScript
        ? {
            ...adapted.generatedScript,
            fullLyrics: lyricsNote || adapted.generatedScript.fullLyrics,
            fullVoiceoverScript:
              lyricsNote || adapted.generatedScript.fullVoiceoverScript,
          }
        : adapted.generatedScript,
      ...(asPrimary
        ? {
            voiceover: {
              mode: "upload" as const,
              fileRelativePath: relative,
              providerId: lyriaResult.model,
            },
          }
        : {
            music: {
              ...adapted.music,
              fileRelativePath: relative,
              rightsConfirmed: true,
              providerId: lyriaResult.model,
              generatedLyricsText: lyricsNote,
            },
          }),
      ...(asPrimary && isMusic
        ? {
            renderChecklist: {
              ...adapted.renderChecklist,
              scriptOriginal: true,
              voiceOriginalOrLicensed: true,
              noCopyrightedSong: true,
            },
          }
        : {}),
    };

    saveProject(next);
    return NextResponse.json({
      project: next,
      lyria: {
        model: lyriaResult.model,
        relativePath: relative,
        lyricsPreview: lyricsNote.slice(0, 500),
        bytes: lyriaResult.audio.length,
        adaptedFromSource: adaptFromSource,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Song generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Adapt source text to lyrics + scenes only (no Lyria yet) */
export async function PUT(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  let project = getProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isMusicFromSourceProject(project)) {
    return NextResponse.json({ error: "Not a story-to-song project" }, { status: 400 });
  }
  try {
    const next = await adaptSourceToSongScript(project);
    saveProject(next);
    return NextResponse.json({ project: next });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Adaptation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
