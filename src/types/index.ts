export interface Building {
  id: string;
  name: string;
  totalFloors: number;
  totalRooms: number;
  totalOccupancy: number;
  occupied: number;
  image: string;
  floors: Floor[];
}

export interface Floor {
  id: string;
  name: string;
  totalRoomsOnFloor: number;
  roomOccupied: number;
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

export interface Occupant {
  occupantId?: string;
  occupantName?: string;
  type?: string;
  Id: string;
  department?: string;
  facultyCode?: string;
  startTime: string;
  scheduledDate: Date;
  endTime: string;
  isEditable: string;
}

export interface SearchResult {
  buildingId: string;
  name: string;
  type: string;
  roomId?: string;
}
export interface GraphData {
  time: string;
  OccupancyRate: string;
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
  availableFacilities: string;
  graphDataPoints: GraphData[];
}
export interface RoomInfo {
  id: string;
  roomName: string;
  capacity: number;
  occupied: number;
  occupants?: Occupant[];
  occupiedBy: string | null;
  building?: string;
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
  "Start Session": string;
  "End Session": string;
};

export type UserProfile = {
  userName: string;
  userContact: string;
  userDepartment: string;
  userPosition: string;
  activeSession: string;
  activeYear: string;
  userImage: string;
  employeeId: string;
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

export interface Department {
  departmentId: string;
  departmentName: string;
}
export interface Employee {
  employeeCode: string;
  employeeName: string;
  departmentCode: string;
  facultyCode: string;
  programCode: string;
}
export interface Faculty {
  facultyId: string;
  facultyName: string;
}

export interface Allocation {
  blockNo: string;
  systemId: string;
  roomNo: string;
  floor: string;
  typeOfCourse: string;
  roomName: string;
  facultyCode: string;
  department: string;
  classType: string;
  program: string;
  section: string;
  semester: string;
  session: string;
  academicYear: string;
}

export interface Program {
  code: string;
  description: string;
}

export interface SpaceAllocation {
  allocationDate: string;
  startTime: string;
  endTime: string;
  purpose?: string; //
  type?: string;
  allocatedRoomID?: string;
  buildingId?: string;
  subRoom?: string;
  academicSession: string;
  academicYear: string;
  allocatedTo: string;
  isAllocationActive?: Boolean;
  keyAssigned?: string;
  remarks?: string;
  allocatedfrom?: string;
  allocatedBy?: string;
  allocatedOnDate?: string;
}

export interface Maintenance {
  id: number;
  buildingId: string;
  roomid: string;
  maintanceDate: string;
  startTime: string;
  endTime: string;
  maintainenceType: string;
  description: string;
  isMainteneceActive: boolean;
}
