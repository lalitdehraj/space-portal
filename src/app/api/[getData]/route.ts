import {
  Allocation,
  Building,
  Course,
  Room,
  RoomInfo,
  RoomRequestTable,
} from "@/types";
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
    let roomId = body["roomID"];
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
  }
  if (
    request.url.includes(
      `${process.env.NEXT_PUBLIC_BASE_URL}${process.env.NEXT_PUBLIC_GET_ALLOCATIONS}`
    )
  ) {
    return response(Allocations);
  }
  if (
    request.url.includes(
      `${process.env.NEXT_PUBLIC_BASE_URL}${process.env.NEXT_PUBLIC_GET_PROGRAM}`
    )
  ) {
    return response(Courses);
  } else return response({ error: "return from end" });
}

const Courses: Course[] = [
  {
    code: "BTECH-008",
    description: "BTECH in Computer Science",
  },
];

const Allocations: Allocation[] = [
  {
    id: "allo1",
    programCode: "CSE1",
    courseName: "Computer science",
    roomId: "001",
    buildingId: "AB1",
    floorId: "ground",
    roomName: "Class",
    acadSession: "JUL-NOV 2025",
    acadYear: "25-26",
  },
];
const AcademicYears = [
  {
    Code: "25-26",
    Description: "2025-26",
  },
  {
    Code: "24-25",
    Description: "2024-25",
  },
].reverse();
const AcademicSession = [
  {
    Code: "WINTER 2024",
    "Start Session": "2025-01-13",
    "End Session": "2025-02-15",
    "Academic Year": "24-25",
  },
  {
    Code: "WINTER 2024-I",
    "Start Session": "2025-02-13",
    "End Session": "2025-02-28",
    "Academic Year": "24-25",
  },
  {
    Code: "JUL-NOV 2025",
    "Start Session": "2025-07-13",
    "End Session": "2025-11-28",
    "Academic Year": "25-26",
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
    activeSession: "JUL-NOV 2025",
    activeYear: "25-26",
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
    totalOccupancy: 480,
    occupied: 300,
    image: "/images/main-building.jpg",
    floors: [
      {
        id: "ground",
        name: "Ground",
        totalRoomsOnFloor: 60,
        roomOccupied: 45,
        floorArea: "700",
      },
      {
        id: "first",
        name: "First Floor",
        totalRoomsOnFloor: 60,
        roomOccupied: 40,
        floorArea: "700",
      },
      {
        id: "second",
        name: "Second Floor",
        totalRoomsOnFloor: 60,
        roomOccupied: 50,
        floorArea: "700",
      },
    ],
  },
  {
    id: "AB2",
    name: "Academic Block-2",
    totalFloors: 4,
    totalRooms: 240,
    totalOccupancy: 640,
    occupied: 360,
    image: "/images/main-building.jpg",
    floors: [
      {
        id: "ground",
        name: "Ground",
        totalRoomsOnFloor: 65,
        roomOccupied: 40,
        floorArea: "760",
      },
      {
        id: "first",
        name: "First Floor",
        totalRoomsOnFloor: 65,
        roomOccupied: 50,
        floorArea: "760",
      },
      {
        id: "second",
        name: "Second Floor",
        totalRoomsOnFloor: 55,
        roomOccupied: 55,
        floorArea: "650",
      },
      {
        id: "third",
        name: "Third Floor",
        totalRoomsOnFloor: 55,
        roomOccupied: 45,
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
    hasSubroom: false,
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
        Id: "event1",
        occupantName: "Introduction to Physics",
        type: "Lecture",
        scheduledDate: new Date("2025-09-27"), // Monday
        startTime: "14:30",
        endTime: "15:00",
      },
      {
        Id: "event2",
        occupantName: "Software Engineering Lab",
        type: "Lab Session",
        scheduledDate: new Date("2025-09-28"), // Tuesday
        startTime: "09:00",
        endTime: "09:45",
      },
      {
        Id: "event3",
        occupantName: "Introduction to Psychology",
        type: "Seminar",
        scheduledDate: new Date("2025-09-28"), // Wednesday
        startTime: "09:45",
        endTime: "10:30",
      },
      {
        Id: "event4",
        occupantName: "Organic Chemistry",
        type: "Lecture",
        scheduledDate: new Date("2025-09-30"), // Thursday
        startTime: "10:00",
        endTime: "11:00",
      },
      {
        Id: "event5",
        occupantName: "Group Project Meeting",
        type: "Meeting",
        scheduledDate: new Date("2025-09-31"), // Friday
        startTime: "16:00",
        endTime: "17:00",
      },
      {
        Id: "event6",
        occupantName: "Mathematics Tutorial",
        type: "Tutorial",
        scheduledDate: new Date("2025-09-01"), // Saturday
        startTime: "15:00",
        endTime: "16:00",
      },
      {
        Id: "event7",
        occupantName: "Computer Science Lecture",
        type: "Lecture",
        scheduledDate: new Date("2025-09-27"), // Monday
        startTime: "11:00",
        endTime: "12:00",
      },
      {
        Id: "event8",
        occupantName: "Biology Lab",
        type: "Lab Session",
        scheduledDate: new Date("2025-09-28"), // Tuesday
        startTime: "14:00",
        endTime: "16:00",
      },
      {
        Id: "event9",
        occupantName: "English Literature",
        type: "Lecture",
        scheduledDate: new Date("2025-09-29"), // Wednesday
        startTime: "10:00",
        endTime: "11:00",
      },
      {
        Id: "event10",
        occupantName: "Research Discussion",
        type: "Discussion",
        scheduledDate: new Date("2025-09-30"), // Thursday
        startTime: "15:00",
        endTime: "16:00",
      },
      // Add data for September 1-7, 2025 (current week being displayed)
      {
        Id: "event11",
        occupantName: "Advanced Physics",
        type: "Lecture",
        scheduledDate: new Date("2025-09-01T00:00:00.000Z"), // Monday
        startTime: "10:00",
        endTime: "11:00",
      },
      {
        Id: "event12",
        occupantName: "Calculus Tutorial",
        type: "Tutorial",
        scheduledDate: new Date("2025-09-02T00:00:00.000Z"), // Tuesday
        startTime: "14:00",
        endTime: "15:00",
      },
      {
        Id: "event13",
        occupantName: "Organic Chemistry Lab",
        type: "Lab Session",
        scheduledDate: new Date("2025-09-03T00:00:00.000Z"), // Wednesday
        startTime: "09:00",
        endTime: "11:00",
      },
      {
        Id: "event14",
        occupantName: "Molecular Biology",
        type: "Lecture",
        scheduledDate: new Date("2025-09-04T00:00:00.000Z"), // Thursday
        startTime: "13:00",
        endTime: "14:00",
      },
      {
        Id: "event15",
        occupantName: "Literature Discussion",
        type: "Discussion",
        scheduledDate: new Date("2025-09-05T00:00:00.000Z"), // Friday
        startTime: "16:00",
        endTime: "17:00",
      },
      {
        Id: "event16",
        occupantName: "Computer Science",
        type: "Lecture",
        scheduledDate: new Date("2025-09-01T00:00:00.000Z"), // Monday
        startTime: "11:00",
        endTime: "12:00",
      },
      {
        Id: "event17",
        occupantName: "Data Structures",
        type: "Lab Session",
        scheduledDate: new Date("2025-09-02T00:00:00.000Z"), // Tuesday
        startTime: "09:00",
        endTime: "11:00",
      },
      {
        Id: "event18",
        occupantName: "Statistics",
        type: "Lecture",
        scheduledDate: new Date("2025-09-03T00:00:00.000Z"), // Wednesday
        startTime: "15:00",
        endTime: "16:00",
      },
      {
        Id: "event19",
        occupantName: "Research Methods",
        type: "Seminar",
        scheduledDate: new Date("2025-09-04T00:00:00.000Z"), // Thursday
        startTime: "10:00",
        endTime: "11:00",
      },
      {
        Id: "event20",
        occupantName: "Project Meeting",
        type: "Meeting",
        scheduledDate: new Date("2025-09-05T00:00:00.000Z"), // Friday
        startTime: "14:00",
        endTime: "15:00",
      },
    ],
    managedBy: "Central facilities",
  },
  {
    id: "AB1-G-02",
    roomName: "Classroom 102",
    capacity: 30,
    occupied: 0,
    hasSubtype: false,
    occupiedBy: null,
    roomType: "Classroom",
    building: "Academic Block 1",
    floor: "ground",
    status: "Available",
    roomArea: "45",
    occupants: [],
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
