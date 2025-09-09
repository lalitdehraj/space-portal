"use client";
import React, { useEffect, useState } from "react";
import moment from "moment";
import { Building, Room, RoomInfo } from "@/types";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { useSelector } from "react-redux";

export function AdvancedSearch({ onClose }: { onClose: () => void }) {
  const academicYear = useSelector(
    (state: any) => state.dataState.selectedAcademicYear
  );
  const acadSession = useSelector(
    (state: any) => state.dataState.selectedAcademicSession
  );
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

  // Load buildings + rooms
  useEffect(() => {
    const fetchBuildingsAndRooms = async () => {
      try {
        setLoading(true);
        const buildingsRes = await callApi<Building[]>(
          process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND,
          {
            acadSession: `${acadSession}`,
            acadYear: `${academicYear}`,
          }
        );
        if (!buildingsRes.success) return;
        setBuildings(buildingsRes.data || []);

        const rooms: Room[] = [];
        for (const b of buildingsRes.data || []) {
          for (const f of b.floors) {
            const res = await callApi<Room[]>(
              process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND,
              {
                buildingNo: b.id,
                floorID: f.id,
                curreentTime: moment().format("HH:mm"),
              }
            );
            if (res.success && res.data) rooms.push(...res.data);
          }
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
          const res = await callApi<RoomInfo>(
            process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND,
            {
              roomID: room.parentId ?? room.roomId,
              subroomID: room.parentId ? room.roomId : 0,
              academicYr: academicYear,
              acadSess: acadSession,
              startDate,
              endDate,
            }
          );
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
      const sameDay = moment(occ.scheduledDate).isBetween(
        startDate,
        endDate,
        "day",
        "[]"
      );
      if (!sameDay) return false;

      const occStart = moment(occ.startTime, "HH:mm");
      const occEnd = moment(occ.endTime, "HH:mm");
      const checkStart = moment(startTime, "HH:mm");
      const checkEnd = moment(endTime, "HH:mm");

      return checkStart.isBefore(occEnd) && checkEnd.isAfter(occStart);
    });
  };

  // Filter function
  const handleSearch = () => {
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

    const results = allRooms.filter((room) => {
      if (capacity && room.roomCapactiy < parseInt(capacity)) return false;
      if (status && room.status?.toLowerCase() !== status?.toLowerCase())
        return false;
      if (roomType && room.roomType?.toLowerCase() !== roomType?.toLowerCase())
        return false;
      if (availabilityOn && !isRoomAvailable(room.roomId)) return false;
      return true;
    });
    setFilteredRooms(results);
  };

  const today = moment().format("YYYY-MM-DD"); // today
  const nowTime = moment().format("HH:mm"); // current time

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50 text-gray-600">
      <div className="bg-white w-[95%] md:w-[85%] h-[90%] rounded-lg shadow-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-700 ">
            Advanced Search
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Filters */}
          <div className="w-full md:w-80 border-r p-4 bg-gray-50 flex flex-col space-y-4 overflow-y-auto">
            <h3 className="font-semibold text-gray-700 text-sm">Filters</h3>

            <div className="flex flex-col space-y-2">
              <label className="text-xs font-medium">Capacity</label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-orange-400"
              />
            </div>

            <div className="flex flex-col space-y-2">
              <label className="text-xs font-medium">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-orange-400"
              >
                <option value="">All</option>
                <option value="maintenance">Maintenance</option>
                <option value="allocated">Allocated</option>
                <option value="unallocated">Unallocated</option>
              </select>
            </div>

            <div className="flex flex-col space-y-2">
              <label className="text-xs font-medium">Room Type</label>
              <select
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-orange-400"
              >
                <option value="">All</option>
                {[...new Set(allRooms.map((r) => r.roomType))].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={availabilityOn}
                onChange={() => setAvailabilityOn(!availabilityOn)}
              />
              <span className="text-sm font-medium text-orange-600">
                Available
              </span>
            </div>
            {availabilityOn && (
              <div className="flex flex-col space-y-2">
                <input
                  type="date"
                  value={startDate}
                  min={today} // prevent past dates
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm"
                />
                <input
                  type="date"
                  value={endDate}
                  min={startDate || today} // end date cannot be before start date
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm"
                />
                <div className="flex space-x-2">
                  <input
                    type="time"
                    value={startTime}
                    min={startDate === today ? nowTime : "00:00"} // prevent past time if today
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-1/2 border rounded px-2 py-1 text-sm"
                  />
                  <input
                    type="time"
                    value={endTime}
                    min={startTime} // endTime cannot be before startTime
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-1/2 border rounded px-2 py-1 text-sm"
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleSearch}
              className="mt-auto bg-orange-500 text-white py-2 rounded hover:bg-orange-600 text-sm font-medium"
            >
              Search
            </button>
          </div>

          {/* Results */}
          <div className="flex-1 p-4 overflow-y-auto">
            {loading ? (
              <p>Loading rooms...</p>
            ) : filteredRooms.length === 0 ? (
              <p className="text-sm text-gray-500">
                No rooms match the filters.
              </p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {filteredRooms.map((room) => (
                  <li
                    key={room.roomId}
                    className="p-4 border border-orange-600 rounded-lg shadow-sm hover:shadow-md transition bg-white flex flex-col justify-between"
                  >
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-1">
                        {room.roomName}
                      </h4>
                      <p className="text-xs text-gray-500 mb-1">
                        Capacity: {room.roomCapactiy}
                      </p>
                      <p className="text-xs mb-1">
                        Status:{" "}
                        <span
                          className={`px-2 py-0.5 rounded text-white text-[10px] ${
                            room.status === "allocated"
                              ? "bg-green-500"
                              : room.status === "maintenance"
                              ? "bg-red-500"
                              : "bg-gray-400"
                          }`}
                        >
                          {room.status}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 mb-1">
                        Type: {room.roomType}
                      </p>
                    </div>
                    {availabilityOn && (
                      <p
                        className={`text-xs font-semibold mt-2 ${
                          isRoomAvailable(room.roomId)
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {isRoomAvailable(room.roomId)
                          ? "Available"
                          : "Not Available"}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
