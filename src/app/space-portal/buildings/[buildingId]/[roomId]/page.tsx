"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RoomInfo } from "@/types";
import { BuildingSVG } from "@/components/BuildingSvg";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { encrypt, decrypt } from "@/utils/encryption";
import { useSelector } from "react-redux";
import WeeklyTimetable from "./WeeklyTimetable";
import AddAssignmentForm from "./AddAssignmentForm";

function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const userRole = useSelector((state: any) => state.dataState.userRole);
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
  let roomId = decrypt(params.roomId?.toString() || "");
  const [isAllocationFormVisible, setIsAllocationFormVisible] = useState(false);
  const [room, setRoom] = useState<RoomInfo>();
  const [startDate, setStartDate] = useState(() => new Date());
  const [selectedSlot, setSelectedSlot] = useState<{
    date: Date;
    start: string;
    end: string;
  } | null>(null);

  useEffect(() => {
    if (
      !acadmeicYear &&
      !acadmeicSession &&
      !academicSessionStartDate &&
      !academicSessionEndDate
    )
      return;
    const fetchRoomInfo = async (roomId: string) => {
      const requestbody = {
        roomID: roomId,
        subroomID: 0,
        academicYr: acadmeicYear,
        acadSess: acadmeicSession,
        startDate: academicSessionStartDate,
        endDate: academicSessionEndDate,
      };
      let response = callApi<RoomInfo>(
        process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND,
        requestbody
      );
      let res = await response;
      if (res.success) {
        let room = res.data;
        setRoom(room);
      }
    };
    fetchRoomInfo(roomId);
  }, [
    acadmeicYear,
    acadmeicSession,
    academicSessionStartDate,
    academicSessionEndDate,
  ]);

  const percentage = (room?.occupied || 0) / (room?.capacity || 0);
  const circumference = 2 * Math.PI * 28;
  const strokeDashoffset = circumference - percentage * circumference;
  const borderColor =
    room?.occupied === 0
      ? "text-green-400"
      : (room?.occupied || 0) >= (room?.capacity || 0) * 0.8
      ? "text-red-500"
      : "text-yellow-400";

  return room ? (
    <>
      <section className="bg-white w-full">
        <div className="flex justify-between">
          <div>
            <h4 className="text-base font-semibold text-gray-800 md:ml-2">
              {room?.floor?.toUpperCase()} - Room Details
            </h4>
            <span className="text-xs font-semibold text-gray-500 md:ml-2">
              {room.building}
            </span>
          </div>
          <button
            className="mt-4 flex h-fit items-center rounded-md bg-[#F26722] px-4 py-2 text-xs text-white shadow-md transition-all hover:bg-[#a5705a] md:mt-0"
            onClick={() => {
              router.back();
            }}
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
                        room?.occupied === 0
                          ? "bg-green-500"
                          : room.occupied >= room.capacity * 0.8
                          ? "bg-orange-500"
                          : "bg-yellow-500"
                      }`}
                    >
                      {room?.roomName?.split(" ")[0].substring(0, 3)}
                    </div>
                    <div className="ml-4">
                      <h2 className="text font-[500] text-gray-600">
                        {room.roomName}
                      </h2>
                      <div className="flex items-center mt-1">
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            room.occupied === 0
                              ? "bg-green-100 text-green-800"
                              : room.occupied >= room.capacity * 0.8
                              ? "bg-red-100 text-orange-500"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {room.occupied === 0
                            ? "Available"
                            : room.occupied >= room.capacity * 0.8
                            ? "High Occupancy"
                            : "Moderate Occupancy"}
                        </span>
                        <span className="mx-2 text-gray-400">•</span>
                        <span className="text-xs text-gray-600">
                          Room ID: {room.id}
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
                      <p className="text-lg font-semibold">{room.capacity}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Today's Bookings</p>
                      <p className="text-lg font-semibold">{room.occupied}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Room Area</p>
                      <p className="text-lg font-semibold">
                        {/* {room.capacity - room.occupied} */}
                        40
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Room Type</p>
                      <p className="text-lg font-semibold">{room.roomType}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="flex flex-row justify-between">
                    <h3 className="text-lg font-semibold mb-4 text-gray-500">
                      Current Assignment
                    </h3>
                    {room.managedBy?.split("|").includes(userRole) && (
                      <button
                        className="mt-4 flex h-fit items-center rounded-md bg-[#F26722] px-4 py-2 text-xs text-white shadow-md transition-all hover:bg-[#a5705a] md:mt-0"
                        onClick={() => {
                          setIsAllocationFormVisible(true);
                        }}
                      >
                        + Add Allocation
                      </button>
                    )}
                  </div>

                  {/* Replace this table with WeeklyTimetable */}
                  <WeeklyTimetable
                    startDate={startDate}
                    setStartDate={setStartDate}
                    occupants={room.occupants || []}
                    academicSessionStartDate={academicSessionStartDate || ""}
                    academicSessionEndDate={academicSessionEndDate || ""}
                    onClickTimeTableSlot={(date, slot) => {
                      setSelectedSlot({
                        date,
                        start: slot.start,
                        end: slot.end,
                      });
                      setIsAllocationFormVisible(true);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {isAllocationFormVisible && (
        <AddAssignmentForm
          onClose={() => {
            setIsAllocationFormVisible(false);
          }}
          // roomOccupants={room.occupants || []}
          // academicSessionStartDate={academicSessionStartDate || ""}
          // academicSessionEndDate={academicSessionEndDate || ""}
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
