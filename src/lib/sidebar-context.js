"use client";

import { createContext, useContext } from "react";

export const SidebarContext = createContext({
  sidebarOpen: true,
  setSidebarOpen: () => {},
});

export const useSidebar = () => useContext(SidebarContext);
