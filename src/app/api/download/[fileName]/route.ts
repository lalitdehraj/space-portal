import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest, context: { params: Promise<{ fileName: string }> }) {
  const params = await context.params;
  const filePath = path.join(process.cwd(), "reports", params.fileName);

  if (!fs.existsSync(filePath)) {
    return new Response("File not found", { status: 404 });
  }

  const fileStream = fs.createReadStream(filePath);
  return new Response(fileStream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${params.fileName}"`,
    },
  });
}
