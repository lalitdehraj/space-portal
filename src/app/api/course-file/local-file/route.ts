import { NextRequest, NextResponse } from "next/server";
import { access, readFile } from "fs/promises";
import { constants } from "fs";
import path from "path";

function getBaseDir(): string {
  return process.env.COURSE_FILE_SECTION4_TEMP_DIR || "";
}

function sanitizeFileName(fileName: string): string {
  const name = fileName.trim();
  if (!name) return "";
  if (name.includes("..") || name.includes("/") || name.includes("\\")) return "";
  return name;
}

function buildAbsolutePath(fileName: string): string {
  const baseDir = getBaseDir();
  if (!baseDir) return "";
  const safeName = sanitizeFileName(fileName);
  if (!safeName) return "";
  const resolvedBase = path.isAbsolute(baseDir) ? baseDir : path.resolve(process.cwd(), baseDir);
  return path.join(resolvedBase, safeName);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { fileName?: string };
    const fileName = String(body.fileName || "");
    const absolutePath = buildAbsolutePath(fileName);
    if (!absolutePath) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file name or COURSE_FILE_SECTION4_TEMP_DIR is not configured.",
        },
        { status: 400 }
      );
    }
    try {
      await access(absolutePath, constants.R_OK);
      return NextResponse.json({ success: true, exists: true, fileName });
    } catch {
      return NextResponse.json({ success: true, exists: false, fileName });
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const fileName = req.nextUrl.searchParams.get("name") || "";
    const absolutePath = buildAbsolutePath(fileName);
    if (!absolutePath) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file name or COURSE_FILE_SECTION4_TEMP_DIR is not configured.",
        },
        { status: 400 }
      );
    }
    await access(absolutePath, constants.R_OK);
    const fileBuffer = await readFile(absolutePath);
    const ext = path.extname(absolutePath).toLowerCase();
    const contentType = ext === ".pdf" ? "application/pdf" : "application/octet-stream";
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${path.basename(absolutePath)}"`,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "File not found." }, { status: 404 });
  }
}
