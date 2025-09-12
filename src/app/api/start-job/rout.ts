import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { callApi } from "@/utils/apiIntercepter";
import {
  Building,
  Program,
  Occupant,
  Room,
  RoomInfo,
  Allocation,
} from "@/types";
import { URL_NOT_FOUND } from "@/constants";
import moment from "moment";

export async function POST(req: NextRequest) {
  const jsonObject = await req.json();

  if (!jsonObject.fileKey) {
    return NextResponse.json({ error: "Missing fileKey" }, { status: 400 });
  }

  const fileName = `${jsonObject.fileKey}.xlsx`;
  const filePath = path.join(process.cwd(), "reports", fileName);

  if (fs.existsSync(filePath)) {
    return NextResponse.json({
      jobId: fileName,
      alreadyExists: true,
      downloadUrl: `/api/download/${fileName}`,
    });
  }

  // Run async in background. If you want to block until file is ready, use "await".
  createBigXLS(filePath, jsonObject).catch(console.error);

  return NextResponse.json({ jobId: fileName, alreadyExists: false });
}

async function createBigXLS(filePath: string, jsonObject: any) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("report");
  const worksheetFaculty = workbook.addWorksheet("faculty_seating");

  const { data: programs } = await callApi<any>(
    process.env.NEXT_PUBLIC_GET_PROGRAM || URL_NOT_FOUND
  );
  const { data: employees } = await callApi<any>("");

  const { data: roomAllocation } = await callApi<Allocation[]>(
    process.env.NEXT_PUBLIC_GET_ROOM_ALLOCATIONS || URL_NOT_FOUND,
    {
      acadSession: jsonObject.acadSess,
      acadYear: jsonObject.academicYr,
    }
  );

  const allocations = roomAllocation?.filter(
    (a) => a.roomNo === jsonObject.roomID
  );
  const programsCode = allocations?.map((a) => a.program).toString();

  const programsName = programs?.programCode
    ?.filter((p: any) => programsCode?.split(",").includes(p.code))
    .map((p: any) => p.description)
    .toString();
    
  worksheet.columns = [
    { header: "Room No", key: "roomNo", width: 12 },
    { header: "Program Name", key: "programName", width: 18 },
    { header: "Program Code", key: "programCode", width: 15 },
    { header: "Room Type", key: "roomType", width: 12 },
    { header: "Block No", key: "buildingId", width: 12 },
    { header: "Room Capacity", key: "roomCapacity", width: 15 },

    // Occupancy
    { header: "Occupancy - Monday", key: "occupancyMon", width: 18 },
    { header: "Occupancy - Tuesday", key: "occupancyTue", width: 18 },
    { header: "Occupancy - Wednesday", key: "occupancyWed", width: 18 },
    { header: "Occupancy - Thursday", key: "occupancyThu", width: 18 },
    { header: "Occupancy - Friday", key: "occupancyFri", width: 18 },
    { header: "Occupancy - Saturday", key: "occupancySat", width: 18 },
    { header: "Occupancy - Sunday", key: "occupancySun", width: 18 },
    { header: "Weekly Occupancy", key: "occupancyWeekly", width: 20 },

    // Vacant
    { header: "Vacant - Monday", key: "vacantMon", width: 18 },
    { header: "Vacant - Tuesday", key: "vacantTue", width: 18 },
    { header: "Vacant - Wednesday", key: "vacantWed", width: 18 },
    { header: "Vacant - Thursday", key: "vacantThu", width: 18 },
    { header: "Vacant - Friday", key: "vacantFri", width: 18 },
    { header: "Vacant - Saturday", key: "vacantSat", width: 18 },
    { header: "Vacant - Sunday", key: "vacantSun", width: 18 },
  ];
  worksheetFaculty.columns = [
    { header: "Employee Id", key: "employeeId", width: 15 },
    { header: "Faculty Name", key: "facultyName", width: 20 },
    { header: "Program Code", key: "programCode", width: 15 },
    { header: "Program Name", key: "programName", width: 18 },
    { header: "Block No", key: "buildingId", width: 12 },
    { header: "Faculty Block Name", key: "facultyBlockName", width: 20 },
    { header: "Work Station No", key: "workStationNo", width: 12 },
    { header: "Cabin No.", key: "cabinNo", width: 12 },
    { header: "Keys", key: "keys", width: 10 },
    { header: "Room Capacity", key: "roomCapacity", width: 15 },
  ];

  if (jsonObject.reportType === "room") {
    const reqBody = {
      roomID: jsonObject.roomID,
      subroomID: 0,
      academicYr: jsonObject.academicYr,
      acadSess: jsonObject.acadSess,
      startDate: jsonObject.startDate,
      endDate: jsonObject.endDate,
    };
    const roomInfoResponse = await callApi<RoomInfo>(
      process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND,
      reqBody
    );
    console.log("print", roomInfoResponse);

    if (roomInfoResponse.success) {
      if (
        roomInfoResponse.data?.roomType.toLowerCase().trim() !==
        "FACULTY".toLowerCase()
      ) {
        const week = getRoomOccupancyByWeekday(
          roomInfoResponse?.data?.occupants || []
        );
        const vacant = getVacantSlotsByWeekday(
          roomInfoResponse.data?.occupants || []
        );
        const rowEntry: ReportData = {
          roomNo: String(roomInfoResponse.data?.id ?? ""),
          roomType: roomInfoResponse.data?.roomType,
          buildingId: roomInfoResponse.data?.building,
          programCode: programsCode,
          programName: programsName,
          roomCapacity: String(roomInfoResponse.data?.capacity ?? ""),
          occupancyMon: String((((week.Monday ?? 0) * 100) / 540).toFixed(2)),
          occupancyTue: String((((week.Tuesday ?? 0) * 100) / 540).toFixed(2)),
          occupancyWed: String(
            (((week.Wednesday ?? 0) * 100) / 540).toFixed(2)
          ),
          occupancyThu: String((((week.Thursday ?? 0) * 100) / 540).toFixed(2)),
          occupancyFri: String((((week.Friday ?? 0) * 100) / 540).toFixed(2)),
          occupancySat: String((((week.Saturday ?? 0) * 100) / 540).toFixed(2)),
          occupancySun: String((((week.Sunday ?? 0) * 100) / 540).toFixed(2)),
          occupancyWeekly: String(
            (((week.Weekly ?? 0) * 100) / (540 * 7)).toFixed(2)
          ),

          vacantMon: String(vacant.Monday.toString()),
          vacantTue: String(vacant.Tuesday.toString()),
          vacantWed: String(vacant.Wednesday.toString()),
          vacantThu: String(vacant.Thursday.toString()),
          vacantFri: String(vacant.Friday.toString()),
          vacantSat: String(vacant.Saturday.toString()),
          vacantSun: String(vacant.Sunday.toString()),
        };

        worksheet.addRow(rowEntry);
        await workbook.xlsx.writeFile(filePath);
      } else {
        const rowEntry = {
          employeeId:  roomInfoResponse.data?.occupants?.[0]?.occupantId ||"",
          facultyName: roomInfoResponse.data?.occupants?.[0]?.occupantName || "",
          programCode: "",
          programName: "",
          buildingId: roomInfoResponse.data?.building||"",
          facultyBlockName:roomInfoResponse.data.parentId? roomInfoResponse.data.parentId:"",
          workStationNo: roomInfoResponse.data.parentId?roomInfoResponse.data.id:"",
          cabinNo: "",
          keys: "",
          roomCapacity: "",
        };
        worksheetFaculty.addRow(rowEntry);
        await workbook.xlsx.writeFile(filePath);
      }
    }
  }

  if (jsonObject.reportType === "building") {
    // 1️⃣ Fetch all rooms for this building
    const roomsResponse = await callApi<Room[]>(
      process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND,
      {
        buildingNo: jsonObject.buildingId,
        floorID: "",
        curreentTime: moment().format("HH:mm"),
      }
    );

    if (!roomsResponse.success || !roomsResponse.data) {
      console.error("No rooms found for building:", jsonObject.buildingId);
      return;
    }

    const allRooms = roomsResponse.data.filter(
      (r) => !r.hasSubroom && r.roomType !== "FACULTY"
    ); // list of all rooms

    for (const room of allRooms) {
      // 2️⃣ Fetch detailed room info for each room
      const reqBody = {
        roomID: room.roomId,
        subroomID: 0,
        academicYr: jsonObject.academicYr,
        acadSess: jsonObject.acadSess,
        startDate: jsonObject.startDate,
        endDate: jsonObject.endDate,
      };
      const roomInfoResponse = await callApi<RoomInfo>(
        process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND,
        reqBody
      );

      if (!roomInfoResponse.success || !roomInfoResponse.data) continue;

      const roomInfo = roomInfoResponse.data;

      // 3️⃣ Calculate occupancy and vacant slots
      const week = getRoomOccupancyByWeekday(roomInfo.occupants || []);
      const vacant = getVacantSlotsByWeekday(roomInfo.occupants || []);

      // 4️⃣ Prepare row entry
      const rowEntry: ReportData = {
        roomNo: String(roomInfo.id ?? ""),
        roomType: roomInfo.roomType,
        buildingId: roomInfo.building,
        roomCapacity: String(roomInfo.capacity ?? ""),

        occupancyMon: String((((week.Monday ?? 0) * 100) / 540).toFixed(2)),
        occupancyTue: String((((week.Tuesday ?? 0) * 100) / 540).toFixed(2)),
        occupancyWed: String((((week.Wednesday ?? 0) * 100) / 540).toFixed(2)),
        occupancyThu: String((((week.Thursday ?? 0) * 100) / 540).toFixed(2)),
        occupancyFri: String((((week.Friday ?? 0) * 100) / 540).toFixed(2)),
        occupancySat: String((((week.Saturday ?? 0) * 100) / 540).toFixed(2)),
        occupancySun: String((((week.Sunday ?? 0) * 100) / 540).toFixed(2)),
        occupancyWeekly: String(
          (((week.Weekly ?? 0) * 100) / (540 * 7)).toFixed(2)
        ),

        vacantMon: vacant.Monday.join(", "),
        vacantTue: vacant.Tuesday.join(", "),
        vacantWed: vacant.Wednesday.join(", "),
        vacantThu: vacant.Thursday.join(", "),
        vacantFri: vacant.Friday.join(", "),
        vacantSat: vacant.Saturday.join(", "),
        vacantSun: vacant.Sunday.join(", "),
      };

      worksheet.addRow(rowEntry);
    }

    await workbook.xlsx.writeFile(filePath);
  }
  if (jsonObject.reportType === "department") {
    const r = {
      acadYear: jsonObject.academicYr,
      acadSession: jsonObject.acadSess,
    };
    const buildingsResponse = await callApi<Building[]>(
      process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND,
      r
    );

    if (!buildingsResponse.success || !buildingsResponse.data) {
      console.error("No buildings found");
      return [];
    }

    const allBuildings = buildingsResponse.data;

    const roomPromises = allBuildings.map(async (building) => {
      const roomsResponse = await callApi<Room[]>(
        process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND,
        {
          buildingNo: building.id,
          floorID: "",
          curreentTime: moment().format("HH:mm"),
        }
      );

      if (roomsResponse.success && roomsResponse.data) {
        return roomsResponse.data.filter((r) => !r.hasSubroom); // filter subrooms
      }
      return [];
    });

    const roomsPerBuilding = await Promise.all(roomPromises);
    const allRooms: Room[] = roomsPerBuilding
      .flat()
      .filter((r) => !r.hasSubroom && r.roomType !== "FACULTY");

    for (const room of allRooms) {
      const reqBody = {
        roomID: room.roomId,
        subroomID: 0,
        academicYr: jsonObject.academicYr,
        acadSess: jsonObject.acadSess,
        startDate: jsonObject.startDate,
        endDate: jsonObject.endDate,
      };
      const roomInfoResponse = await callApi<RoomInfo>(
        process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND,
        reqBody
      );

      if (!roomInfoResponse.success || !roomInfoResponse.data) continue;

      const roomInfo = roomInfoResponse.data;

      const week = getRoomOccupancyByWeekday(roomInfo.occupants || []);
      const vacant = getVacantSlotsByWeekday(roomInfo.occupants || []);

      const rowEntry: ReportData = {
        roomNo: String(roomInfo.id ?? ""),
        roomType: roomInfo.roomType,
        buildingId: roomInfo.building,
        roomCapacity: String(roomInfo.capacity ?? ""),

        occupancyMon: String((((week.Monday ?? 0) * 100) / 540).toFixed(2)),
        occupancyTue: String((((week.Tuesday ?? 0) * 100) / 540).toFixed(2)),
        occupancyWed: String((((week.Wednesday ?? 0) * 100) / 540).toFixed(2)),
        occupancyThu: String((((week.Thursday ?? 0) * 100) / 540).toFixed(2)),
        occupancyFri: String((((week.Friday ?? 0) * 100) / 540).toFixed(2)),
        occupancySat: String((((week.Saturday ?? 0) * 100) / 540).toFixed(2)),
        occupancySun: String((((week.Sunday ?? 0) * 100) / 540).toFixed(2)),
        occupancyWeekly: String(
          (((week.Weekly ?? 0) * 100) / (540 * 7)).toFixed(2)
        ),

        vacantMon: vacant.Monday.join(", "),
        vacantTue: vacant.Tuesday.join(", "),
        vacantWed: vacant.Wednesday.join(", "),
        vacantThu: vacant.Thursday.join(", "),
        vacantFri: vacant.Friday.join(", "),
        vacantSat: vacant.Saturday.join(", "),
        vacantSun: vacant.Sunday.join(", "),
      };

      worksheet.addRow(rowEntry);
    }

    await workbook.xlsx.writeFile(filePath);
  }
  if (jsonObject.reportType === "faculty") {
    const buildingsResponse = await callApi<Building[]>(
      process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND,
      {
        acadYear: jsonObject.academicYr,
        acadSession: jsonObject.acadSess,
      }
    );

    if (!buildingsResponse.success || !buildingsResponse.data) {
      console.error("No buildings found");
      return [];
    }

    const allBuildings = buildingsResponse.data;

    const roomPromises = allBuildings.map(async (building) => {
      const roomsResponse = await callApi<Room[]>(
        process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND,
        {
          buildingNo: building.id,
          floorID: "",
          curreentTime: moment().format("HH:mm"),
        }
      );

      if (roomsResponse.success && roomsResponse.data) {
        return roomsResponse.data.filter((r) => !r.hasSubroom); // filter subrooms
      }
      return [];
    });

    const roomsPerBuilding = await Promise.all(roomPromises);
    const allRooms: Room[] = roomsPerBuilding
      .flat()
      .filter((r) => !r.hasSubroom && r.roomType !== "FACULTY");

    for (const room of allRooms) {
      const reqBody = {
        roomID: room.roomId,
        subroomID: 0,
        academicYr: jsonObject.academicYr,
        acadSess: jsonObject.acadSess,
        startDate: jsonObject.startDate,
        endDate: jsonObject.endDate,
      };
      const roomInfoResponse = await callApi<RoomInfo>(
        process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND,
        reqBody
      );

      if (!roomInfoResponse.success || !roomInfoResponse.data) continue;

      const roomInfo = roomInfoResponse.data;

      const week = getRoomOccupancyByWeekday(roomInfo.occupants || []);
      const vacant = getVacantSlotsByWeekday(roomInfo.occupants || []);

      const rowEntry: ReportData = {
        roomNo: String(roomInfo.id ?? ""),
        roomType: roomInfo.roomType,
        buildingId: roomInfo.building,
        roomCapacity: String(roomInfo.capacity ?? ""),

        occupancyMon: String((((week.Monday ?? 0) * 100) / 540).toFixed(2)),
        occupancyTue: String((((week.Tuesday ?? 0) * 100) / 540).toFixed(2)),
        occupancyWed: String((((week.Wednesday ?? 0) * 100) / 540).toFixed(2)),
        occupancyThu: String((((week.Thursday ?? 0) * 100) / 540).toFixed(2)),
        occupancyFri: String((((week.Friday ?? 0) * 100) / 540).toFixed(2)),
        occupancySat: String((((week.Saturday ?? 0) * 100) / 540).toFixed(2)),
        occupancySun: String((((week.Sunday ?? 0) * 100) / 540).toFixed(2)),
        occupancyWeekly: String(
          (((week.Weekly ?? 0) * 100) / (540 * 7)).toFixed(2)
        ),

        vacantMon: vacant.Monday.join(", "),
        vacantTue: vacant.Tuesday.join(", "),
        vacantWed: vacant.Wednesday.join(", "),
        vacantThu: vacant.Thursday.join(", "),
        vacantFri: vacant.Friday.join(", "),
        vacantSat: vacant.Saturday.join(", "),
        vacantSun: vacant.Sunday.join(", "),
      };

      worksheet.addRow(rowEntry);
    }

    await workbook.xlsx.writeFile(filePath);
  }
}

