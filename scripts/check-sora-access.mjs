/**
 * Quick check: does this OPENAI_API_KEY have Sora / Videos API access?
 *
 * Usage (from repo root):
 *   npm run check:sora              # lists models + instructions (no charge)
 *   npm run check:sora -- --live    # starts a real test video job (may bill)
 *
 * Reads OPENAI_API_KEY from the environment, then .env.local, then .env.
 */

import fs from "fs";
import path from "path";

const live = process.argv.includes("--live");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^OPENAI_API_KEY=(.+)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

function loadKey() {
  if (process.env.OPENAI_API_KEY?.trim()) return process.env.OPENAI_API_KEY.trim();
  const root = process.cwd();
  return (
    parseEnvFile(path.join(root, ".env.local")) ??
    parseEnvFile(path.join(root, ".env")) ??
    null
  );
}

/** Avoid Windows libuv crash when exiting while fetch sockets are still closing. */
async function shutdown(exitCode) {
  try {
    const { getGlobalDispatcher } = await import("undici");
    await getGlobalDispatcher().close();
  } catch {
    await new Promise((r) => setTimeout(r, 300));
  }
  process.exit(exitCode);
}

async function main() {
  const key = loadKey();
  if (!key) {
    console.error(
      "No OPENAI_API_KEY found. Add it to .env or .env.local (or export it in the shell).",
    );
    await shutdown(1);
  }

  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const model = process.env.OPENAI_VIDEO_MODEL || "sora-2";
  const headers = { Authorization: `Bearer ${key}` };

  console.log("Checking OpenAI account for Sora / Videos API…\n");

  try {
    const modelsRes = await fetch(`${base}/models`, { headers });
    const body = modelsRes.ok ? await modelsRes.json() : null;
    if (body) {
      const sora = (body.data || [])
        .map((m) => m.id)
        .filter((id) => typeof id === "string" && id.includes("sora"));
      if (sora.length) {
        console.log("Sora-related models visible on your account:");
        sora.forEach((id) => console.log(`  - ${id}`));
      } else {
        console.log(
          "No model IDs containing 'sora' in GET /models (this alone does not prove lack of access).",
        );
      }
      console.log();
    }
  } catch (e) {
    console.warn("Could not list models:", e.message);
  }

  if (!live) {
    console.log(
      "Run with --live to start a tiny test render (may incur Sora charges):\n  npm run check:sora -- --live\n",
    );
    await shutdown(0);
  }

  const testBody = {
    model,
    prompt:
      "A calm wide shot of ocean waves at sunset, gentle motion, no people, documentary B-roll.",
    size: model.includes("pro") ? "1080x1920" : "720x1280",
    seconds: "16",
  };

  console.log(`POST /videos (model=${model})…`);

  const createRes = await fetch(`${base}/videos`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(testBody),
  });

  const text = await createRes.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (createRes.ok && json.id) {
    console.log("\n✓ Videos API access looks OK.");
    console.log(`  Job id: ${json.id}`);
    console.log(`  Status: ${json.status ?? "unknown"}`);
    console.log(
      "\nA short test clip was queued (you may be billed). Check usage at:",
    );
    console.log("  https://platform.openai.com/usage");
    await shutdown(0);
  }

  console.error("\n✗ Videos API request failed.");
  console.error(`  HTTP ${createRes.status}`);
  if (json.error?.message) console.error(`  Message: ${json.error.message}`);
  else if (json.raw) console.error(`  Body: ${json.raw.slice(0, 500)}`);
  else console.error(`  Body: ${text.slice(0, 500)}`);

  console.error(`
Common causes:
  - Account not verified / billing not set up: https://platform.openai.com/settings/organization/general
  - API key from a project without video access
  - Sora not enabled for your org (check https://platform.openai.com/docs/models and usage limits)
  - Using a key that only has chat/TTS but not video models

ChatGPT Sora in the app (chatgpt.com) is separate from API access.
`);

  await shutdown(1);
}

main().catch(async (e) => {
  console.error(e);
  await shutdown(1);
});
