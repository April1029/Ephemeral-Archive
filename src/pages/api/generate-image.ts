// pages/api/generate-image.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL = 'gemini-2.5-flash-image-preview';

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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });

    // The key change is here: The API expects the prompt text in a single part, not wrapped in a role.
    const result = await model.generateContent({
      contents: [{
        role: 'user', 
        parts: [{ text: prompt }]
      }],
      generationConfig: {}, 
    });
    const parts = result?.response?.candidates?.[0]?.content?.parts ?? [];

    let dataUrl: string | null = null;
    let modelText = '';

    for (const p of parts as any[]) {
      if (p.text) modelText += p.text + '\n';
      if (p.inlineData?.data) {
        const mime = p.inlineData?.mimeType || 'image/png';
        const base64 = p.inlineData.data;
        dataUrl = `data:${mime};base64,${base64}`;
        break;
      }
    }

    if (!dataUrl) {
      return res.status(502).json({
        error: 'No image returned',
        note: modelText?.trim() || null,
        debugParts: parts.length,
      });
    }

    return res.status(200).json({
      imageUrl: dataUrl,
      note: modelText?.trim() || null,
    });
  } catch (err: any) {
    console.error('generate-image error:', err?.stack || err);
    return res.status(500).json({
      error: err?.message || 'Image generation failed',
    });
  }
}