type WeekSummary = {
  Monday: number;
  Tuesday: number;
  Wednesday: number;
  Thursday: number;
  Friday: number;
  Saturday: number;
  Sunday: number;
  Weekly: number;
};

type WeekVacantSlots = {
  Monday: string[];
  Tuesday: string[];
  Wednesday: string[];
  Thursday: string[];
  Friday: string[];
  Saturday: string[];
  Sunday: string[];
};

export function getVacantSlotsByWeekday(
  schedules: Occupant[],
  dayStart = "09:00",
  dayEnd = "18:00"
): WeekVacantSlots {
  const grouped: Record<
    keyof WeekVacantSlots,
    { start: moment.Moment; end: moment.Moment }[]
  > = {
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: [],
  };

  // Group schedules by weekday
  for (const { scheduledDate, startTime, endTime } of schedules) {
    const start = moment(`${scheduledDate} ${startTime}`, "YYYY-MM-DD HH:mm");
    let end = moment(`${scheduledDate} ${endTime}`, "YYYY-MM-DD HH:mm");

    if (!start.isValid() || !end.isValid()) continue;
    if (end.isBefore(start)) end = end.add(1, "day"); // overnight

    const weekday = start.format("dddd") as keyof WeekVacantSlots;
    grouped[weekday].push({ start, end });
  }

  const result: WeekVacantSlots = {
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: [],
  };

  // Calculate vacant slots
  for (const weekday of Object.keys(grouped) as (keyof WeekVacantSlots)[]) {
    const daySchedules = grouped[weekday];

    if (daySchedules.length === 0) {
      result[weekday].push(`${dayStart}-${dayEnd}`);
      continue;
    }

    // Use first schedule’s date as reference
    const refDate = daySchedules[0].start.format("YYYY-MM-DD");
    const workStart = moment(`${refDate} ${dayStart}`, "YYYY-MM-DD HH:mm");
    const workEnd = moment(`${refDate} ${dayEnd}`, "YYYY-MM-DD HH:mm");

    // Sort & merge occupied slots
    const merged: { start: moment.Moment; end: moment.Moment }[] = [];
    daySchedules.sort((a, b) => a.start.diff(b.start));

    for (const slot of daySchedules) {
      if (merged.length === 0) {
        merged.push(slot);
      } else {
        const last = merged[merged.length - 1];
        if (slot.start.isBefore(last.end)) {
          last.end = moment.max(last.end, slot.end); // merge overlap
        } else {
          merged.push(slot);
        }
      }
    }

    // Find vacant slots
    let prevEnd = workStart.clone();
    for (const slot of merged) {
      if (slot.start.isAfter(prevEnd)) {
        result[weekday].push(
          `${prevEnd.format("HH:mm")}-${slot.start.format("HH:mm")}`
        );
      }
      prevEnd = moment.max(prevEnd, slot.end);
    }
    if (prevEnd.isBefore(workEnd)) {
      result[weekday].push(
        `${prevEnd.format("HH:mm")}-${workEnd.format("HH:mm")}`
      );
    }
  }

  return result;
}

