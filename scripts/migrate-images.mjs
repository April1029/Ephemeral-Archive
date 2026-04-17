/**
 * One-time migration script: downloads images from Render, uploads to R2,
 * updates image_url in the local nowever.sqlite, ready for Turso import.
 *
 * Usage:
 *   RENDER_BASE_URL=https://your-app.onrender.com \
 *   R2_ACCOUNT_ID=xxx \
 *   R2_ACCESS_KEY_ID=xxx \
 *   R2_SECRET_ACCESS_KEY=xxx \
 *   R2_BUCKET_NAME=nowever-images \
 *   R2_PUBLIC_URL=https://pub-xxx.r2.dev \
 *   node scripts/migrate-images.mjs
 */

import { createClient } from "@libsql/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const RENDER_BASE_URL = process.env.RENDER_BASE_URL?.replace(/\/$/, "");
const R2_ACCOUNT_ID    = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY    = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET        = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL    = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

// Validate env vars
const missing = ["RENDER_BASE_URL","R2_ACCOUNT_ID","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY","R2_BUCKET_NAME","R2_PUBLIC_URL"]
  .filter(k => !process.env[k]);
if (missing.length) {
  console.error("Missing env vars:", missing.join(", "));
  process.exit(1);
}

const db = createClient({ url: "file:./nowever.sqlite" });

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_KEY },
});

const result = await db.execute(
  "SELECT id, image_url FROM memories WHERE image_url IS NOT NULL AND image_url != ''"
);

console.log(`Found ${result.rows.length} memories with images\n`);

let migrated = 0;
let skipped  = 0;
let failed   = 0;

for (const row of result.rows) {
  const id       = Number(row[0]);
  const imageUrl = String(row[1]);

  // Already migrated to R2
  if (imageUrl.startsWith("http")) {
    console.log(`[${id}] Already an R2 URL, skipping`);
    skipped++;
    continue;
  }

  // Base64 data URI stored directly in the DB
  if (imageUrl.startsWith("data:")) {
    process.stdout.write(`[${id}] Uploading base64 image to R2 ... `);
    try {
      const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/s);
      if (!matches) {
        console.log("FAILED (could not parse data URI)");
        failed++;
        continue;
      }
      const contentType = matches[1];
      const buffer      = Buffer.from(matches[2], "base64");
      const ext         = contentType.split("/")[1]?.replace("jpeg", "jpg") || "png";
      const filename    = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: filename,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }));

      const newUrl = `${R2_PUBLIC_URL}/${filename}`;

      await db.execute({
        sql: "UPDATE memories SET image_url = ? WHERE id = ?",
        args: [newUrl, id],
      });

      console.log(`done → ${newUrl}`);
      migrated++;
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      failed++;
    }
    continue;
  }

  // Relative path from old Render filesystem (e.g. /api/images/filename.png)
  const renderUrl = `${RENDER_BASE_URL}${imageUrl}`;
  process.stdout.write(`[${id}] Downloading ${imageUrl} ... `);

  try {
    const res = await fetch(renderUrl);
    if (!res.ok) {
      console.log(`FAILED (HTTP ${res.status})`);
      failed++;
      continue;
    }

    const buffer      = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/png";
    const filename    = imageUrl.split("/").pop();

    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: filename,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }));

    const newUrl = `${R2_PUBLIC_URL}/${filename}`;

    await db.execute({
      sql: "UPDATE memories SET image_url = ? WHERE id = ?",
      args: [newUrl, id],
    });

    console.log(`done → ${newUrl}`);
    migrated++;
  } catch (err) {
    console.log(`ERROR: ${err.message}`);
    failed++;
  }
}

console.log(`\nDone. Migrated: ${migrated}  Skipped: ${skipped}  Failed: ${failed}`);
console.log("\nNext step: turso db create nowever --from-file ./nowever.sqlite");
