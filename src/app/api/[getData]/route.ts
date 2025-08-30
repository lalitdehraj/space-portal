import { Building, Room, RoomInfo, RoomRequestTable } from "@/types";
import { removeSpaces } from "@/utils";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const response = NextResponse.json;

  // const fileName = `temp.json`;
  // const filePath = path.join(process.cwd(), "reports", fileName);
  // createBigFile(filePath);
  console.log(`requested URL ${request.url}`);
  const { searchParams } = new URL(request.url);

  if (
    request.url.includes(
      `${process.env.NEXT_PUBLIC_BASE_URL}${process.env.NEXT_PUBLIC_GET_ACADMIC_YEARS}`
    )
  )
    return response({ "Academic Year": AcademicYears });

  if (
    request.url.includes(
      `${process.env.NEXT_PUBLIC_BASE_URL}${process.env.NEXT_PUBLIC_GET_ACADMIC_SESSIONS}`
    )
  )
    return response({ "Academic Session": AcademicSession });
  if (request.url.includes(`${process.env.NEXT_PUBLIC_GET_BUILDING_LIST}`))
    return response(BuildingsData);
  if (
    request.url.includes(
      `${process.env.NEXT_PUBLIC_BASE_URL}${process.env.NEXT_PUBLIC_GET_REPORTS}`
    )
  ) {
    let res = {
      totalPages: 1,
      currentPage: 1,
      pageSize: 10,
      reports: [],
    };
    return response(res);
  }
  if (
    request.url.includes(
      `${process.env.NEXT_PUBLIC_BASE_URL}${process.env.NEXT_PUBLIC_GET_ROOMS_LIST}`
    )
  ) {
    const body = await request.json();
    let buildingId = body["buildingNo"];
    let floorId = body["floorID"];
    return response(
      RoomsData.filter((room) => {
        return (
          buildingId == room.buildingId &&
          (floorId == room.floorId || floorId == "")
        );
      })
    );
  }
  if (
    request.url.includes(
      `${process.env.NEXT_PUBLIC_BASE_URL}${process.env.NEXT_PUBLIC_GET_SUBROOMS_LIST}`
    )
  ) {
    const body = await request.json();
    let roomId = body["roomId"];
    console.log("roomInfo:  ", roomId);
    return response(
      SubRoomsData.filter((room) => {
        return room.parentId === roomId;
      })
    );
  }
  if (
    request.url.includes(
      `${process.env.NEXT_PUBLIC_BASE_URL}${process.env.NEXT_PUBLIC_GET_REQUEST_LIST}`
    )
  ) {
    const body = await request.json();
    let limit = parseInt(body["limit"]!);
    let offSet = parseInt(body["offset"]!);
    let startIndex = (offSet - 1) * limit;
    let totalPage = Math.ceil(RequestData.requests.length / limit);
    let curruntPage = offSet;
    if (offSet > totalPage) curruntPage = totalPage;

    const reqData = {
      curruntPage: curruntPage,
      totalPages: totalPage,
      pageSize: limit,
      requests: RequestData.requests.slice(startIndex, startIndex + limit),
    };
    return response(reqData);
  }
  if (
    request.url.includes(
      `${process.env.NEXT_PUBLIC_BASE_URL}${process.env.NEXT_PUBLIC_GET_DASHBOARD_DATA}`
    )
  ) {
    const body = await request.json();
    let days = body["noOfDays"];
    if (days === "7") return response(DashboardData7D);
    else return response(DashboardData30D);
  }
  if (
    request.url.includes(
      `${process.env.NEXT_PUBLIC_BASE_URL}${process.env.NEXT_PUBLIC_GET_ROOM_INFO}`
    )
  ) {
    const body = await request.json();
    let roomId = body["roomId"];
    let roomInfo = RoomInformation.filter((room) => room.id === roomId);
    return response(roomInfo[0] || RoomInformation[0]);
  }
  if (
    request.url.includes(
      `${process.env.NEXT_PUBLIC_BASE_URL}${process.env.NEXT_PUBLIC_GET_SEARCH}`
    )
  ) {
    const body = await request.json();
    let searchText = body["searchKey"];
    let buildings = BuildingsData.filter((building) => {
      return removeSpaces(building.name)
        .toLowerCase()
        .includes(searchText!.toLowerCase());
    });
    let rooms = RoomsData.filter((room) => {
      return removeSpaces(room.roomName)
        .toLowerCase()
        .includes(searchText!.toLowerCase());
    });

    let b = buildings.map((item) => {
      return {
        buildingId: item.id,
        name: item.name,
        type: "building",
      };
    });
    let r = rooms.map((item) => {
      return {
        buildingId: item.buildingId,
        name: item.roomName,
        type: "room",
        roomId: item.roomId,
      };
    });
    let res = {
      buildings: b,
      rooms: r,
    };
    return response(res);
  }
  if (
    request.url.includes(
      `${process.env.NEXT_PUBLIC_BASE_URL}${process.env.NEXT_PUBLIC_GET_USER}`
    )
  ) {
    return response(UsersList);
  } else return response({ error: "return from end" });
}
const AcademicYears = [
  {
    Code: "25-26",
    Description: "2025-26",
  },
  {
    Code: "24-25",
    Description: "2024-25",
  },
  {
    Code: "23-24",
    Description: "2023-24",
  },
  {
    Code: "22-23",
    Description: "2022-23",
  },
  {
    Code: "21-22",
    Description: "2021-22",
  },
  {
    Code: "20-21",
    Description: "2020-21",
  },
  {
    Code: "19-20",
    Description: "2019-20",
  },
  {
    Code: "18-19",
    Description: "2018-19",
  },
  {
    Code: "17-18",
    Description: "2017-18",
  },
  {
    Code: "16-17",
    Description: "2016-17",
  },
  {
    Code: "15-16",
    Description: "2015-16",
  },
  {
    Code: "14-15",
    Description: "2014-15",
  },
  {
    Code: "13-14",
    Description: "2013-14",
  },
  {
    Code: "12-13",
    Description: "2012-13",
  },
  {
    Code: "11-12",
    Description: "2011-12",
  },
].reverse();
const AcademicSession = [
  {
    Code: "AUG-NOV 2018",
    "Academic Year": "18-19",
  },
  {
    Code: "AUG-NOV 2019",
    "Academic Year": "19-20",
  },
  {
    Code: "AUG-NOV 2020",
    "Academic Year": "20-21",
  },
  {
    Code: "AUG-NOV 2021",
    "Academic Year": "21-22",
  },
  {
    Code: "AUG-NOV 2022",
    "Academic Year": "22-23",
  },
  {
    Code: "AUG-NOV 2023",
    "Academic Year": "23-24",
  },
  {
    Code: "FEB-APRIL 2019",
    "Academic Year": "18-19",
  },
  {
    Code: "FEB-APRIL 2020",
    "Academic Year": "19-20",
  },
  {
    Code: "FEB-APRIL 2021",
    "Academic Year": "20-21",
  },
  {
    Code: "FEB-APRIL 2022",
    "Academic Year": "21-22",
  },
  {
    Code: "FEB-APRIL 2023",
    "Academic Year": "22-23",
  },
  {
    Code: "FEB-APRIL 2024",
    "Academic Year": "23-24",
  },
  {
    Code: "JAN-MAY 2017",
    "Academic Year": "16-17",
  },
  {
    Code: "JAN-MAY 2018",
    "Academic Year": "17-18",
  },
  {
    Code: "JAN-MAY 2019",
    "Academic Year": "18-19",
  },
  {
    Code: "JAN-MAY 2020",
    "Academic Year": "19-20",
  },
  {
    Code: "JAN-MAY 2021",
    "Academic Year": "20-21",
  },
  {
    Code: "JAN-MAY 2022",
    "Academic Year": "21-22",
  },
  {
    Code: "JAN-MAY 2023",
    "Academic Year": "22-23",
  },
  {
    Code: "JAN-MAY 2024",
    "Academic Year": "23-24",
  },
  {
    Code: "JAN-MAY 2025",
    "Academic Year": "24-25",
  },
  {
    Code: "JUL 2018 - MAY 2019",
    "Academic Year": "18-19",
  },
  {
    Code: "JUL 2019 - MAY 2020",
    "Academic Year": "19-20",
  },
  {
    Code: "JUL 2020 - MAY 2021",
    "Academic Year": "20-21",
  },
  {
    Code: "JUL 2021 - MAY 2022",
    "Academic Year": "21-22",
  },
  {
    Code: "JUL 2022 - MAY 2023",
    "Academic Year": "22-23",
  },
  {
    Code: "JUL 2023 - MAY 2024",
    "Academic Year": "23-24",
  },
  {
    Code: "JUL 2024 - MAY 2025",
    "Academic Year": "24-25",
  },
  {
    Code: "JUL-NOV 2017",
    "Academic Year": "17-18",
  },
  {
    Code: "JUL-NOV 2018",
    "Academic Year": "18-19",
  },
  {
    Code: "JUL-NOV 2019",
    "Academic Year": "19-20",
  },
  {
    Code: "JUL-NOV 2020",
    "Academic Year": "20-21",
  },
  {
    Code: "JUL-NOV 2021",
    "Academic Year": "21-22",
  },
  {
    Code: "JUL-NOV 2022",
    "Academic Year": "22-23",
  },
  {
    Code: "JUL-NOV 2023",
    "Academic Year": "23-24",
  },
  {
    Code: "JUL-NOV 2024",
    "Academic Year": "24-25",
  },
  {
    Code: "NOV-FEB 2019",
    "Academic Year": "18-19",
  },
  {
    Code: "NOV-FEB 2020",
    "Academic Year": "19-20",
  },
  {
    Code: "NOV-FEB 2021",
    "Academic Year": "20-21",
  },
  {
    Code: "NOV-FEB 2022",
    "Academic Year": "21-22",
  },
  {
    Code: "NOV-FEB 2023",
    "Academic Year": "22-23",
  },
  {
    Code: "NOV-FEB 2024",
    "Academic Year": "23-24",
  },
  {
    Code: "SUMMER 2017",
    "Academic Year": "16-17",
  },
  {
    Code: "SUMMER 2018",
    "Academic Year": "17-18",
  },
  {
    Code: "SUMMER 2019",
    "Academic Year": "18-19",
  },
  {
    Code: "SUMMER 2020",
    "Academic Year": "19-20",
  },
  {
    Code: "SUMMER 2021",
    "Academic Year": "20-21",
  },
  {
    Code: "SUMMER 2022",
    "Academic Year": "21-22",
  },
  {
    Code: "SUMMER 2022-I",
    "Academic Year": "21-22",
  },
  {
    Code: "SUMMER 2022-II",
    "Academic Year": "21-22",
  },
  {
    Code: "SUMMER 2023",
    "Academic Year": "22-23",
  },
  {
    Code: "SUMMER 2024",
    "Academic Year": "23-24",
  },
  {
    Code: "SUMMER 2024-I",
    "Academic Year": "23-24",
  },
  {
    Code: "SUMMER 2025",
    "Academic Year": "24-25",
  },
  {
    Code: "WINTER 2019",
    "Academic Year": "19-20",
  },
  {
    Code: "WINTER 2021",
    "Academic Year": "21-22",
  },
  {
    Code: "WINTER 2022",
    "Academic Year": "22-23",
  },
  {
    Code: "WINTER 2023",
    "Academic Year": "23-24",
  },
  {
    Code: "WINTER 2024",
    "Academic Year": "24-25",
  },
  {
    Code: "WINTER 2024-I",
    "Academic Year": "24-25",
  },
];
const UsersList = [
  {
    userId: "Emp003",
    userEmail: "lalit.dehraj@incitegravity.com",
    userName: "Lalit Dehraj",
    userContact: "9891135663",
    userDepartment: "CSE",
    userPosition: "Developer",
    userRole: "Central facilities",
    activeSession: "WINTER 2024",
    activeYear: "24-25",
    userImage: "",
  },
  {
    userId: "Emp001",
    userEmail: "aditya.sharma@incitegravity.com",
    userName: "Aditya Sharma",
    userRole: "Faculty Sitting",
    userContact: "9876543210",
    userDepartment: "HR",
    userPosition: "Manager",
    activeSession: "Jan-Jun",
    activeYear: "2025-26",
    userImage: "",
  },
  {
    userId: "Emp002",
    userEmail: "priya.singh@incitegravity.com",
    userName: "Priya Singh",
    userContact: "9988776655",
    userDepartment: "Finance",
    userRole: "Academic",
    userPosition: "Accountant",
    activeSession: "Jul-Dec",
    activeYear: "2024-25",
    userImage: "",
  },
  {
    userId: "Emp004",
    userEmail: "amit.kumar@incitegravity.com",
    userName: "Amit Kumar",
    userContact: "9123456789",
    userDepartment: "Marketing",
    userRole: "Faculty Sitting",
    userPosition: "Coordinator",
    activeSession: "Jan-Jun",
    activeYear: "2025-26",
    userImage: "",
  },
  {
    userId: "Emp005",
    userEmail: "sonia.garg@incitegravity.com",
    userName: "Sonia Garg",
    userContact: "9012345678",
    userDepartment: "CSE",
    userPosition: "Lead Developer",
    userRole: "Central facilities",
    activeSession: "Jul-Dec",
    activeYear: "2024-25",
    userImage: "",
  },
];
const BuildingsData: Building[] = [
  {
    id: "AB1",
    name: "Academic Block-1",
    totalFloors: 3,
    totalRooms: 180,
    totalCapacity: 480,
    totalOccupiedRooms: 300,
    image: "/images/main-building.jpg",
    floors: [
      {
        floorId: "ground",
        floorName: "Ground",
        totalRoomsOnFloor: 60,
        roomsOccupied: 45,
        floorArea: "700",
      },
      {
        floorId: "first",
        floorName: "First Floor",
        totalRoomsOnFloor: 60,
        roomsOccupied: 40,
        floorArea: "700",
      },
      {
        floorId: "second",
        floorName: "Second Floor",
        totalRoomsOnFloor: 60,
        roomsOccupied: 50,
        floorArea: "700",
      },
    ],
  },
  {
    id: "AB2",
    name: "Academic Block-2",
    totalFloors: 4,
    totalRooms: 240,
    totalCapacity: 640,
    totalOccupiedRooms: 360,
    image: "/images/main-building.jpg",
    floors: [
      {
        floorId: "ground",
        floorName: "Ground",
        totalRoomsOnFloor: 65,
        roomsOccupied: 40,
        floorArea: "760",
      },
      {
        floorId: "first",
        floorName: "First Floor",
        totalRoomsOnFloor: 65,
        roomsOccupied: 50,
        floorArea: "760",
      },
      {
        floorId: "second",
        floorName: "Second Floor",
        totalRoomsOnFloor: 55,
        roomsOccupied: 55,
        floorArea: "650",
      },
      {
        floorId: "third",
        floorName: "Third Floor",
        totalRoomsOnFloor: 55,
        roomsOccupied: 45,
        floorArea: "650",
      },
    ],
  },
];

