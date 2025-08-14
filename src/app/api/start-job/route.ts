import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  const { fileKey } = await req.json();

  if (!fileKey) {
    return NextResponse.json({ error: "Missing fileKey" }, { status: 400 });
  }

  const fileName = `${fileKey}.json`;
  const filePath = path.join(process.cwd(), "reports", fileName);

  // ✅ If file already exists, don't create again
  if (fs.existsSync(filePath)) {
    return NextResponse.json({
      jobId: fileName,
      alreadyExists: true,
      downloadUrl:`/api/download/${fileName}`
    });
  }

  // Run the job in background
  createBigFile(filePath).catch(console.error);

  return NextResponse.json({ jobId: fileName, alreadyExists: false });
}

// Fetch in chunks and save file
async function createBigFile(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const writeStream = fs.createWriteStream(filePath, { flags: "w" });
  writeStream.write("[");

  let firstChunk = true;
  let page = 1;

  while (true) {
    const res = await fetch(
      `https://jsonplaceholder.typicode.com/posts?_page=${page}&_limit=10`
    );
    const data = await res.json();

    if (!data.length) break;

    if (!firstChunk) writeStream.write(",");
    writeStream.write(JSON.stringify(data).slice(1, -1));

    firstChunk = false;
    page++;
    await new Promise((res) => setTimeout(res, 300)); // simulate delay
  }

  writeStream.write("]");
  writeStream.end();
}
