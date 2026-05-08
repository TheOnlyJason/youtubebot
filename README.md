# SafeShorts Studio

Local-first **Next.js** app to draft **copyright-conscious YouTube Shorts**: original scripts (OpenAI or offline mock), optional **OpenAI TTS**, uploads for voice/music/media, **ASS captions burned in** with **FFmpeg**, and **1080×1920** MP4 export. A **human review checklist** and **rights confirmation** gate rendering.

## Requirements

- **Node.js 18+** and npm
- **FFmpeg** available to the dev server: either on your `PATH` (`ffmpeg -version` in the **same** terminal you use for `npm run dev`) or set **`FFMPEG_PATH`** in `.env.local` to the full path of `ffmpeg.exe` (Windows).

### Windows

Install FFmpeg (e.g. [gyan.dev builds](https://www.gyan.dev/ffmpeg/builds/) or `winget install ffmpeg`). **Restart the terminal and your IDE** so the PATH update is picked up by the process running Next.js.

If you still see **`spawn ffmpeg ENOENT`**, add to `.env.local`:

`FFMPEG_PATH=C:\full\path\to\ffmpeg.exe`

(Find `ffmpeg.exe` in Explorer or run `where ffmpeg` in PowerShell after install.)

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
4. **Visuals**: per-scene upload or built-in **animated backgrounds**.
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

No keys are committed; use `.env.local` (gitignored).

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
