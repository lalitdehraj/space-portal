"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Occupant, RoomInfo, SpaceAllocation, Maintenance } from "@/types";
import { BuildingSVG } from "@/components/BuildingSvg";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { decrypt } from "@/utils/encryption";
import { useSelector } from "react-redux";
import { useBuildingsData } from "@/hooks/useBuildingsData";
import WeeklyTimetable from "./WeeklyTimetable";
import AddAssignmentForm from "./AddAssignmentForm";
import CabinWorkstationAllocationForm from "./CabinWorkstationAllocationForm";
import moment from "moment";
import { RootState } from "@/app/store";

function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const userRole = useSelector((state: RootState) => state.dataState.userRole);
  const [isManagedByThisUser, setIsManagedByThisUser] = useState(false);
  const acadmeicYear = useSelector((state: RootState) => state.dataState.selectedAcademicYear);
  const acadmeicSession = useSelector((state: RootState) => state.dataState.selectedAcademicSession);
  const academicSessionStartDate = useSelector((state: RootState) => state.dataState.selectedAcademicSessionStartDate);
  const academicSessionEndDate = useSelector((state: RootState) => state.dataState.selectedAcademicSessionEndDate);
  const isActiveSession = useSelector((state: RootState) => state.dataState.isActiveSession);
  const string = decrypt(params.roomId?.toString() || "");
  const buildingId = decrypt(params.buildingId?.toString() || "");
  const roomId = string.split("|")?.[0];
  const subRoomId = string.split("|")?.[1];

  const [isAllocationFormVisible, setIsAllocationFormVisible] = useState(false);
  const [isCabinWorkstationFormVisible, setIsCabinWorkstationFormVisible] = useState(false);
  const [roomInfo, setRoomInfo] = useState<RoomInfo>();
  const [startDate, setStartDate] = useState(() => new Date());
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    start: string;
    end: string;
  } | null>(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => moment().startOf("isoWeek").toDate());
  const [maintenanceData, setMaintenanceData] = useState<Maintenance[]>([]);
  const [editingOccupant, setEditingOccupant] = useState<Occupant | null>(null);
  const [editFormData, setEditFormData] = useState({
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
  });

  // Use custom hook for buildings data
  const { buildings: allBuildingsData } = useBuildingsData();

  const MAX_WEEKLY_MINUTES = 63 * 60; // adjustable max weekly minutes

  /** Fetch room info */
  const fetchRoomInfo = async () => {
    if (!roomId || !acadmeicYear || !acadmeicSession || !academicSessionStartDate || !academicSessionEndDate) return;
    const requestbody = {
      roomID: roomId,
      subroomID: subRoomId ?? "",
      academicYr: acadmeicYear,
      acadSess: acadmeicSession,
      startDate: academicSessionStartDate,
      endDate: academicSessionEndDate,
    };
    try {
      const res = await callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, requestbody);
      const isAllocationAllowed = res.data?.managedBy?.split("|").some((d) => {
        return userRole?.toUpperCase().split("|").includes(d.toUpperCase());
      });
      setIsManagedByThisUser(isAllocationAllowed || false);
      if (res.success) setRoomInfo(res.data);
    } catch (error) {
      console.error("Error fetching room info:", error);
    }
  };

  useEffect(() => {
    if (acadmeicYear && acadmeicSession && academicSessionStartDate && academicSessionEndDate) {
      fetchRoomInfo();
    }
  }, [acadmeicYear, acadmeicSession, academicSessionStartDate, academicSessionEndDate]);

  /** Fetch maintenance data */
  const fetchMaintenanceData = async () => {
    if (!buildingId || !roomId) return;
    try {
      const response = await callApi<Maintenance[]>(process.env.NEXT_PUBLIC_GET_MAINTENANCE_DATA || URL_NOT_FOUND);
      if (response.success) {
        const allMaintenanceData = response.data || [];

        // Filter maintenance data to only include records for this room
        const filteredMaintenanceData = allMaintenanceData.filter((maintenance) => {
          const isActive = maintenance.isMainteneceActive;

          // Check if maintenance is for this room or its parent room
          const isRoomMatch = maintenance.roomid === roomId;
          const isParentMatch = roomInfo?.parentId && maintenance.roomid === roomInfo.parentId;

          return isActive && (isRoomMatch || isParentMatch);
        });

        setMaintenanceData(filteredMaintenanceData);
      }
    } catch (error) {
      console.error("Error fetching maintenance data:", error);
    }
  };

  useEffect(() => {
    fetchMaintenanceData();
  }, [buildingId, roomId, roomInfo?.parentId]);

  /** Handle timetable slot click */
  const handleTimeTableClick = (date: string, slot: { start: string; end: string }) => {
    if (isManagedByThisUser) {
      const slotDate = moment(date);
      const startSlotTime = moment(slot.start, "HH:mm");
      const exactSlotStartTime = slotDate.hour(startSlotTime.hour()).minute(startSlotTime.minute());
      setSelectedSlot({
        date,
        start: moment().isSameOrBefore(exactSlotStartTime) ? slot.start : moment().format("HH:mm"),
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
        const response = await callApi<{ success: boolean; data?: unknown }>(
          process.env.NEXT_PUBLIC_INSERT_SPACE_ALLOCATION_ENTRY || URL_NOT_FOUND,
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

  /** Handle edit occupant */
  const handleEditOccupant = (occupant: Occupant) => {
    setEditingOccupant(occupant);
    setEditFormData({
      startDate: occupant.scheduledDate ? moment(occupant.scheduledDate).format("YYYY-MM-DD") : "",
      endDate: occupant.scheduledDate ? moment(occupant.scheduledDate).format("YYYY-MM-DD") : "",
      startTime: occupant.startTime || "",
      endTime: occupant.endTime || "",
    });
  };

  /** Handle save edit */
  const handleSaveEdit = async () => {
    if (!editingOccupant) return;

    try {
      // Here you would typically call an API to update the occupant
      // For now, we'll just refresh the data
      console.log("Saving occupant edit:", editingOccupant, editFormData);

      // TODO: Implement actual API call to update occupant
      // await callApi(process.env.NEXT_PUBLIC_UPDATE_OCCUPANT || URL_NOT_FOUND, {
      //   occupantId: editingOccupant.Id,
      //   ...editFormData
      // });

      setEditingOccupant(null);
      setEditFormData({ startDate: "", endDate: "", startTime: "", endTime: "" });
      fetchRoomInfo(); // Refresh data
    } catch (error) {
      console.error("Error updating occupant:", error);
    }
  };

  /** Handle cancel edit */
  const handleCancelEdit = () => {
    setEditingOccupant(null);
    setEditFormData({ startDate: "", endDate: "", startTime: "", endTime: "" });
  };

  /** Handle cabin/workstation allocation */
  const handleCabinWorkstationAllocation = async (allocations: SpaceAllocation[]) => {
    let allSucceeded = true;
    for (const allocation of allocations) {
      try {
        const response = await callApi<{ success: boolean; data?: unknown }>(
          process.env.NEXT_PUBLIC_INSERT_SPACE_ALLOCATION_ENTRY || URL_NOT_FOUND,
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
    if (allSucceeded) fetchRoomInfo(); // Refresh data only if all succeeded
  };

  /** Weekly occupancy calculation based on selected week */
  const startOfSelectedWeek = moment(selectedWeekStart).startOf("isoWeek");
  const endOfSelectedWeek = moment(selectedWeekStart).endOf("isoWeek");

  const weeklyOccupants =
    roomInfo?.occupants?.filter((o: Occupant) => {
      if (!o.scheduledDate) return false;
      const scheduled = moment(o.scheduledDate);
      return scheduled.isBetween(startOfSelectedWeek, endOfSelectedWeek, "day", "[]");
    }) || [];

  const totalMinutes = weeklyOccupants.reduce((sum, occupant) => {
    if (!occupant.startTime || !occupant.endTime) return sum;
    const start = moment(occupant.startTime, "HH:mm");
    const end = moment(occupant.endTime, "HH:mm");
    return sum + Math.max(end.diff(start, "minutes"), 0);
  }, 0);

  const weeklyOccupancy = ((totalMinutes || 0) / MAX_WEEKLY_MINUTES) * 100;
  const circumference = 2 * Math.PI * 28;
  const strokeDashoffset = circumference - (weeklyOccupancy / 100) * circumference;

  const borderColor = roomInfo?.occupied === 0 ? "text-green-400" : totalMinutes >= MAX_WEEKLY_MINUTES * 0.8 ? "text-red-500" : "text-yellow-400";

  /** Group consecutive occupants by occupantId for Cabin/Workstation only */
  const groupConsecutiveOccupants = (occupants: Occupant[]) => {
    if (!occupants || occupants.length === 0) return [];

    // Sort occupants by occupantId and then by scheduledDate
    const sortedOccupants = [...occupants].sort((a, b) => {
      const aId = a.occupantId || a.Id || "";
      const bId = b.occupantId || b.Id || "";
      if (aId !== bId) return aId.localeCompare(bId);

      const aDate = moment(a.scheduledDate);
      const bDate = moment(b.scheduledDate);
      return aDate.diff(bDate);
    });

    const groupedOccupants: Array<{
      occupantId: string;
      occupantName: string;
      startDate: string;
      endDate: string;
      isEditable: string;
      originalOccupants: Occupant[];
    }> = [];

    let currentGroup: Occupant[] = [];
    let currentOccupantId = "";

    for (const occupant of sortedOccupants) {
      const occupantId = occupant.occupantId || occupant.Id || "";

      if (occupantId !== currentOccupantId) {
        // Start a new group
        if (currentGroup.length > 0) {
          // Process the previous group
          const groupStartDate = moment.min(currentGroup.map((o) => moment(o.scheduledDate))).format("YYYY-MM-DD");
          const groupEndDate = moment.max(currentGroup.map((o) => moment(o.scheduledDate))).format("YYYY-MM-DD");

          groupedOccupants.push({
            occupantId: currentOccupantId,
            occupantName: currentGroup[0].occupantName || "N/A",
            startDate: groupStartDate,
            endDate: groupEndDate,
            isEditable: currentGroup[0].isEditable || "false",
            originalOccupants: [...currentGroup],
          });
        }

        currentGroup = [occupant];
        currentOccupantId = occupantId;
      } else {
        // Check if this occupant's date is consecutive to the last occupant in the group
        const lastOccupantDate = moment(currentGroup[currentGroup.length - 1].scheduledDate);
        const currentOccupantDate = moment(occupant.scheduledDate);

        if (currentOccupantDate.diff(lastOccupantDate, "days") === 1) {
          // Consecutive day, add to current group
          currentGroup.push(occupant);
        } else {
          // Non-consecutive day, start a new group for the same occupant
          const groupStartDate = moment.min(currentGroup.map((o) => moment(o.scheduledDate))).format("YYYY-MM-DD");
          const groupEndDate = moment.max(currentGroup.map((o) => moment(o.scheduledDate))).format("YYYY-MM-DD");

          groupedOccupants.push({
            occupantId: currentOccupantId,
            occupantName: currentGroup[0].occupantName || "N/A",
            startDate: groupStartDate,
            endDate: groupEndDate,
            isEditable: currentGroup[0].isEditable || "false",
            originalOccupants: [...currentGroup],
          });

          currentGroup = [occupant];
        }
      }
    }

    // Process the last group
    if (currentGroup.length > 0) {
      const groupStartDate = moment.min(currentGroup.map((o) => moment(o.scheduledDate))).format("YYYY-MM-DD");
      const groupEndDate = moment.max(currentGroup.map((o) => moment(o.scheduledDate))).format("YYYY-MM-DD");

      groupedOccupants.push({
        occupantId: currentOccupantId,
        occupantName: currentGroup[0].occupantName || "N/A",
        startDate: groupStartDate,
        endDate: groupEndDate,
        isEditable: currentGroup[0].isEditable || "false",
        originalOccupants: [...currentGroup],
      });
    }

    return groupedOccupants;
  };

  return roomInfo ? (
    <>
      <section className="bg-white w-full">
        <div className="flex justify-between">
          <div>
            <h4 className="text-base font-semibold text-gray-800 md:ml-2">
              {allBuildingsData
                .filter((b) => b.id === roomInfo.building)?.[0]
                ?.floors?.filter((f) => f.id === roomInfo.floor)?.[0]
                ?.name.toUpperCase()}
              - Room Details
            </h4>
            <span className="text-xs font-semibold text-gray-500 md:ml-2">{allBuildingsData.filter((b) => b.id === roomInfo.building)?.[0]?.name}</span>
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
                        weeklyOccupancy === 0 ? "bg-green-500" : weeklyOccupancy >= 63 * 0.8 ? "bg-orange-500" : "bg-yellow-500"
                      }`}
                    >
                      {roomInfo.roomName ? roomInfo?.roomName?.substring(0, 3) : roomInfo?.id?.split(" ")[0].substring(0, 3)}
                    </div>
                    <div className="ml-4">
                      <h2 className="text font-[500] text-gray-600">{roomInfo.roomName ? roomInfo?.roomName : roomInfo?.id}</h2>
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
                          {weeklyOccupancy === 0 ? "Available" : weeklyOccupancy >= 63 * 0.8 ? "High Occupancy" : "Moderate Occupancy"}
                        </span>
                        <span className="mx-2 text-gray-400">•</span>
                        <span className="text-xs text-gray-600">Room ID: {roomInfo.id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-4 border-gray-100 relative">
                      <div>
                        <div className="relative w-16 h-16">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="28" strokeWidth="4" className="stroke-current text-gray-200" fill="transparent" />
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
                            {Math.round(weeklyOccupancy)}%
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
                      <p className="text-lg font-semibold">{roomInfo.capacity}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Today&apos;s Bookings</p>
                      <p className="text-lg font-semibold">
                        {roomInfo.occupants?.filter((o) => moment().format("YYYY-MM-DD") === moment(new Date(o.scheduledDate)).format("YYYY-MM-DD")).length}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Room Area</p>
                      <p className="text-lg font-semibold">{`${roomInfo.roomArea} Sq. ft.`}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Room Type</p>
                      <p className="text-lg font-semibold">{roomInfo.roomType}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="flex flex-row justify-between">
                    <h3 className="text-lg font-semibold mb-4 text-gray-500">Current Assignment</h3>
                    {isManagedByThisUser && isActiveSession && (
                      <button
                        className="mt-4 flex h-fit items-center rounded-md bg-[#F26722] px-4 py-2 text-xs text-white shadow-md transition-all hover:bg-[#a5705a] md:mt-0"
                        onClick={() => {
                          if (roomInfo.roomType.toLowerCase() === "workstation" || roomInfo.roomType.toLowerCase() === "cabin") {
                            setIsCabinWorkstationFormVisible(true);
                          } else {
                            setIsAllocationFormVisible(true);
                          }
                        }}
                      >
                        + Add Allocation
                      </button>
                    )}
                  </div>

                  {roomInfo.roomType.toLowerCase() === "workstation" || roomInfo.roomType.toLowerCase() === "cabin" ? (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-800">Occupant List</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Occupant ID</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {(() => {
                              // Use grouped occupants for Cabin/Workstation, individual occupants for other room types
                              const shouldGroup = roomInfo.roomType.toLowerCase() === "workstation" || roomInfo.roomType.toLowerCase() === "cabin";
                              const displayData = shouldGroup ? groupConsecutiveOccupants(roomInfo.occupants || []) : roomInfo.occupants || [];

                              return displayData.length > 0 ? (
                                displayData.map((item, index) => {
                                  if (shouldGroup) {
                                    // Grouped data for Cabin/Workstation
                                    const group = item as {
                                      occupantId: string;
                                      occupantName: string;
                                      startDate: string;
                                      endDate: string;
                                      isEditable: string;
                                      originalOccupants: Occupant[];
                                    };
                                    return (
                                      <tr key={`${group.occupantId}-${index}`} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{group.occupantId}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{group.occupantName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{moment(group.startDate).format("DD/MM/YYYY")}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{moment(group.endDate).format("DD/MM/YYYY")}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                          {group.isEditable === "true" && isManagedByThisUser ? (
                                            <button
                                              className="text-[#F26722] hover:text-[#a5705a] transition-colors"
                                              onClick={() => handleEditOccupant(group.originalOccupants[0])}
                                            >
                                              Edit
                                            </button>
                                          ) : (
                                            <span className="text-gray-400">Not editable</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  } else {
                                    // Individual data for other room types
                                    const occupant = item as Occupant;
                                    return (
                                      <tr key={occupant.Id || index} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{occupant.occupantId || occupant.Id || "N/A"}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{occupant.occupantName || "N/A"}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                          {occupant.scheduledDate ? moment(occupant.scheduledDate).format("DD/MM/YYYY") : "N/A"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                          {occupant.endTime ? moment(occupant.scheduledDate).format("DD/MM/YYYY") : "N/A"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                          {occupant.isEditable === "true" && isManagedByThisUser ? (
                                            <button
                                              className="text-[#F26722] hover:text-[#a5705a] transition-colors"
                                              onClick={() => handleEditOccupant(occupant)}
                                            >
                                              Edit
                                            </button>
                                          ) : (
                                            <span className="text-gray-400">Not editable</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  }
                                })
                              ) : (
                                <tr>
                                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                                    No occupants found
                                  </td>
                                </tr>
                              );
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <WeeklyTimetable
                      startDate={startDate}
                      isManagedByThisUser={isManagedByThisUser}
                      refreshData={() => fetchRoomInfo()}
                      setStartDate={(date) => {
                        setStartDate(date);
                        setSelectedWeekStart(
                          moment(date as Date)
                            .startOf("isoWeek")
                            .toDate()
                        );
                      }}
                      occupants={roomInfo.occupants || []}
                      maintenanceData={maintenanceData}
                      academicSessionStartDate={academicSessionStartDate || ""}
                      academicSessionEndDate={academicSessionEndDate || ""}
                      onClickTimeTableSlot={handleTimeTableClick}
                      roomId={roomId}
                      roomParentId={roomInfo.parentId}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {isAllocationFormVisible && (
        <AddAssignmentForm
          onSuccessfulSlotsCreation={handleSpaceAllocations}
          onClose={() => setIsAllocationFormVisible(false)}
          roomInfo={roomInfo}
          initialDate={selectedSlot?.date}
          initialStartTime={selectedSlot?.start}
          initialEndTime={selectedSlot?.end}
          maintenanceData={maintenanceData}
        />
      )}

      {isCabinWorkstationFormVisible && (
        <CabinWorkstationAllocationForm
          onSuccessfulAllocation={handleCabinWorkstationAllocation}
          onClose={() => setIsCabinWorkstationFormVisible(false)}
          roomInfo={roomInfo}
        />
      )}

      {/* Edit Occupant Modal */}
      {editingOccupant && (
        <div className="fixed inset-0 bg-[#00000070] bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Edit Occupant</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Occupant: {editingOccupant.occupantName || editingOccupant.Id}</label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={editFormData.startDate}
                  onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F26722]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={editFormData.endDate}
                  onChange={(e) => setEditFormData({ ...editFormData, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F26722]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input
                  type="time"
                  value={editFormData.startTime}
                  onChange={(e) => setEditFormData({ ...editFormData, startTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F26722]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input
                  type="time"
                  value={editFormData.endTime}
                  onChange={(e) => setEditFormData({ ...editFormData, endTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F26722]"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 text-sm font-medium text-white bg-[#F26722] rounded-md hover:bg-[#a5705a] transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  ) : (
    <div>Room Info Not Found</div>
  );
}

export default RoomPage;
