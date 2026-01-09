import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export async function GET() {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Room Allocations");

    // Add headers
    worksheet.columns = [
      { header: "Building ID", key: "buildingId", width: 15 },
      { header: "Room ID", key: "roomId", width: 15 },
      { header: "Program Code", key: "programCode", width: 20 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFE0" },
    };

    // Add example row (optional - can be removed)
    worksheet.addRow({
      buildingId: "Example: BLD001",
      roomId: "Example: ROOM101",
      programCode: "Example: CS101",
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=room_allocation_template.xlsx",
      },
    });
  } catch (error) {
    console.error("Error generating template:", error);
    return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
  }
}
