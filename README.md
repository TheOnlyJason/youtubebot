# SafeShorts Studio

Local-first **Next.js** app to draft **copyright-conscious YouTube Shorts**: original scripts (OpenAI or offline mock), optional **OpenAI TTS**, uploads for voice/music/media, **ASS captions burned in** with **FFmpeg**, and **1080×1920** MP4 export. A **human review checklist** and **rights confirmation** gate rendering.

## Requirements

- **Node.js 18+** and npm
- **FFmpeg** for final MP4 assembly: **`npm install` includes `ffmpeg-static`** (bundled binary — no system install required). Optional: set **`FFMPEG_PATH`** in `.env.local` if you prefer your own `ffmpeg.exe`.

### Windows

After `npm install`, render should work without installing FFmpeg globally. If you still see **`spawn ffmpeg ENOENT`**, run `npm install` again or set `FFMPEG_PATH` to a full path to `ffmpeg.exe`.

## Setup

```bash
cd youtubebot
cp .env.example .env.local
# Optional: in .env.local add OPENAI_API_KEY=... for AI script + server TTS (never commit .env.local)
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Sample data

See `data/sample-project.json`. To pre-seed projects, create `data/projects.json`:

```json
{ "projects": [ /* paste the "project" object from sample-project.json */ ] }
```

Generate a script in the UI once to create five timed **scenes** (the sample has empty `scenes` until you do).

## MVP flow

1. **Dashboard** → New project → fill topic and settings.
2. **Generate script** → edit text → **safety** panel (green / yellow / red).
3. **Voice**: upload audio, or **Server TTS (OpenAI)** if `OPENAI_API_KEY` is set, or **browser preview** (preview only; not used in render).
4. **Visuals**: **OpenAI Sora** video per scene, **DALL·E** stills, **Pexels** stock clips, upload, or color backgrounds.
5. **Music** (optional): upload + **commercial rights** checkbox; level slider (~10–15% default).
6. **Rights** checkbox + **human review** checklist → **Render** (FFmpeg).
7. **Export** page: preview, download MP4, copy metadata, export JSON, re-render.

**YouTube:** the **YouTube helper** page is metadata-only; there is **no automatic upload** in this MVP.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Chat script + optional TTS |
| `FFMPEG_PATH` | Full path to `ffmpeg` if not on PATH (fixes `spawn ffmpeg ENOENT`) |
| `OPENAI_BASE_URL` | Optional compatible API base |
| `OPENAI_SCRIPT_MODEL` | Default `gpt-4o-mini` |
| `OPENAI_TTS_MODEL` | Default `tts-1` |
| `OPENAI_IMAGE_MODEL` | Default `dall-e-3` for scene stills |
| `OPENAI_VIDEO_MODEL` | Default `sora-2` (720×1280, faster). Use `sora-2-pro` for 1080×1920 |
| `PEXELS_API_KEY` | Optional — real stock video per scene |

No keys are committed; use `.env.local` (gitignored).

### Confirm Sora / Videos API access

```bash
npm run check:sora              # list Sora models on your key (free)
npm run check:sora -- --live    # start a test video job (may bill)
```

With `--live`, if you get a job `id` and `queued`/`in_progress`, your key can use Sora. A `403` or “model” / “access” error means the API is not enabled for that key or org yet.

Also check [platform.openai.com](https://platform.openai.com) → **Settings** → billing active, and **Usage** after a test. ChatGPT’s in-app Sora is **not** the same as API access.

## Folder layout

- `app/` — routes (dashboard, project, export, YouTube helper, API)
- `components/` — UI
- `lib/ai`, `lib/tts`, `lib/video`, `lib/safety` — providers and FFmpeg pipeline
- `uploads/` — user uploads (`uploads/projects/<id>/...`)
- `renders/` — output MP4s
- `data/projects.json` — SQLite-style JSON store (auto-created)

## Provider hooks

- **Script / LLM:** `lib/ai/script.ts` — swap `fetch` URL and payload for another vendor.
- **TTS:** `lib/tts/index.ts` — register additional `TtsProvider` implementations (e.g. ElevenLabs, Google).

## Legal / safety

This tool **does not** fetch YouTube or other platform clips. You are responsible for rights to all uploads. The app surfaces **keyword warnings** and a **basic script scanner**; it is **not** legal advice.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — run production build
- `npm run lint` — ESLint
