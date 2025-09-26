"use client";
import React, { JSX, useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { Room } from "@/types";
import RoomCard from "@/components/RoomCard";
import { Building } from "@/types";
import { removeSpaces } from "@/utils";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { encrypt } from "@/utils/encryption";
import { setSeletedRoomTypeId } from "@/app/feature/dataSlice";
import { RootState } from "@/app/store";
export default function Buildings() {
  const router = useRouter();
  const dispatcher = useDispatch();
  const params = useParams();
  const role = params.role?.toString().replace("%20", " ");
  const [buildings, setBuildings] = useState<Building[]>();
  const [roomsList, setRoomsList] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room>();
  const [subRooms, setSubRooms] = useState<Room[]>([]);
  const [allBuildingSubrooms, setAllBuildingSubrooms] = useState<Room[]>([]);
  const [isLoadingBuildings, setIsLoadingBuildings] = useState(false);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(16);
  const [initialLoad] = useState(8);
  const [searchQuery, setSearchQuery] = useState("");
  const acadmeicYear = useSelector((state: RootState) => state.dataState.selectedAcademicYear);
  const acadmeicSession = useSelector((state: RootState) => state.dataState.selectedAcademicSession);
  const selectedRoomType = useSelector((state: RootState) => state.dataState.selectedRoomType);

  useEffect(() => {
    const fetchBuildings = async () => {
      if (!acadmeicSession || !acadmeicYear) return;
      setIsLoadingBuildings(true);
      try {
        const reqBody = {
          acadSession: `${acadmeicSession}`,
          acadYear: `${acadmeicYear}`,
        };

        const response = await callApi<Building[]>(process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND, reqBody);
        if (response.success) {
          setBuildings(response.data);
        }
      } catch (error) {
        console.error("Error fetching buildings:", error);
      } finally {
        setIsLoadingBuildings(false);
      }
    };
    fetchBuildings();
  }, [acadmeicSession, acadmeicYear]);

  useEffect(() => {
    if (!buildings || buildings.length === 0) {
      setRoomsList([]);
      return;
    }

    const fetchRooms = async () => {
      setIsLoadingRooms(true);
      if (!buildings || !role) return;
      try {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, "0");
        const minutes = now.getMinutes().toString().padStart(2, "0");
        const time24h = `${hours}:${minutes}`;
        const promises = buildings.map(async (b) => {
          const response = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, {
            buildingNo: String(b.id),
            floorID: "",
            curreentTime: `${time24h}`,
          });
          const filteredRooms = (response.data || []).filter((room) => room.managedBy === role);
          return filteredRooms;
        });

        const roomLists = await Promise.all(promises);
        setRoomsList(roomLists.flat().sort((a, b) => a.roomName.localeCompare(b.roomName)));
      } catch (error) {
        console.error("Error fetching rooms:", error);
      } finally {
        setIsLoadingRooms(false);
      }
    };

    fetchRooms();
  }, [acadmeicSession, acadmeicYear, buildings, role]);

  // Fetch all subrooms for all buildings at once
  useEffect(() => {
    const fetchAllBuildingSubrooms = async () => {
      if (!buildings || buildings.length === 0) return;
      try {
        const promises = buildings.map(async (building) => {
          const requestBody = {
            roomID: "", // Use blank roomID to get all subrooms for the building
            buildingNo: building.id,
            acadSess: acadmeicSession,
            acadYr: acadmeicYear,
          };
          const response = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_SUBROOMS_LIST || URL_NOT_FOUND, requestBody);
          return response.data || [];
        });

        const allSubrooms = await Promise.all(promises);
        setAllBuildingSubrooms(allSubrooms.flat());
        console.log("All building subrooms:", allSubrooms.flat());
      } catch (error) {
        console.error("Error fetching building subrooms:", error);
      }
    };
    fetchAllBuildingSubrooms();
  }, [buildings, acadmeicSession, acadmeicYear]);

  const kpiCards = [
    {
      title: "Total Rooms Managed",
      value: roomsList.length,
      iconSrc: "/images/house-door.svg",
      alt: "Rooms icon",
    },
    {
      title: "Available Rooms",
      value: roomsList.filter((room) => room.occupied === 0).length,
      iconSrc: "/images/floor-plan.svg",
      alt: "Occupancy icon",
    },
    {
      title: "Occupied Rooms",
      value: roomsList.filter((room) => room.occupied > 0).length,
      iconSrc: "/images/chart-areaspline-variant.svg",
      alt: "Floor area icon",
    },
  ];

  let allRoomsCategories: string[] = [...new Set(roomsList.map((room) => room.roomType).filter((roomType) => roomType && roomType.trim() !== ""))];
  let roomCategories = ["All Rooms"];
  roomCategories = [...roomCategories, ...allRoomsCategories];
  useEffect(() => {
    if (!roomCategories.some((category) => category === selectedRoomType)) dispatcher(setSeletedRoomTypeId("All Rooms"));
  }, [roomCategories]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedRoomType, searchQuery]);

  const filteredRooms: Room[] = roomsList.filter((room) => {
    if (selectedRoomType === "All Rooms") return true;
    if (!room.roomType || room.roomType.trim() === "") return false;
    return removeSpaces(room.roomType).toLowerCase().includes(removeSpaces(selectedRoomType).toLowerCase());
  });

  // Apply search filter and pagination
  const searchRooms = filteredRooms.filter((room) => {
    return room.roomName.toLowerCase().includes(searchQuery.toLowerCase()) || room.roomId.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const visibleRooms = searchRooms.slice(0, currentPage === 1 ? initialLoad : initialLoad + (currentPage - 1) * itemsPerPage);
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
  const handleRoomClick = (room: Room) => {
    if (room.hasSubroom) {
      const isSameRoom = selectedRoom && selectedRoom.roomId === room.roomId && selectedRoom.buildingId === room.buildingId;
      setSelectedRoom(isSameRoom ? undefined : room);
    } else {
      setSelectedRoom(undefined);
      if (room.parentId) {
        router.push(`/space-portal/buildings/${encrypt(room.buildingId)}/${encrypt(`${room.parentId}|${room.roomId}`)}`);
      } else router.push(`/space-portal/buildings/${encrypt(room.buildingId)}/${encrypt(room.roomId)}`);
    }
  };

  const renderRoomCards = () => {
    if (!visibleRooms?.length) return;
    const items: JSX.Element[] = [];
    let expandedRowIndex: number | null = null;
    const cardsPerRow = 4;
    for (let i = 0; i < visibleRooms.length; i++) {
      if (selectedRoom && selectedRoom.roomId === visibleRooms[i].roomId && selectedRoom.buildingId === visibleRooms[i].buildingId) {
        expandedRowIndex = Math.floor(i / cardsPerRow);
        break;
      }
    }

    visibleRooms?.length > 0
      ? visibleRooms?.forEach((room, index) => {
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
          const isLastCardOverall = index === visibleRooms.length - 1;

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
                    onClick={() => setSelectedRoom(undefined)}
                    className="px-2 py-1 bg-orange-500 text-white rounded-lg text-xs hover:bg-orange-600 transition-colors duration-300"
                  >
                    Close &times;
                  </button>
                </h4>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                  {subRooms &&
                    subRooms.map((room) => (
                      <RoomCard key={`${room.buildingId}-${room.roomId}`} onClick={handleRoomClick} room={room} cachedSubrooms={allBuildingSubrooms} />
                    ))}
                </div>
              </div>
            );
          }
        })
      : items.push(
          <div key={"No Room Found"} className="text-gray-600">
            No rooms found{" "}
          </div>
        );

    return items;
  };

  return (
    <div>
      <section>
        <div className="flex flex-1 flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-800 md:ml-2">{role}</h2>
                <h4 className="text-xs font-semibold text-gray-500 md:ml-2">
                  {isLoadingBuildings || isLoadingRooms ? "Loading rooms..." : `${roomsList.length} rooms under your management`}
                </h4>
              </div>

              <input
                type="text"
                placeholder="Search"
                value={searchQuery ? searchQuery : ""}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border border-gray-300 rounded-md py-1 px-2 text-sm focus:outline-none text-gray-700 focus:ring-1 focus:ring-orange-500 mr-2"
              />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {isLoadingBuildings || isLoadingRooms
                ? // Loading skeleton for KPI cards
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="rounded-lg bg-white p-4 pl-6 shadow-sm animate-pulse">
                      <div className="h-6 w-6 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-20 mb-2"></div>
                      <div className="h-6 bg-gray-200 rounded w-16"></div>
                    </div>
                  ))
                : kpiCards.map((card) => (
                    <div key={card.title} className="rounded-lg bg-white p-4 pl-6 shadow-sm">
                      <Image src={card.iconSrc} alt={card.alt} height={24} width={24} className="mb-2 h-6 w-6" />
                      <h3 className="text-xs text-black">{card.title}</h3>
                      <h5 className="text-xl font-semibold text-black">{card.value}</h5>
                    </div>
                  ))}
            </div>

            <h4 className="mt-6 text-xs font-semibold text-gray-500 md:ml-2">Rooms</h4>

            {isLoadingRooms ? (
              // Loading skeleton for room categories
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-8 w-20 bg-gray-200 rounded-md animate-pulse"></div>
                ))}
              </div>
            ) : (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                {roomCategories.map((roomType) => (
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
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {isLoadingRooms
                ? // Loading skeleton for room cards
                  Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                    </div>
                  ))
                : renderRoomCards()}
            </div>

            {/* Load More Button */}
            {!isLoadingRooms && searchRooms.length > 0 && visibleRooms.length < searchRooms.length && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setCurrentPage((prev) => prev + 1)}
                  className="px-6 py-2 bg-[#F26722] text-white rounded-lg hover:bg-[#E55A1A] transition-colors duration-300 font-medium"
                >
                  Load More ({searchRooms.length - visibleRooms.length} more rooms)
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
