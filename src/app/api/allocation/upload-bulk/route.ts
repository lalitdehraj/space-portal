import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const acadSession = formData.get("acadSession") as string;
    const acadYear = formData.get("acadYear") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!acadSession || !acadYear) {
      return NextResponse.json({ error: "Academic session and year are required" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      return NextResponse.json({ error: "Invalid Excel file format" }, { status: 400 });
    }

    const rows: Array<{ buildingId: string; roomId: string; programCode: string }> = [];
    const errors: string[] = [];

    // Start from row 2 (skip header)
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const buildingId = row.getCell(1).value?.toString()?.trim() || "";
      const roomId = row.getCell(2).value?.toString()?.trim() || "";
      const programCode = row.getCell(3).value?.toString()?.trim() || "";

      // Validate row
      if (!buildingId || !roomId || !programCode) {
        errors.push(`Row ${rowNumber}: Missing required fields`);
        return;
      }

      rows.push({ buildingId, roomId, programCode });
    });

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation errors", details: errors }, { status: 400 });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid data rows found" }, { status: 400 });
    }

    // Return the parsed data - the frontend will handle the API calls
    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error("Error processing file:", error);
    return NextResponse.json({ error: "Failed to process file" }, { status: 500 });
  }
}
