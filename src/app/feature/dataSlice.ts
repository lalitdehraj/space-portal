import { Building1, Floor1,Room } from "@/types";
import { createSlice } from "@reduxjs/toolkit";

export interface DataState {
    academicYear:string
    academicSession:string
    selectedBuilding:Building1|null
    selectedFloor:string  
    headerText:string 
    selectedRoom:Room|null
}
const initialState:DataState= {
    academicYear:"",
    academicSession:"",
    selectedBuilding :null,
    headerText:"Dashboard",
    selectedFloor :"",
    selectedRoom :null
}

export const dataSlice = createSlice({
    name: "dataState",
    initialState,
    reducers:{
        setAcademicYear:(state,action)=>{
            state.academicYear = action.payload;
        },
        setAcademicSession:(state,action)=>{
            state.academicSession = action.payload;
        },
        setSelectedBuilding:(state,action)=>{
            state.selectedBuilding = action.payload;
        },
        setSeletedFloor:(state,action)=>{
            state.selectedFloor = action.payload;
        },setHeaderText:(state,action)=>{
            state.headerText = action.payload;
        },
        setSelectedRoom:(state,action)=>{
            state.selectedRoom = action.payload;
        }
    }
})

export const {setSelectedBuilding,setSeletedFloor,setSelectedRoom,setAcademicYear,setAcademicSession,setHeaderText} = dataSlice.actions;

export default dataSlice.reducer;
