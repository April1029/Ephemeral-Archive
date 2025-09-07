export const runtime = "nodejs";
import type { NextApiRequest, NextApiResponse } from "next";
import db from "../../../lib/db";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb', // This line increases the limit to 4 megabytes.
    },
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { q } = req.query;
    if (typeof q === "string" && q.trim()) {
      const stmt = db.prepare(`
        SELECT id, title, body, keepsake, image_prompt, image_url, created_at, updated_at
        FROM memories
        WHERE title LIKE ? OR body LIKE ? OR keepsake LIKE ?
        ORDER BY created_at DESC
        LIMIT 200
      `);
      const rows = stmt.all(`%${q}%`, `%${q}%`, `%${q}%`);
      return res.status(200).json(rows);
    }

    const rows = db
      .prepare(`
        SELECT id, title, body, keepsake, image_prompt, image_url, created_at, updated_at
        FROM memories
        ORDER BY created_at DESC
        LIMIT 10
      `)
      .all();
    return res.status(200).json(rows);
  }

  if (req.method === "POST") {
    try {
      const { title, body, keepsake, image_prompt, image_url } = req.body || {};
      if (!title || !body) return res.status(400).json({ error: "title and body are required" });

      const stmt = db.prepare(`
        INSERT INTO memories (title, body, keepsake, image_prompt, image_url)
        VALUES (@title, @body, @keepsake, @image_prompt, @image_url)
      `);
      const info = stmt.run({ title, body, keepsake, image_prompt, image_url });

      const row = db
        .prepare(`SELECT * FROM memories WHERE id = ?`)
        .get(info.lastInsertRowid);

      return res.status(201).json(row);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).end("Method Not Allowed");
}
