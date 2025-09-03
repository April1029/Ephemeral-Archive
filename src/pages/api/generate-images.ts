// /pages/api/generate-image.ts
import type { NextApiRequest, NextApiResponse } from "next";

const DEFAULT_MODEL = process.env.HF_IMAGE_MODEL || "stabilityai/sd-turbo";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) {
    return res.status(500).json({ error: "HF_TOKEN is not set on the server." });
  }

  const {
    prompt,
    inputs,       
    model,
  } = (req.body ?? {}) as { prompt?: string; inputs?: string; model?: string };

  const text = (prompt ?? inputs ?? "").trim();
  if (!text) {
    return res.status(400).json({ error: "Missing 'prompt' (or 'inputs')." });
  }

  const selectedModel = model || DEFAULT_MODEL;


  const body = JSON.stringify({
    inputs: text,
    options: { wait_for_model: true, use_cache: true },
  });

  try {
    const resp = await fetch(
      `https://api-inference.huggingface.co/models/${encodeURIComponent(selectedModel)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body,
      }
    );

    if (!resp.ok) {
      // Try to extract a helpful error from HF
      let details: any = null;
      try { details = await resp.json(); } catch { /* ignore */ }

      const message =
        details?.error ||
        details?.message ||
        `Image generation failed (${resp.status})`;

      return res.status(resp.status).json({
        error: message,
        model: selectedModel,
        // Optional: echo back what we sent so you can debug in the client console
        _debug: { hadPrompt: !!text, contentType: "application/json" },
      });
    }

    // Success: HF returns binary image
    const arrayBuffer = await resp.arrayBuffer();
    const mime = resp.headers.get("content-type") || "image/png";
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const imageUrl = `data:${mime};base64,${base64}`;

    return res.status(200).json({ imageUrl, model: selectedModel });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return res.status(504).json({ error: "Image generation timed out" });
    }
    return res
      .status(err?.status ?? err?.response?.status ?? 500)
      .json({ error: err?.message || "Unknown server error" });
  }
}
