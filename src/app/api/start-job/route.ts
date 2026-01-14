import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { Building, Program, Occupant, Room, RoomInfo, Allocation, Employee } from "@/types";
import { URL_NOT_FOUND } from "@/constants";
import { getRoomOccupancyByWeekday, getVacantSlotsByWeekday } from "./helperFunction";
import moment from "moment";
import axios from "axios";

// Store bearer token for server-side API calls
let serverBearerToken: string | null = null;
let serverBearerTokenExpiry: number = 0;

// Function to get bearer token for server-side API calls
async function getServerBearerToken(): Promise<string | null> {
  // Check if token exists and is not expired (with 2 minute buffer)
  const isTokenValid = serverBearerToken && serverBearerTokenExpiry > Date.now();

  if (isTokenValid) {
    return serverBearerToken;
  }

  // Token is missing or expired, fetch a new one
  console.log("Server-side bearer token expired or missing, refreshing...");

  try {
    const params = new URLSearchParams();
    params.append("client_id", process.env.NEXT_PUBLIC_CLIENT_ID || "");
    params.append("client_secret", process.env.NEXT_PUBLIC_CLIENT_SECRET || "");
    params.append("scope", process.env.NEXT_PUBLIC_SCOPE || "");
    params.append("grant_type", process.env.NEXT_PUBLIC_GRANT_TYPE || "client_credentials");
    params.append("token_name", process.env.NEXT_PUBLIC_TOKEN_NAME || "");

    const tenantId = process.env.NEXT_PUBLIC_TENANT_ID;
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Error response from token endpoint:", errorData);
      return null;
    }

    const data = await response.json();
    console.log("Server-side access_token fetched successfully");

    if (data.access_token) {
      const expiryTime = Date.now() + data.expires_in * 1000 - 2 * 60 * 1000; // Subtract 2 minutes
      serverBearerToken = data.access_token;
      serverBearerTokenExpiry = expiryTime;
      return serverBearerToken;
    }

    return null;
  } catch (error) {
    console.error("Error generating server-side bearer token:", error);
    return null;
  }
}