const RoomsData: Room[] = [
  {
    roomId: "AB1-G-01",
    roomName: "Classroom 101",
    roomCapactiy: 40,
    occupied: 35,
    hasSubroom: true,
    occupiedBy: "",
    roomType: "Classroom",
    floorId: "ground",
    status: "Partially Allocated",
    roomArea: "60",
    buildingId: "AB1",
    managedBy: "Central facilities",
  },
];

const SubRoomsData: Room[] = [
  {
    roomId: "SPC-G-01-WS",
    roomName: "Weights Section",
    roomCapactiy: 25,
    occupied: 20,
    hasSubroom: false,
    occupiedBy: "Students",
    roomType: "Gym Area",
    floorId: "ground",
    status: "Partially Allocated",
    roomArea: "150",
    buildingId: "SPC",
    parentId: "AB1-G-01",
    managedBy: "Central facilities",
  },
];

const RequestData: RoomRequestTable = {
  curruntPage: "1",
  totalPages: "3",
  pageSize: "10",
  requests: [
    {
      requestID: "REQ001",
      employeeName: "EMP001",
      employeeDepartment: "HR",
      requestedRoomType: "Conference Room",
      purpose: "Team Meeting - Q3 Planning",
      priority: "High",
      requestDate: "2024-07-25",
      startDate: "2024-08-10",
      purposeDesc: "This is the purpose for this meeting",
      description:
        "This request was approved because their are too many free rooms available",
      startTime: "09:00",
      endTime: "11:00",
      status: "Approved",
      allocatedRoomID: "CR005",
      approvedBy: "EMP005",
      approvalDate: "2024-07-26",
      recurrence: "None",
      endDate: "2024-07-27",
    },
    {
      requestID: "REQ002",
      employeeName: "EMP002",
      employeeDepartment: "Marketing",
      requestedRoomType: "Training Room",
      purpose: "New Product Training",
      priority: "Medium",
      requestDate: "2024-07-28",
      startDate: "2024-08-15",
      purposeDesc: "This is the purpose for this meeting",
      startTime: "13:00",
      endTime: "17:00",
      status: "Pending",
      allocatedRoomID: null,
      approvedBy: null,
      approvalDate: null,
      recurrence: "Weekly",
      endDate: "2024-07-27",
    },
    {
      requestID: "REQ007",
      employeeName: "EMP008",
      employeeDepartment: "Operations",
      requestedRoomType: "Conference Room",
      purpose: "Project Review",
      priority: "Medium",
      requestDate: "2024-08-03",
      startDate: "2024-08-18",
      purposeDesc: "This is the main purpose of meeting",
      description:
        "Meeting reject because thier is no project reviewer available",
      startTime: "14:00",
      endTime: "15:30",
      status: "Rejected",
      allocatedRoomID: null,
      approvedBy: "EMP005",
      approvalDate: "2024-08-04",
      recurrence: "None",
      endDate: "2024-07-27",
    },
  ],
};

