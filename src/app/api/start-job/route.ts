import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";

export async function POST(req: NextRequest) {
  const { fileKey } = await req.json();

  if (!fileKey) {
    return NextResponse.json({ error: "Missing fileKey" }, { status: 400 });
  }

  const fileName = `${fileKey}.xlsx`;
  const filePath = path.join(process.cwd(), "reports", fileName);

  if (fs.existsSync(filePath)) {
    return NextResponse.json({
      jobId: fileName,
      alreadyExists: true,
      downloadUrl: `/api/download/${fileName}`,
    });
  }

  createBigXLS(filePath).catch(console.error);

  return NextResponse.json({ jobId: fileName, alreadyExists: false });
}

async function createBigFile(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const writeStream = fs.createWriteStream(filePath, { flags: "w" });
  writeStream.write("[");

  let firstChunk = true;
  let page = 1;

  while (true) {
    const res = await fetch(
      `https://jsonplaceholder.typicode.com/posts?_page=${page}&_limit=500`
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

async function createBigXLS(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Posts");

  worksheet.columns = [
    { header: "User ID", key: "userId", width: 10 },
    { header: "ID", key: "id", width: 10 },
    { header: "Title", key: "title", width: 40 },
    { header: "Body", key: "body", width: 80 },
  ];

  let page = 1;
  while (true) {
    const res = await fetch(
      `https://jsonplaceholder.typicode.com/posts?_page=${page}&_limit=500`
    );
    const data = await res.json();

    if (!data.length) break;

    data.forEach((row: any) => {
      worksheet.addRow(row);
    });

    page++;
    await new Promise((res) => setTimeout(res, 300)); 
  }

  await workbook.xlsx.writeFile(filePath);
}
