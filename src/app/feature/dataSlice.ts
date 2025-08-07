import { Building, Floor,Room } from "@/types";
import { createSlice } from "@reduxjs/toolkit";

export interface DataState {
    allBuildingsData:Building[]
    selectedBuilding:Building|null
    selectedFloor:Floor|null    
    selectedRoom:Room|null
}
const initialState:DataState= {
    allBuildingsData : [],
    selectedBuilding :null,
    selectedFloor :null,
    selectedRoom :null
}

export const dataSlice = createSlice({
    name: "dataState",
    initialState,
    reducers:{
        setAllBuildingsData:(state,action)=>{
            state.allBuildingsData = action.payload;
        },
        setSelectedBuilding:(state,action)=>{
            state.selectedBuilding = action.payload;
        },
        setSeletedFloor:(state,action)=>{
            state.selectedFloor = action.payload;
        },
        setSelectedRoom:(state,action)=>{
            state.selectedRoom = action.payload;
        }
    }
})

export const {setAllBuildingsData,setSelectedBuilding,setSeletedFloor,setSelectedRoom} = dataSlice.actions;

export default dataSlice.reducer;
