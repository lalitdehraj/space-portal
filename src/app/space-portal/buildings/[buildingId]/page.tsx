"use client";
import React, { JSX, useEffect, useState, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { Room, RoomInfo, TotalAvailableRoomsResponse } from "@/types";
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
import moment from "moment";

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
  const [roomsLoadingState, setRoomsLoadingState] = useState<Record<string, boolean>>({});
  const [isFetchingRooms, setIsFetchingRooms] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const acadmeicYear = useSelector((state: RootState) => state.dataState.selectedAcademicYear);
  const acadmeicSession = useSelector((state: RootState) => state.dataState.selectedAcademicSession);
  const academicSessionStartDate = useSelector((state: RootState) => state.dataState.selectedAcademicSessionStartDate);
  const academicSessionEndDate = useSelector((state: RootState) => state.dataState.selectedAcademicSessionEndDate);
  const selectedFloorId = useSelector((state: RootState) => state.dataState.selectedFloorId);
  const selectedRoomId = useSelector((state: RootState) => state.dataState.selectedRoomId);
  const selectedRoomType = useSelector((state: RootState) => state.dataState.selectedRoomType);
  const [availableSitting, setAvailableSitting] = useState<TotalAvailableRoomsResponse | undefined>(undefined);
  
  // KPI state variables
  const [availableRoomsCount, setAvailableRoomsCount] = useState<number>(0);
  const [occupiedRoomsCount, setOccupiedRoomsCount] = useState<number>(0);
  const [averageOccupancy, setAverageOccupancy] = useState<number>(0);
  const [roomStatuses, setRoomStatuses] = useState<Record<string, { isAvailable: boolean; isOccupied: boolean; occupancyPercent: number }>>({});
  
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
    if (!selectedFloor) {
      setRoomsList([]);
      return;
    }

    const fetchRoomsSequentially = async () => {
      setIsFetchingRooms(true);

      // Cancel any ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this fetch session
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, "0");
        const minutes = now.getMinutes().toString().padStart(2, "0");
        const time24h = `${hours}:${minutes}`;
        const reqBody = {
          buildingNo: `${buildingId}`,
          floorID: `${selectedFloor?.id}`,
          curreentTime: `${time24h}`,
        };

        // First, get all rooms
        const response = await callApi<Room[]>(
          process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND,
          reqBody,
          false,
          signal
        );

        if (signal.aborted) return;

        if (response.success && response.data) {
          const allRooms = response.data || [];
          setRoomsList(allRooms);

          if (selectedRoomId) {
            const room = allRooms.filter((r) => r.roomId === selectedRoomId);
            setSelectedRoom(room?.[0] || undefined);
          }

          // Initialize loading states for all rooms
          const loadingStates: Record<string, boolean> = {};
          allRooms.forEach((room) => {
            loadingStates[`${room.buildingId}-${room.roomId}`] = true;
          });
          setRoomsLoadingState(loadingStates);

          // Fetch room details 2 at a time sequentially
          const fetchRoomDetails = async (room: Room) => {
            if (signal.aborted) return;

            try {
              const requestBody = {
                roomID: room.roomId,
                subroomID: "",
                academicYr: acadmeicYear,
                acadSess: acadmeicSession,
                startDate: academicSessionStartDate || moment().format("YYYY-MM-DD"),
                endDate: academicSessionEndDate || moment().format("YYYY-MM-DD"),
              };

              const roomInfoResponse = await callApi<RoomInfo>(
                process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND,
                requestBody,
                false,
                signal
              );

              if (signal.aborted) return;

              if (roomInfoResponse.success && roomInfoResponse.data) {
                // Update the specific room in the list
                setRoomsList((prev) => {
                  const updated = [...prev];
                  const roomIndex = updated.findIndex(
                    (r) => r.roomId === room.roomId && r.buildingId === room.buildingId
                  );
                  if (roomIndex !== -1) {
                    // Merge RoomInfo data into Room object
                    updated[roomIndex] = {
                      ...updated[roomIndex],
                      occupied: roomInfoResponse.data?.occupied || 0,
                      occupiedBy: roomInfoResponse.data?.occupiedBy || "",
                      status: roomInfoResponse.data?.status || "",
                    };
                  }
                  return updated;
                });

                // Mark this room as loaded
                setRoomsLoadingState((prev) => ({
                  ...prev,
                  [`${room.buildingId}-${room.roomId}`]: false,
                }));
              }
            } catch (error) {
              if (signal.aborted) return;
              console.error(`Error fetching room ${room.roomId}:`, error);

              // Mark as loaded even on error to stop shimmer
              setRoomsLoadingState((prev) => ({
                ...prev,
                [`${room.buildingId}-${room.roomId}`]: false,
              }));
            }
          };

          // Process rooms 2 at a time
          for (let i = 0; i < allRooms.length; i += 2) {
            if (signal.aborted) break;

            const batch = allRooms.slice(i, i + 2);
            await Promise.all(batch.map((room) => fetchRoomDetails(room)));
          }
        }
      } catch (error) {
        if (signal.aborted) {
          console.log("Room fetching cancelled");
          return;
        }
        console.error("Error fetching rooms:", error);
      } finally {
        if (!signal.aborted) {
          setIsFetchingRooms(false);
        }
      }
    };

    fetchRoomsSequentially();

    // Cleanup: abort requests when component unmounts or dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [acadmeicSession, acadmeicYear, selectedFloor, buildingId]);

  const allRoomsCategories: string[] = [...new Set(roomsList?.map((room) => room.roomType).filter((roomType) => roomType && roomType.trim() !== ""))];
  let roomCategories = ["All Rooms"];
  roomCategories = [...roomCategories, ...allRoomsCategories];

  useEffect(() => {
    if (roomCategories.some((category) => category === selectedRoomType)) dispatcher(setSeletedRoomTypeId("All Rooms"));
  }, [selectedFloor]);

  const filteredRooms = useMemo(() => {
    return roomsList.filter((room) => {
      if (selectedRoomType === "All Rooms") return true;
      if (!room.roomType || room.roomType.trim() === "") return false;
      return removeSpaces(room.roomType).toLowerCase() === removeSpaces(selectedRoomType).toLowerCase();
    });
  }, [roomsList, selectedRoomType]);
  
  // Callback handler for room status changes
  const handleRoomStatusChange = useCallback((roomId: string, status: { isAvailable: boolean; isOccupied: boolean; occupancyPercent: number }) => {
    setRoomStatuses((prev) => ({
      ...prev,
      [roomId]: status,
    }));
  }, []);
  
  // Create a stable key from filtered room IDs to avoid infinite loops
  const filteredRoomIdsKey = useMemo(() => {
    const filteredRoomIds = new Set(filteredRooms.map((room) => room.roomId));
    return Array.from(filteredRoomIds).sort().join(',');
  }, [filteredRooms]);
  
  // Calculate KPIs from filtered rooms
  useEffect(() => {
    const filteredRoomIds = new Set(filteredRooms.map((room) => room.roomId));
    // Create a map for quick lookup of room.isSitting
    const roomIsSittingMap = new Map(filteredRooms.map((room) => [room.roomId, room.isSitting]));
    
    let available = 0;
    let occupied = 0;
    let totalOccupancySum = 0; // Sum of all occupancy percentages (excluding isSitting)
    let totalRoomsCount = 0; // Total count of filtered rooms (excluding isSitting)

    Object.entries(roomStatuses).forEach(([roomId, status]) => {
      if (filteredRoomIds.has(roomId)) {
        const isSitting = roomIsSittingMap.get(roomId) || false;
        
        // Exclude isSitting rooms from all calculations
        if (!isSitting) {
          totalRoomsCount++; // Count all filtered rooms (excluding isSitting)
          totalOccupancySum += status.occupancyPercent; // Sum all occupancy percentages
          
          if (status.isAvailable) {
            available++;
          }
          if (status.isOccupied) {
            occupied++;
          }
        }
      }
    });

    setAvailableRoomsCount(available);
    setOccupiedRoomsCount(occupied);
    
    // Calculate average occupancy: sum of all occupancy percentages / total rooms count (excluding isSitting)
    if(availableSitting)
    {
      totalOccupancySum= totalOccupancySum +  (100*(availableSitting?.totalRoom - availableSitting?.availableRoom));
      totalRoomsCount= totalRoomsCount + availableSitting?.totalRoom
    }
    const avgOccupancy = totalRoomsCount > 0 ? totalOccupancySum / totalRoomsCount : 0;
    setAverageOccupancy(avgOccupancy);
  }, [roomStatuses, filteredRoomIdsKey, filteredRooms,availableSitting]);
  useEffect(() => {
    const fetchAvailableSittingRooms = async () => {
      if (!buildingId || !selectedFloor?.id) return; 
      try{
      // Get building IDs and floor IDs from appliedFilters, join with | separator
      const requestBody = {
        buildingNo: buildingId,
        floorId: selectedFloor?.id,
        roomTypes: selectedRoomType==="All Rooms" ? "" : selectedRoomType,
        managedBy: "",
      };
      const response = await callApi<TotalAvailableRoomsResponse>(     
         process.env.NEXT_PUBLIC_GET_TOTAL_AVAILABLE_ROOMS_SITTING || URL_NOT_FOUND, requestBody);

      if (response.success && response.data) {
        // Update availableSitting from API response
        setAvailableSitting(response.data || 0);
      } else {
        console.error("Failed to fetch available rooms:", response.error);
        setAvailableSitting(undefined);
      }}catch(error){
        console.error("Error fetching available rooms:", error);
        setAvailableSitting(undefined);
      }
    };
  
    fetchAvailableSittingRooms();
  }, [acadmeicSession,selectedRoomType,selectedFloor?.id,buildingId]);
  
  const kpiCards = [
    {
      title: "Rooms",
      value: filteredRooms.length,
      iconSrc: "/images/house-door.svg",
      alt: "Rooms icon",
    },
    {
      title: "Available Sitting",
      value: availableSitting ? `${availableSitting?.availableRoom }/${availableSitting?.totalRoom}` : "0",
      iconSrc: "/images/chart-areaspline-variant.svg",
      alt: "Floor area icon",
    },
    {
      title: "Available Rooms",
      value: availableRoomsCount? `${availableRoomsCount}/${filteredRooms.filter(room => !room.isSitting).length}` : "0",
      iconSrc: "/images/floor-plan.svg",
      alt: "Occupancy icon",
    },
    {
      title: "Occupancy",
      value: `${averageOccupancy.toFixed(1)}%`,
      iconSrc: "/images/chart-areaspline-variant.svg",
      alt: "Floor area icon",
    },
  ];

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
    if (!filteredRooms?.length && !isFetchingRooms) return null;

    const items: JSX.Element[] = [];
    let expandedRowIndex: number | null = null;
    const cardsPerRow = 4;

    // Show shimmer for rooms that are loading
    filteredRooms?.forEach((room, index) => {
      const roomKey = `${room.buildingId}-${room.roomId}`;
      const isLoading = roomsLoadingState[roomKey] || false;

      if (isLoading) {
        // Shimmer loading card
        items.push(
          <div key={roomKey} className="bg-white rounded-lg shadow-sm p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/3"></div>
          </div>
        );
      } else {
        // Actual room card
        if (selectedRoom && selectedRoom.roomId === room.roomId && selectedRoom.buildingId === room.buildingId) {
          expandedRowIndex = Math.floor(index / cardsPerRow);
        }

        items.push(
          <RoomCard
            room={room}
            key={roomKey}
            isExpanded={selectedRoom ? selectedRoom.roomId === room.roomId && selectedRoom.buildingId === room.buildingId : false}
            onClick={(room) => handleRoomClick(room)}
            onStatusChange={handleRoomStatusChange}
          />
        );

        const currentRowIndex = Math.floor(index / cardsPerRow);
        const isLastCardInRow = (index + 1) % cardsPerRow === 0;
        const isLastCardOverall = index === filteredRooms.length - 1;

        if (selectedRoom !== null && currentRowIndex === expandedRowIndex && (isLastCardInRow || isLastCardOverall)) {
          items.push(
            <div
              key={`details-${selectedRoom?.buildingId}-${selectedRoom?.roomId}`}
              className="col-span-full bg-gray-50 p-8 rounded-xl shadow-inner border border-gray-200 transition-all duration-500 ease-in-out transform opacity-100 translate-y-0"
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
                      onStatusChange={handleRoomStatusChange}
                    />
                  ))}
              </div>
            </div>
          );
        }
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
              {kpiCards.map((card: { title: string; value: string | number | undefined; iconSrc: string; alt: string }) =>
                card.value ? (
                  <div key={card.title} className="rounded-lg bg-[#FFCC29]/80 p-4 pl-6 shadow-sm">
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