// Server-side API call wrapper with bearer token
async function serverCallApi<T>(url: string, requestBody?: unknown): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const bearerToken = await getServerBearerToken();
    if (!bearerToken) {
      return { success: false, error: "Failed to obtain bearer token" };
    }

    const response = await axios.post(url, JSON.stringify(requestBody || {}), {
      baseURL: process.env.NEXT_PUBLIC_BASE_URL,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerToken}`,
      },
    });

    return { success: true, data: JSON.parse((response.data as { value: string }).value) };
  } catch (err) {
    const error = err as { response?: { data?: { message?: string } }; message?: string };
    const errorMessage = error.response?.data?.message || error.message || "An unknown error occurred";
    return { success: false, error: errorMessage };
  }
}

export async function POST(req: NextRequest) {
  const jsonObject = await req.json();

  if (!jsonObject.fileKey) {
    return NextResponse.json(
      {
        error: "Missing fileKey",
      },
      {
        status: 400,
      }
    );
  }
  let fileName = `${jsonObject.fileKey}`;
  if (!jsonObject.fileKey.endsWith(".xlsx")) fileName = `${jsonObject.fileKey}.xlsx`;
  console.log("fileName", fileName);
  const filePath = path.join(process.cwd(), "reports", fileName);
  if (!jsonObject.isNeededToGenrate || false) {
    if (fs.existsSync(filePath)) {
      return NextResponse.json({
        jobId: fileName,
        alreadyExists: true,
        downloadUrl: `/api/download/${fileName}`,
      });
    }
  }

  createBigXLS(filePath, jsonObject).catch(console.error);

  return NextResponse.json({
    jobId: fileName,
    alreadyExists: false,
  });
}

async function createBigXLS(filePath: string, jsonObject: Record<string, unknown>) {
  try {
    fs.mkdirSync(path.dirname(filePath), {
      recursive: true,
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("report");
    const worksheetFaculty = workbook.addWorksheet("faculty_seating");

    worksheet.columns = [
      {
        header: "Room No",
        key: "roomNo",
        width: 12,
      },
      {
        header: "Program Name",
        key: "programName",
        width: 18,
      },
      {
        header: "Program Code",
        key: "programCode",
        width: 15,
      },
      {
        header: "Room Type",
        key: "roomType",
        width: 12,
      },
      {
        header: "Block No",
        key: "buildingId",
        width: 12,
      },
      {
        header: "Room Capacity",
        key: "roomCapacity",
        width: 15,
      },
      // Occupancy
      {
        header: "Occupancy - Monday",
        key: "occupancyMon",
        width: 18,
      },
      {
        header: "Occupancy - Tuesday",
        key: "occupancyTue",
        width: 18,
      },
      {
        header: "Occupancy - Wednesday",
        key: "occupancyWed",
        width: 18,
      },
      {
        header: "Occupancy - Thursday",
        key: "occupancyThu",
        width: 18,
      },
      {
        header: "Occupancy - Friday",
        key: "occupancyFri",
        width: 18,
      },
      {
        header: "Occupancy - Saturday",
        key: "occupancySat",
        width: 18,
      },
      {
        header: "Occupancy - Sunday",
        key: "occupancySun",
        width: 18,
      },
      {
        header: "Weekly Occupancy",
        key: "occupancyWeekly",
        width: 20,
      },
      // Vacant
      {
        header: "Vacant - Monday",
        key: "vacantMon",
        width: 18,
      },
      {
        header: "Vacant - Tuesday",
        key: "vacantTue",
        width: 18,
      },
      {
        header: "Vacant - Wednesday",
        key: "vacantWed",
        width: 18,
      },
      {
        header: "Vacant - Thursday",
        key: "vacantThu",
        width: 18,
      },
      {
        header: "Vacant - Friday",
        key: "vacantFri",
        width: 18,
      },
      {
        header: "Vacant - Saturday",
        key: "vacantSat",
        width: 18,
      },
      {
        header: "Vacant - Sunday",
        key: "vacantSun",
        width: 18,
      },
    ];
    type FacultyRow = {
      employeeId: string;
      facultyName: string;
      programCode: string;
      programName: string;
      academicBlock: string;
      facultyBlock: string;
      workStation: string;
      cabinNo: string;
      occupancy: string;
      keyNo: string;
    };

    worksheetFaculty.columns = [
      {
        header: "Employee Id",
        key: "employeeId",
        width: 15,
      },
      {
        header: "Faculty Name",
        key: "facultyName",
        width: 20,
      },
      {
        header: "Program Code",
        key: "programCode",
        width: 15,
      },
      {
        header: "Program Name",
        key: "programName",
        width: 18,
      },
      {
        header: "Academic Block",
        key: "academicBlock",
        width: 12,
      },
      {
        header: "Faculty Block Name",
        key: "facultyBlock",
        width: 20,
      },
      {
        header: "Work Station No",
        key: "workStation",
        width: 12,
      },
      {
        header: "Cabin No.",
        key: "cabinNo",
        width: 12,
      },
      {
        header: "Keys",
        key: "keyNo",
        width: 10,
      },
      {
        header: "Room Capacity",
        key: "occupancy",
        width: 15,
      },
    ];

    const { data: programs } = await serverCallApi<{ programCode: Program[] }>(process.env.NEXT_PUBLIC_GET_PROGRAM || URL_NOT_FOUND);
    const { data: employees } = await serverCallApi<Employee[]>(process.env.NEXT_PUBLIC_GET_EMPLOYEES || URL_NOT_FOUND, {
      employeeCode: "",
    });

    const { data: roomAllocation } = await serverCallApi<Allocation[]>(process.env.NEXT_PUBLIC_GET_ROOM_ALLOCATIONS || URL_NOT_FOUND, {
      acadSession: jsonObject.acadSess,
      acadYear: jsonObject.academicYr,
    });

    // Helper function to calculate weekday counts in date range
    const calculateWeekdayCounts = (startDate: string, endDate: string): Record<string, number> => {
      const counts: Record<string, number> = {
        Monday: 0,
        Tuesday: 0,
        Wednesday: 0,
        Thursday: 0,
        Friday: 0,
        Saturday: 0,
        Sunday: 0,
      };

      if (!startDate || !endDate) {
        // Default to 1 if no range provided
        Object.keys(counts).forEach((key) => (counts[key] = 1));
        return counts;
      }

      const start = moment(startDate, "YYYY-MM-DD");
      const end = moment(endDate, "YYYY-MM-DD");

      if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
        Object.keys(counts).forEach((key) => (counts[key] = 1));
        return counts;
      }

      let current = start.clone();
      while (current.isSameOrBefore(end)) {
        const weekday = current.format("dddd");
        counts[weekday]++;
        current.add(1, "day");
      }

      return counts;
    };

    const handleRoom = async (roomData: RoomInfo) => {
      const allocations = roomAllocation?.filter((a) => a.roomNo === roomData.id);

      let occupants = roomData?.occupants || [];
      if (jsonObject.reportType === "department") occupants = occupants.filter((o: Occupant) => o.department === jsonObject.departmentId);
      if (jsonObject.reportType === "faculty") occupants = occupants.filter((o: Occupant) => o.department === jsonObject.facultyId);

      const startDate = (jsonObject.startDate as string) || "";
      const endDate = (jsonObject.endDate as string) || "";

      const week = getRoomOccupancyByWeekday(occupants, startDate, endDate);
      const vacant = getVacantSlotsByWeekday(occupants, startDate, endDate);
      const programsCode: string[] = allocations?.map((a) => a.program) ?? [];
      const startRow = worksheet.rowCount + 1;

      // Calculate weekday counts for percentage calculation
      const weekdayCounts = calculateWeekdayCounts(startDate, endDate);

      // Helper function to calculate occupancy percentage
      const getOccupancyPercentage = (weekdayMinutes: number, weekday: string): number => {
        const count = weekdayCounts[weekday] || 1;
        const totalPossibleMinutes = count * 540; // 540 minutes = 9 hours (9:00-18:00)
        return totalPossibleMinutes > 0 ? Number(((weekdayMinutes * 100) / totalPossibleMinutes).toFixed(2)) : 0;
      };

      // Calculate weekly percentage
      const totalWeekdays = Object.values(weekdayCounts).reduce((a, b) => a + b, 0);
      const weeklyPercentage = totalWeekdays > 0 ? Number(((week.Weekly * 100) / (totalWeekdays * 540)).toFixed(2)) : 0;

      // Check if there are no programs.
      if (programsCode.length === 0) {
        const rowEntry: ReportData = {
          roomNo: String(roomData.parentId ? `${roomData?.parentId} - ${roomData?.id}` : `${roomData?.id}`),
          roomType: roomData?.roomType ?? "",
          buildingId: roomData?.building ?? "",
          roomCapacity: Number(roomData?.capacity ?? ""),
          programCode: "",
          programName: "",
          occupancyMon: getOccupancyPercentage(week.Monday, "Monday"),
          occupancyTue: getOccupancyPercentage(week.Tuesday, "Tuesday"),
          occupancyWed: getOccupancyPercentage(week.Wednesday, "Wednesday"),
          occupancyThu: getOccupancyPercentage(week.Thursday, "Thursday"),
          occupancyFri: getOccupancyPercentage(week.Friday, "Friday"),
          occupancySat: getOccupancyPercentage(week.Saturday, "Saturday"),
          occupancySun: getOccupancyPercentage(week.Sunday, "Sunday"),
          occupancyWeekly: weeklyPercentage,
          vacantMon: String(vacant.Monday.join(", ")),
          vacantTue: String(vacant.Tuesday.join(", ")),
          vacantWed: String(vacant.Wednesday.join(", ")),
          vacantThu: String(vacant.Thursday.join(", ")),
          vacantFri: String(vacant.Friday.join(", ")),
          vacantSat: String(vacant.Saturday.join(", ")),
          vacantSun: String(vacant.Sunday.join(", ")),
        };
        worksheet.addRow(rowEntry);
      } else {
        // If there are programs, process them normally.
        programsCode.forEach((code) => {
          const program = programs?.programCode?.find((p: Program) => p.code === code);
          const rowEntry: ReportData = {
            roomNo: String(roomData.parentId ? `${roomData?.parentId} - ${roomData?.id}` : `${roomData?.id}`),
            roomType: roomData?.roomType ?? "",
            buildingId: roomData?.building ?? "",
            roomCapacity: Number(roomData?.capacity ?? ""),
            programCode: code,
            programName: program ? program.description : "",
            occupancyMon: getOccupancyPercentage(week.Monday, "Monday"),
            occupancyTue: getOccupancyPercentage(week.Tuesday, "Tuesday"),
            occupancyWed: getOccupancyPercentage(week.Wednesday, "Wednesday"),
            occupancyThu: getOccupancyPercentage(week.Thursday, "Thursday"),
            occupancyFri: getOccupancyPercentage(week.Friday, "Friday"),
            occupancySat: getOccupancyPercentage(week.Saturday, "Saturday"),
            occupancySun: getOccupancyPercentage(week.Sunday, "Sunday"),
            occupancyWeekly: weeklyPercentage,
            vacantMon: String(vacant.Monday.join(", ")),
            vacantTue: String(vacant.Tuesday.join(", ")),
            vacantWed: String(vacant.Wednesday.join(", ")),
            vacantThu: String(vacant.Thursday.join(", ")),
            vacantFri: String(vacant.Friday.join(", ")),
            vacantSat: String(vacant.Saturday.join(", ")),
            vacantSun: String(vacant.Sunday.join(", ")),
          };
          worksheet.addRow(rowEntry);
        });

        // Merge cells only if there were multiple programs
        const endRow = worksheet.rowCount;
        if (programsCode.length > 1) {
          const mergeCols = ["A", "E", "F", "D", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U"];
          mergeCols.forEach((col) => {
            worksheet.mergeCells(`${col}${startRow}:${col}${endRow}`);
          });
        }
      }
    };

    const handleFacultySeating = async (emp: Employee, roomData: RoomInfo[]) => {
      const program = programs?.programCode?.find((p: Program) => p.code === emp.programCode);

      const roomsMap: Record<string, RoomInfo> = {};

      if (jsonObject.reportType === "building") {
        roomData.forEach((r: RoomInfo) => {
          r?.occupants?.forEach((o: Occupant) => {
            if (o.occupantId === emp.employeeCode) {
              roomsMap[r.id] = r; // keyed by room id
            }
          });
        });
      }
      if (jsonObject.reportType === "department") {
        roomData.forEach((r: RoomInfo) => {
          r?.occupants?.forEach((o: Occupant) => {
            if (o.department && o.department === jsonObject.departmentId) {
              roomsMap[r.id] = r; // keyed by room id
            }
          });
        });
      }
      if (jsonObject.reportType === "faculty") {
        roomData.forEach((r: RoomInfo) => {
          r?.occupants?.forEach((o: Occupant) => {
            if (o.facultyCode && o.facultyCode === jsonObject.facultyId) {
              roomsMap[r.id] = r; // keyed by room id
            }
          });
        });
      }

      // Convert hashmap back to array if needed
      const roomsInWhichEmp: RoomInfo[] = Object.values(roomsMap);
      const startRow = worksheetFaculty.rowCount + 1;

      // // Add one row per matched room
      for (let i = 0; i < (roomsInWhichEmp.length === 0 ? 1 : roomsInWhichEmp.length); i++) {
        const room = roomsInWhichEmp.length === 0 ? null : roomsInWhichEmp[i];
        const row: FacultyRow = {
          employeeId: String(emp.employeeCode ?? ""),
          facultyName: String(emp.employeeName ?? ""),
          programCode: String(emp.programCode ?? ""),
          programName: program ? program.description : "",
          academicBlock: String(room?.building ?? ""),
          facultyBlock: String(room?.hasSubtype ? room?.parentId : room?.id ?? ""),
          workStation: String(room?.roomType.replace(" ", "").toLowerCase() === "workstation" ? room?.id : ""),
          cabinNo: String(room?.roomType.toLowerCase() === "cubical" ? room?.id : ""),
          keyNo: String(room?.occupants?.find((o: Occupant) => o.occupantId === emp.employeeCode)?.keyNo ?? ""),
          occupancy: String(room?.capacity ?? ""),
        };

        worksheetFaculty.addRow(row);
      }

      const endRow = worksheetFaculty.rowCount;

      // Merge common columns (Employee + Program info)
      if (roomsInWhichEmp.length > 1) {
        const mergeCols = ["A", "B", "C", "D"]; // employeeId, facultyName, programCode, programName
        mergeCols.forEach((col) => {
          worksheetFaculty.mergeCells(`${col}${startRow}:${col}${endRow}`);
        });
      }
    };

    const dataManupulation = async (object: Record<string, unknown>) => {
      const reqBody = {
        roomID: object.roomID,
        subroomID: "",
        academicYr: object.academicYr,
        acadSess: object.acadSess,
        startDate: object.startDate,
        endDate: object.endDate,
      };
      console.log(`[Data Manipulation] Processing roomID: ${JSON.stringify(reqBody)}`);

      const roomInfoResponse = await serverCallApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, reqBody);
      if (roomInfoResponse.success) {
        if (roomInfoResponse.data && !roomInfoResponse.data?.isSitting) {
          // Process parent room only - occupants already contain subroom data
          await handleRoom(roomInfoResponse.data);
        }
      }
    };

    if (jsonObject.reportType === "room") {
      await dataManupulation(jsonObject);

      // Add faculty seating logic for room reports if it's a faculty room
      const reqBody = {
        roomID: jsonObject.roomID,
        subroomID: "",
        academicYr: jsonObject.academicYr,
        acadSess: jsonObject.acadSess,
        startDate: jsonObject.startDate,
        endDate: jsonObject.endDate,
      };

      const roomInfoResponse = await serverCallApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, reqBody);

      if (roomInfoResponse.success && roomInfoResponse.data?.isSitting) {
        // Process faculty room - occupants already contain subroom data
        const roomOccupants = roomInfoResponse.data?.occupants || [];
        const employeeIds = roomOccupants.map((o) => o.occupantId).filter((id) => id);

        const filteredEmployees =
          employees?.filter((e) => {
            return employeeIds.includes(e.employeeCode);
          }) || [];

        for (const emp of filteredEmployees) {
          await handleFacultySeating(emp, [roomInfoResponse.data]);
        }
      }

      await workbook.xlsx.writeFile(filePath);

      // Insert file information into database after successful creation
      await insertFileInfo(filePath, jsonObject);
    }

    if (jsonObject.reportType === "building") {
      let { data: buildings } = await serverCallApi<Building[]>(process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND, {
        acadSession: jsonObject.acadSess,
        acadYear: jsonObject.academicYr,
      });

      if (jsonObject.buildingId !== "allBuildings") {
        buildings = buildings?.filter((b) => b.id === jsonObject.buildingId);
      }

      for (const b of buildings || []) {
        const { data: roomsList } = await serverCallApi<Room[]>(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, {
          buildingNo: b.id,
          floorID: ``,
          curreentTime: moment().format("HH:mm"),
        });
        for (const room of roomsList || []) {
          await dataManupulation({ ...jsonObject, roomID: room.roomId });
        }
      }

      // this is used to insert data into second Sheet
      const allRooms: Room[] = (
        await Promise.all(
          buildings?.map(async (b) => {
            const { data: roomsList } = await serverCallApi<Room[]>(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, {
              buildingNo: b.id,
              floorID: ``,
              curreentTime: moment().format("HH:mm"),
            });
            return roomsList ?? [];
          }) ?? []
        )
      ).flat();

      // Process all rooms - fetch room info to check if they are sitting rooms
      const roomInfoPromises = allRooms.map(async (room) => {
        const reqBody = {
          roomID: room.roomId,
          subroomID: "",
          academicYr: jsonObject.academicYr,
          acadSess: jsonObject.acadSess,
          startDate: jsonObject.startDate,
          endDate: jsonObject.endDate,
        };

        return serverCallApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, reqBody).then((res) => ({
          ...res.data,
          isRoom: true,
        }));
      });

      // Run everything in parallel, flatten, and filter for sitting rooms with occupants
      const roomInfoResponses = (await Promise.all(roomInfoPromises)).flat().filter((r) => r && r.isSitting && (r.occupants?.length || 0) > 0) as RoomInfo[];

      for (const emp of employees || []) {
        await handleFacultySeating(emp, roomInfoResponses);
      }

      await workbook.xlsx.writeFile(filePath);

      // Insert file information into database after successful creation
      await insertFileInfo(filePath, jsonObject);
    }

    if (jsonObject.reportType === "department") {
      let { data: buildings } = await serverCallApi<Building[]>(process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND, {
        acadSession: jsonObject.acadSess,
        acadYear: jsonObject.academicYr,
      });

      if (jsonObject.buildingId !== "allBuildings") {
        buildings = buildings?.filter((b) => b.id === jsonObject.buildingId);
      }

      for (const b of buildings || []) {
        const { data: roomsList } = await serverCallApi<Room[]>(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, {
          buildingNo: b.id,
          floorID: ``,
          curreentTime: moment().format("HH:mm"),
        });
        for (const room of roomsList || []) {
          await dataManupulation({ ...jsonObject, roomID: room.roomId });
        }
      }

      // this is used to insert data into second Sheet
      const allRooms: Room[] = (
        await Promise.all(
          buildings?.map(async (b) => {
            const { data: roomsList } = await serverCallApi<Room[]>(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, {
              buildingNo: b.id,
              floorID: ``,
              curreentTime: moment().format("HH:mm"),
            });
            return roomsList ?? [];
          }) ?? []
        )
      ).flat();

      // Process all rooms - occupants already contain subroom data
      const roomInfoPromises = allRooms.map(async (room) => {
        const reqBody = {
          roomID: room.roomId,
          subroomID: "",
          academicYr: jsonObject.academicYr,
          acadSess: jsonObject.acadSess,
          startDate: jsonObject.startDate,
          endDate: jsonObject.endDate,
        };

        return serverCallApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, reqBody).then((res) => ({
          ...res.data,
          isRoom: true,
        }));
      });

      // Run everything in parallel and flatten
      const roomInfoResponses = (await Promise.all(roomInfoPromises)).flat().filter((r) => r && (r.occupants?.length || 0) > 0) as RoomInfo[];

      const filteredEmployees =
        employees?.filter((e) => {
          return e.departmentCode === jsonObject.departmentId;
        }) || [];

      for (const emp of filteredEmployees) {
        await handleFacultySeating(emp, roomInfoResponses);
      }

      await workbook.xlsx.writeFile(filePath);

      // Insert file information into database after successful creation
      await insertFileInfo(filePath, jsonObject);
    }

    if (jsonObject.reportType === "faculty") {
      let { data: buildings } = await serverCallApi<Building[]>(process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND, {
        acadSession: jsonObject.acadSess,
        acadYear: jsonObject.academicYr,
      });

      if (jsonObject.buildingId !== "allBuildings") {
        buildings = buildings?.filter((b) => b.id === jsonObject.buildingId);
      }

      for (const b of buildings || []) {
        const { data: roomsList } = await serverCallApi<Room[]>(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, {
          buildingNo: b.id,
          floorID: ``,
          curreentTime: moment().format("HH:mm"),
        });
        for (const room of roomsList || []) {
          await dataManupulation({ ...jsonObject, roomID: room.roomId });
        }
      }

      // this is used to insert data into second Sheet
      const allRooms: Room[] = (
        await Promise.all(
          buildings?.map(async (b) => {
            const { data: roomsList } = await serverCallApi<Room[]>(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, {
              buildingNo: b.id,
              floorID: ``,
              curreentTime: moment().format("HH:mm"),
            });
            return roomsList ?? [];
          }) ?? []
        )
      ).flat();

      // Process all rooms - occupants already contain subroom data
      const roomInfoPromises = allRooms.map(async (room) => {
        const reqBody = {
          roomID: room.roomId,
          subroomID: "",
          academicYr: jsonObject.academicYr,
          acadSess: jsonObject.acadSess,
          startDate: jsonObject.startDate,
          endDate: jsonObject.endDate,
        };

        return serverCallApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, reqBody).then((res) => ({
          ...res.data,
          isRoom: true,
        }));
      });

      // Run everything in parallel and flatten
      const roomInfoResponses = (await Promise.all(roomInfoPromises)).flat().filter((r) => r && (r.occupants?.length || 0) > 0) as RoomInfo[];

      const filteredEmployees =
        employees?.filter((e) => {
          return e.facultyCode === jsonObject.facultyId;
        }) || [];

      for (const emp of filteredEmployees) {
        // await handleFacultySeating(employees?.[1473]!, roomInfoResponses);
        await handleFacultySeating(emp, roomInfoResponses);
      }

      await workbook.xlsx.writeFile(filePath);

      // Insert file information into database after successful creation
      await insertFileInfo(filePath, jsonObject);
    }
  } catch (error) {
    console.error("Error creating Excel file:", error);
    // You could add additional error handling here, such as:
    // - Writing error to a log file
    // - Sending notification to admin
    // - Creating a fallback error report
  }
}
async function insertFileInfo(filePath: string, jsonObject: Record<string, unknown>) {
  try {
    const fileName = path.basename(filePath);
    const stats = fs.statSync(filePath);
    const fileSize = stats.size.toString();

    const insertData = {
      fileName: fileName,
      reportType: jsonObject.reportType || "room",
      fileSize: fileSize,
      isActiveSession: jsonObject.isNeededToGenrate,
      startDate: jsonObject.startDate || "",
      endDate: jsonObject.endDate || "",
      filePath: filePath,
    };

    console.log("Inserting file info:", insertData);

    const response = await serverCallApi(process.env.NEXT_PUBLIC_INSERT_ALLOCATION_UTILIZATION_REPORT_API || URL_NOT_FOUND, insertData);

    if (response.success) {
      console.log("File information inserted successfully");
    } else {
      console.error("Failed to insert file information:", response);
    }
  } catch (error) {
    console.error("Error inserting file information:", error);
  }
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
  roomCapacity?: number;

  occupancyMon?: number;
  occupancyTue?: number;
  occupancyWed?: number;
  occupancyThu?: number;
  occupancyFri?: number;
  occupancySat?: number;
  occupancySun?: number;
  occupancyWeekly?: number;
  totalOccupancy?: number;

  vacantMon?: string;
  vacantTue?: string;
  vacantWed?: string;
  vacantThu?: string;
  vacantFri?: string;
  vacantSat?: string;
  vacantSun?: string;
};
