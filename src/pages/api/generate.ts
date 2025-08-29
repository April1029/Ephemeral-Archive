// pages/api/generate.ts
import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
    api: { bodyParser: { sizeLimit: "2mb" } }, // in case prompts are long
};

const HF_URL = "https://router.huggingface.co/v1/chat/completions";

// knobs
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;

function isTransient(err: unknown) {
    const msg = String((err as any)?.message || err || "");
    return /(?:^Upstream 5\d\d:|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|timeout|502|503|504)/i.test(msg);
}

// Find & parse the first {...} JSON object inside a string
function extractFirstJsonObject(s: string) {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) throw new Error("No JSON object found");
    return JSON.parse(s.slice(start, end + 1));
}

async function withRetries<T>(fn: () => Promise<T>, attempts = MAX_RETRIES): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (e) {
            lastErr = e;
            if (i === attempts - 1 || !isTransient(e)) break;
            await new Promise(r => setTimeout(r, 500 * (i + 1))); // 0.5s, 1s, 1.5s
        }
    }
    throw lastErr;
}

async function callHF({
    prompt,
    max_new_tokens = 1024,
    temperature = 0.6,
    signal,
}: {
    prompt: string;
    max_new_tokens?: number;
    temperature?: number;
    signal?: AbortSignal;
}) {
    const hfRes = await fetch(HF_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.HF_TOKEN ?? ""}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "openai/gpt-oss-20b",
            messages: [{ role: "user", content: prompt }],
            // keep payload small; streaming off to avoid mid-stream truncation
            max_tokens: max_new_tokens,
            temperature,
            stream: false,
            tool_choice: "none",
            response_format: { type: "json_object" }
        }),
        signal,
    });

    const raw = await hfRes.text();

    // Keep a tiny tail for debugging truncation; shows in server logs
    console.info("HF upstream", {
        status: hfRes.status,
        te: hfRes.headers.get("transfer-encoding"),
        clen: hfRes.headers.get("content-length"),
        tail: raw.slice(-160),
    });

    if (!hfRes.ok) {
        throw new Error(`Upstream ${hfRes.status}: ${raw.slice(0, 600)}`);
    }

    // Parse the HF “OpenAI-compatible” envelope; fall back if it’s a bit messy
    let envelope: any;
    try {
        envelope = JSON.parse(raw);
    } catch {
        const cleaned = raw.replace(/^[^{]+/, "").replace(/[^}]+$/, "");
        envelope = JSON.parse(cleaned);
    }

    const choice = envelope?.choices?.[0] ?? {};
    const msg = choice?.message ?? {};

    // Prefer standard content; fallback to provider quirks
    const content: string =
        msg?.content ??
        choice?.text ?? // some providers put it here
        msg?.tool_calls?.[0]?.function?.arguments ?? // “function call” JSON
        "";

    if (!content) {
        // Helpful extra logging for diagnosis
        console.error("Empty content. Choice keys:", Object.keys(choice || {}), "Msg keys:", Object.keys(msg || {}));
        throw new Error("Empty model content");
    }

    // Your model is supposed to return JSON; handle “prose + JSON” too
    let parsed: any;
    try {
        parsed = JSON.parse(content);
    } catch {
        parsed = extractFirstJsonObject(content);
    }

    if (typeof parsed?.keepsake !== "string" || typeof parsed?.image_prompt !== "string") {
        throw new Error("Model JSON missing 'keepsake' or 'image_prompt'");
    }

    return { keepsake: parsed.keepsake, image_prompt: parsed.image_prompt };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    try {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
        const prompt: string = body?.prompt;
        const max_new_tokens: number | undefined = body?.max_new_tokens;
        const temperature: number | undefined = body?.temperature;

        if (!process.env.HF_TOKEN) {
            return res.status(500).json({ ok: false, error: "Missing HF_TOKEN on server" });
        }
        if (typeof prompt !== "string" || !prompt.trim()) {
            return res.status(400).json({ ok: false, error: "Missing 'prompt' string" });
        }

        // Abort before the platform hard-kills us (clean error vs raw 502)
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const result = await withRetries(() =>
            callHF({ prompt, max_new_tokens, temperature, signal: controller.signal })
        ).finally(() => clearTimeout(timer));

        return res.status(200).json({ ok: true, ...result });
    } catch (e: any) {
        const msg = String(e?.message || "Unknown error");
        console.error("generate error:", msg);
        // Normalize to 502 so your client shows a single retry UX
        return res.status(502).json({ ok: false, error: msg.slice(0, 800) });
    }
}
