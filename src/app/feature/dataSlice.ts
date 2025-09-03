import { createSlice } from "@reduxjs/toolkit";

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
  isActiveSession: false;
}
const initialState: DataState = {
  selectedAcademicYear: "",
  selectedAcademicSession: "",
  selectedAcademicSessionStartDate: "",
  selectedAcademicSessionEndDate: "",
  selectedBuildingId: "",
  isActiveSession: false,
  selectedFloorId: "",
  selectedRoomType: "All Rooms",
  selectedRoomId: "",
  headerText: "",
  userRole: "",
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
} = dataSlice.actions;

export default dataSlice.reducer;
