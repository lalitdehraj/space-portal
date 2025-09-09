"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Building, Occupant, RoomInfo, SpaceAllocation } from "@/types";
import { BuildingSVG } from "@/components/BuildingSvg";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { decrypt } from "@/utils/encryption";
import { useSelector } from "react-redux";
import WeeklyTimetable from "./WeeklyTimetable";
import AddAssignmentForm from "./AddAssignmentForm";
import moment from "moment";

function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const userRole = useSelector((state: any) => state.dataState.userRole);
  const [isManagedByThisUser, setIsManagedByThisUser] = useState(false);
  const acadmeicYear = useSelector(
    (state: any) => state.dataState.selectedAcademicYear
  );
  const acadmeicSession = useSelector(
    (state: any) => state.dataState.selectedAcademicSession
  );
  const academicSessionStartDate = useSelector(
    (state: any) => state.dataState.selectedAcademicSessionStartDate
  );
  const academicSessionEndDate = useSelector(
    (state: any) => state.dataState.selectedAcademicSessionEndDate
  );

  const string = decrypt(params.roomId?.toString() || "");
  const buildingId = decrypt(params.buildingId?.toString() || "");
  const roomId = string.split("|")?.[0];
  const subRoomId = string.split("|")?.[1];

  const [isAllocationFormVisible, setIsAllocationFormVisible] = useState(false);
  const [roomInfo, setRoomInfo] = useState<RoomInfo>();
  const [startDate, setStartDate] = useState(() => new Date());
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    start: string;
    end: string;
  } | null>(null);
  const [allBuildingsData, setAllBuildingsData] = useState<Building[]>([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState(() =>
    moment().startOf("isoWeek").toDate()
  );

  const MAX_WEEKLY_MINUTES = 63 * 60; // adjustable max weekly minutes

  /** Fetch all buildings */
  useEffect(() => {
    const fetchBuildings = async () => {
      if (!acadmeicSession && !acadmeicYear) return;
      try {
        const reqBody = {
          acadSession: `${acadmeicSession}`,
          acadYear: `${acadmeicYear}`,
        };
        const response = await callApi<Building[]>(
          process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND,
          reqBody
        );
        if (response.success) setAllBuildingsData(response.data || []);
      } catch (error) {
        console.error("Error fetching buildings:", error);
      }
    };
    fetchBuildings();
  }, [acadmeicSession, acadmeicYear]);

  /** Fetch room info */
  const fetchRoomInfo = async () => {
    if (
      !roomId ||
      !acadmeicYear ||
      !acadmeicSession ||
      !academicSessionStartDate ||
      !academicSessionEndDate
    )
      return;
    const requestbody = {
      roomID: roomId,
      subroomID: subRoomId ?? 0,
      academicYr: acadmeicYear,
      acadSess: acadmeicSession,
      startDate: academicSessionStartDate,
      endDate: academicSessionEndDate,
    };
    try {
      const res = await callApi<RoomInfo>(
        process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND,
        requestbody
      );
      const isAllocationAllowed = res.data?.managedBy?.split("|").some((d) => {
        return d.toUpperCase() === userRole?.toUpperCase();
      });
      console.log(isAllocationAllowed);
      setIsManagedByThisUser(isAllocationAllowed || false);
      if (res.success) setRoomInfo(res.data);
    } catch (error) {
      console.error("Error fetching room info:", error);
    }
  };

  useEffect(() => {
    if (
      acadmeicYear &&
      acadmeicSession &&
      academicSessionStartDate &&
      academicSessionEndDate
    ) {
      fetchRoomInfo();
    }
  }, [
    acadmeicYear,
    acadmeicSession,
    academicSessionStartDate,
    academicSessionEndDate,
  ]);

  /** Handle timetable slot click */
  const handleTimeTableClick = (
    date: string,
    slot: { start: string; end: string }
  ) => {
    if (isManagedByThisUser) {
      const slotDate = moment(date);
      const startSlotTime = moment(slot.start, "HH:mm");
      const exactSlotStartTime = slotDate
        .hour(startSlotTime.hour())
        .minute(startSlotTime.minute());
      setSelectedSlot({
        date,
        start: moment().isSameOrBefore(exactSlotStartTime)
          ? slot.start
          : moment().format("HH:mm"),
        end: slot.end,
      });
      setIsAllocationFormVisible(true);
    } else {
      alert("You cannot manage this room !");
    }
  };

  /** Handle space allocations */
  const handleSpaceAllocations = async (allocations: SpaceAllocation[]) => {
    let allSucceeded = true;
    for (const allocation of allocations) {
      try {
        const response = await callApi<any>(
          process.env.NEXT_PUBLIC_INSERT_SPACE_ALLOCATION_ENTRY ||
            URL_NOT_FOUND,
          allocation
        );
        if (!response?.data) {
          console.warn("Insert failed for allocation:", allocation, response);
          allSucceeded = false;
        }
      } catch (error) {
        console.error("Error inserting allocation:", allocation, error);
        allSucceeded = false;
      }
    }
    if (allSucceeded) fetchRoomInfo();
  };

  /** Weekly occupancy calculation based on selected week */
  const startOfSelectedWeek = moment(selectedWeekStart).startOf("isoWeek");
  const endOfSelectedWeek = moment(selectedWeekStart).endOf("isoWeek");

  const weeklyOccupants =
    roomInfo?.occupants?.filter((o: Occupant) => {
      if (!o.scheduledDate) return false;
      const scheduled = moment(o.scheduledDate);
      return scheduled.isBetween(
        startOfSelectedWeek,
        endOfSelectedWeek,
        "day",
        "[]"
      );
    }) || [];

  const weeklyOccupancy = weeklyOccupants.length;

  const totalMinutes = weeklyOccupants.reduce((sum, occupant) => {
    if (!occupant.startTime || !occupant.endTime) return sum;
    const start = moment(occupant.startTime, "HH:mm");
    const end = moment(occupant.endTime, "HH:mm");
    return sum + Math.max(end.diff(start, "minutes"), 0);
  }, 0);

  const percentage = (totalMinutes || 0) / MAX_WEEKLY_MINUTES;
  const circumference = 2 * Math.PI * 28;
  const strokeDashoffset = circumference - percentage * circumference;
  const borderColor =
    roomInfo?.occupied === 0
      ? "text-green-400"
      : totalMinutes >= MAX_WEEKLY_MINUTES * 0.8
      ? "text-red-500"
      : "text-yellow-400";

  return roomInfo ? (
    <>
      <section className="bg-white w-full">
        <div className="flex justify-between">
          <div>
            <h4 className="text-base font-semibold text-gray-800 md:ml-2">
              {allBuildingsData
                .filter((b) => b.id === roomInfo.building)?.[0]
                .floors.filter((f) => f.id === roomInfo.floor)?.[0]
                .name.toUpperCase()}{" "}
              - Room Details
            </h4>
            <span className="text-xs font-semibold text-gray-500 md:ml-2">
              {
                allBuildingsData.filter((b) => b.id === roomInfo.building)?.[0]
                  ?.name
              }
            </span>
          </div>
          <button
            className="mt-4 flex h-fit items-center rounded-md bg-[#F26722] px-4 py-2 text-xs text-white shadow-md transition-all hover:bg-[#a5705a] md:mt-0"
            onClick={() => router.back()}
          >
            <BuildingSVG className="mr-2 h-4 w-4 fill-white" />
            Back
          </button>
        </div>

        <div className="mt-2">
          <div className="lg:col-span-2">
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold ${
                        weeklyOccupancy === 0
                          ? "bg-green-500"
                          : weeklyOccupancy >= 63 * 0.8
                          ? "bg-orange-500"
                          : "bg-yellow-500"
                      }`}
                    >
                      {roomInfo?.roomName?.split(" ")[0].substring(0, 3)}
                    </div>
                    <div className="ml-4">
                      <h2 className="text font-[500] text-gray-600">
                        {roomInfo.roomName}
                      </h2>
                      <div className="flex items-center mt-1">
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            weeklyOccupancy === 0
                              ? "bg-green-100 text-green-800"
                              : weeklyOccupancy >= 63 * 0.8
                              ? "bg-red-100 text-orange-500"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {weeklyOccupancy === 0
                            ? "Available"
                            : weeklyOccupancy >= 63 * 0.8
                            ? "High Occupancy"
                            : "Moderate Occupancy"}
                        </span>
                        <span className="mx-2 text-gray-400">•</span>
                        <span className="text-xs text-gray-600">
                          Room ID: {roomInfo.id}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-4 border-gray-100 relative">
                      <div>
                        <div className="relative w-16 h-16">
                          <svg
                            className="w-full h-full transform -rotate-90"
                            viewBox="0 0 64 64"
                          >
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              strokeWidth="4"
                              className="stroke-current text-gray-200"
                              fill="transparent"
                            />
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              strokeWidth="4"
                              strokeDasharray={circumference}
                              strokeDashoffset={strokeDashoffset}
                              strokeLinecap="round"
                              className={`transition-all duration-1000 ease-out ${borderColor} stroke-current`}
                              fill="transparent"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center font-bold text-lg text-gray-500">
                            {Math.round(percentage * 100)}%
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Occupancy</p>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-6 text-gray-500">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-sm text-gray-500">Capacity</p>
                      <p className="text-lg font-semibold">
                        {roomInfo.capacity}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Today's Bookings</p>
                      <p className="text-lg font-semibold">
                        {
                          roomInfo.occupants?.filter(
                            (o) =>
                              moment().format("YYYY-MM-DD") ===
                              moment(new Date(o.scheduledDate)).format(
                                "YYYY-MM-DD"
                              )
                          ).length
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Room Area</p>
                      <p className="text-lg font-semibold">{`${roomInfo.roomArea} Sq. ft.`}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Room Type</p>
                      <p className="text-lg font-semibold">
                        {roomInfo.roomType}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="flex flex-row justify-between">
                    <h3 className="text-lg font-semibold mb-4 text-gray-500">
                      Current Assignment
                    </h3>
                    {roomInfo.managedBy?.split("|").includes(userRole) && (
                      <button
                        className="mt-4 flex h-fit items-center rounded-md bg-[#F26722] px-4 py-2 text-xs text-white shadow-md transition-all hover:bg-[#a5705a] md:mt-0"
                        onClick={() => setIsAllocationFormVisible(true)}
                      >
                        + Add Allocation
                      </button>
                    )}
                  </div>

                  <WeeklyTimetable
                    startDate={startDate}
                    isManagedByThisUser={isManagedByThisUser}
                    refreshData={() => fetchRoomInfo()}
                    setStartDate={(date) => {
                      setStartDate(date);
                      setSelectedWeekStart(
                        moment(date).startOf("isoWeek").toDate()
                      );
                    }}
                    occupants={roomInfo.occupants || []}
                    academicSessionStartDate={academicSessionStartDate || ""}
                    academicSessionEndDate={academicSessionEndDate || ""}
                    onClickTimeTableSlot={handleTimeTableClick}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {isAllocationFormVisible && (
        <AddAssignmentForm
          buildingId={buildingId}
          onSuccessfulSlotsCreation={handleSpaceAllocations}
          onClose={() => setIsAllocationFormVisible(false)}
          occupants={roomInfo.occupants || []}
          roomId={subRoomId ? subRoomId : roomId}
          initialDate={selectedSlot?.date}
          initialStartTime={selectedSlot?.start}
          initialEndTime={selectedSlot?.end}
        />
      )}
    </>
  ) : (
    <div>Room Info Not Found</div>
  );
}

export default RoomPage;