const DashboardData7D = {
  totalBuildings: "4",
  totalFloors: "18",
  totalRooms: "1560",
  totalFacilities: "45",
  avgOccupancy: "62",
  activeSessions: "55",
  maintenanceIssues: "5",
  utilizationRequests: "120",
  availabeFacilities: "12",
  graphData: [
    { time: "Day 1 - Morning", "Occupancy Rate": 60 },
    { time: "Day 1 - Afternoon", "Occupancy Rate": 85 },
    { time: "Day 2 - Morning", "Occupancy Rate": 65 },
    { time: "Day 2 - Afternoon", "Occupancy Rate": 90 },
    { time: "Day 3 - Morning", "Occupancy Rate": 70 },
    { time: "Day 3 - Afternoon", "Occupancy Rate": 95 },
    { time: "Day 4 - Morning", "Occupancy Rate": 55 },
    { time: "Day 4 - Afternoon", "Occupancy Rate": 88 },
    { time: "Day 5 - Morning", "Occupancy Rate": 40 },
    { time: "Day 5 - Afternoon", "Occupancy Rate": 75 },
    { time: "Day 6 - Morning", "Occupancy Rate": 20 },
    { time: "Day 6 - Afternoon", "Occupancy Rate": 35 },
    { time: "Day 7 - Morning", "Occupancy Rate": 25 },
    { time: "Day 7 - Afternoon", "Occupancy Rate": 40 },
  ],
};
const DashboardData30D = {
  totalBuildings: "4",
  totalFloors: "18",
  totalRooms: "1560",
  totalFacilities: "45",
  avgOccupancy: "68",
  activeSessions: "65",
  maintenanceIssues: "8",
  utilizationRequests: "150",
  availabeFacilities: "10",
  graphData: [
    { time: "Day 1", "Occupancy Rate": 60 },
    { time: "Day 3", "Occupancy Rate": 75 },
    { time: "Day 5", "Occupancy Rate": 80 },
    { time: "Day 7", "Occupancy Rate": 70 },
    { time: "Day 9", "Occupancy Rate": 65 },
    { time: "Day 11", "Occupancy Rate": 85 },
    { time: "Day 13", "Occupancy Rate": 90 },
    { time: "Day 15", "Occupancy Rate": 82 },
    { time: "Day 17", "Occupancy Rate": 78 },
    { time: "Day 19", "Occupancy Rate": 88 },
    { time: "Day 21", "Occupancy Rate": 95 },
    { time: "Day 23", "Occupancy Rate": 70 },
    { time: "Day 25", "Occupancy Rate": 68 },
    { time: "Day 27", "Occupancy Rate": 75 },
    { time: "Day 29", "Occupancy Rate": 80 },
  ],
};

