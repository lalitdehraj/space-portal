"use client";
import SideNav from "@/components/SideNav";
import React, { ReactNode } from "react";
import useSideNavState from "@/hooks/useSideNavState";
import Header from "@/components/Header";
import { Menu } from "lucide-react";
import { useSelector } from "react-redux";

interface ChildProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: ChildProps) => {
  let headertext = useSelector((state: any) => state.dataState.headerText);
  const { isSideNavOpen, toggleSideNav } = useSideNavState();

  return (
    <div className="flex min-h-screen flex-col bg-gray-500 font-sans md:grid md:grid-cols-[256px_1fr] ">
      <div
        className={`fixed inset-y-0 left-0 z-50 w-full transform bg-gray-500 transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isSideNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SideNav onClose={toggleSideNav} />
      </div>

      {isSideNavOpen && <div className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden" onClick={toggleSideNav} />}

      <div className="flex flex-1 flex-col bg-white">
        <div className="sticky top-0 z-30 flex w-full items-center justify-between border-b  p-4 shadow-sm md:hidden bg-white">
          <button onClick={toggleSideNav} className="text-gray-900">
            <Menu size={24} />
          </button>
          <h1 className="text-xl font-bold text-gray-800 ">{headertext}</h1>
          <div className="w-6" />
        </div>

        <div className="hidden md:block">
          <Header />
        </div>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <section className="mb-8">{children}</section>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
