import { UserProfile } from "@/types";
import { createSlice } from "@reduxjs/toolkit";

/** Profile info for OBE users, stored in slice for menu and OBE pages. */
export interface OBEPublicProfile {
  email: string;
  employeeNo: string;
  activeSession: string;
  activeYear: string;
}

export interface DataState {
  selectedAcademicYear: string;
  selectedAcademicSession: string;
  selectedBuildingId: string;
  selectedFloorId: string;
  selectedRoomType: string;
  selectedRoomId: string;
  selectedAcademicSessionStartDate: string;
  selectedAcademicSessionEndDate: string;
  headerText: string;
  userRole: string;
  user: UserProfile | null;
  isActiveSession: false;
  appliedFilters: { building: string[]; floor: string[] };
  bearerToken: string | null;
  bearerTokenExpiry: number;
  isSpaceAdmin: boolean;
  isOBEUser: boolean;
  obeProfile: OBEPublicProfile | null;
}
const initialState: DataState = {
  selectedAcademicYear: "",
  selectedAcademicSession: "",
  selectedAcademicSessionStartDate: "",
  selectedAcademicSessionEndDate: "",
  appliedFilters: { building: [], floor: [] },
  selectedBuildingId: "",
  isActiveSession: false,
  selectedFloorId: "",
  selectedRoomType: "All Rooms",
  selectedRoomId: "",
  headerText: "",
  userRole: "",
  user: null,
  bearerToken: null,
  bearerTokenExpiry: 0,
  isSpaceAdmin: false,
  isOBEUser: false,
  obeProfile: null,
};

export const dataSlice = createSlice({
  name: "dataState",
  initialState,
  reducers: {
    setAcademicYearId: (state, action) => {
      state.selectedAcademicYear = action.payload;
    },
    setAcademicSessionId: (state, action) => {
      state.selectedAcademicSession = action.payload;
    },
    setAcademicSessionStartDate: (state, action) => {
      state.selectedAcademicSessionStartDate = action.payload;
    },
    setAcademicSessionEndDate: (state, action) => {
      state.selectedAcademicSessionEndDate = action.payload;
    },
    setSelectedBuildingId: (state, action) => {
      state.selectedBuildingId = action.payload;
    },
    setIsActiveSession: (state, action) => {
      state.isActiveSession = action.payload;
    },
    setSelectedFloorId: (state, action) => {
      state.selectedFloorId = action.payload;
    },
    setSeletedRoomTypeId: (state, action) => {
      state.selectedRoomType = action.payload;
    },
    setHeaderTextId: (state, action) => {
      state.headerText = action.payload;
    },
    setSelectedRoomId: (state, action) => {
      state.selectedRoomId = action.payload;
    },
    setUserRoleId: (state, action) => {
      state.userRole = action.payload;
    },
    setUser: (state, action) => {
      state.user = action.payload;
    },
    setBearerToken: (state, action) => {
      state.bearerToken = action.payload.token;
      state.bearerTokenExpiry = action.payload.expiry;
    },
    setAppliedFilters: (state, action) => {
      state.appliedFilters = action.payload;
    },
    setIsSpaceAdmin: (state, action) => {
      state.isSpaceAdmin = action.payload;
    },
    setIsOBEUser: (state, action) => {
      state.isOBEUser = action.payload;
    },
    setOBEProfile: (state, action: { payload: OBEPublicProfile | null }) => {
      state.obeProfile = action.payload;
    },
  },
});

export const {
  setAcademicYearId,
  setAcademicSessionId,
  setAcademicSessionStartDate,
  setAcademicSessionEndDate,
  setSelectedBuildingId,
  setSelectedFloorId,
  setSeletedRoomTypeId,
  setHeaderTextId,
  setIsActiveSession,
  setSelectedRoomId,
  setUserRoleId,
  setUser,
  setBearerToken,
  setAppliedFilters,
  setIsSpaceAdmin,
  setIsOBEUser,
  setOBEProfile,
} = dataSlice.actions;

export default dataSlice.reducer;
