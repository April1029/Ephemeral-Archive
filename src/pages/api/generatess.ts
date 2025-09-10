// /pages/api/generate.ts
export const runtime = "nodejs";
import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: { bodyParser: { sizeLimit: "2mb" } },
};

const HF_URL = "https://router.huggingface.co/v1/chat/completions";
const HF_MODEL = "openai/gpt-oss-20b:fireworks-ai";
const REQUEST_TIMEOUT_MS = 60_000;

// ---------------- JSON helpers ----------------
function extractFirstJsonObjectBalanced(s: string) {
  let start = -1, depth = 0, inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (start === -1) { if (ch === "{") { start = i; depth = 1; } continue; }
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return JSON.parse(s.slice(start, i + 1));
    }
  }
  throw new Error("No balanced JSON object found");
}

function parseJsonFromContent(content: string, key: "keepsake" | "image_prompt") {
  try {
    const obj = JSON.parse(content);
    if (obj && Object.prototype.hasOwnProperty.call(obj, key)) return obj;
  } catch { /* fall through */ }
  const obj = extractFirstJsonObjectBalanced(content);
  if (obj && Object.prototype.hasOwnProperty.call(obj, key)) return obj;
  throw new Error(`Assistant content did not contain valid JSON for key "${key}"`);
}

// ---------------- Validation ----------------
function isValid(kind: "keepsake" | "image_prompt", value: string): boolean {
  if (!value) return false;
  if (/(^|[^a-z])\.\.\.($|[^a-z])/i.test(value)) return false; // reject literal "..."

  if (kind === "keepsake") {
    const lines = value.split(/\r?\n/);
    if (lines.length !== 4) return false;
    if (!/^Title:\s*\S/.test(lines[0])) return false;
    const verses = lines.slice(1);
    for (const l of verses) {
      const words = l.trim().split(/\s+/);
      if (words.length < 4 || words.length > 7) return false;
    }
    return true;
  }

  // image_prompt must include all tokens and be concise
  const must = [
    "mixed-media collage",
    "paper texture",
    "torn edges",
    "halftone",
    "tape/glue shadows",
    "slight misregistration",
    "matte finish",
  ];
  const wordCount = value.trim().split(/\s+/).length;
  if (wordCount > 90) return false;
  return must.every((t) => value.includes(t));
}

// ---------------- Prompts ----------------
function keepsakePrompt(memory: string, feedback?: string) {
  return [
    "Output JSON only. No prose, no code fences.",
    'The JSON must contain exactly one key: "keepsake".',
    'Value of "keepsake": 4 lines joined by "\\n":',
    '  • Line 1: starts with "Title: " plus short concrete title',
    "  • Lines 2–4: exactly 3 verse lines, each 4–7 words, concrete, sensory, present tense",
    'Do not use placeholders like "...".',
    feedback?.trim() ? `CORRECTION: ${feedback.trim()}` : "",
    "",
    "Moment:",
    memory.trim(),
  ].filter(Boolean).join("\n");
}

function imagePrompt(memory: string, feedback?: string) {
  return [
    "Output JSON only. No prose, no code fences.",
    'The JSON must contain exactly one key: "image_prompt".',
    "Value: <= ~80 words that describe a collage for this moment with 3–5 distinct fragments + a setting.",
    'Include EXACT tokens: mixed-media collage, paper texture, torn edges, halftone, tape/glue shadows, slight misregistration, matte finish.',
    "Be specific and visual. No placeholders.",
    feedback?.trim() ? `CORRECTION: ${feedback.trim()}` : "",
    "",
    "Moment:",
    memory.trim(),
  ].filter(Boolean).join("\n");
}

// ---------------- Response-format schemas ----------------
const KEEPSAKE_SCHEMA = {
  name: "keepsake_schema",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: { keepsake: { type: "string" } },
    required: ["keepsake"],
  },
  strict: true,
};

const IMAGE_SCHEMA = {
  name: "image_prompt_schema",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: { image_prompt: { type: "string" } },
    required: ["image_prompt"],
  },
  strict: true,
};

// ---------------- Provider quirks helpers ----------------
function getAssistantTextContent(choice: any): string {
  const msg = choice?.message ?? {};
  // 1) tool-calls JSON (very common when response_format is used)
  const tc = Array.isArray(msg?.tool_calls) ? msg.tool_calls : null;
  if (tc && tc[0]?.function?.arguments && typeof tc[0].function.arguments === "string") {
    return tc[0].function.arguments;
  }
  // 2) some providers expose parsed JSON here
  if (msg?.parsed && typeof msg.parsed === "object") {
    try { return JSON.stringify(msg.parsed); } catch {}
  }
  // 3) plain string content
  const c = msg?.content;
  if (typeof c === "string" && c.trim()) return c;
  // 4) array-of-parts fallback
  if (Array.isArray(c)) {
    const text = c.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("");
    if (text.trim()) return text;
  }
  // 5) nothing usable
  return "";
}

