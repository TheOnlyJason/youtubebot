import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type { Project, Scene } from "@/types";
import { absFromRelative, ensureDir, rendersDir } from "@/lib/paths";
import {
  assertFfmpegPathExists,
  ffmpegMissingMessage,
  getFfmpegExecutable,
} from "@/lib/video/ffmpegBin";

function runFfmpeg(args: string[], cwd?: string): Promise<string> {
  const bin = getFfmpegExecutable();
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, {
      cwd,
      shell: false,
      windowsHide: true,
    });
    let stderr = "";
    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on("error", (err) => {
      const ne = err as NodeJS.ErrnoException;
      if (ne.code === "ENOENT") {
        reject(new Error(ffmpegMissingMessage(bin)));
        return;
      }
      reject(err);
    });
    proc.on("close", (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-4000)}`));
    });
  });
}

export function normalizeSceneDurations(
  scenes: Scene[],
  targetSeconds: number,
): Scene[] {
  if (!scenes.length) return scenes;
  const weights = scenes.map((s) => Math.max(1, s.durationSeconds));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const base = scenes.map((s, i) => ({
    ...s,
    durationSeconds: Math.max(1, Math.floor((targetSeconds * weights[i]) / wsum)),
  }));
  let used = base.reduce((a, s) => a + s.durationSeconds, 0);
  let i = 0;
  while (used < targetSeconds) {
    base[i % base.length].durationSeconds += 1;
    used++;
    i++;
  }
  while (used > targetSeconds) {
    const idx = i % base.length;
    if (base[idx].durationSeconds > 1) {
      base[idx].durationSeconds -= 1;
      used--;
    }
    i++;
    if (i > 100000) break;
  }
  return base;
}

function vfForMotion(motion: Scene["motion"], frames: number): string {
  const base =
    "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p";
  if (motion === "fade") {
    return `${base},fade=t=in:st=0:d=0.35`;
  }
  if (motion === "zoom_in") {
    return `scale=4000:-1,zoompan=z='min(zoom+0.0018,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30,format=yuv420p`;
  }
  if (motion === "pan") {
    return `scale=4000:-1,zoompan=z=1.12:x='50+on*3':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=30,format=yuv420p`;
  }
  return `${base},fade=t=in:st=0:d=0.15`;
}

