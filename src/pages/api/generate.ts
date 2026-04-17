export const runtime = "nodejs";
import type { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenAI } from "@google/genai";

export const config = {
  api: { bodyParser: { sizeLimit: "2mb" } },
};

const MODEL = "gemini-2.5-flash";
const MAX_RETRIES = 3;

function buildPrompt(memory: string, feedback?: string): string {
  return [
    'Output ONLY a JSON object with exactly two keys: "keepsake" and "image_prompt". No prose, no markdown fences.',
    "",
    '"keepsake": a single string with lines joined by \\n.',
    '  Line 1 — starts with "Title: " followed by a short concrete title.',
    "  Lines 2–4 — exactly 3 verse lines, each 4–7 words, sensory, present tense.",
    "",
    '"image_prompt": a single string (~60–80 words) describing a mixed-media collage',
    "  with 3–5 distinct fragments and a setting. Include: mixed-media collage,",
    "  paper texture, torn edges, halftone, tape/glue shadows, slight misregistration, matte finish.",
    "",
    feedback?.trim() ? `Feedback on previous attempt: ${feedback.trim()}` : "",
    `Memory: ${memory.trim()}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function generate(
  memory: string,
  feedback?: string
): Promise<{ keepsake: string; image_prompt: string }> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  let lastFeedback = feedback;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts: [{ text: buildPrompt(memory, lastFeedback) }] }],
        config: {
          responseMimeType: "application/json",
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      });

      const text = (response.text ?? "").trim();
      if (!text) throw new Error("Empty response from model");

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start !== -1 && end > start) {
          parsed = JSON.parse(text.slice(start, end + 1));
        } else {
          throw new Error("No JSON found in response");
        }
      }

      const keepsake = (parsed?.keepsake ?? "").toString().trim();
      const image_prompt = (parsed?.image_prompt ?? "").toString().trim();

      if (!keepsake || !image_prompt) {
        lastFeedback = 'Response was missing "keepsake" or "image_prompt". Return both keys.';
        continue;
      }

      return { keepsake, image_prompt };
    } catch (err: any) {
      console.warn(`generate attempt ${attempt + 1} failed:`, err?.message);
      if (attempt === MAX_RETRIES - 1) throw err;
      lastFeedback = "Previous response was invalid. Return only JSON with both keys.";
    }
  }

  throw new Error("Failed to generate after multiple attempts.");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ ok: false, error: "Missing GEMINI_API_KEY on server" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const memory: string = body?.memory;
    const feedback: string | undefined = body?.feedback;

    if (!memory?.trim()) {
      return res.status(400).json({ ok: false, error: "Missing 'memory'." });
    }

    const { keepsake, image_prompt } = await generate(memory, feedback);
    return res.status(200).json({ ok: true, keepsake, image_prompt });
  } catch (e: any) {
    const msg = String(e?.message || "Unknown error");
    console.error("generate error:", msg);
    return res.status(502).json({ ok: false, error: msg.slice(0, 800) });
  }
}
