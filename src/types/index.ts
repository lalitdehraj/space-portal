export interface Building {
  id: string;
  name: string;
  totalFloors: number;
  totalRooms: number;
  totalCapacity: number;
  totalOccupiedRooms: number;
  image: string;
  floors: Floor[];
}

export interface Faculty {
  facultyName: string;
  facultyId: string;
}
export interface Department {
  departmentId: string;
  departmentName: string;
}
export interface Floor {
  floorId: string;
  floorName: string;
  totalRoomsOnFloor: number;
  roomsOccupied: number;
  floorArea: string;
}

export interface Room {
  roomId: string;
  roomName: string;
  roomCapactiy: number;
  occupied: number;
  occupiedBy: string;
  hasSubroom: boolean;
  roomType: string;
  floorId: string;
  status: string;
  roomArea: string;
  buildingId: string;
  parentId?: string;
  managedBy?: string;
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
  occupants?: Occupants[];
  occupiedBy: string | null;
  building?: string;
  buildingId?: string;
  hasSubtype: boolean;
  roomType: string;
  parentId?: string;
  floor: string;
  status: string;
  roomArea: string;
  managedBy?: string;
}

export type SearchResults = {
  buildings: SearchResult[];
  rooms: SearchResult[];
};

export type AcademicYear = {
  Code: string;
  Description: string;
};
export type AcademicSession = {
  Code: string;
  "Academic Year": string;
};

export type UserProfile = {
  userName: string;
  userContact: string;
  userDepartment: string;
  userPosition: string;
  activeSession: string;
  activeYear: string;
  userImage: string;
  userId: string;
  userEmail: string;
  userRole: string;
};

export interface AcademicSessions {
  academicYears: string[];
  academicSessions: string[];
}

export interface RoomRequestTable {
  requests: RoomRequest[];
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
  startDate: string;
  endDate: string;
  requestDate: string;
  startTime: string;
  endTime: string;
  purposeDesc?: string;
  description?: string;
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
