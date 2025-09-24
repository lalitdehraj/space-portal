"use client";
import React, { useEffect, useState } from "react";
import moment from "moment";
import { Building, Room, RoomInfo } from "@/types";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { useSelector } from "react-redux";

export function AdvancedSearch({ onClose }: { onClose: () => void }) {
  const academicYear = useSelector((state: any) => state.dataState.selectedAcademicYear);
  const acadSession = useSelector((state: any) => state.dataState.selectedAcademicSession);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [roomInfos, setRoomInfos] = useState<Record<string, RoomInfo>>({});
  const [loading, setLoading] = useState(false);

  // Filters
  const [capacity, setCapacity] = useState("");
  const [status, setStatus] = useState<string>("");
  const [roomType, setRoomType] = useState<string>("");
  const [availabilityOn, setAvailabilityOn] = useState(false);
  const [startDate, setStartDate] = useState(moment().format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(moment().format("YYYY-MM-DD"));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [subroomsForAdvancedSearch, setSubroomsForAdvancedSearch] = useState<Room[]>([]);
  const [loadingSubrooms, setLoadingSubrooms] = useState(false);

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
        setFilteredRooms(rooms); // Show all rooms initially
      } catch (err) {
        console.error("Error fetching buildings/rooms:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBuildingsAndRooms();
  }, [acadSession, academicYear]);

  // Fetch room info for availability
  useEffect(() => {
    const fetchRoomInfos = async () => {
      if (!availabilityOn) return;
      if (Object.keys(roomInfos).length > 0) return;

      try {
        const infos: Record<string, RoomInfo> = {};
        for (const room of allRooms) {
          const res = await callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, {
            roomID: room.parentId ?? room.roomId,
            subroomID: room.parentId ? room.roomId : 0,
            academicYr: academicYear,
            acadSess: acadSession,
            startDate,
            endDate,
          });
          if (res.success && res.data) {
            infos[room.roomId] = res.data;
          }
        }
        setRoomInfos(infos);
      } catch (err) {
        console.error("Error fetching room info:", err);
      }
    };

    fetchRoomInfos();
  }, [availabilityOn, allRooms, startDate, endDate]);

  console.log(roomInfos);
  // Availability check
  const isRoomAvailable = (roomId: string) => {
    const info = roomInfos[roomId];
    if (!info || !info.occupants) return true;

    return !info.occupants.some((occ) => {
      const sameDay = moment(occ.scheduledDate).isBetween(startDate, endDate, "day", "[]");
      if (!sameDay) return false;

      const occStart = moment(occ.startTime, "HH:mm");
      const occEnd = moment(occ.endTime, "HH:mm");
      const checkStart = moment(startTime, "HH:mm");
      const checkEnd = moment(endTime, "HH:mm");

      return checkStart.isBefore(occEnd) && checkEnd.isAfter(occStart);
    });
  };

  // Filter function
  const handleSearch = async () => {
    if (availabilityOn) {
      const now = moment();
      const start = moment(`${startDate} ${startTime}`);
      const end = moment(`${endDate} ${endTime}`);

      if (start.isBefore(now)) {
        alert("Start date/time cannot be in the past.");
        return;
      }
      if (end.isBefore(start)) {
        alert("End date/time cannot be before start date/time.");
        return;
      }
    }

    // Filter rooms based on criteria
    const matchingRooms = allRooms.filter((room) => {
      if (capacity && room.roomCapactiy < parseInt(capacity)) return false;
      if (status && room.status?.toLowerCase() !== status?.toLowerCase()) return false;
      if (roomType && room.roomType?.toLowerCase() !== roomType?.toLowerCase()) return false;
      if (availabilityOn && !isRoomAvailable(room.roomId)) return false;
      return true;
    });

    // Separate parent rooms from regular rooms
    const parentRooms = matchingRooms.filter((room) => room.hasSubroom);
    const regularRooms = matchingRooms.filter((room) => !room.hasSubroom);

    // Set regular rooms first
    setFilteredRooms(regularRooms);

    // Fetch subrooms for parent rooms
    if (parentRooms.length > 0) {
      setLoadingSubrooms(true);

      // Add 250ms delay before making API calls
      await new Promise((resolve) => setTimeout(resolve, 250));

      try {
        // Get unique buildings from parent rooms
        const uniqueBuildings = [...new Set(parentRooms.map((room) => room.buildingId))];

        // Fetch all subrooms for each building at once using blank roomID
        const buildingSubroomPromises = uniqueBuildings.map(async (buildingId) => {
          const response = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_SUBROOMS_LIST || URL_NOT_FOUND, {
            roomID: "", // Use blank roomID to get all subrooms for the building
            buildingNo: buildingId,
            acadSess: acadSession,
            acadYr: academicYear,
          });
          return response.success ? response.data || [] : [];
        });

        const buildingSubroomArrays = await Promise.all(buildingSubroomPromises);
        const allBuildingSubrooms = buildingSubroomArrays.flat();

        // Filter subrooms that belong to the parent rooms we're searching for
        const relevantSubrooms = allBuildingSubrooms.filter((subroom) => parentRooms.some((parentRoom) => parentRoom.roomId === subroom.parentId));

        setSubroomsForAdvancedSearch(relevantSubrooms);

        // Update filtered rooms to include subrooms
        setFilteredRooms([...regularRooms, ...relevantSubrooms]);
      } catch (error) {
        console.error("Error fetching subrooms for advanced search:", error);
        setSubroomsForAdvancedSearch([]);
      } finally {
        setLoadingSubrooms(false);
      }
    } else {
      setSubroomsForAdvancedSearch([]);
    }
  };

  const today = moment().format("YYYY-MM-DD"); // today
  const nowTime = moment().format("HH:mm"); // current time

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-white w-[95%] md:w-[90%] h-[90%] rounded-lg shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
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
                    <option value="">All Status</option>
                    <option value="allocated">Allocated</option>
                    <option value="unallocated">Unallocated</option>
                    <option value="maintenance">Maintenance</option>
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
                    {[...new Set(allRooms.map((r) => r.roomType))].map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Availability Filter */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="availability"
                      checked={availabilityOn}
                      onChange={() => setAvailabilityOn(!availabilityOn)}
                      className="w-4 h-4 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 focus:ring-2"
                    />
                    <label htmlFor="availability" className="text-sm font-medium text-gray-700">
                      Check Availability
                    </label>
                  </div>

                  {availabilityOn && (
                    <div className="space-y-3 pl-7">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Date Range</label>
                        <div className="space-y-2">
                          <input
                            type="date"
                            value={startDate}
                            min={today}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          />
                          <input
                            type="date"
                            value={endDate}
                            min={startDate || today}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Time Range</label>
                        <div className="flex space-x-2">
                          <input
                            type="time"
                            value={startTime}
                            min={startDate === today ? nowTime : "00:00"}
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
                  )}
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
                {loading || loadingSubrooms ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-gray-600">Loading rooms...</span>
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
                      const occupancyStatus = room.occupied / room.roomCapactiy;
                      const statusColor = occupancyStatus <= 0.1 ? "green" : occupancyStatus > 0.8 ? "red" : "yellow";

                      return (
                        <div
                          key={room.roomId}
                          className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
                        >
                          <div className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-800 text-sm mb-1 truncate">{room.roomName}</h4>
                                <p className="text-xs text-gray-500 mb-1">Building ID: {room.buildingId}</p>
                              </div>
                              <div
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  room.status === "allocated"
                                    ? "bg-green-100 text-green-800"
                                    : room.status === "maintenance"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {room.status}
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
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Occupied:</span>
                                <span className="font-medium text-gray-700">{room.occupied}</span>
                              </div>
                            </div>

                            {/* Occupancy Progress Bar */}
                            <div className="mt-3">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-500">Occupancy</span>
                                <span
                                  className={`font-medium ${
                                    statusColor === "green" ? "text-green-600" : statusColor === "red" ? "text-red-600" : "text-yellow-600"
                                  }`}
                                >
                                  {Math.round(occupancyStatus * 100)}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    statusColor === "green" ? "bg-green-500" : statusColor === "red" ? "bg-red-500" : "bg-yellow-500"
                                  }`}
                                  style={{ width: `${Math.min(occupancyStatus * 100, 100)}%` }}
                                ></div>
                              </div>
                            </div>

                            {/* Availability Status */}
                            {availabilityOn && (
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                <div
                                  className={`flex items-center space-x-2 text-xs font-medium ${
                                    isRoomAvailable(room.roomId) ? "text-green-600" : "text-red-600"
                                  }`}
                                >
                                  <div className={`w-2 h-2 rounded-full ${isRoomAvailable(room.roomId) ? "bg-green-500" : "bg-red-500"}`}></div>
                                  <span>{isRoomAvailable(room.roomId) ? "Available" : "Not Available"}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
