"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { Menu } from "lucide-react";
import SideNav from "@/components/SideNav";
import Header from "@/components/Header";
import RoomCard from "@/components/RoomCard";
import { Building, Floor } from "@/types";
import { setSeletedFloor } from "@/app/feature/dataSlice";
import useSideNavState from "@/hooks/useSideNavState";
import React, { SVGProps, useState, FC } from "react";

const FloorSVG = (props: SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M2.168,10.555a1,1,0,0,1,.278-1.387l9-6a1,1,0,0,1,1.11,0l9,6A1,1,0,0,1,21,11H19v9a1,1,0,0,1-1,1H6a1,1,0,0,1-1-1V11H3l.019-.019A.981.981,0,0,1,2.168,10.555Z"
      fill="currentColor"
    />
  </svg>
);

const BuildingSVG = (props: SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 5V10H9V5H5V13H9V12H10V17H9V14H5V19H12V17H13V19H19V17H21V21H3V3H21V15H19V10H13V15H12V9H19V5H10Z"
      fill="currentColor"
    />
  </svg>
);

const kpiCards = [
  {
    title: "Rooms",
    value: "5",
    iconSrc: "/images/house-door.svg",
    alt: "Rooms icon",
  },
  {
    title: "Occupancy",
    value: "5",
    iconSrc: "/images/floor-plan.svg",
    alt: "Occupancy icon",
  },
  {
    title: "Floor Area",
    value: "750",
    iconSrc: "/images/chart-areaspline-variant.svg",
    alt: "Floor area icon",
  },
];

const roomCategories = [
  "All Rooms",
  "Faculty Room",
  "Class Room",
  "Office",
  "Lab",
  "Boardroom",
  "Seminar Hall",
  "Faculty Block",
];

const RoomPage: FC = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const { isSideNavOpen, toggleSideNav } = useSideNavState();

  const selectedBuilding: Building = useSelector(
    (state: any) => state.dataState.selectedBuilding
  );
  const selectedFloor: Floor = useSelector(
    (state: any) => state.dataState.selectedFloor
  );

  const [selectedRoomType, setSelectedRoomType] = useState<string>("All Rooms");

  const filteredRooms = selectedFloor?.rooms.filter((room) => {
    return (
      selectedRoomType === "All Rooms" || room.name.includes(selectedRoomType)
    );
  });

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 font-sans md:grid md:grid-cols-[256px_1fr]">
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-gray-50 transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isSideNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SideNav onClose={toggleSideNav} />
      </div>

      {isSideNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={toggleSideNav}
        />
      )}

      <div className="flex flex-1 flex-col">
        <div className="sticky top-0 z-30 flex w-full items-center justify-between border-b bg-white p-4 shadow-sm md:hidden">
          <button onClick={toggleSideNav} className="text-gray-900">
            <Menu size={24} />
          </button>
          <h1 className="text-xl font-bold text-gray-800">
            {selectedBuilding.name}
          </h1>
          <div className="w-6" />
        </div>

        <div className="hidden md:block">
          <Header />
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-800 md:ml-2">
                {selectedBuilding.name}
              </h2>
              <h4 className="text-xs font-semibold text-gray-500 md:ml-2">
                Floors
              </h4>
            </div>

            <button
              className="mt-4 flex h-fit items-center rounded-md bg-[#F26722] px-4 py-2 text-xs text-white shadow-md transition-all hover:bg-[#a5705a] md:mt-0"
              onClick={() => router.push("/dashboard")}
            >
              <BuildingSVG className="mr-2 h-4 w-4 fill-white" />
              Back to Buildings
            </button>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {selectedBuilding.floors.map((floor) => (
              <button
                key={floor.id}
                className={`flex items-center rounded-md px-4 py-2 text-xs transition-all ${
                  selectedFloor?.id === floor.id
                    ? "bg-[#F26722] text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                onClick={() => dispatch(setSeletedFloor(floor))}
              >
                <FloorSVG className="mr-2 h-4 w-4" />
                {floor.name}
              </button>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {kpiCards.map((card) => (
              <div
                key={card.title}
                className="rounded-lg bg-white p-4 pl-6 shadow-sm"
              >
                <Image
                  src={card.iconSrc}
                  alt={card.alt}
                  height={24}
                  width={24}
                  className="mb-2 h-6 w-6"
                />
                <h3 className="text-xs text-black">{card.title}</h3>
                <h5 className="text-xl font-semibold text-black">
                  {card.value}
                </h5>
              </div>
            ))}
          </div>

          <h4 className="mt-6 text-xs font-semibold text-gray-500 md:ml-2">
            Rooms
          </h4>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {roomCategories.map((roomType) => (
              <button
                key={roomType}
                className={`flex items-center rounded-md px-3 py-1 text-xs font-medium transition-all ${
                  selectedRoomType === roomType
                    ? "bg-[#F26722] text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                onClick={() => setSelectedRoomType(roomType)}
              >
                {roomType}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredRooms?.map((room) => (
              <RoomCard room={room} key={room.id} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};

export default RoomPage;