async function buildSceneSegment(
  scene: Scene,
  idx: number,
  workDir: string,
  isLavfi: boolean,
): Promise<string> {
  const out = path.join(workDir, `seg_${idx}.mp4`);
  const dur = scene.durationSeconds;
  const frames = Math.max(1, Math.round(dur * 30));
  const vf = isLavfi
    ? "format=yuv420p,fade=t=in:st=0:d=0.25"
    : vfForMotion(scene.motion, frames);

  if (scene.media.sourceType === "upload" && scene.media.fileRelativePath) {
    const abs = absFromRelative(scene.media.fileRelativePath);
    if (!fs.existsSync(abs)) {
      throw new Error(`Missing media file: ${scene.media.fileRelativePath}`);
    }
    const ext = path.extname(abs).toLowerCase();
    const isVideo = [".mp4", ".webm", ".mov", ".mkv"].includes(ext);
    if (isVideo) {
      await runFfmpeg(
        [
          "-y",
          "-i",
          abs,
          "-t",
          String(dur),
          "-vf",
          vf,
          "-an",
          "-r",
          "30",
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          out,
        ],
        workDir,
      );
    } else {
      await runFfmpeg(
        [
          "-y",
          "-loop",
          "1",
          "-i",
          abs,
          "-t",
          String(dur),
          "-vf",
          vf,
          "-r",
          "30",
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          out,
        ],
        workDir,
      );
    }
    return out;
  }

  const hex =
    ["0x1a1a2e", "0x16213e", "0x0f3460", "0x533483", "0xe94560"][idx % 5];
  await runFfmpeg(
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=${hex}:s=1080x1920:r=30`,
      "-t",
      String(dur),
      "-vf",
      vf,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      out,
    ],
    workDir,
  );
  return out;
}

function escapeAssText(text: string): string {
  return text.replace(/\n/g, " ").replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
}

function buildAssTimed(scenes: Scene[]): string {
  let t = 0;
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,64,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,2,2,60,60,140,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const lines: string[] = [];
  for (const s of scenes) {
    const start = t;
    const end = t + s.durationSeconds;
    const cs = formatAssTime(start);
    const ce = formatAssTime(end);
    const cap = escapeAssText(s.caption || " ");
    lines.push(`Dialogue: 0,${cs},${ce},Default,,0,0,0,,${cap}`);
    t = end;
  }
  return header + lines.join("\n");
}

function formatAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export interface RenderResult {
  relativeOutput: string;
  absoluteOutput: string;
}

export async function renderVerticalMp4(project: Project): Promise<RenderResult> {
  if (!project.generatedScript) throw new Error("Script required");
  if (!project.voiceover.fileRelativePath) throw new Error("Voiceover file required");
  assertFfmpegPathExists(getFfmpegExecutable());
  const voiceAbs = absFromRelative(project.voiceover.fileRelativePath);
  if (!fs.existsSync(voiceAbs)) {
    throw new Error(
      `Voiceover missing on disk (resolved: ${voiceAbs}). Re-upload or regenerate TTS.`,
    );
  }

  const target = project.form.duration;
  const scenes = normalizeSceneDurations(project.scenes, target);
  const workDir = path.join(rendersDir(), `work_${project.id}_${Date.now()}`);
  ensureDir(rendersDir());
  fs.mkdirSync(workDir, { recursive: true });

  const segments: string[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const lavfi =
      !s.media.fileRelativePath ||
      s.media.sourceType === "animated_bg" ||
      s.media.sourceType === "placeholder";
    const p = await buildSceneSegment(s, i, workDir, lavfi);
    segments.push(p);
  }

  const concatPath = path.join(workDir, "concat.mp4");
  const concatArgs = ["-y"];
  for (const seg of segments) {
    concatArgs.push("-i", seg);
  }
  const concatFilter =
    segments.map((_, i) => `[${i}:v]`).join("") +
    `concat=n=${segments.length}:v=1:a=0[outv]`;
  concatArgs.push(
    "-filter_complex",
    concatFilter,
    "-map",
    "[outv]",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    concatPath,
  );
  await runFfmpeg(concatArgs, workDir);

  const assPath = path.join(workDir, "captions.ass");
  fs.writeFileSync(assPath, buildAssTimed(scenes), "utf-8");

  const outName = `short_${project.id}.mp4`;
  const outAbs = path.join(rendersDir(), outName);
  const assForFilter = assPath.replace(/\\/g, "/").replace(":", "\\:");

  const musicAbs =
    project.music.fileRelativePath && project.music.rightsConfirmed
      ? absFromRelative(project.music.fileRelativePath)
      : null;
  const hasMusic = musicAbs && fs.existsSync(musicAbs);

  const totalSeconds = scenes.reduce((a, s) => a + s.durationSeconds, 0);

  if (hasMusic) {
    const mv = Math.max(0, Math.min(1, project.musicVolume));
    const vv = Math.max(0, Math.min(2, project.voiceVolume));
    const fadeOutSt = Math.max(0, totalSeconds - 0.5);
    const filter = [
      `[0:v]ass='${assForFilter}'[vout];`,
      `[1:a]volume=${vv},apad=whole_dur=${totalSeconds}[a1];`,
      `[2:a]volume=${mv},apad=whole_dur=${totalSeconds}[a2];`,
      `[a1][a2]amix=inputs=2:duration=longest:dropout_transition=0[am];`,
      `[am]afade=t=in:st=0:d=0.4,afade=t=out:st=${fadeOutSt}:d=0.4[aout]`,
    ].join("");
    await runFfmpeg(
      [
        "-y",
        "-i",
        concatPath,
        "-i",
        voiceAbs,
        "-i",
        musicAbs,
        "-filter_complex",
        filter,
        "-map",
        "[vout]",
        "-map",
        "[aout]",
        "-t",
        String(totalSeconds),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        outAbs,
      ],
      workDir,
    );
  } else {
    const vv = Math.max(0, Math.min(2, project.voiceVolume));
    const fadeOutSt = Math.max(0, totalSeconds - 0.5);
    const filter = [
      `[0:v]ass='${assForFilter}'[vout];`,
      `[1:a]volume=${vv},apad=whole_dur=${totalSeconds}[a];`,
      `[a]afade=t=in:st=0:d=0.4,afade=t=out:st=${fadeOutSt}:d=0.4[aout]`,
    ].join("");
    await runFfmpeg(
      [
        "-y",
        "-i",
        concatPath,
        "-i",
        voiceAbs,
        "-filter_complex",
        filter,
        "-map",
        "[vout]",
        "-map",
        "[aout]",
        "-t",
        String(totalSeconds),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        outAbs,
      ],
      workDir,
    );
  }

  fs.rmSync(workDir, { recursive: true, force: true });

  return {
    absoluteOutput: outAbs,
    relativeOutput: path.join("renders", outName).replace(/\\/g, "/"),
  };
}
