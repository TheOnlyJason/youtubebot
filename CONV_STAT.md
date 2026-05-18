# Conversation status — SafeShorts Studio

Last updated: 2026-05-18

---

## Project goal (why this app exists)

**SafeShorts Studio** is a local-first Next.js app to help create **copyright-conscious YouTube Shorts** with a **human review step** before export.

| Target output | 9:16 vertical MP4 (1080×1920), voiceover, burned-in captions, optional licensed music |
|---------------|----------------------------------------------------------------------------------------|
| Not in scope (MVP) | Auto-upload to YouTube; scraping TikTok/YouTube clips; copyrighted music |

**Intended pipeline**

1. Original AI script (5 scenes)
2. Voice (upload or OpenAI TTS)
3. **Real visuals** (not just colored slides)
4. Human rights + safety checklist
5. FFmpeg render → download / YouTube helper metadata

---

## Your goals in this conversation

| # | What you wanted | Root issue |
|---|-----------------|------------|
| 1 | **Real video**, not a slideshow of stills + audio | Render used **animated color backgrounds** unless you uploaded or generated media per scene |
| 2 | **Photorealistic** visuals, not cartoon | No image gen at first; DALL·E / defaults improved later |
| 3 | **FFmpeg without a system install** | `spawn ffmpeg ENOENT` on Windows |
| 4 | **Use OpenAI Sora** for motion video | Was not wired in initially; added after you pointed at the Videos API docs |
| 5 | **Progress feedback** while Sora runs | Long async jobs; added progress bar + background jobs + polling |
| 6 | **Faster / lower quality** Sora | `sora-2-pro` @ 1080p was very slow; switched to **`sora-2` @ 720×1280** |
| 7 | **This document** (`CONV_STAT`) | Ongoing log of goals, work, and outcomes |

**Clarification:** **Closed captions do not slow down Sora.** Captions are burned in only at the final **Render** step (FFmpeg + ASS), after all scene videos exist.

---

## What was wrong (dog project example)

Project ID: `e66c9180-a051-4374-918c-2a59d90dd2bc` (dogs catching food in the air)

| Symptom | Cause |
|---------|--------|
| Final MP4 was **solid colors** | All 5 scenes were `animated_bg` with **no** `fileRelativePath` — user went straight to **Render** without **Generate Sora video** |
| Sora felt “not used” | Sora is a **separate button**; it does not run automatically before render |
| `POST /visuals` **500 @ ~10 min** | Our poll timeout was **10 minutes**; Sora was still `in_progress` |
| Progress stuck at **0%** | OpenAI often reports `0%` for a long time, then jumps (e.g. 40%); UI now smooths backward jumps |
| `useEffect` warning | Unstable dependency array (`?.active`); fixed with stable booleans |

---

## What we built / changed (chronological)

### Session A — Initial MVP (earlier chat)

- SafeShorts Studio: script, TTS, scenes, safety, checklist, FFmpeg render, export page
- Visuals = text suggestions + **animated backgrounds** or manual upload

### Session B — Your feedback + fixes

| Change | Files / notes |
|--------|----------------|
| Bundled FFmpeg | `ffmpeg-static`, `lib/video/ffmpegBin.ts`, `FFMPEG_PATH` in `.env` |
| DALL·E scene stills | `lib/ai/images.ts`, visuals API |
| Pexels stock video | `lib/visuals/pexels.ts` (optional `PEXELS_API_KEY`) |
| Default visual style | `realistic` for new projects |
| **Sora Videos API** | `lib/ai/sora.ts`, `lib/visuals/soraRunner.ts`, UI button |
| Sora access check | `npm run check:sora` (reads `.env` + `.env.local`) |
| Block render without media | `lib/sceneMedia.ts`, `canRender()` — no more silent solid-color export |
| Render uses files if present | Fixed bug: `animated_bg` + file path was ignored |
| **Progress bar** | Background Sora job, poll project every 2.5s, `visualGeneration` on project |
| Longer Sora wait | 30 min poll default; route `maxDuration` 3600s |
| **Faster Sora** | `.env`: `OPENAI_VIDEO_MODEL=sora-2`, `OPENAI_VIDEO_SIZE=720x1280` |

