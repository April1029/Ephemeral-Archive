export const runtime = "nodejs";
import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-2.5-flash-image';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { prompt } = req.body ?? {};
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseModalities: ['TEXT', 'IMAGE'] },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];

    let base64: string | null = null;
    let mime = 'image/png';
    let modelText = '';

    for (const p of parts as any[]) {
      if (p.text) modelText += p.text + '\n';
      if (p.inlineData?.data) {
        base64 = p.inlineData.data;
        mime = p.inlineData.mimeType || 'image/png';
        break;
      }
    }

    if (!base64) {
      return res.status(502).json({
        error: 'No image returned',
        note: modelText?.trim() || null,
        debugParts: parts.length,
      });
    }

    // Store as base64 data URI directly in Turso — no external storage needed
    const imageUrl = `data:${mime};base64,${base64}`;

    return res.status(200).json({ imageUrl, note: modelText?.trim() || null });
  } catch (err: any) {
    console.error('generate-image error:', err?.stack || err);
    return res.status(500).json({ error: err?.message || 'Image generation failed' });
  }
}
