import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getProject, saveProject } from "@/lib/db";
import { generateVoiceover } from "@/lib/tts";
import { ensureDir, uploadsDir } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = getProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!project.generatedScript?.fullVoiceoverScript) {
    return NextResponse.json({ error: "Script required" }, { status: 400 });
  }
  try {
    const result = await generateVoiceover(
      project.generatedScript.fullVoiceoverScript,
      project.form.voiceStyle,
    );
    const base = path.join(uploadsDir(), "projects", id);
    ensureDir(base);
    const fname = `voice_tts.${result.extension}`;
    const dest = path.join(base, fname);
    fs.writeFileSync(dest, result.audioBuffer);
    const relative = path.join("uploads", "projects", id, fname).replace(/\\/g, "/");
    const next = {
      ...project,
      voiceover: {
        mode: "tts_openai" as const,
        fileRelativePath: relative,
        providerId: result.providerId,
      },
    };
    saveProject(next);
    return NextResponse.json({ project: next });
  } catch (e) {
    const message = e instanceof Error ? e.message : "TTS failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
