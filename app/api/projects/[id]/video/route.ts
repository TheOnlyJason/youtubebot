import { NextResponse } from "next/server";
import fs from "fs";
import { getProject } from "@/lib/db";
import { absFromRelative } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = getProject(id);
  if (!project?.render.outputRelativePath) {
    return NextResponse.json({ error: "No render" }, { status: 404 });
  }
  const abs = absFromRelative(project.render.outputRelativePath);
  if (!fs.existsSync(abs)) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
  const data = fs.readFileSync(abs);
  return new NextResponse(data, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `inline; filename="safeshorts-${id}.mp4"`,
    },
  });
}
