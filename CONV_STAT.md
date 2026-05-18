# Conversation status — SafeShorts Studio

Last updated: 2026-05-18

## What you reported

1. **“Video” feels like slideshows** — the app builds Shorts from still images (or color backgrounds) with motion effects, then mixes voiceover and captions. It does not generate true AI motion video end-to-end.
2. **Visuals look cartoonish** — you want **photorealistic** imagery when possible.
3. **FFmpeg blocked on your PC** — render failed with `spawn ffmpeg ENOENT` (see `data/projects.json` for the car-facts project).
4. **Conversation status** — this file.

## What the app did before this session

Built in an earlier session as **SafeShorts Studio** (local Next.js MVP):

| Area | Behavior |
|------|----------|
| Script | OpenAI chat (or offline mock) → 5 scenes + captions |
| Voice | Upload or OpenAI TTS |
| Visuals | Text *suggestions* only; colored **animated backgrounds** or manual upload |
| Render | **FFmpeg** concatenates segments, burns ASS captions, mixes audio → 1080×1920 MP4 |
| YouTube | Metadata helper only (no auto-upload) |

There was **no** built-in AI image or stock-video fetch — only suggestions + optional uploads. Ken Burns (zoom/pan) on stills can feel like a “picture slideshow,” which matches your observation.

## What we changed in this session

| Change | Purpose |
|--------|---------|
| **`ffmpeg-static` npm package** | Bundled `ffmpeg.exe` under `node_modules` — render works without a system FFmpeg install |
| **`lib/ai/images.ts` + `POST …/visuals`** | Generate **5 photorealistic** scene stills via DALL·E 3 (`style: natural` when visual style is realistic/cinematic/minimal/stock) |
| **`lib/visuals/pexels.ts`** | Optional **real stock video** per scene (needs free `PEXELS_API_KEY`) |
| **UI buttons** | “Generate AI images (photorealistic)” and “Fetch stock video (Pexels)” on the Visuals step |
| **Script prompts** | Scene visual suggestions now ask for shootable B-roll, not cartoon |
| **Default visual style** | New projects default to **`realistic`** instead of `minimal` |

## Outcomes

| Goal | Status |
|------|--------|
| No system FFmpeg | **Addressed** — use bundled binary after `npm install` |
| Less cartoon / more realistic stills | **Addressed** — DALL·E prompts + `natural` style + default `realistic` |
| Actual moving video footage | **Partially addressed** — use **Pexels stock video** per scene; not full generative video (Sora/Runway class) |
| True AI-generated video clips | **Not in MVP** — would need a separate video API, cost, and latency |

## How to use it now

1. `npm install` (pulls in `ffmpeg-static`).
2. `.env.local`: `OPENAI_API_KEY` (script, TTS, **images**).
3. Optional: `PEXELS_API_KEY` for real video clips.
4. Flow: **Generate script** → **Server TTS** → **Generate AI images** *or* **Fetch stock video** → checklist + rights → **Render**.

## Update: OpenAI Sora (Videos API)

We were **not** using Sora initially because the first MVP shipped with FFmpeg + uploads only; the follow-up added DALL·E/Pexels as faster/cheaper paths before Sora was wired in.

**Now integrated:** `lib/ai/sora.ts` + **Generate Sora video (OpenAI)** in the UI. Uses `POST /v1/videos`, polls until `completed`, downloads MP4 per scene. Default model `sora-2-pro` at `1080x1920`.

**Why it wasn’t the default earlier:** async jobs (minutes per clip), higher cost, API access gating, and 16–20s clip lengths (trimmed at render) — not because the API is unsuitable.

## Known limits (honest)

- **Sora**: several minutes per scene; 5 scenes ≈ long wait; needs Sora enabled on your OpenAI account. API deprecates Sept 2026 per OpenAI docs.
- **DALL·E stills** are not motion video; render adds Ken Burns effects.
- **Pexels** clips are licensed stock; search quality varies.
- **YouTube upload** remains manual via the helper page.

## Your car-facts project

- ID: `cb501e3c-176a-4d7c-b222-2001d2a764ba`
- Had voiceover + script; scenes used **animated_bg** only (no uploaded/generated media).
- Render error: `spawn ffmpeg ENOENT` — should clear after `npm install` and re-render, ideally after generating images or stock video for all 5 scenes.

## Suggested next steps (if you want more)

1. Re-open the project → generate visuals → render again.
2. Add `PEXELS_API_KEY` if you want real footage instead of AI stills.
3. Future: integrate a **video generation API** (Runway, Luma, etc.) behind a feature flag for true AI motion (higher cost/complexity).
