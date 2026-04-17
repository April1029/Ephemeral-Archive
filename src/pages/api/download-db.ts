// TEMPORARY — delete this file after downloading the database
export const runtime = "nodejs";
import type { NextApiRequest, NextApiResponse } from "next";
import { createReadStream } from "fs";
import path from "path";

const SECRET = process.env.DOWNLOAD_SECRET;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!SECRET || req.query.secret !== SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const dbPath =
    process.env.SQLITE_PATH ?? path.join(process.cwd(), "data", "nowever.sqlite");

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", 'attachment; filename="nowever.sqlite"');

  const stream = createReadStream(dbPath);
  stream.on("error", () => res.status(404).json({ error: "File not found" }));
  stream.pipe(res);
}