// ---------------- HF call (with fallbacks) ----------------
async function hfCall({
  prompt,
  signal,
  max_tokens,
  schema,
}: {
  prompt: string;
  signal: AbortSignal;
  max_tokens: number;
  schema: typeof KEEPSAKE_SCHEMA | typeof IMAGE_SCHEMA;
}): Promise<string> {
  const basePayload: any = {
    model: HF_MODEL,
    messages: [
      { role: "system", content: "Return ONLY valid JSON. No prose. No code fences." },
      { role: "user", content: prompt },
    ],
    max_tokens,
    temperature: 0.2, // reduce meta-chatter
    stream: false,
  };

  async function attempt(payload: any) {
    const res = await fetch(HF_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal,
    });

    const raw = await res.text();
    console.info("HF RAW RESPONSE >>>", raw.slice(0, 500));
    console.info("HF upstream", {
      status: res.status,
      te: res.headers.get("transfer-encoding"),
      clen: res.headers.get("content-length"),
      tail: raw.slice(-160),
    });

    if (!res.ok) throw new Error(`Upstream ${res.status}: ${raw.slice(0, 600)}`);
    const env = JSON.parse(raw);
    const choice = env?.choices?.[0];
    const content = getAssistantTextContent(choice);
    if (!content.trim()) throw new Error("Empty assistant content");
    return content;
  }

  // 1) Strict json_schema
  try {
    const payload = {
      ...basePayload,
      response_format: { type: "json_schema", json_schema: schema },
    };
    return await attempt(payload);
  } catch (e: any) {
    const msg = String(e?.message || "");
    // 2) Fallback to json_object
    if (/response_format|json_schema|unsupported|schema/i.test(msg)) {
      try {
        const payload = {
          ...basePayload,
          response_format: { type: "json_object" },
        };
        return await attempt(payload);
      } catch (e2: any) {
        const msg2 = String(e2?.message || "");
        // 3) Final fallback: no response_format
        if (/response_format|json_object|unsupported|schema/i.test(msg2)) {
          const payload = { ...basePayload }; // rely on prompt + post-parse
          return await attempt(payload);
        }
        throw e2;
      }
    }
    throw e;
  }
}

// ---------------- Field generation with retries ----------------
async function generateField({
  kind, // "keepsake" | "image_prompt"
  memory,
  feedback,
  signal,
}: {
  kind: "keepsake" | "image_prompt";
  memory: string;
  feedback?: string;
  signal: AbortSignal;
}): Promise<string> {
  // Start big because some providers leak internal "reasoning_content"
  // and only emit actual JSON after a while.
  const budgets = [1024, 600, 400, 250, 180, 120, 90, 70];

  const badKeepsakeFeedback =
    'Your previous output was invalid. Do NOT use "...". Output exactly 4 lines: line 1 starts with "Title: ", lines 2–4 are 3 verse lines, each 4–7 words, present tense, sensory. JSON only.';
  const badImageFeedback =
    'Your previous output was invalid. Do NOT use placeholders. Include EXACT tokens: mixed-media collage, paper texture, torn edges, halftone, tape/glue shadows, slight misregistration, matte finish. 3–5 concrete fragments + setting. JSON only.';

  let lastFeedback = feedback;

  for (const max_tokens of budgets) {
    try {
      const prompt =
        kind === "keepsake" ? keepsakePrompt(memory, lastFeedback) : imagePrompt(memory, lastFeedback);
      const schema = kind === "keepsake" ? KEEPSAKE_SCHEMA : IMAGE_SCHEMA;

      const content = await hfCall({ prompt, signal, max_tokens, schema });

      const parsed = parseJsonFromContent(content, kind);
      const value = parsed?.[kind];

      if (typeof value === "string" && isValid(kind, value)) {
        console.info(`Parsed ${kind} from assistant content at tokens=${max_tokens}`);
        return value;
      }

      console.warn(`Invalid ${kind} content at tokens=${max_tokens}; retrying with corrective feedback.`);
      lastFeedback = kind === "keepsake" ? badKeepsakeFeedback : badImageFeedback;
    } catch (err: any) {
      console.warn(`Attempt error for ${kind} at tokens=${max_tokens}:`, String(err?.message || err));
      if (!lastFeedback) lastFeedback = kind === "keepsake" ? badKeepsakeFeedback : badImageFeedback;
      // continue to next budget
    }
  }

  throw new Error(`Failed to generate valid ${kind} after multiple attempts.`);
}

// ---------------- API handler ----------------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  if (!process.env.HF_TOKEN) {
    return res.status(500).json({ ok: false, error: "Missing HF_TOKEN on server" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const memory: string = body?.memory;
    const feedback: string | undefined = body?.feedback;

    if (!memory?.trim()) {
      return res.status(400).json({ ok: false, error: "Missing 'memory'." });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let keepsake: string;
    let image_prompt: string;

    try {
      keepsake = await generateField({ kind: "keepsake", memory, feedback, signal: controller.signal });
      image_prompt = await generateField({ kind: "image_prompt", memory, feedback, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    console.info("Generated keepsake >>>", keepsake);
    console.info("Generated image_prompt >>>", image_prompt);

    return res.status(200).json({ ok: true, keepsake, image_prompt });
  } catch (e: any) {
    const msg = String(e?.message || "Unknown error");
    console.error("generate error:", msg);
    return res.status(502).json({ ok: false, error: msg.slice(0, 800) });
  }
}
