import { createSlice } from "@reduxjs/toolkit";

export interface DataState {
  selectedAcademicYear: string;
  selectedAcademicSession: string;
  selectedBuildingId: string;
  selectedFloorId: string;
  selectedRoomType: string;
  selectedRoomId: string;
  headerText: string;
  userRole: string;
}
const initialState: DataState = {
  selectedAcademicYear: "",
  selectedAcademicSession: "",
  selectedBuildingId: "",
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
    setSelectedBuildingId: (state, action) => {
      state.selectedBuildingId = action.payload;
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
  setSelectedBuildingId,
  setSelectedFloorId,
  setSeletedRoomTypeId,
  setHeaderTextId,
  setSelectedRoomId,
  setUserRoleId,
} = dataSlice.actions;

export default dataSlice.reducer;
