"use client";
import React, { JSX, useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { Room, Room1 } from "@/types";
import RoomCard from "@/components/RoomCard";
import { Building1, Floor1 } from "@/types";
import { BuildingSVG } from "@/components/BuildingSvg";
import { FloorSVG } from "@/components/FloorSvg";
import { removeSpaces } from "@/utils";
import { api, callApi } from "@/utils/apiIntercepter";
import { credentials, URL_NOT_FOUND } from "@/constants";
import { encrypt, decrypt } from "@/utils/encryption";
import {
  setSelectedBuilding,
  setSeletedFloor as sliceFloor,
} from "@/app/feature/dataSlice";

export default function Buildings() {
  const router = useRouter();
  const dispatcher = useDispatch();
  const params = useParams();
  let buildingId = decrypt(params.buildingId?.toString() || "");
  let [selectedBuilding, setSelectedBuilding] = useState<Building1>();
  const [selectedFloor, setSelectedFloor] = useState<Floor1 | null>(null);
  const [roomsList, setRoomsList] = useState<Room1[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room1 | null>(null);
  const [subRooms, setSubRooms] = useState<Room1[]>([]);
  const acadmeicYear = useSelector(
    (state: any) => state.dataState.academicYear
  );
  const acadmeicSession = useSelector(
    (state: any) => state.dataState.academicSession
  );

  useEffect(() => {
    const fetchBuildings = async () => {
      const reqBody = {
        acadSession: `${acadmeicSession}`,
        acadYear: `${acadmeicYear}`,
      };

      const response = await callApi<Building1[]>(
        process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND,
        reqBody
      );
      if (response.success) {
        let building = response.data?.find(
          (building) => building.id === buildingId
        );
        setSelectedBuilding(building);
      }
    };
    fetchBuildings();
  }, [acadmeicSession, acadmeicYear]);

  if (selectedBuilding && !selectedFloor) {
    if (selectedBuilding?.floors.length > 0)
      setSelectedFloor(selectedBuilding?.floors[0]);
  }
  useEffect(() => {
    const fetchRooms = async () => {
      const reqBody = {
        buildingNo: `${buildingId}`,
        floorID: `${selectedFloor?.id}`,
        // acadSession: `${acadmeicSession}`,
        // acadYear: `${acadmeicYear}`,
      };

      const response = await callApi<Room1[]>(
        process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND,
        reqBody
      );
      if (response.success) {
        setRoomsList(response.data || []);
      }
    };
    if (selectedFloor) fetchRooms();
  }, [acadmeicSession, acadmeicYear, selectedFloor]);

  const kpiCards = [
    {
      title: "Rooms",
      value: selectedFloor?.totalRoomsOnFloor,
      iconSrc: "/images/house-door.svg",
      alt: "Rooms icon",
    },
    {
      title: "Occupancy",
      value: selectedFloor?.roomOccupied,
      iconSrc: "/images/floor-plan.svg",
      alt: "Occupancy icon",
    },
    {
      title: "Floor Area",
      value: selectedFloor?.floorArea,
      iconSrc: "/images/chart-areaspline-variant.svg",
      alt: "Floor area icon",
    },
  ];

  let allRoomsCategories: string[] = [
    ...new Set(roomsList.map((room) => room.roomType)),
  ];
  let roomCategories = ["All Rooms"];
  roomCategories = [...roomCategories, ...allRoomsCategories];
  const [selectedRoomType, setSelectedRoomType] = useState<string>("All Rooms");
  useEffect(() => {
    if (!roomCategories.some((category) => category === selectedRoomType))
      setSelectedRoomType("All Rooms");
  }, [roomCategories]);

  const filteredRooms: Room1[] = roomsList.filter((room) => {
    return (
      selectedRoomType === "All Rooms" ||
      removeSpaces(room.roomType)
        .toLowerCase()
        .includes(removeSpaces(selectedRoomType).toLowerCase())
    );
  });

  const fetchSubrooms = async (room: Room1) => {
    if (!room) return;
    const requestBody = {
      roomId: room.id,
    };
    let response = callApi<Room1[]>(
      process.env.NEXT_PUBLIC_GET_SUBROOMS_LIST || URL_NOT_FOUND,
      requestBody
    );
    let res = await response;
    setSubRooms(res.data || []);
  };
  const handleFloorClick = (floor: Floor1) => {
    setSelectedFloor(floor);
    dispatcher(sliceFloor(floor.id));
  };

  const handleRoomClick = (room: Room1) => {
    if (room.hasSubtype) {
      setSelectedRoom(room.id === selectedRoom?.id ? null : room);
      fetchSubrooms(room);
    } else {
      router.push(
        `/space-portal/buildings/${encrypt(selectedBuilding?.id)}/${encrypt(
          room.id
        )}`
      );
    }
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
            <h4 className="flex justify-between text-normal text-gray-700 mb-2">
              {selectedRoom.roomName}
              <button
                onClick={() => setSelectedRoom(null)}
                className="px-2 py-1 bg-orange-500 text-white rounded-lg text-xs hover:bg-orange-600 transition-colors duration-300"
              >
                Close &times;
              </button>
            </h4>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
              {subRooms &&
                subRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    onClick={handleRoomClick}
                    room={room}
                  />
                ))}
            </div>
          </div>
        );
      }
    });

    return items;
  };

  return (
    <div>
      <section>
        <div className="flex flex-1 flex-col">
          <div className="flex-1 overflow-y-auto">
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
                  setSelectedFloor(null);
                  setSelectedRoomType("All Rooms");
                  router.back();
                }}
              >
                <BuildingSVG className="mr-2 h-4 w-4 fill-white" />
                Back
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
                  onClick={() => handleFloorClick(floor)}
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
    </div>
  );
}
