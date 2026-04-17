export const runtime = "nodejs";
import type { NextApiRequest, NextApiResponse } from "next";
import { db, ensureMigrated, toRow, toRows } from "../../../lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureMigrated();

  if (req.method === "GET") {
    const { q } = req.query;

    if (typeof q === "string" && q.trim()) {
      const result = await db.execute({
        sql: `SELECT id, title, body, keepsake, image_url, created_at, updated_at
              FROM memories
              WHERE title LIKE ? OR body LIKE ? OR keepsake LIKE ?
              ORDER BY created_at DESC
              LIMIT 200`,
        args: [`%${q}%`, `%${q}%`, `%${q}%`],
      });
      return res.status(200).json(toRows(result));
    }

    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1), 100);
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);

    const result = await db.execute({
      sql: `SELECT id, title, body, keepsake, image_url, created_at, updated_at
            FROM memories
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?`,
      args: [limit, offset],
    });

    res.setHeader("Cache-Control", "public, max-age=15, stale-while-revalidate=60");
    return res.status(200).json(toRows(result));
  }

  if (req.method === "POST") {
    try {
      const { title, body, keepsake, image_prompt, image_url } = req.body || {};
      if (!title || !body) return res.status(400).json({ error: "title and body are required" });

      const insert = await db.execute({
        sql: `INSERT INTO memories (title, body, keepsake, image_prompt, image_url)
              VALUES (?, ?, ?, ?, ?)`,
        args: [title, body, keepsake ?? null, image_prompt ?? null, image_url ?? null],
      });

      const row = await db.execute({
        sql: "SELECT * FROM memories WHERE id = ?",
        args: [Number(insert.lastInsertRowid)],
      });

      return res.status(201).json(toRow(row));
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).end("Method Not Allowed");
}
