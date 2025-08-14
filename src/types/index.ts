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

interface Duration1 {
  startTime: string;
  endTime: string;
  session: string;
  acadmenicYear: string;
}
interface University1 {
  id: string;
  name: string;
  image: string;
}

export interface Building1 {
  id: string;
  name: string;
  totalFloors: number;
  totalRooms: number;
  totalOccupancy: number;
  occupied: number;
  image: string;
  floors: Floor1[];
}

export interface Floor1 {
  id: string;
  name: string;
  totalRoomsOnFloor: number;
  roomOccupied: number;
  floorArea: string;
}

export interface Room1 {
  id: string;
  roomName: string;
  capacity: number;
  occupied: number;
  occupiedBy: string | null;
  hasSubtype: boolean;
  roomType: string;
  floor: string;
  status: string;
  roomArea: string;
  buildingId: string;
  parentId?: string;
}

export interface Occupants {
  occupantName?: string;
  type?: string;
  startTime?: string;
  endTime?: string;
}

export interface SearchResult {
  buildingId: string;
  name: string;
  type: string;
  roomId?: string;
}
export interface GraphData {
  time: string;
  "Occupancy Rate": string;
}
export interface DashboardDataResponse {
  totalBuildings: string;
  totalFloors: string;
  totalRooms: string;
  totalFacilities: string;
  avgOccupancy: string;
  activeSessions: string;
  maintenanceIssues: string;
  utilizationRequests: string;
  availabeFacilities: string;
  graphData: GraphData[];
}
export interface RoomInfo {
  id: string;
  roomName: string;
  capacity: number;
  occupied: number;
  occupants: Occupants[];
  occupiedBy: string | null;
  building: string;
  hasSubtype: boolean;
  roomType: string;
  floor: string;
  status: string;
  roomArea: string;
}

export interface AcademicSessions {
  academicYears: string[];
  academicSessions: string[];
}

export interface RoomRequestTable {
  rooms: RoomRequest[];
  curruntPage: string;
  totalPages: string;
  pageSize: string;
}

export interface RoomRequest {
  requestID: string;
  employeeName: string;
  employeeDepartment: string;
  requestedRoomType: string;
  purpose: string;
  priority: string;
  requestDate: string;
  requiredDate: string;
  requiredTimeStart: string;
  requiredTimeEnd: string;
  rejectionReason?: string;
  status: string;
  allocatedRoomID: string | null;
  approvedBy: string | null;
  approvalDate: string | null;
  recurrence: string;
}

export interface Report {
  id: string;
  fileUrl: string;
  fileName: string;
  createdAt: string;
  size: string;
  startDate: string;
  endDate: string;
}
