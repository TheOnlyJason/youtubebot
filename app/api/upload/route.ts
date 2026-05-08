import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { ensureDir, uploadsDir } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  const projectId = String(form.get("projectId") || "");
  const kind = String(form.get("kind") || "scene");
  const sceneIndex = form.get("sceneIndex");

  if (!projectId || !(file instanceof File)) {
    return NextResponse.json({ error: "projectId and file required" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name || "") || ".bin";
  const base = path.join(uploadsDir(), "projects", projectId);
  ensureDir(base);

  let relative: string;
  if (kind === "voice") {
    const dest = path.join(base, `voice${ext}`);
    fs.writeFileSync(dest, buf);
    relative = path.join("uploads", "projects", projectId, `voice${ext}`).replace(/\\/g, "/");
  } else if (kind === "music") {
    const dest = path.join(base, `music${ext}`);
    fs.writeFileSync(dest, buf);
    relative = path.join("uploads", "projects", projectId, `music${ext}`).replace(/\\/g, "/");
  } else {
    const idx = sceneIndex != null ? Number(sceneIndex) : 0;
    const dest = path.join(base, `scene_${idx}${ext}`);
    fs.writeFileSync(dest, buf);
    relative = path.join("uploads", "projects", projectId, `scene_${idx}${ext}`).replace(
      /\\/g,
      "/",
    );
  }

  return NextResponse.json({ relativePath: relative, size: buf.length });
}
