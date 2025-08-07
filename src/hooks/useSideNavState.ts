// src/hooks/useSideNavState.js

import { useState, useCallback } from "react";

export default function useSideNavState() {
  const [isSideNavOpen, setIsSideNavOpen] = useState(false);

  const toggleSideNav = useCallback(() => {
    setIsSideNavOpen((prev) => !prev);
  }, []);

  return { isSideNavOpen, toggleSideNav };
}