export function getRoomOccupancyByWeekday(schedules: Occupant[]): WeekSummary {
  const totals: Omit<WeekSummary, "Weekly"> = {
    Monday: 0,
    Tuesday: 0,
    Wednesday: 0,
    Thursday: 0,
    Friday: 0,
    Saturday: 0,
    Sunday: 0,
  };

  for (const { scheduledDate, startTime, endTime } of schedules) {
    const start = moment(`${scheduledDate} ${startTime}`, "YYYY-MM-DD HH:mm");
    let end = moment(`${scheduledDate} ${endTime}`, "YYYY-MM-DD HH:mm");

    if (!start.isValid() || !end.isValid()) continue;

    if (end.isBefore(start)) {
      end = end.add(1, "day"); // handle overnight
    }

    const duration = end.diff(start, "minutes");
    const weekday = start.format("dddd") as keyof typeof totals;

    totals[weekday] += duration;
  }

  return {
    ...totals,
    Weekly: Object.values(totals).reduce((a, b) => a + b, 0),
  };
}

type ReportData = {
  roomNo?: string;
  programName?: string;
  programCode?: string;
  roomType?: string;
  facultyName?: string;
  employeeId?: string;
  buildingId?: string;
  facultyBlockName?: string;
  keys?: string;
  roomCapacity?: string;

  occupancyMon?: string;
  occupancyTue?: string;
  occupancyWed?: string;
  occupancyThu?: string;
  occupancyFri?: string;
  occupancySat?: string;
  occupancySun?: string;
  occupancyWeekly?: string;
  totalOccupancy?: string;

  vacantMon?: string;
  vacantTue?: string;
  vacantWed?: string;
  vacantThu?: string;
  vacantFri?: string;
  vacantSat?: string;
  vacantSun?: string;
};
