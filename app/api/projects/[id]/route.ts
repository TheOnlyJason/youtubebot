import { NextResponse } from "next/server";
import { deleteProject, getProject, saveProject } from "@/lib/db";
import { reconcileProjectState } from "@/lib/visuals/soraReconcile";
import type {
  GeneratedScript,
  MusicState,
  Project,
  RenderChecklist,
  RightsConfirmation,
  Scene,
  VoiceoverState,
} from "@/types";

export const dynamic = "force-dynamic";

type PatchBody = {
  form?: Partial<Project["form"]>;
  generatedScript?: GeneratedScript;
  safetyReport?: Project["safetyReport"];
  scenes?: Scene[];
  voiceover?: VoiceoverState;
  music?: Partial<MusicState>;
  voiceVolume?: number;
  musicVolume?: number;
  renderChecklist?: Partial<RenderChecklist>;
  rights?: Partial<RightsConfirmation>;
  exportApproved?: boolean;
  topicKeywordWarnings?: string[];
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const p = getProject(id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const project = reconcileProjectState(p);
  return NextResponse.json({ project });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const existing = getProject(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json()) as PatchBody;
  const next: Project = {
    ...existing,
    form: body.form ? { ...existing.form, ...body.form } : existing.form,
    generatedScript: body.generatedScript ?? existing.generatedScript,
    safetyReport: body.safetyReport ?? existing.safetyReport,
    scenes: body.scenes ?? existing.scenes,
    voiceover: body.voiceover ?? existing.voiceover,
    music: body.music ? { ...existing.music, ...body.music } : existing.music,
    voiceVolume: body.voiceVolume ?? existing.voiceVolume,
    musicVolume: body.musicVolume ?? existing.musicVolume,
    renderChecklist: body.renderChecklist
      ? { ...existing.renderChecklist, ...body.renderChecklist }
      : existing.renderChecklist,
    rights: body.rights ? { ...existing.rights, ...body.rights } : existing.rights,
    exportApproved: body.exportApproved ?? existing.exportApproved,
    topicKeywordWarnings: body.topicKeywordWarnings ?? existing.topicKeywordWarnings,
  };
  saveProject(next);
  return NextResponse.json({ project: next });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const ok = deleteProject(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