---

## Current configuration (your machine)

```env
# .env (not only .env.local — check script reads both)
OPENAI_API_KEY=...
FFMPEG_PATH=C:/Users/aiteam.user/Jason/youtubebot/node_modules/ffmpeg-static/ffmpeg.exe
OPENAI_VIDEO_MODEL=sora-2
OPENAI_VIDEO_SIZE=720x1280
```

| Setting | Effect |
|---------|--------|
| `sora-2` + `720x1280` | Faster, lower cost, draft quality |
| `sora-2-pro` + `1080x1920` | Slower, best quality (set in `.env` if you switch back) |

**Sora API access:** Confirmed working (`npm run check:sora -- --live` returned job `queued`).

---

## How to use the app now (correct order)

1. `npm install` → `npm run dev`
2. New or open project → **Generate script**
3. **Server TTS** (or upload voice)
4. **Generate Sora video (OpenAI)** — wait for progress bar (per scene; 5 scenes = long total time)
5. Confirm each scene shows **✓ uploads/.../scene_X_sora.mp4**
6. Complete checklist + rights → **Render vertical MP4**
7. Export / YouTube helper

**Alternatives on Visuals step:** DALL·E stills (Ken Burns at render), Pexels stock clips, manual upload.

---

## Outcomes vs goals

| Goal | Status |
|------|--------|
| No system FFmpeg | **Done** — bundled binary + `FFMPEG_PATH` |
| Photorealistic option | **Done** — DALL·E + realistic prompts; Sora for motion |
| Real motion video | **Done** — Sora per scene (manual step before render) |
| Know Sora is working | **Done** — `check:sora`, terminal `[sora]` logs, UI progress bar |
| Faster iteration | **Done** — default `sora-2` @ 720p |
| Auto Sora before render | **Not done** (by design — too slow/expensive to surprise users) |
| YouTube auto-upload | **Not in MVP** |

---

## Known limits

- **Sora:** Minutes per scene even on `sora-2`; 5 scenes sequentially can take a long time. OpenAI Videos API deprecation noted for **Sept 2026** in their docs.
- **Render** upscales 720p Sora clips to 1080×1920 — softer than native 1080p Sora.
- **DALL·E** = stills + motion effects, not true video.
- **Background job** stops if you kill `npm run dev` mid-generation.
- **`.env` vs `.env.local`:** Both work with Next.js; `check:sora` reads both.

---

## Projects referenced

| Project ID | Topic | Notes |
|------------|-------|--------|
| `cb501e3c-176a-4d7c-b222-2001d2a764ba` | Car facts | Early `ffmpeg ENOENT`; animated_bg only |
| `e66c9180-a051-4374-918c-2a59d90dd2bc` | Dogs / food toss | Solid-color render before Sora; Sora gen in progress / slow |

---

## Suggested next steps

1. Restart dev server after `.env` changes.
2. On dog project: run **Generate Sora video** again with `sora-2` (cancel old run if server was restarted).
3. When all 5 scenes have files → **Render** again.
4. For production quality: switch to `sora-2-pro` + `1080x1920` when you accept longer waits.

---

## Key files (for developers)

| Area | Path |
|------|------|
| Sora API | `lib/ai/sora.ts` |
| Background + progress | `lib/visuals/soraRunner.ts` |
| Visuals API | `app/api/projects/[id]/visuals/route.ts` |
| Render / FFmpeg | `lib/video/ffmpeg.ts`, `lib/video/ffmpegBin.ts` |
| Media gating | `lib/sceneMedia.ts`, `lib/projectStatus.ts` |
| UI | `components/ProjectWorkspace.tsx` |
| Sora check | `scripts/check-sora-access.mjs` |
