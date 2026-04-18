/**
 * Converts existing R2 image URLs in Turso back to base64 data URIs.
 * Run once, then R2 is no longer needed.
 *
 * Usage:
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... node scripts/reverse-migrate.mjs
 */

const TURSO_URL = process.env.TURSO_DATABASE_URL?.replace(/^libsql:\/\//, "https://");
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  process.exit(1);
}

async function query(sql, args = []) {
  const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TURSO_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          type: "execute",
          stmt: {
            sql,
            args: args.map((a) =>
              a === null ? { type: "null" }
              : typeof a === "number" ? { type: "integer", value: String(a) }
              : { type: "text", value: String(a) }
            ),
          },
        },
        { type: "close" },
      ],
    }),
  });

  const data = await res.json();
  if (!data.results) {
    console.error("Unexpected Turso response:", JSON.stringify(data).slice(0, 500));
    throw new Error("No results field in Turso response");
  }
  const r = data.results[0];
  if (r.type === "error") throw new Error(r.error?.message ?? "Turso error");
  const { cols, rows, affected_row_count } = r.response.result;
  return {
    rows: rows.map((row) =>
      Object.fromEntries(cols.map((c, i) => [c.name, row[i]?.value ?? null]))
    ),
    rowsAffected: affected_row_count,
  };
}

const { rows } = await query(
  "SELECT id, image_url FROM memories WHERE image_url LIKE 'http%'"
);

console.log(`Found ${rows.length} memories with R2 URLs\n`);

let done = 0, failed = 0;

for (const row of rows) {
  const id = Number(row.id);
  const imageUrl = row.image_url;

  process.stdout.write(`[${id}] Downloading ... `);

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) { console.log(`FAILED (HTTP ${res.status})`); failed++; continue; }

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/png";
    const dataUri = `data:${contentType};base64,${buffer.toString("base64")}`;

    await query("UPDATE memories SET image_url = ? WHERE id = ?", [dataUri, id]);
    console.log(`done (${Math.round(buffer.length / 1024)}KB)`);
    done++;
  } catch (err) {
    console.log(`ERROR: ${err.message}`);
    failed++;
  }
}

console.log(`\nDone. Converted: ${done}  Failed: ${failed}`);
