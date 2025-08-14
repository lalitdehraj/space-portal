import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const fileName = req.nextUrl.searchParams.get("jobId");
  if (!fileName)
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  const filePath = path.join(process.cwd(), "reports", fileName);
  const exists = fs.existsSync(filePath);

  return NextResponse.json({
    ready: exists,
    downloadUrl: exists ? `/api/download/${fileName}` : null,
  });
}
