export const runtime = "nodejs";
import type { NextApiRequest, NextApiResponse } from "next";
import { execute, ensureMigrated } from "../../../lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureMigrated();

  const id = Number(req.query.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id." });

  if (req.method === "GET") {
    const result = await execute("SELECT * FROM memories WHERE id = ?", [id]);
    if (!result.rows[0]) return res.status(404).json({ error: "Not found." });
    return res.status(200).json(result.rows[0]);
  }

  if (req.method === "PUT") {
    try {
      const { title, body, keepsake, image_prompt, image_url } = req.body || {};

      const update = await execute(
        `UPDATE memories
         SET title        = COALESCE(?, title),
             body         = COALESCE(?, body),
             keepsake     = COALESCE(?, keepsake),
             image_prompt = COALESCE(?, image_prompt),
             image_url    = COALESCE(?, image_url),
             updated_at   = datetime('now')
         WHERE id = ?`,
        [title ?? null, body ?? null, keepsake ?? null, image_prompt ?? null, image_url ?? null, id]
      );

      if (update.rowsAffected === 0) return res.status(404).json({ error: "not found" });

      const result = await execute("SELECT * FROM memories WHERE id = ?", [id]);
      return res.status(200).json(result.rows[0]);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "DELETE") {
    const result = await execute("DELETE FROM memories WHERE id = ?", [id]);
    if (result.rowsAffected === 0) return res.status(404).json({ error: "not found" });
    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  res.status(405).end("Method Not Allowed");
}
