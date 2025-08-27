"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AcademicSession, AcademicYear, RoomInfo } from "@/types";
import { BuildingSVG } from "@/components/BuildingSvg";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { encrypt, decrypt } from "@/utils/encryption";
import {
  AcademicSessionResponse,
  AcademicYearResponse,
} from "@/components/Header";
import { WeekdaySelector } from "@/components/WeekDays";

function RoomPage() {
  const params = useParams();
  const router = useRouter();
  let buildingId = decrypt(params.buildingId?.toString() || "");
  let roomId = decrypt(params.roomId?.toString() || "");
  const [isAllocationFormVisible, setIsAllocationFormVisible] = useState(false);

  const [room, setRoom] = useState<RoomInfo>();
  useEffect(() => {
    const fetchRoomInfo = async (roomId: string) => {
      const requestbody = { roomId: roomId };
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
  }, []);

  const percentage = (room?.occupied || 0) / (room?.capacity || 0);
  const circumference = 2 * Math.PI * 28; // 2 * pi * radius (for a 64px container with 4px border)
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
              {room.floor.toUpperCase()} - Room Details
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
                      {room.roomName.split(" ")[0].substring(0, 3)}
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
                      <p className="text-sm text-gray-500">
                        Currently Occupied
                      </p>
                      <p className="text-lg font-semibold">{room.occupied}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Available Seats</p>
                      <p className="text-lg font-semibold">
                        {room.capacity - room.occupied}
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
                    <button
                      className="mt-4 flex h-fit items-center rounded-md bg-[#F26722] px-4 py-2 text-xs text-white shadow-md transition-all hover:bg-[#a5705a] md:mt-0"
                      onClick={() => {
                        setIsAllocationFormVisible(true);
                      }}
                    >
                      + Add Allocation
                    </button>
                  </div>

                  {room.occupied > 0 ? (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-sm font-medium text-gray-500">
                              Occupant
                            </th>
                            <th className="px-4 py-3 text-sm font-medium text-gray-500">
                              Type
                            </th>
                            <th className="px-4 py-3 text-sm font-medium text-gray-500">
                              Time
                            </th>
                            <th className="px-4 py-3 text-sm font-medium text-gray-500">
                              Duration
                            </th>
                            <th className="px-4 py-3 text-sm font-medium text-gray-500">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {room.occupants && room.occupants.length > 0 ? (
                            room.occupants.map((occupant, index) => (
                              <tr
                                key={index}
                                className="hover:bg-gray-50 text-gray-500"
                              >
                                <td className="px-4 py-3 text-sm">
                                  {occupant.occupantName}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {occupant.type}
                                </td>
                                <td className="px-4 py-3 text-sm whitespace-nowrap">{`${new Date(
                                  occupant.startTime || ""
                                ).getHours()}:${new Date(
                                  occupant.startTime || ""
                                ).getMinutes()} - ${new Date(
                                  occupant.endTime || ""
                                ).getHours()}:${new Date(
                                  occupant.endTime || ""
                                ).getMinutes()}`}</td>
                                <td className="px-4 py-3 text-sm">
                                  {new Date(
                                    occupant.endTime || ""
                                  ).getMilliseconds() -
                                    new Date(
                                      occupant.startTime || ""
                                    ).getMilliseconds()}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <button className="px-2 py-1 bg-red-50 text-red-600 rounded-md text-xs hover:bg-red-100 transition-colors">
                                    Vacate
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={5}
                                className="px-4 py-3 text-sm text-center text-gray-500"
                              >
                                No occupants assigned
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-100 rounded-lg p-4 flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-green-500 mr-2"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-green-700">
                        This room is currently available for allocation
                      </span>
                    </div>
                  )}
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
        />
      )}
    </>
  ) : (
    <div>Room Info Not Found</div>
  );
}

export default RoomPage;

type FormProps = {
  onClose: () => void;
};
function AddAssignmentForm({ onClose }: FormProps) {
  const [academicYear, setAcademicYear] = useState("");
  const [academicSession, setAcademicSession] = useState("");
  const [departmentOrFaculty, setDepartmentOrFaculty] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState("");
  const [purpose, setPurpose] = useState("");
  const [remarks, setRemarks] = useState("");

  // State for custom date fields
  const [dateType, setDateType] = useState("day");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // State for custom time fields
  const [timeType, setTimeType] = useState("fullDay");
  const [customStartTime, setCustomStartTime] = useState("");
  const [customEndTime, setCustomEndTime] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [academicYearsList, setAcademicYearsList] = useState<AcademicYear[]>();
  const [academicSessionsList, setAcademicSessionsList] =
    useState<AcademicSession[]>();
  useEffect(() => {
    const getAcadmicCalender = async () => {
      const responseYear = await callApi<AcademicYearResponse>(
        process.env.NEXT_PUBLIC_GET_ACADMIC_YEARS || URL_NOT_FOUND
      );
      if (responseYear.success) {
        const acadYearsList = responseYear.data?.["Academic Year"]?.reverse();
        setAcademicYearsList(acadYearsList);
      }

      let responseSession = await callApi<AcademicSessionResponse>(
        process.env.NEXT_PUBLIC_GET_ACADMIC_SESSIONS || URL_NOT_FOUND
      );

      if (responseSession.success) {
        setAcademicSessionsList(responseSession.data?.["Academic Session"]);
      }
    };
    getAcadmicCalender();
  }, []);

  const departments = [
    "Computer Science",
    "Electrical Engineering",
    "Mechanical Engineering",
  ];
  const faculties = ["Science", "Arts", "Engineering"];
  const handleSubmit = (e: any) => {
    e.preventDefault();
  };
  return (
    <section className="fixed inset-0 z-50 h-screen w-screen bg-[#00000070] flex items-center justify-center text-gray-500">
      {/* Form container with styling */}
      <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl p-8 transform transition-all duration-300 ease-in-out scale-95 md:scale-100">
        <div className="max-h-[70vh] bg-white overflow-y-scroll  mr-4 pr-2">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition duration-300"
            aria-label="Close"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Form heading */}
          <h2 className="font-semibold text-gray-700 mb-6">Allocate Room</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Department or Faculty Dropdown with Conditional Logic */}
            <div className="flex flex-row">
              <div className="w-full pr-2">
                <label
                  htmlFor="dept-faculty"
                  className="block  text-xs font-medium text-gray-700"
                >
                  Select Department or Faculty
                </label>
                <select
                  id="dept-faculty"
                  name="dept-faculty"
                  className="mt-1 block text-sm w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  value={departmentOrFaculty}
                  onChange={(e) => {
                    setDepartmentOrFaculty(e.target.value);
                    setSelectedDepartment(""); // Reset conditional dropdowns
                    setSelectedFaculty("");
                  }}
                  required
                >
                  <option value="" disabled>
                    Select an option
                  </option>
                  <option value="department">Department</option>
                  <option value="faculty">Faculty</option>
                </select>
              </div>

              {/* Conditional Dropdown for Departments */}
              {departmentOrFaculty === "department" && (
                <div className="w-full">
                  <label
                    htmlFor="department"
                    className="block  text-xs font-medium text-gray-700"
                  >
                    Select Department
                  </label>
                  <select
                    id="department"
                    name="department"
                    className="mt-1 block text-sm w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select a department
                    </option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Conditional Dropdown for Faculties */}
              {departmentOrFaculty === "faculty" && (
                <div className="w-full">
                  <label
                    htmlFor="faculty"
                    className="block  text-xs font-medium text-gray-700"
                  >
                    Select Faculty
                  </label>
                  <select
                    id="faculty"
                    name="faculty"
                    className="mt-1 block w-full text-sm px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                    value={selectedFaculty}
                    onChange={(e) => setSelectedFaculty(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select a faculty
                    </option>
                    {faculties.map((faculty) => (
                      <option key={faculty} value={faculty}>
                        {faculty}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              {dateType !== "custom" ? (
                <div>
                  <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 w-full">
                    <div className="flex flex-col space-y-4 md:space-y-0 md:space-x-4 w-1/2">
                      <label className="block text-sm text-gray-700">
                        Date
                      </label>
                      <select
                        className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                        value={dateType}
                        onChange={(e) => setDateType(e.target.value)}
                      >
                        <option value="day">Day</option>
                        <option value="week">Week</option>
                        <option value="month">Month</option>
                        <option value="activeSession">Active Session</option>
                        <option value="custom">Custom Range</option>
                      </select>
                    </div>
                    {(dateType === "day" ||
                      dateType === "week" ||
                      dateType === "month") && (
                      <div className="w-full md:w-1/2 mt-1">
                        <label className="block text-xs text-gray-500">
                          Start Date
                        </label>
                        <input
                          type="date"
                          className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row md:space-x-4">
                  <div className="md:w-1/2 w-full">
                    <label className="block text-sm text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div className="md:w-1/2 w-full mt-4 md:mt-0">
                    <label className="block text-sm text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                  <div className="mt-3 md:mt-0 flex items-end">
                    <button
                      type="button"
                      className="px-3 py-2 text-xs bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                      onClick={() => {
                        setDateType("day");
                        setCustomStartDate("");
                        setCustomEndDate("");
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
              {dateType !== "day" && (
                <div className="mt-4">
                  <label className="block text-sm text-gray-700 mb-1">
                    Recurrance
                  </label>
                  <WeekdaySelector
                    value={selectedDays}
                    onChange={setSelectedDays}
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-700">Time</label>
              {timeType !== "custom" ? (
                <div className="flex space-x-4">
                  <select
                    className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                    value={timeType}
                    onChange={(e) => setTimeType(e.target.value)}
                  >
                    <option value="fullDay">Full Day</option>
                    <option value="firstHalf">First Half</option>
                    <option value="secondHalf">Second Half</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row md:space-x-4">
                  <div className="md:w-1/2 w-full">
                    <label className="block text-xs text-gray-500 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      value={customStartTime}
                      onChange={(e) => setCustomStartTime(e.target.value)}
                    />
                  </div>
                  <div className="md:w-1/2 w-full mt-4 md:mt-0">
                    <label className="block text-xs text-gray-500 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      value={customEndTime}
                      onChange={(e) => setCustomEndTime(e.target.value)}
                    />
                  </div>
                  <div className="mt-3 md:mt-0 flex items-end">
                    <button
                      type="button"
                      className="px-3 py-2 text-xs bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                      onClick={() => {
                        setTimeType("fullDay");
                        setCustomStartTime("");
                        setCustomEndTime("");
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-700">Keys</label>
              <input
                className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                type="text"
                placeholder="Assigned Key numbers e.g.: 002,005"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm text-gray-700">Remarks</label>
              <textarea
                className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                rows={3}
                placeholder="Remarks"
              />
            </div>
            {/* Form submission button */}
            <div className="flex justify-center">
              <button
                type="submit"
                className="px-3 py-2 bg-[#F26722] text-white rounded-lg shadow-md hover:bg-[#a5705a] transition duration-300 mb-6"
              >
                Allocate
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
