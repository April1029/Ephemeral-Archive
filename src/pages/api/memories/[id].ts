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
    const id = Number(req.query.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id." });

    if (req.method === "GET") {
        const row = db.prepare(`SELECT * FROM memories where id = ?`).get(id);
        if (!row) return res.status(404).json({ error: "Not found." });
        return res.status(200).json(row);
    }

    if (req.method === "PUT") {
        try {
            const { title, body, keepsake, image_prompt, image_url } = req.body || {};
            const stmt = db.prepare(`
                UPDATE memories
                SET
                    title = COALESCE(@title, title),
                    body = COALESCE(@body, body),
                    keepsake = COALESCE(@keepsake, keepsake),
                    image_prompt = COALESCE(@image_prompt, image_prompt),
                    image_url = COALESCE(@image_url, image_url)
                    WHERE id = @id
            `);

            const info = stmt.run({ id, title, body, keepsake, image_prompt, image_url });
            if (info.changes === 0) return res.status(404).json({ error: "not found" });
            const row = db.prepare(`SELECT * FROM memories WHERE id = ?`).get(id);
            return res.status(200).json(row);
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    if (req.method === "DELETE") {
        const info = db.prepare(`DELETE FROM memories WHERE id = ?`).run(id);
        if (info.changes === 0) return res.status(404).json({ error: "not found" });
        return res.status(204).end();
    }

    res.setHeader("Allow", "GET, PUT, DELETE");
    res.status(405).end("Method Not Allowed");
}