const RoomInformation: RoomInfo[] = [
  {
    id: "AB1-G-01",
    roomName: "Classroom 101",
    capacity: 40,
    occupied: 35,
    hasSubtype: false,
    occupiedBy: null,
    roomType: "Classroom",
    building: "Academic Block 1",
    floor: "ground",
    status: "Partially Allocated",
    roomArea: "60",
    occupants: [
      {
        occupantName: "Introduction to Physics",
        type: "Lecture",
        startTime: "2025-08-13T09:00:00.000Z",
        endTime: "2025-08-13T10:30:00.000Z",
      },
      {
        occupantName: "Introduction to Physics",
        type: "Lecture",
        startTime: "2025-08-13T09:00:00.000Z",
        endTime: "2025-08-13T10:30:00.000Z",
      },
      {
        occupantName: "Introduction to Physics",
        type: "Lecture",
        startTime: "2025-08-13T09:00:00.000Z",
        endTime: "2025-08-13T10:30:00.000Z",
      },
      {
        occupantName: "Introduction to Physics",
        type: "Lecture",
        startTime: "2025-08-13T09:00:00.000Z",
        endTime: "2025-08-13T10:30:00.000Z",
      },
      {
        occupantName: "Introduction to Physics",
        type: "Lecture",
        startTime: "2025-08-13T09:00:00.000Z",
        endTime: "2025-08-13T10:30:00.000Z",
      },
      {
        occupantName: "Introduction to Physics",
        type: "Lecture",
        startTime: "2025-08-13T09:00:00.000Z",
        endTime: "2025-08-13T10:30:00.000Z",
      },
      {
        occupantName: "Introduction to Physics",
        type: "Lecture",
        startTime: "2025-08-13T09:00:00.000Z",
        endTime: "2025-08-13T10:30:00.000Z",
      },
      {
        occupantName: "Introduction to Physics",
        type: "Lecture",
        startTime: "2025-08-13T09:00:00.000Z",
        endTime: "2025-08-13T10:30:00.000Z",
      },
      {
        occupantName: "Introduction to Physics",
        type: "Lecture",
        startTime: "2025-08-13T09:00:00.000Z",
        endTime: "2025-08-13T10:30:00.000Z",
      },
      {
        occupantName: "Introduction to Physics",
        type: "Lecture",
        startTime: "2025-08-13T09:00:00.000Z",
        endTime: "2025-08-13T10:30:00.000Z",
      },
      {
        occupantName: "Introduction to Physics",
        type: "Lecture",
        startTime: "2025-08-13T09:00:00.000Z",
        endTime: "2025-08-13T10:30:00.000Z",
      },
      {
        occupantName: "Introduction to Physics",
        type: "Lecture",
        startTime: "2025-08-13T09:00:00.000Z",
        endTime: "2025-08-13T10:30:00.000Z",
      },
      {
        occupantName: "Introduction to Physics",
        type: "Lecture",
        startTime: "2025-08-13T09:00:00.000Z",
        endTime: "2025-08-13T10:30:00.000Z",
      },
    ],
    managedBy: "Central facilities",
  },
];

import fs from "fs";
import path from "path";
async function createBigFile(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const writeStream = fs.createWriteStream(filePath, { flags: "w" });
  // writeStream.write("[");

  // while (true) {
  const data = SubRoomsData.map((r) => {
    if (r.managedBy === "GHS") return { ...r, managedBy: "Central facilities" };
    if (r.managedBy === "HR") return { ...r, managedBy: "Faculty Sitting" };
    if (r.managedBy === "GSA") return { ...r, managedBy: "Academic" };
  });

  // if (!data.length) break;

  // if (!RoomInformation) writeStream.write(",");
  writeStream.write(JSON.stringify(data));

  await new Promise((res) => setTimeout(res, 300)); // simulate delay
  // }

  // writeStream.write("]");
  writeStream.end();
}
