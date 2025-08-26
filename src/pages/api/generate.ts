import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const client = new OpenAI({
    baseURL: "https://router.huggingface.co/v1",
    apiKey: process.env.HF_TOKEN,
    timeout: 60_000,
});



export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const {
        prompt,
        temperature = 0.7,
        max_new_tokens = 160,
        // optional overrides
        model: modelOverride,
        system,
        top_p,
    } = (req.body ?? {}) as {
        prompt?: string;
        temperature?: number;
        max_new_tokens?: number;
        model?: string;
        system?: string;
        top_p?: number;
    };

    if (!prompt) return res.status(400).json({ error: "Missing 'prompt'" });
    if (!process.env.HF_TOKEN) return res.status(500).json({ error: "HF_TOKEN is not set on the server." });

    const model =
        modelOverride ??
        process.env.HF_MODEL ??
        "openai/gpt-oss-20b";

    const messages: ChatCompletionMessageParam[] = [];
    if (system) {
        messages.push({ role: "system", content: String(system) });
    }
    messages.push({ role: "user", content: String(prompt) });

    try {


        const completion = await client.chat.completions.create({
            model,
            messages,
            temperature,
            top_p,
            max_tokens: max_new_tokens,
        });
        const output = completion.choices?.[0]?.message?.content ?? "";
        return res.status(200).json({ output });
    } catch (err: any) {
        // Surface helpful HF router errors if present
        const message =
            err?.response?.data?.error?.message ||
            err?.message ||
            "Unknown server error";
        const status = err?.status ?? err?.response?.status ?? 500;
        return res.status(status).json({ error: message });
    }




}
