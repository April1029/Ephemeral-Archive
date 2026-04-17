import fs from "fs";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (key !== process.env.DB_DOWNLOAD_KEY) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const filePath = "/var/data/nowever-download.sqlite";
  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="nowever-download.sqlite"',
    },
  });
}
