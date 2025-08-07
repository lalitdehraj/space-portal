// components/ReduxProvider.tsx
"use client"; // This directive makes it a Client Component

import { useRef } from "react";
import { Provider } from "react-redux";
import { reduxStore } from "@/app/store";

type ReduxProviderProps = {
  children: React.ReactNode;
};

export default function ReduxProvider({ children }: ReduxProviderProps) {
  const storeRef = useRef(reduxStore);
  if (!storeRef.current) {
    storeRef.current = reduxStore;
  }
  return <Provider store={reduxStore}>{children}</Provider>;
}
