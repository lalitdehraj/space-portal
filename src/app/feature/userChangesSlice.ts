import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    userName : "Lalit"
}

export const userChangesSlice = createSlice({
    name: "userChanges",
    initialState,
    reducers:{
        changeUserName:(state,action)=>{
            state.userName = action.payload;
        }
    }
})

export const {changeUserName} = userChangesSlice.actions;
export default userChangesSlice.reducer;