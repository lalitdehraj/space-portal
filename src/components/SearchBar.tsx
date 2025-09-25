"use client";
import React, { useEffect, useState, useMemo } from "react";
import moment from "moment";
import { Building, Room, Maintenance, RoomInfo, Occupant } from "@/types";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { useSelector } from "react-redux";

export function AdvancedSearch({ onClose }: { onClose: () => void }) {
  const academicYear = useSelector((state: any) => state.dataState.selectedAcademicYear);
  const acadSession = useSelector((state: any) => state.dataState.selectedAcademicSession);

  // State management
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<Maintenance[]>([]);
  const [roomInfos, setRoomInfos] = useState<Record<string, RoomInfo>>({});
  const [loading, setLoading] = useState(false);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [subroomData, setSubroomData] = useState<Record<string, Room[]>>({});
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);
  const [subroomCache, setSubroomCache] = useState<Record<string, Room[]>>({});
  const [clickedRoom, setClickedRoom] = useState<Room | null>(null);
  const [clickedRoomSubrooms, setClickedRoomSubrooms] = useState<Room[]>([]);
  const [loadingSubrooms, setLoadingSubrooms] = useState(false);

  // Filters
  const [capacity, setCapacity] = useState("");
  const [status, setStatus] = useState<string>("");
  const [roomType, setRoomType] = useState<string>("");
  const [searchDate, setSearchDate] = useState(moment().format("YYYY-MM-DD"));
  const [startTime, setStartTime] = useState(moment().format("HH:mm"));
  const [endTime, setEndTime] = useState(moment().format("HH:mm"));

  // Fetch maintenance records
  const fetchMaintenanceRecords = async () => {
    try {
      const response = await callApi<Maintenance[]>(process.env.NEXT_PUBLIC_GET_MAINTENANCE_DATA || URL_NOT_FOUND);
      setMaintenanceRecords(response.success ? response.data || [] : []);
    } catch (error) {
      console.error("Error fetching maintenance records:", error);
      setMaintenanceRecords([]);
    }
  };

  // Load buildings + rooms
  useEffect(() => {
    const fetchBuildingsAndRooms = async () => {
      try {
        setLoading(true);
        const buildingsRes = await callApi<Building[]>(process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND, {
          acadSession: `${acadSession}`,
          acadYear: `${academicYear}`,
        });

        if (!buildingsRes.success) return;
        setBuildings(buildingsRes.data || []);

        const rooms: Room[] = [];
        for (const b of buildingsRes.data || []) {
          const res = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, {
            buildingNo: b.id,
            floorID: "",
            curreentTime: moment().format("HH:mm"),
          });
          if (res.success && res.data) rooms.push(...res.data);
        }
        setAllRooms(rooms);
        setFilteredRooms(rooms);
      } catch (err) {
        console.error("Error fetching buildings/rooms:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBuildingsAndRooms();
    fetchMaintenanceRecords();
  }, [acadSession, academicYear]);

  /**
   * Memoized maintenance room IDs for current search parameters
   */
  const maintenanceRoomIds = useMemo(() => {
    if (!maintenanceRecords || !searchDate || !startTime || !endTime) return new Set<string>();

    const filterStart = moment(`${searchDate} ${startTime}`);
    const filterEnd = moment(`${searchDate} ${endTime}`);

    return new Set(
      maintenanceRecords
        .filter((rec) => {
          if (!rec.isMainteneceActive) return false;

          // Parse maintenance date (ISO format: 2025-09-23T00:00:00Z)
          const maintenanceDate = moment(rec.maintanceDate).format("YYYY-MM-DD");

          // Parse maintenance times correctly from ISO format
          // The time format is "0001-01-02T09:00:00Z" - extract time part manually
          const maintenanceStartTime = rec.startTime.split("T")[1]?.split("Z")[0]?.substring(0, 5) || "00:00";
          const maintenanceEndTime = rec.endTime.split("T")[1]?.split("Z")[0]?.substring(0, 5) || "00:00";

          const recStart = moment(`${maintenanceDate} ${maintenanceStartTime}`);
          const recEnd = moment(`${maintenanceDate} ${maintenanceEndTime}`);

          return recEnd.isAfter(filterStart) && recStart.isBefore(filterEnd);
        })
        .map((rec) => `${rec.buildingId}|${rec.roomid}`)
    );
  }, [maintenanceRecords, searchDate, startTime, endTime]);

  /**
   * Consolidated room filtering function - handles both maintenance and regular filtering
   */
  const roomUnderMaintenece = ({ status, capacity, roomType }: { status?: string; capacity?: string; roomType?: string }) => {
    let filtered = allRooms;

    // Handle maintenance status using memoized maintenance room IDs
    if (status && status.toLowerCase() === "maintenance") {
      filtered = filtered.filter((room) => maintenanceRoomIds.has(`${room.buildingId}|${room.roomId}`));
    }
    // Apply additional filters
    if (capacity) {
      filtered = filtered.filter((room) => room.roomCapactiy >= parseInt(capacity));
    }

    if (roomType) {
      filtered = filtered.filter((room) => room.roomType?.toLowerCase() === roomType.toLowerCase());
    }

    return filtered;
  };

  /**
   * Fetch RoomInfo data for rooms with caching
   */
  const fetchRoomInfos = async (rooms: Room[], searchDate: string): Promise<Record<string, RoomInfo>> => {
    const roomInfoMap: Record<string, RoomInfo> = {};

    try {
      const roomInfoPromises = rooms.map(async (room) => {
        const requestBody = {
          roomID: room.roomId,
          subroomID: "",
          academicYr: academicYear,
          acadSess: acadSession,
          startDate: searchDate,
          endDate: searchDate,
        };

        try {
          const response = await callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, requestBody);
          if (response.success && response.data) {
            return { roomId: room.roomId, roomInfo: response.data };
          }
        } catch (error) {
          console.error(`Error fetching room info for room ${room.roomId}:`, error);
        }
        return null;
      });

      const results = await Promise.all(roomInfoPromises);
      results.forEach((result) => {
        if (result) {
          roomInfoMap[result.roomId] = result.roomInfo;
        }
      });
    } catch (error) {
      console.error("Error fetching room infos:", error);
    }

    return roomInfoMap;
  };

  /**
   * Fetch subrooms with caching
   */
  const fetchSubrooms = async (roomId: string, buildingId: string): Promise<Room[]> => {
    const cacheKey = `${roomId}-${buildingId}`;
    if (subroomCache[cacheKey]) {
      return subroomCache[cacheKey];
    }

    try {
      const requestBody = {
        roomID: roomId,
        buildingNo: buildingId,
        acadSess: acadSession,
        acadYr: academicYear,
      };

      const response = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_SUBROOMS_LIST || URL_NOT_FOUND, requestBody);
      if (response.success && response.data) {
        setSubroomCache((prev) => ({
          ...prev,
          [cacheKey]: response.data!,
        }));
        return response.data;
      }
    } catch (error) {
      console.error(`Error fetching subrooms for room ${roomId}:`, error);
    }
    return [];
  };

  /**
   * Handle room click to show subrooms
   */
  const handleRoomClick = async (room: Room) => {
    if (!room.hasSubroom) {
      return; // Don't show subrooms for rooms that don't have them
    }

    setClickedRoom(room);
    setLoadingSubrooms(true);

    try {
      const subrooms = await fetchSubrooms(room.roomId, room.buildingId);
      setClickedRoomSubrooms(subrooms);
    } catch (error) {
      console.error(`Error fetching subrooms for clicked room ${room.roomId}:`, error);
      setClickedRoomSubrooms([]);
    } finally {
      setLoadingSubrooms(false);
    }
  };

  /**
   * Close subroom modal
   */
  const closeSubroomModal = () => {
    setClickedRoom(null);
    setClickedRoomSubrooms([]);
  };

  /**
   * Consolidated function to check if a room/subroom is occupied during time frame
   */
  const isOccupiedDuringTimeFrame = (
    occupants: Occupant[] | undefined,
    searchDate: string,
    startTime: string,
    endTime: string,
    subroomId?: string
  ): boolean => {
    if (!occupants) return false;

    const filterStart = moment(`${searchDate} ${startTime}`);
    const filterEnd = moment(`${searchDate} ${endTime}`);

    return occupants.some((occupant) => {
      // If checking for specific subroom, filter by subroomId
      if (subroomId && occupant.subroomId !== subroomId) {
        return false;
      }

      const occupantDate = moment(occupant.scheduledDate).format("YYYY-MM-DD");
      if (occupantDate !== searchDate) {
        return false;
      }

      const occupantStart = moment(`${occupantDate} ${occupant.startTime}`);
      const occupantEnd = moment(`${occupantDate} ${occupant.endTime}`);

      return occupantEnd.isAfter(filterStart) && occupantStart.isBefore(filterEnd);
    });
  };

  /**
   * Consolidated function to handle room availability checking
   */
  const getAvailableRooms = async (rooms: Room[], searchDate: string, startTime: string, endTime: string) => {
    const nonMaintenanceRooms = rooms.filter((room) => !maintenanceRoomIds.has(`${room.buildingId}|${room.roomId}`));

    // Fetch room infos for occupancy checking
    const roomInfosData = await fetchRoomInfos(nonMaintenanceRooms, searchDate);
    setRoomInfos(roomInfosData);

    const availableRooms: Room[] = [];
    const subroomData: Record<string, Room[]> = {};

    for (const room of nonMaintenanceRooms) {
      if (room.hasSubroom) {
        // Handle subroom logic
        const subrooms = await fetchSubrooms(room.roomId, room.buildingId);

        if (subrooms.length > 0) {
          const roomInfo = roomInfosData[room.roomId];
          const availableSubrooms = subrooms.filter(
            (subroom) => !isOccupiedDuringTimeFrame(roomInfo?.occupants, searchDate, startTime, endTime, subroom.roomId)
          );

          if (availableSubrooms.length > 0) {
            availableRooms.push(room);
            subroomData[room.roomId] = availableSubrooms;
          }
        }
      } else {
        // Handle regular rooms
        const roomInfo = roomInfosData[room.roomId];
        if (!isOccupiedDuringTimeFrame(roomInfo?.occupants, searchDate, startTime, endTime)) {
          availableRooms.push(room);
        }
      }
    }

    return { availableRooms, subroomData };
  };

  // Main search function
  const handleSearch = async () => {
    const now = moment();
    const start = moment(`${searchDate} ${startTime}`);
    const end = moment(`${searchDate} ${endTime}`);

    if (start.isBefore(now)) {
      alert("Start date/time cannot be in the past.");
      return;
    }
    if (end.isBefore(start)) {
      alert("End time cannot be before start time.");
      return;
    }

    setLoading(true);

    try {
      if (status && status.toLowerCase() === "maintenance") {
        // Instant maintenance search - no API calls needed
        const maintenanceRooms = roomUnderMaintenece({
          status,
          capacity,
          roomType,
        });
        setFilteredRooms(maintenanceRooms);
        setSubroomData({});
        setLoading(false);
        return;
      } else if (status && status.toLowerCase() === "available") {
        // Available rooms search - requires API calls
        const { availableRooms, subroomData: subroomDataResult } = await getAvailableRooms(allRooms, searchDate, startTime, endTime);

        // Apply additional filters
        let finalFilteredRooms = availableRooms;

        if (capacity) {
          finalFilteredRooms = finalFilteredRooms.filter((room) => room.roomCapactiy >= parseInt(capacity));
        }

        if (roomType) {
          finalFilteredRooms = finalFilteredRooms.filter((room) => room.roomType?.toLowerCase() === roomType.toLowerCase());
        }

        setFilteredRooms(finalFilteredRooms);
        setSubroomData(subroomDataResult);
      } else {
        // Apply the rest of the filters (except status) to allRooms
        let filtered = allRooms;

        if (capacity) {
          filtered = filtered.filter((room) => room.roomCapactiy >= parseInt(capacity));
        }

        if (roomType) {
          filtered = filtered.filter((room) => room.roomType?.toLowerCase() === roomType.toLowerCase());
        }

        setFilteredRooms(filtered);
        setSubroomData({});
      }
    } catch (error) {
      console.error("Error in handleSearch:", error);
      setFilteredRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const today = moment().format("YYYY-MM-DD");
  const nowTime = moment().format("HH:mm");

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-white w-[95%] md:w-[90%] h-[90%] rounded-lg shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center">
              <img src="/images/bx-filter-alt.svg" alt="Filter" className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Advanced Search</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Filters Sidebar */}
          <div className="w-full md:w-80 border-r border-gray-200 bg-gray-50 flex flex-col">
            <div className="p-6 flex flex-col space-y-6 overflow-y-auto">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Search Filters</h3>

                {/* Capacity Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Minimum Capacity</label>
                  <input
                    type="number"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="Enter capacity"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Room Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">All Rooms</option>
                    <option value="maintenance">Under maintenance</option>
                    <option value="available">Available</option>
                  </select>
                </div>

                {/* Room Type Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Room Type</label>
                  <select
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">All Types</option>
                    {[...new Set(allRooms.filter((r) => r.roomType !== "").map((r) => r.roomType))].map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Search Date</label>
                  <input
                    type="date"
                    value={searchDate}
                    min={today}
                    onChange={(e) => setSearchDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* Time Range Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Time Range</label>
                  <div className="flex space-x-2">
                    <input
                      type="time"
                      value={startTime}
                      min={searchDate === today ? nowTime : "00:00"}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    <input
                      type="time"
                      value={endTime}
                      min={startTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Search Button */}
            <div className="p-6 border-t border-gray-200 bg-white">
              <button
                onClick={handleSearch}
                className="w-full bg-orange-500 text-white py-3 rounded-lg hover:bg-orange-600 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              >
                Search Rooms
              </button>
            </div>
          </div>

          {/* Results Section */}
          <div className="flex-1 bg-white">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-800">Search Results</h3>
                {filteredRooms.length > 0 && (
                  <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    {filteredRooms.length} room{filteredRooms.length !== 1 ? "s" : ""} found
                  </span>
                )}
              </div>

              <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-gray-600">Checking room availability...</span>
                    </div>
                  </div>
                ) : filteredRooms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                    </div>
                    <p className="text-lg font-medium">No rooms found</p>
                    <p className="text-sm">Try adjusting your search criteria</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredRooms.map((room) => {
                      const isHovered = hoveredRoomId === room.roomId;
                      const availableSubrooms = subroomData[room.roomId] || [];

                      return (
                        <div
                          key={`${room.buildingId}-${room.roomId}-${room.parentId || "main"}`}
                          className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden relative cursor-pointer"
                          onMouseEnter={() => (room.hasSubroom ? setHoveredRoomId(room.roomId) : null)}
                          onMouseLeave={() => (room.hasSubroom ? setHoveredRoomId(null) : null)}
                          onClick={() => handleRoomClick(room)}
                        >
                          <div className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-800 text-sm mb-1 truncate">{room.roomName}</h4>
                                <p className="text-xs text-gray-500 mb-1">Building ID: {room.buildingId}</p>
                                {room.hasSubroom && availableSubrooms.length > 0 && (
                                  <p className="text-xs text-blue-600 mb-1">
                                    {availableSubrooms.length} subroom{availableSubrooms.length !== 1 ? "s" : ""} available
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Capacity:</span>
                                <span className="font-medium text-gray-700">{room.roomCapactiy}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Type:</span>
                                <span className="font-medium text-gray-700">{room.roomType}</span>
                              </div>
                            </div>
                          </div>

                          {/* Subroom Hover Tooltip */}
                          {room.hasSubroom && isHovered && availableSubrooms.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1 p-3">
                              <h5 className="font-semibold text-sm text-gray-800 mb-2">Available Subrooms:</h5>
                              <div className="space-y-1">
                                {availableSubrooms.map((subroom) => (
                                  <div key={subroom.roomId} className="flex justify-between text-xs">
                                    <span className="text-gray-700">{subroom.roomName}</span>
                                    <span className="text-gray-500">Cap: {subroom.roomCapactiy}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Subroom Modal */}
        {clickedRoom && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-[60]">
            <div className="bg-white w-[90%] md:w-[70%] lg:w-[60%] max-w-4xl h-[80%] rounded-lg shadow-xl flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-white">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-100">
                    <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">Subrooms</h2>
                    <p className="text-sm text-gray-500">
                      Room: {clickedRoom.roomName} (Building: {clickedRoom.buildingId})
                    </p>
                  </div>
                </div>
                <button onClick={closeSubroomModal} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-hidden">
                <div className="p-6 h-full overflow-y-auto">
                  {loadingSubrooms ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-gray-600">Loading subrooms...</span>
                      </div>
                    </div>
                  ) : clickedRoomSubrooms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                      </div>
                      <p className="text-lg font-medium">No subrooms found</p>
                      <p className="text-sm">This room doesn't have any subrooms</p>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Available Subrooms</h3>
                        <p className="text-sm text-gray-500">
                          Found {clickedRoomSubrooms.length} subroom{clickedRoomSubrooms.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {clickedRoomSubrooms.map((subroom) => (
                          <div
                            key={subroom.roomId}
                            className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-4"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-800 text-sm mb-1 truncate">{subroom.roomName}</h4>
                                <p className="text-xs text-gray-500 mb-1">Subroom ID: {subroom.roomId}</p>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Capacity:</span>
                                <span className="font-medium text-gray-700">{subroom.roomCapactiy}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Type:</span>
                                <span className="font-medium text-gray-700">{subroom.roomType}</span>
                              </div>
                              {subroom.parentId && (
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-500">Parent Room:</span>
                                  <span className="font-medium text-gray-700">{subroom.parentId}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
