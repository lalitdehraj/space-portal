"use client"
import { University } from "@/types";
import { Building } from "@/types";
import { Floor } from "@/types";
import { Room } from "@/types";
// Mock data structure for universities
const universitiesData: University[] = [
  {
    id: "u1",
    name: "Manipal University Jaipur",
    coordinates: { x: 450, y: 340 },
    image: "/images/manipal-university.jpg",
  },
];

// Mock data structure with buildings directly
export const buildingsData: Building[] = [
  {
    id: "b1",
    name: "Academic Block A",
    totalFloors: 3,
    totalRooms: 150,
    occupancyRate: 75,
    position: { x: 100, y: 100 },
    image: "/images/main-building.jpg",
    floors: [
      {
        id: "f1-1",
        name: "Ground Floor",
        totalRooms: 50,
        occupancyRate: 80,
        layout: "/images/floor1-layout.jpg",
        rooms: generateRooms(50, "A-G", 1),
      },
      {
        id: "f1-2",
        name: "First Floor",
        totalRooms: 50,
        occupancyRate: 70,
        layout: "/images/floor2-layout.jpg",
        rooms: generateRooms(50, "A-1", 101),
      },
      {
        id: "f1-3",
        name: "Second Floor",
        totalRooms: 50,
        occupancyRate: 65,
        layout: "/images/floor3-layout.jpg",
        rooms: generateRooms(50, "A-2", 201),
      },
    ],
  },
  {
    id: "b2",
    name: "Library Building",
    totalFloors: 3,
    totalRooms: 150,
    occupancyRate: 60,
    position: { x: 300, y: 100 },
    image: "/images/main-building.jpg",
    floors: [
      {
        id: "f2-1",
        name: "Ground Floor",
        totalRooms: 50,
        occupancyRate: 65,
        layout: "/images/library-floor1-layout.jpg",
        rooms: generateRooms(50, "L-G", 1),
      },
      {
        id: "f2-2",
        name: "First Floor",
        totalRooms: 50,
        occupancyRate: 55,
        layout: "/images/library-floor2-layout.jpg",
        rooms: generateRooms(50, "L-1", 101),
      },
      {
        id: "f2-3",
        name: "Second Floor",
        totalRooms: 50,
        occupancyRate: 60,
        layout: "/images/library-floor3-layout.jpg",
        rooms: generateRooms(50, "L-2", 201),
      },
    ],
  },
  {
    id: "b3",
    name: "Science Block",
    totalFloors: 3,
    totalRooms: 150,
    occupancyRate: 85,
    position: { x: 500, y: 100 },
    image: "/images/main-building.jpg",
    floors: [
      {
        id: "f3-1",
        name: "Ground Floor",
        totalRooms: 50,
        occupancyRate: 85,
        layout: "/images/science-floor1-layout.jpg",
        rooms: generateRooms(50, "S-G", 1),
      },
      {
        id: "f3-2",
        name: "First Floor",
        totalRooms: 50,
        occupancyRate: 90,
        layout: "/images/science-floor2-layout.jpg",
        rooms: generateRooms(50, "S-1", 101),
      },
      {
        id: "f3-3",
        name: "Second Floor",
        totalRooms: 50,
        occupancyRate: 80,
        layout: "/images/science-floor3-layout.jpg",
        rooms: generateRooms(50, "S-2", 201),
      },
    ],
  },
  {
    id: "b4",
    name: "Engineering Block",
    totalFloors: 3,
    totalRooms: 150,
    occupancyRate: 82,
    position: { x: 700, y: 100 },
    image: "/images/main-building.jpg",
    floors: [
      {
        id: "f4-1",
        name: "Ground Floor",
        totalRooms: 50,
        occupancyRate: 80,
        layout: "/images/engineering-floor1-layout.jpg",
        rooms: generateRooms(50, "E-G", 1),
      },
      {
        id: "f4-2",
        name: "First Floor",
        totalRooms: 50,
        occupancyRate: 85,
        layout: "/images/engineering-floor2-layout.jpg",
        rooms: generateRooms(50, "E-1", 101),
      },
      {
        id: "f4-3",
        name: "Second Floor",
        totalRooms: 50,
        occupancyRate: 82,
        layout: "/images/engineering-floor3-layout.jpg",
        rooms: generateRooms(50, "E-2", 201),
      },
    ],
  },
  {
    id: "b5",
    name: "Management Block",
    totalFloors: 3,
    totalRooms: 150,
    occupancyRate: 8,
    position: { x: 900, y: 100 },
    image: "/images/main-building.jpg",
    floors: [
      {
        id: "f5-1",
        name: "Ground Floor",
        totalRooms: 50,
        occupancyRate: 75,
        layout: "/images/management-floor1-layout.jpg",
        rooms: generateRooms(50, "M-G", 1),
      },
      {
        id: "f5-2",
        name: "First Floor",
        totalRooms: 50,
        occupancyRate: 65,
        layout: "/images/management-floor2-layout.jpg",
        rooms: generateRooms(50, "M-1", 101),
      },
      {
        id: "f5-3",
        name: "Second Floor",
        totalRooms: 50,
        occupancyRate: 70,
        layout: "/images/management-floor3-layout.jpg",
        rooms: generateRooms(50, "M-2", 201),
      },
    ],
  },
];

// Function to generate rooms dynamically
function generateRooms(
  count: number,
  prefix: string,
  startNum: number
): Room[] {
  const rooms: Room[] = [];
  const roomTypes = [
    "Faculty Room",
    "Classroom",
    "Office",
    "Lab",
    "Boardroom",
    "Seminar Hall",
    "A-G7 Block",
    "A-G31 Block",
  ];

  const occupantGroups = [
    ["B.Tech CSE - Section A"],
    ["B.Tech ECE - Section B"],
    ["Faculty Members"],
    ["M.Tech Students"],
    ["Research Scholars"],
    ["Administrative Staff"],
    ["Dr. Smith - HOD"],
    ["Prof. Johnson - Dean"],
    [],
  ];

  for (let i = 0; i < count; i++) {
    const roomNum = startNum + i;
    const typeIndex = i % roomTypes.length;
    const roomType = roomTypes[typeIndex];

    // Adjust capacity based on room type
    let capacity;
    if (roomType.includes("Classroom"))
      capacity = Math.floor(Math.random() * 30) + 50; // 50-80
    else if (roomType.includes("Lab"))
      capacity = Math.floor(Math.random() * 20) + 40; // 40-60
    else if (roomType.includes("Seminar Hall"))
      capacity = Math.floor(Math.random() * 50) + 100; // 100-150
    else if (roomType.includes("Block B"))
      capacity = 14; // Total capacity for faculty block (8 workstation + 6 cabin)
    else capacity = Math.floor(Math.random() * 10) + 10; // 10-20 for other rooms

    const occupied = Math.floor(Math.random() * (capacity + 1)); // 0 to capacity

    // Calculate position in a grid layout (10 columns, 5 rows)
    const col = i % 10;
    const row = Math.floor(i / 10);

    rooms.push({
      id: `${prefix}-${roomNum}`,
      name: `${prefix}${roomNum} ${roomType}`,
      capacity: capacity,
      occupied: occupied,
      occupants: occupied > 0 ? occupantGroups[i % occupantGroups.length] : [],
      position: {
        x: 20 + col * 115,
        y: 20 + row * 90,
        width: 100,
        height: 80,
      },
    });
  }

  return rooms;
}