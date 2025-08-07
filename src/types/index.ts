
export interface Room {
  id: string;
  name: string;
  capacity: number;
  occupied: number;
  occupants: string[];
  position: { x: number; y: number; width: number; height: number };
}

export interface Floor {
  id: string;
  name: string;
  totalRooms: number;
  occupancyRate: number;
  rooms: Room[];
  layout: string; 
}

export interface Building {
  id: string;
  name: string;
  totalFloors: number;
  totalRooms: number;
  occupancyRate: number;
  floors: Floor[];
  position: { x: number; y: number };
  image: string;
}

export interface University {
  id: string;
  name: string;
  coordinates: { x: number; y: number };
  image: string;
}

interface Duration1{
  startTime:string;
  endTime:string;
  session:string;
  acadmenicYear:string;
}
interface University1 {
  id: string;
  name: string;
  image: string;
}

interface Building1 {
  id: string;
  name: string;
  totalFloors: number;
  totalRooms: number;
  totalOccupancy:number;
  occupied:number;
  image: string;
}

interface Floor1 {
  id: string;
  name: string;
  totalRoomsOnFloor: number;
  roomOccupied:number;
  floorArea: string;
}

interface Room1 {
  id: string;
  roomName: string;
  capacity: number;
  occupied: number;
  occupiedBy: string|null;
  roomType:string;
  floor:string;
  status:string;
  roomArea:string;
}

export interface AcademicSessions {
  academicYears:number[],
  academicSessions:string[]
}
