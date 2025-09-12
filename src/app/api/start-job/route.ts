import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { callApi } from "@/utils/apiIntercepter";
import { Building, Program, Occupant, Room, RoomInfo, Allocation, Department, Faculty, Employee } from "@/types";
import { URL_NOT_FOUND } from "@/constants";
import { getRoomOccupancyByWeekday, getVacantSlotsByWeekday } from "./helperFunction";
import moment from "moment";
import React from "react";

export async function POST(req: NextRequest) {
  const jsonObject = await req.json();
  console.log(jsonObject);

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

  const fileName = `${jsonObject.fileKey}.xlsx`;
  const filePath = path.join(process.cwd(), "reports", fileName);

  // if (fs.existsSync(filePath)) {
  //   return NextResponse.json({
  //     jobId: fileName,
  //     alreadyExists: true,
  //     downloadUrl: `/api/download/${fileName}`,
  //   });
  // }

  createBigXLS(filePath, jsonObject).catch(console.error);

  return NextResponse.json({
    jobId: fileName,
    alreadyExists: false,
  });
}

async function createBigXLS(filePath: string, jsonObject: any) {
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

  const { data: programs } = await callApi<any>(process.env.NEXT_PUBLIC_GET_PROGRAM || URL_NOT_FOUND);
  const { data: employees } = await callApi<Employee[]>(process.env.NEXT_PUBLIC_GET_EMPLOYEES || URL_NOT_FOUND, {
    employeeCode: "",
  });
  const { data: departments } = await callApi<Department[]>(process.env.NEXT_PUBLIC_GET_FACULTY_OR_DEPARTMENT || URL_NOT_FOUND, {
    filterValue: "DEPARTMENT",
  });
  const { data: faculties } = await callApi<Faculty[]>(process.env.NEXT_PUBLIC_GET_FACULTY_OR_DEPARTMENT || URL_NOT_FOUND, {
    filterValue: "FACULTY",
  });

  const { data: roomAllocation } = await callApi<Allocation[]>(process.env.NEXT_PUBLIC_GET_ROOM_ALLOCATIONS || URL_NOT_FOUND, {
    acadSession: jsonObject.acadSess,
    acadYear: jsonObject.academicYr,
  });

  const handleRoom = async (roomData: any) => {
    const allocations = roomAllocation?.filter((a) => a.roomNo === roomData.id);

    let occupants = roomData?.occupants;
    if (jsonObject.reportType === "department") occupants = occupants.filter((o: Occupant) => o.department === jsonObject.departmentId);
    if (jsonObject.reportType === "faculty") occupants = occupants.filter((o: Occupant) => o.department === jsonObject.facultyId);

    const week = getRoomOccupancyByWeekday(occupants || []);
    const vacant = getVacantSlotsByWeekday(occupants || []);
    const programsCode: string[] = allocations?.map((a) => a.program) ?? [];
    const startRow = worksheet.rowCount + 1;

    // Check if there are no programs.
    if (programsCode.length === 0) {
      const rowEntry: ReportData = {
        roomNo: String(roomData.parentId ? `${roomData?.parentId} - ${roomData?.id}` : `${roomData?.id}`),
        roomType: roomData?.roomType ?? "",
        buildingId: roomData?.building ?? "",
        roomCapacity: String(roomData?.capacity ?? ""),
        programCode: "",
        programName: "",
        occupancyMon: String((((week.Monday ?? 0) * 100) / 540).toFixed(2)),
        occupancyTue: String((((week.Tuesday ?? 0) * 100) / 540).toFixed(2)),
        occupancyWed: String((((week.Wednesday ?? 0) * 100) / 540).toFixed(2)),
        occupancyThu: String((((week.Thursday ?? 0) * 100) / 540).toFixed(2)),
        occupancyFri: String((((week.Friday ?? 0) * 100) / 540).toFixed(2)),
        occupancySat: String((((week.Saturday ?? 0) * 100) / 540).toFixed(2)),
        occupancySun: String((((week.Sunday ?? 0) * 100) / 540).toFixed(2)),
        occupancyWeekly: String((((week.Weekly ?? 0) * 100) / (540 * 7)).toFixed(2)),
        vacantMon: String(vacant.Monday.toString()),
        vacantTue: String(vacant.Tuesday.toString()),
        vacantWed: String(vacant.Wednesday.toString()),
        vacantThu: String(vacant.Thursday.toString()),
        vacantFri: String(vacant.Friday.toString()),
        vacantSat: String(vacant.Saturday.toString()),
        vacantSun: String(vacant.Sunday.toString()),
      };
      worksheet.addRow(rowEntry);
    } else {
      // If there are programs, process them normally.
      programsCode.forEach((code) => {
        const program = programs?.programCode?.find((p: any) => p.code === code);
        const rowEntry: ReportData = {
          roomNo: String(roomData.parentId ? `${roomData?.parentId} - ${roomData?.id}` : `${roomData?.id}`),
          roomType: roomData?.roomType ?? "",
          buildingId: roomData?.building ?? "",
          roomCapacity: String(roomData?.capacity ?? ""),
          programCode: code,
          programName: program ? program.description : "",
          occupancyMon: String((((week.Monday ?? 0) * 100) / 540).toFixed(2)),
          occupancyTue: String((((week.Tuesday ?? 0) * 100) / 540).toFixed(2)),
          occupancyWed: String((((week.Wednesday ?? 0) * 100) / 540).toFixed(2)),
          occupancyThu: String((((week.Thursday ?? 0) * 100) / 540).toFixed(2)),
          occupancyFri: String((((week.Friday ?? 0) * 100) / 540).toFixed(2)),
          occupancySat: String((((week.Saturday ?? 0) * 100) / 540).toFixed(2)),
          occupancySun: String((((week.Sunday ?? 0) * 100) / 540).toFixed(2)),
          occupancyWeekly: String((((week.Weekly ?? 0) * 100) / (540 * 7)).toFixed(2)),
          vacantMon: String(vacant.Monday.toString()),
          vacantTue: String(vacant.Tuesday.toString()),
          vacantWed: String(vacant.Wednesday.toString()),
          vacantThu: String(vacant.Thursday.toString()),
          vacantFri: String(vacant.Friday.toString()),
          vacantSat: String(vacant.Saturday.toString()),
          vacantSun: String(vacant.Sunday.toString()),
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

  const handleFacultySeating = async (emp: Employee, roomData: any) => {
    const program = programs?.programCode?.find((p: Program) => p.code === emp.programCode);

    const roomsMap: Record<string, any> = {};

    if (jsonObject.reportType === "building") {
      roomData.forEach((r: any) => {
        r?.occupants?.forEach((o: Occupant) => {
          if (o.occupantId === emp.employeeCode) {
            roomsMap[r.id] = r; // keyed by room id
          }
        });
      });
    }
    if (jsonObject.reportType === "department") {
      roomData.forEach((r: any) => {
        r?.occupants?.forEach((o: Occupant) => {
          if (o.department && o.department === jsonObject.departmentId) {
            roomsMap[r.id] = r; // keyed by room id
          }
        });
      });
    }
    if (jsonObject.reportType === "faculty") {
      roomData.forEach((r: any) => {
        r?.occupants?.forEach((o: Occupant) => {
          if (o.facultyCode && o.facultyCode === jsonObject.facultyId) {
            roomsMap[r.id] = r; // keyed by room id
          }
        });
      });
    }

    // Convert hashmap back to array if needed
    const roomsInWhichEmp: any[] = Object.values(roomsMap);
    const startRow = worksheetFaculty.rowCount + 1;

    // // Add one row per matched room
    for (let i = 0; i < (roomsInWhichEmp.length === 0 ? 1 : roomsInWhichEmp.length); i++) {
      let room = roomsInWhichEmp.length === 0 ? null : roomsInWhichEmp[i];
      const row: FacultyRow = {
        employeeId: String(emp.employeeCode ?? ""),
        facultyName: String(emp.employeeName ?? ""),
        programCode: String(emp.programCode ?? ""),
        programName: program ? program.description : "",
        academicBlock: String(room?.building ?? ""),
        facultyBlock: String(room?.isRoom ? room?.id : room?.parentId ?? ""),
        workStation: String(room?.roomType.replace(" ", "").toLowerCase() === "workstation" ? room?.id : ""),
        cabinNo: String(room?.roomType.toLowerCase() === "cubical" ? room?.id : ""),
        keyNo: String(room?.keys ?? ""),
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

  const dataManupulation = async (object: any) => {
    const reqBody = {
      roomID: object.roomID,
      subroomID: 0,
      academicYr: object.academicYr,
      acadSess: object.acadSess,
      startDate: object.startDate,
      endDate: object.endDate,
    };

    const roomInfoResponse = await callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, reqBody);
    if (roomInfoResponse.success) {
      if (!roomInfoResponse.data?.roomType.toLowerCase().includes("faculty")) {
        if (roomInfoResponse.data?.hasSubtype) {
          // 🔹 CASE 1: Room has subrooms
          const subroomsResponse = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_SUBROOMS_LIST || URL_NOT_FOUND, {
            roomID: object.roomID,
            buildingNo: roomInfoResponse.data.building,
            acadSess: object.acadSess,
            acadYr: object.academicYr,
          });

          const subrooms = subroomsResponse?.data || [];
          for (const sub of subrooms) {
            const subRoomReqBody = {
              ...reqBody,
              subroomID: sub.roomId,
            };

            const subRoomInfoResponse = await callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, subRoomReqBody);

            if (subRoomInfoResponse.success) {
              await handleRoom(subRoomInfoResponse.data);
            }
          }
        } else {
          // 🔹 CASE 2: Normal room
          await handleRoom(roomInfoResponse.data);
        }
      }
    }
  };

  if (jsonObject.reportType === "room") {
    await dataManupulation(jsonObject);
    await workbook.xlsx.writeFile(filePath);
  }

  if (jsonObject.reportType === "building") {
    let { data: buildings } = await callApi<Building[]>(process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND, {
      acadSession: jsonObject.acadSess,
      acadYear: jsonObject.academicYr,
    });

    if (jsonObject.buildingId !== "allBuildings") {
      buildings = buildings?.filter((b) => b.id === jsonObject.buildingId);
    }

    buildings?.forEach(async (b) => {
      const { data: roomsList } = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, {
        buildingNo: b.id,
        floorID: ``,
        curreentTime: moment().format("HH:mm"),
      });
      roomsList?.forEach(async (room) => {
        await dataManupulation({ ...jsonObject, roomID: room.roomId });
      });
    });

    // this is used to insert data into second Sheet
    const allRooms: Room[] = (
      await Promise.all(
        buildings?.map(async (b) => {
          const { data: roomsList } = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, {
            buildingNo: b.id,
            floorID: ``,
            curreentTime: moment().format("HH:mm"),
          });
          return roomsList ?? [];
        }) ?? []
      )
    )
      .flat()
      .filter((r) => r.roomType.toLowerCase().includes("faculty"));

    // Prepare promises for rooms and subrooms
    const roomInfoPromises = allRooms.map(async (room) => {
      if (room.hasSubroom) {
        // Fetch subrooms
        const { data: subrooms } = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_SUBROOMS_LIST || URL_NOT_FOUND, {
          roomID: room.roomId,
          buildingNo: room.buildingId,
          acadSess: jsonObject.acadSess,
          acadYr: jsonObject.academicYr,
        });

        if (!subrooms || subrooms.length === 0) return [];

        // Fetch info for each subroom
        const subRoomInfoPromises = subrooms.map((sub) => {
          const reqBody = {
            roomID: room.roomId, // parent
            subroomID: sub.roomId, // subroom
            academicYr: jsonObject.academicYr,
            acadSess: jsonObject.acadSess,
            startDate: jsonObject.startDate,
            endDate: jsonObject.endDate,
          };

          return callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, reqBody).then((res) => ({
            ...res.data,
            isRoom: false,
          }));
        });

        return Promise.all(subRoomInfoPromises);
      } else {
        // Normal room
        const reqBody = {
          roomID: room.roomId,
          subroomID: 0,
          academicYr: jsonObject.academicYr,
          acadSess: jsonObject.acadSess,
          startDate: jsonObject.startDate,
          endDate: jsonObject.endDate,
        };

        return callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, reqBody).then((res) => ({
          ...res.data,
          isRoom: true,
        }));
      }
    });

    // Run everything in parallel and flatten
    const roomInfoResponses = (await Promise.all(roomInfoPromises)).flat().filter((r) => (r.occupants?.length || 0) > 0);

    // console.log(roomInfoResponses);

    employees?.forEach(async (emp) => {
      await handleFacultySeating(emp, roomInfoResponses);
    });

    await workbook.xlsx.writeFile(filePath);
  }

  if (jsonObject.reportType === "department") {
    let { data: buildings } = await callApi<Building[]>(process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND, {
      acadSession: jsonObject.acadSess,
      acadYear: jsonObject.academicYr,
    });

    if (jsonObject.buildingId !== "allBuildings") {
      buildings = buildings?.filter((b) => b.id === jsonObject.buildingId);
    }

    buildings?.forEach(async (b) => {
      const { data: roomsList } = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, {
        buildingNo: b.id,
        floorID: ``,
        curreentTime: moment().format("HH:mm"),
      });
      roomsList?.forEach(async (room) => {
        await dataManupulation({ ...jsonObject, roomID: room.roomId });
      });
    });

    // this is used to insert data into second Sheet
    const allRooms: Room[] = (
      await Promise.all(
        buildings?.map(async (b) => {
          const { data: roomsList } = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, {
            buildingNo: b.id,
            floorID: ``,
            curreentTime: moment().format("HH:mm"),
          });
          return roomsList ?? [];
        }) ?? []
      )
    ).flat();

    // Prepare promises for rooms and subrooms
    const roomInfoPromises = allRooms.map(async (room) => {
      if (room.hasSubroom) {
        // Fetch subrooms
        const { data: subrooms } = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_SUBROOMS_LIST || URL_NOT_FOUND, {
          roomID: room.roomId,
          buildingNo: room.buildingId,
          acadSess: jsonObject.acadSess,
          acadYr: jsonObject.academicYr,
        });

        if (!subrooms || subrooms.length === 0) return [];

        // Fetch info for each subroom
        const subRoomInfoPromises = subrooms.map((sub) => {
          const reqBody = {
            roomID: room.roomId, // parent
            subroomID: sub.roomId, // subroom
            academicYr: jsonObject.academicYr,
            acadSess: jsonObject.acadSess,
            startDate: jsonObject.startDate,
            endDate: jsonObject.endDate,
          };

          return callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, reqBody).then((res) => ({
            ...res.data,
            isRoom: false,
          }));
        });

        return Promise.all(subRoomInfoPromises);
      } else {
        // Normal room
        const reqBody = {
          roomID: room.roomId,
          subroomID: 0,
          academicYr: jsonObject.academicYr,
          acadSess: jsonObject.acadSess,
          startDate: jsonObject.startDate,
          endDate: jsonObject.endDate,
        };

        return callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, reqBody).then((res) => ({
          ...res.data,
          isRoom: true,
        }));
      }
    });

    // Run everything in parallel and flatten
    const roomInfoResponses = (await Promise.all(roomInfoPromises)).flat().filter((r) => (r.occupants?.length || 0) > 0);

    employees
      ?.filter((e) => {
        e.departmentCode === jsonObject.departmentId;
      })
      ?.forEach(async (emp) => {
        await handleFacultySeating(emp, roomInfoResponses);
      });

    await workbook.xlsx.writeFile(filePath);
  }

  if (jsonObject.reportType === "faculty") {
    let { data: buildings } = await callApi<Building[]>(process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND, {
      acadSession: jsonObject.acadSess,
      acadYear: jsonObject.academicYr,
    });

    if (jsonObject.buildingId !== "allBuildings") {
      buildings = buildings?.filter((b) => b.id === jsonObject.buildingId);
    }

    buildings?.forEach(async (b) => {
      const { data: roomsList } = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, {
        buildingNo: b.id,
        floorID: ``,
        curreentTime: moment().format("HH:mm"),
      });
      roomsList?.forEach(async (room) => {
        await dataManupulation({ ...jsonObject, roomID: room.roomId });
      });
    });

    // this is used to insert data into second Sheet
    const allRooms: Room[] = (
      await Promise.all(
        buildings?.map(async (b) => {
          const { data: roomsList } = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, {
            buildingNo: b.id,
            floorID: ``,
            curreentTime: moment().format("HH:mm"),
          });
          return roomsList ?? [];
        }) ?? []
      )
    ).flat();

    // Prepare promises for rooms and subrooms
    const roomInfoPromises = allRooms.map(async (room) => {
      if (room.hasSubroom) {
        // Fetch subrooms
        const { data: subrooms } = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_SUBROOMS_LIST || URL_NOT_FOUND, {
          roomID: room.roomId,
          buildingNo: room.buildingId,
          acadSess: jsonObject.acadSess,
          acadYr: jsonObject.academicYr,
        });

        if (!subrooms || subrooms.length === 0) return [];

        // Fetch info for each subroom
        const subRoomInfoPromises = subrooms.map((sub) => {
          const reqBody = {
            roomID: room.roomId, // parent
            subroomID: sub.roomId, // subroom
            academicYr: jsonObject.academicYr,
            acadSess: jsonObject.acadSess,
            startDate: jsonObject.startDate,
            endDate: jsonObject.endDate,
          };

          return callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, reqBody).then((res) => ({
            ...res.data,
            isRoom: false,
          }));
        });

        return Promise.all(subRoomInfoPromises);
      } else {
        // Normal room
        const reqBody = {
          roomID: room.roomId,
          subroomID: 0,
          academicYr: jsonObject.academicYr,
          acadSess: jsonObject.acadSess,
          startDate: jsonObject.startDate,
          endDate: jsonObject.endDate,
        };

        return callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, reqBody).then((res) => ({
          ...res.data,
          isRoom: true,
        }));
      }
    });

    // Run everything in parallel and flatten
    const roomInfoResponses = (await Promise.all(roomInfoPromises)).flat().filter((r) => (r.occupants?.length || 0) > 0);

    employees
      ?.filter((e) => {
        e.facultyCode === jsonObject.facultyId;
      })
      .forEach(async (emp) => {
        // await handleFacultySeating(employees?.[1473]!, roomInfoResponses);
        await handleFacultySeating(emp, roomInfoResponses);
      });

    await workbook.xlsx.writeFile(filePath);
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
