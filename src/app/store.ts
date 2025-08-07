import { configureStore } from "@reduxjs/toolkit";
import dataSlice from "./feature/dataSlice";

export const reduxStore = configureStore({
    reducer:{
        dataState:dataSlice
    },
})