"use client";
import React, { JSX, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { Menu } from "lucide-react";
import SideNav from "@/components/SideNav";
import Header from "@/components/Header";
import BuildingCard from "@/components/BuildingCard";
import { buildingsData } from "@/constants";
import { setAllBuildingsData } from "../feature/dataSlice";
import { Room } from "@/types";
import useSideNavState from "@/hooks/useSideNavState";
import RoomCard from "@/components/RoomCard";
import { Building, Floor } from "@/types";
import { BuildingSVG } from "@/components/BuildingSvg";
import { FloorSVG } from "@/components/FloorSvg";
import { removeSpaces } from "@/utils";

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

export default function Buildings() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { isSideNavOpen, toggleSideNav } = useSideNavState();
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(
    null
  );
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);
  const [selectedRoomType, setSelectedRoomType] = useState<string>("All Rooms");

  const filteredRooms = selectedFloor?.rooms.filter((room) => {
    return (
      selectedRoomType === "All Rooms" ||
      removeSpaces(room.name)
        .toLowerCase()
        .includes(removeSpaces(selectedRoomType).toLowerCase())
    );
  });

  const data: Building[] = useSelector(
    (state: { dataState: { allBuildingsData: Building[] } }) =>
      state.dataState.allBuildingsData
  );
  const [isBuildingSelected, setIsBuildingSelected] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  useEffect(() => {
    if (!data || data.length === 0) {
      dispatch(setAllBuildingsData(buildingsData));
    }
  }, [dispatch, data]);

  const allBuildings = useMemo(() => data || [], [data]);

  const handleRoomClick = (room: Room) => {
    if (removeSpaces(room.name).toLowerCase().includes("facultyroom"))
      setSelectedRoom(room.id === selectedRoom?.id ? null : room);
    else router.push("/");
  };

  const renderRoomCards = () => {
    if (!filteredRooms?.length) return;
    const items: JSX.Element[] = [];
    let expandedRowIndex: number | null = null;
    let cardsPerRow = 4;
    for (let i = 0; i < (filteredRooms?.length || 1); i++) {
      if (selectedRoom?.id === filteredRooms?.[i].id) {
        expandedRowIndex = Math.floor(i / cardsPerRow);
        break;
      }
    }
    filteredRooms?.forEach((room, index) => {
      items.push(
        <RoomCard
          room={room}
          key={room.id}
          isExpanded={selectedRoom?.id === room.id}
          onClick={(room) => handleRoomClick(room)}
        />
      );
      const currentRowIndex = Math.floor(index / cardsPerRow);
      const isLastCardInRow = (index + 1) % cardsPerRow === 0;
      const isLastCardOverall = index === filteredRooms.length - 1;

      if (
        selectedRoom !== null &&
        currentRowIndex === expandedRowIndex &&
        (isLastCardInRow || isLastCardOverall)
      ) {
        items.push(
          <div
            key={`details-${selectedRoom.id}`}
            className="
                col-span-full bg-gray-50 p-8 rounded-xl shadow-inner
                border border-gray-200
                transition-all duration-500 ease-in-out transform
                opacity-100 translate-y-0
              "
            style={{
              gridColumn: "1 / -1",
              animation: "fadeInSlideUp 0.5s ease-out forwards",
            }}
          >
            <h4 className="text-3xl font-bold text-blue-800 mb-4">
              {selectedRoom.name}
            </h4>
            <p className="text-lg text-gray-700 leading-relaxed">
              {selectedRoom.occupants}
            </p>
            <button
              onClick={() => setSelectedRoom(null)}
              className="mt-6 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-300"
            >
              Close Details
            </button>
          </div>
        );
      }
    });

    return items;
  };

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
          <h1 className="text-xl font-bold text-gray-800">Buildings</h1>
          <div className="w-6" />
        </div>

        <div className="hidden md:block">
          <Header />
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {!isBuildingSelected && (
            <section>
              <h2 className="mb-4 text-base font-semibold text-gray-800 md:ml-2">
                Building Utilizations Details
              </h2>
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800">
                      Building Utilization
                    </h3>
                    <p className="text-[10px] text-gray-500">
                      Comparative analysis across all campus facilities
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {allBuildings.map((building) => (
                    <BuildingCard
                      building={building}
                      key={building.id}
                      onClick={() => {
                        setSelectedBuilding(building);
                        setSelectedFloor(building.floors[0]);
                        setIsBuildingSelected(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}
          {isBuildingSelected && (
            <section>
              <div className="flex flex-1 flex-col">
                <div className="sticky top-0 z-30 flex w-full items-center justify-between border-b bg-white p-4 shadow-sm md:hidden">
                  <button onClick={toggleSideNav} className="text-gray-900">
                    <Menu size={24} />
                  </button>
                  <h1 className="text-xl font-bold text-gray-800">
                    {selectedBuilding?.name || ""}
                  </h1>
                  <div className="w-6" />
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-gray-800 md:ml-2">
                        {selectedBuilding?.name}
                      </h2>
                      <h4 className="text-xs font-semibold text-gray-500 md:ml-2">
                        Floors
                      </h4>
                    </div>

                    <button
                      className="mt-4 flex h-fit items-center rounded-md bg-[#F26722] px-4 py-2 text-xs text-white shadow-md transition-all hover:bg-[#a5705a] md:mt-0"
                      onClick={() => {
                        setSelectedBuilding(null);
                        setIsBuildingSelected(false);
                        setSelectedFloor(null);
                        setSelectedRoomType("All Rooms");
                      }}
                    >
                      <BuildingSVG className="mr-2 h-4 w-4 fill-white" />
                      Back to Buildings
                    </button>
                  </div>

                  <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                    {selectedBuilding?.floors.map((floor) => (
                      <button
                        key={floor.id}
                        className={`flex items-center rounded-md px-4 py-2 text-xs transition-all ${
                          selectedFloor?.id === floor.id
                            ? "bg-[#F26722] text-white shadow-md"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                        onClick={() => setSelectedFloor(floor)}
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
                    {renderRoomCards()}
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
