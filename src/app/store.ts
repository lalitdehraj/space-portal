import { configureStore } from "@reduxjs/toolkit";
import dataSlice from "./feature/dataSlice";

export const reduxStore = configureStore({
    reducer:{
        dataState:dataSlice
    },
})

export type RootState = ReturnType<typeof reduxStore.getState>;
export type AppDispatch = typeof reduxStore.dispatch;