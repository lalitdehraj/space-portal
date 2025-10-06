"use client";
import React, { JSX, useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { Room } from "@/types";
import RoomCard from "@/components/RoomCard";
import { Building, Floor } from "@/types";
import { BuildingSVG } from "@/components/BuildingSvg";
import { FloorSVG } from "@/components/FloorSvg";
import { removeSpaces } from "@/utils";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { encrypt, decrypt } from "@/utils/encryption";
import { setSelectedFloorId, setSelectedRoomId, setSeletedRoomTypeId } from "@/app/feature/dataSlice";
import { RootState } from "@/app/store";

export default function Buildings() {
  const router = useRouter();
  const dispatcher = useDispatch();
  const params = useParams();
  const buildingId = decrypt(params.buildingId?.toString() || "");
  const [selectedBuilding, setSelectedBuilding] = useState<Building>();
  const [selectedFloor, setSelectedFloor] = useState<Floor>();
  const [roomsList, setRoomsList] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room>();
  const [subRooms, setSubRooms] = useState<Room[]>([]);
  const [allBuildingSubrooms, setAllBuildingSubrooms] = useState<Room[]>([]);
  const acadmeicYear = useSelector((state: RootState) => state.dataState.selectedAcademicYear);
  const acadmeicSession = useSelector((state: RootState) => state.dataState.selectedAcademicSession);
  const selectedFloorId = useSelector((state: RootState) => state.dataState.selectedFloorId);
  const selectedRoomId = useSelector((state: RootState) => state.dataState.selectedRoomId);
  const selectedRoomType = useSelector((state: RootState) => state.dataState.selectedRoomType);
  useEffect(() => {
    const fetchBuildings = async () => {
      const reqBody = {
        acadSession: `${acadmeicSession}`,
        acadYear: `${acadmeicYear}`,
      };

      const response = await callApi<Building[]>(process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND, reqBody);
      if (response.success) {
        const building = response.data?.find((building) => building.id === buildingId);
        setSelectedBuilding(building);
        if ((building?.floors?.length || 0) > 0) {
          const floor = building?.floors.filter((f) => f.id === selectedFloorId);
          setSelectedFloor(floor && (floor?.length || 0) > 0 ? floor?.[0] : building?.floors[0]);
        }
      }
    };
    fetchBuildings();
  }, [acadmeicSession, acadmeicYear]);

  useEffect(() => {
    const fetchRooms = async () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const time24h = `${hours}:${minutes}`;
      const reqBody = {
        buildingNo: `${buildingId}`,
        floorID: `${selectedFloor?.id}`,
        curreentTime: `${time24h}`,
      };

      const response = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, reqBody);
      if (response.success) {
        setRoomsList(response.data || []);
        if (selectedRoomId) {
          const room = response?.data?.filter((r) => r.roomId === selectedRoomId);
          setSelectedRoom(room?.[0] || undefined);
        }
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
      value: `${Math.ceil((selectedFloor?.roomOccupied || 0) / (selectedBuilding?.totalOccupancy || 1))}%`,
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

  const allRoomsCategories: string[] = [...new Set(roomsList?.map((room) => room.roomType).filter((roomType) => roomType && roomType.trim() !== ""))];
  let roomCategories = ["All Rooms"];
  roomCategories = [...roomCategories, ...allRoomsCategories];

  useEffect(() => {
    if (roomCategories.some((category) => category === selectedRoomType)) dispatcher(setSeletedRoomTypeId("All Rooms"));
  }, [selectedFloor]);

  const filteredRooms: Room[] = roomsList.filter((room) => {
    if (selectedRoomType === "All Rooms") return true;
    if (!room.roomType || room.roomType.trim() === "") return false;
    return removeSpaces(room.roomType).toLowerCase() === removeSpaces(selectedRoomType).toLowerCase();
  });

  useEffect(() => {
    const fetchAllBuildingSubrooms = async () => {
      if (!selectedBuilding?.id) return;
      const requestBody = {
        roomID: "", // Use blank roomID to get all subrooms for the building
        buildingNo: selectedBuilding.id,
        acadSess: acadmeicSession,
        acadYr: acadmeicYear,
      };
      const response = callApi<Room[]>(process.env.NEXT_PUBLIC_GET_SUBROOMS_LIST || URL_NOT_FOUND, requestBody);
      const res = await response;
      console.log("All building subrooms:", res);
      setAllBuildingSubrooms(res.data || []);
    };
    fetchAllBuildingSubrooms();
  }, [selectedBuilding?.id, acadmeicSession, acadmeicYear]);
  useEffect(() => {
    const fetchSubrooms = async () => {
      if (!selectedRoom) {
        setSubRooms([]);
        return;
      }
      // Filter subrooms from the already fetched building subrooms
      const filteredSubrooms = allBuildingSubrooms.filter((subroom) => subroom.parentId === selectedRoom.roomId);
      setSubRooms(filteredSubrooms);
    };
    fetchSubrooms();
  }, [selectedRoom, allBuildingSubrooms]);
  const handleFloorClick = (floor: Floor) => {
    setSelectedFloor(floor);
    dispatcher(setSelectedFloorId(floor.id));
  };

  const handleRoomClick = (room: Room) => {
    if (room.hasSubroom) {
      dispatcher(setSelectedRoomId(room.roomId));
      const isSameRoom = selectedRoom && selectedRoom.roomId === room.roomId && selectedRoom.buildingId === room.buildingId;
      setSelectedRoom(isSameRoom ? undefined : room);
    } else {
      dispatcher(setSelectedRoomId(""));
      if (room.parentId) {
        router.push(`/space-portal/buildings/${encrypt(buildingId)}/${encrypt(`${room.parentId}|${room.roomId}`)}`);
      } else router.push(`/space-portal/buildings/${encrypt(buildingId)}/${encrypt(room.roomId)}`);
    }
  };

  const renderRoomCards = () => {
    if (!filteredRooms?.length) return;
    const items: JSX.Element[] = [];
    let expandedRowIndex: number | null = null;
    const cardsPerRow = 4;
    for (let i = 0; i < (filteredRooms?.length || 1); i++) {
      if (selectedRoom && selectedRoom.roomId === filteredRooms?.[i].roomId && selectedRoom.buildingId === filteredRooms?.[i].buildingId) {
        expandedRowIndex = Math.floor(i / cardsPerRow);
        break;
      }
    }
    filteredRooms?.forEach((room, index) => {
      items.push(
        <RoomCard
          room={room}
          key={`${room.buildingId}-${room.roomId}`}
          isExpanded={selectedRoom ? selectedRoom.roomId === room.roomId && selectedRoom.buildingId === room.buildingId : false}
          onClick={(room) => handleRoomClick(room)}
          cachedSubrooms={allBuildingSubrooms}
        />
      );
      const currentRowIndex = Math.floor(index / cardsPerRow);
      const isLastCardInRow = (index + 1) % cardsPerRow === 0;
      const isLastCardOverall = index === filteredRooms.length - 1;

      if (selectedRoom !== null && currentRowIndex === expandedRowIndex && (isLastCardInRow || isLastCardOverall)) {
        items.push(
          <div
            key={`details-${selectedRoom?.buildingId}-${selectedRoom?.roomId}`}
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
              {selectedRoom?.roomName}
              <button
                onClick={() => {
                  setSelectedRoom(undefined);
                  dispatcher(setSelectedRoomId(""));
                }}
                className="px-2 py-1 bg-orange-500 text-white rounded-lg text-xs hover:bg-orange-600 transition-colors duration-300"
              >
                Close &times;
              </button>
            </h4>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
              {subRooms &&
                subRooms?.map((room) => (
                  <RoomCard
                    key={`${room.buildingId}-${room.parentId}-${room.roomId}`}
                    onClick={handleRoomClick}
                    room={room}
                    cachedSubrooms={allBuildingSubrooms}
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
                <h2 className="text-base font-semibold text-gray-800 md:ml-2">{selectedBuilding?.name}</h2>
                <h4 className="text-xs font-semibold text-gray-500 md:ml-2">Floors</h4>
              </div>

              <button
                className="mt-4 flex h-fit items-center rounded-md bg-[#F26722] px-4 py-2 text-xs text-white shadow-md transition-all hover:bg-[#a5705a] md:mt-0"
                onClick={() => router.back()}
              >
                <BuildingSVG className="mr-2 h-4 w-4 fill-white" />
                Back
              </button>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
              {selectedBuilding?.floors?.map((floor) => (
                <button
                  key={floor.id}
                  className={`flex items-center rounded-md px-4 py-2 text-xs transition-all ${
                    selectedFloor?.id === floor.id ? "bg-[#F26722] text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  onClick={() => handleFloorClick(floor)}
                >
                  <FloorSVG className="mr-2 h-4 w-4" />
                  {floor.name}
                </button>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {kpiCards.map((card) =>
                card.value ? (
                  <div key={card.title} className="rounded-lg bg-white p-4 pl-6 shadow-sm">
                    <Image src={card.iconSrc} alt={card.alt} height={24} width={24} className="mb-2 h-6 w-6" />
                    <h3 className="text-xs text-black">{card.title}</h3>
                    <h5 className="text-xl font-semibold text-black">{card.value}</h5>
                  </div>
                ) : null
              )}
            </div>

            {filteredRooms.length ? (
              <div>
                <h4 className="mt-6 text-xs font-semibold text-gray-500 md:ml-2">Rooms</h4>
                <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                  {roomCategories?.map((roomType) => (
                    <button
                      key={roomType}
                      className={`flex items-center rounded-md px-3 py-1 text-xs font-medium transition-all ${
                        selectedRoomType === roomType ? "bg-[#F26722] text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      onClick={() => dispatcher(setSeletedRoomTypeId(roomType))}
                    >
                      {roomType}
                    </button>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{renderRoomCards()}</div>
              </div>
            ) : (
              <div className="mt-6 text-gray-500 justify-center items-center w-full h-full">No Rooms Found</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
