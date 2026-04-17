export const runtime = "nodejs";
import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenAI } from '@google/genai';
import { AwsClient } from 'aws4fetch';
import { promises as fs } from 'fs';
import path from 'path';

const MODEL = 'gemini-2.5-flash-image';

async function saveImage(filename: string, data: Buffer, mime: string): Promise<string> {
  // R2 path (production)
  if (process.env.R2_ACCOUNT_ID) {
    const r2 = new AwsClient({
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      region: 'auto',
      service: 's3',
    });
    const url = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${filename}`;
    const uploadRes = await r2.fetch(url, {
      method: 'PUT',
      body: new Uint8Array(data),
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => '');
      throw new Error(`R2 upload failed (${uploadRes.status}): ${text}`);
    }
    return `${process.env.R2_PUBLIC_URL}/${filename}`;
  }

  // Local filesystem fallback (development)
  const dir = path.join(process.cwd(), 'public', 'generated-images');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), data);
  return `/generated-images/${filename}`;
}

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

    const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const imageUrl = await saveImage(filename, Buffer.from(base64, 'base64'), mime);

    return res.status(200).json({ imageUrl, note: modelText?.trim() || null });
  } catch (err: any) {
    console.error('generate-image error:', err?.stack || err);
    return res.status(500).json({ error: err?.message || 'Image generation failed' });
  }
}
