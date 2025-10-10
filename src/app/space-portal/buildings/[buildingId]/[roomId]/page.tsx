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
  const [editValidationErrors, setEditValidationErrors] = useState<string[]>([]);

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
      console.log("res", res.data);
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

    // For sitting rooms (cabins, workstations, offices), use scheduledEndDate if available
    if (roomInfo && roomInfo.isSitting) {
      setEditFormData({
        startDate: occupant.scheduledDate ? moment(occupant.scheduledDate).format("YYYY-MM-DD") : "",
        endDate: occupant.scheduledEndDate
          ? moment(occupant.scheduledEndDate).format("YYYY-MM-DD")
          : occupant.scheduledDate
          ? moment(occupant.scheduledDate).format("YYYY-MM-DD")
          : "",
        startTime: "", // No time fields for sitting rooms
        endTime: "", // No time fields for sitting rooms
      });
    } else {
      // For other room types, use individual occupant data
      setEditFormData({
        startDate: occupant.scheduledDate ? moment(occupant.scheduledDate).format("YYYY-MM-DD") : "",
        endDate: occupant.scheduledDate ? moment(occupant.scheduledDate).format("YYYY-MM-DD") : "",
        startTime: occupant.startTime || "",
        endTime: occupant.endTime || "",
      });
    }
  };

  /** Validate edit form data */
  const validateEditForm = (): string[] => {
    const errors: string[] = [];

    if (!editFormData.endDate) {
      errors.push("End date is required.");
    } else {
      const endDate = moment(editFormData.endDate);
      const startDate = moment(editFormData.startDate);
      const today = moment();

      if (endDate.isBefore(today, "day")) {
        errors.push("End date cannot be before today's date.");
      }

      if (endDate.isBefore(startDate, "day")) {
        errors.push("End date cannot be before start date.");
      }
    }

    // For non-sitting room types, validate time fields
    if (!roomInfo?.isSitting) {
      if (!editFormData.startTime) {
        errors.push("Start time is required.");
      }
      if (!editFormData.endTime) {
        errors.push("End time is required.");
      }
      if (editFormData.startTime && editFormData.endTime && editFormData.startTime >= editFormData.endTime) {
        errors.push("End time must be after start time.");
      }
    }

    return errors;
  };

  /** Handle save edit */
  const handleSaveEdit = async () => {
    if (!editingOccupant) return;

    const validationErrors = validateEditForm();
    setEditValidationErrors(validationErrors);

    if (validationErrors.length > 0) {
      return; // Don't proceed if there are validation errors
    }

    try {
      // For sitting rooms (cabins, workstations, offices), we need to handle date range changes
      if (roomInfo?.isSitting) {
        await handleCabinWorkstationDateChange();
      } else {
        // For other room types, handle individual occupant update
        await handleIndividualOccupantUpdate();
      }

      setEditingOccupant(null);
      setEditFormData({ startDate: "", endDate: "", startTime: "", endTime: "" });
      setEditValidationErrors([]);
      fetchRoomInfo(); // Refresh data
    } catch (error) {
      console.error("Error updating occupant:", error);
    }
  };

  /** Handle cabin/workstation date range changes */
  const handleCabinWorkstationDateChange = async () => {
    if (!editingOccupant || !roomInfo) return;

    try {
      // Update the allocationEndDate for the single occupant entry
      const response = await callApi(process.env.NEXT_PUBLIC_UPDATE_SPACE_ALLOCATION_ENTRY || URL_NOT_FOUND, {
        allocationEntNo: editingOccupant.Id,
        isAllocationActive: true,
        roomID: editingOccupant.roomId || roomId || "",
        subRoomID: editingOccupant.subroomId || subRoomId || "",
        startTime: editingOccupant.startTime ? moment(editingOccupant.startTime, "HH:mm").format("HH:mm:ss") : "",
        endTime: editingOccupant.endTime ? moment(editingOccupant.endTime, "HH:mm").format("HH:mm:ss") : "",
        remarks: "",
        scheduledDate: editingOccupant.scheduledDate ? moment(editingOccupant.scheduledDate).format("YYYY-MM-DD") : "",
        allocatedEndDate: editFormData.endDate,
      });

      if (!response.success) {
        console.error("Failed to update occupant:", editingOccupant.Id, response);
        throw new Error(`Failed to update occupant ${editingOccupant.Id}`);
      }

      console.log("Successfully updated occupant allocation end date");
    } catch (error) {
      console.error("Error updating occupant:", error);
      throw error;
    }
  };

  /** Handle individual occupant update for non-cabin/workstation rooms */
  const handleIndividualOccupantUpdate = async () => {
    if (!editingOccupant) return;

    console.log("Saving individual occupant edit:", editingOccupant, editFormData);

    try {
      const response = await callApi(process.env.NEXT_PUBLIC_UPDATE_SPACE_ALLOCATION_ENTRY || URL_NOT_FOUND, {
        allocationEntNo: editingOccupant.Id,
        isAllocationActive: true,
        roomID: editingOccupant.roomId || roomId || "",
        subRoomID: editingOccupant.subroomId || subRoomId || "",
        startTime: editFormData.startTime ? moment(editFormData.startTime, "HH:mm").format("HH:mm:ss") : "",
        endTime: editFormData.endTime ? moment(editFormData.endTime, "HH:mm").format("HH:mm:ss") : "",
        remarks: "",
        scheduledDate: editFormData.startDate,
        allocatedEndDate: editFormData.endDate,
      });

      if (!response.success) {
        console.error("Failed to update occupant:", editingOccupant.Id, response);
        throw new Error(`Failed to update occupant ${editingOccupant.Id}`);
      }

      console.log("Successfully updated individual occupant");
    } catch (error) {
      console.error("Error updating individual occupant:", error);
    }
  };

  /** Handle un-allocate occupant */
  const handleUnallocateOccupant = async () => {
    if (!editingOccupant) return;

    if (!confirm(`Are you sure you want to un-allocate ${editingOccupant.occupantName || editingOccupant.Id}?`)) {
      return;
    }

    try {
      const response = await callApi(process.env.NEXT_PUBLIC_UPDATE_SPACE_ALLOCATION_ENTRY || URL_NOT_FOUND, {
        allocationEntNo: editingOccupant.Id,
        isAllocationActive: false,
        roomID: editingOccupant.roomId || roomId || "",
        subRoomID: editingOccupant.subroomId || subRoomId || "",
        startTime: editingOccupant.startTime ? moment(editingOccupant.startTime, "HH:mm").format("HH:mm:ss") : "",
        endTime: editingOccupant.endTime ? moment(editingOccupant.endTime, "HH:mm").format("HH:mm:ss") : "",
        remarks: "Un-allocated",
        scheduledDate: editingOccupant.scheduledDate ? moment(editingOccupant.scheduledDate).format("YYYY-MM-DD") : "",
        allocatedEndDate: editingOccupant.scheduledEndDate ? moment(editingOccupant.scheduledEndDate).format("YYYY-MM-DD") : "",
      });

      if (!response.success) {
        console.error("Failed to un-allocate occupant:", editingOccupant.Id, response);
        throw new Error(`Failed to un-allocate occupant ${editingOccupant.Id}`);
      }

      console.log("Successfully un-allocated occupant");
      setEditingOccupant(null);
      setEditFormData({ startDate: "", endDate: "", startTime: "", endTime: "" });
      setEditValidationErrors([]);
      fetchRoomInfo(); // Refresh data
    } catch (error) {
      console.error("Error un-allocating occupant:", error);
      alert("Failed to un-allocate occupant. Please try again.");
    }
  };

  /** Handle cancel edit */
  const handleCancelEdit = () => {
    setEditingOccupant(null);
    setEditFormData({ startDate: "", endDate: "", startTime: "", endTime: "" });
    setEditValidationErrors([]);
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

  // Calculate occupancy differently for sitting vs non-sitting rooms
  let weeklyOccupancy = 0;

  if (roomInfo?.isSitting) {
    // For sitting rooms (cabins, workstations, offices), calculate based on current active occupants
    const today = moment();
    const activeOccupants =
      roomInfo.occupants?.filter((o: Occupant) => {
        if (!o.scheduledDate) return false;
        const startDate = moment(o.scheduledDate);
        const endDate = o.scheduledEndDate ? moment(o.scheduledEndDate) : startDate;

        // Check if the occupant is currently active (today is between start and end date)
        return today.isBetween(startDate, endDate, "day", "[]");
      }) || [];

    // Calculate occupancy percentage based on room capacity
    const capacity = roomInfo.capacity || 1; // Avoid division by zero
    weeklyOccupancy = Math.min((activeOccupants.length / capacity) * 100, 100);
  } else {
    // For non-sitting rooms, use time-based calculation
    const totalMinutes = weeklyOccupants.reduce((sum, occupant) => {
      if (!occupant.startTime || !occupant.endTime) return sum;
      const start = moment(occupant.startTime, "HH:mm");
      const end = moment(occupant.endTime, "HH:mm");
      return sum + Math.max(end.diff(start, "minutes"), 0);
    }, 0);

    weeklyOccupancy = ((totalMinutes || 0) / MAX_WEEKLY_MINUTES) * 100;
  }
  const circumference = 2 * Math.PI * 28;
  const strokeDashoffset = circumference - (weeklyOccupancy / 100) * circumference;

  const borderColor = weeklyOccupancy === 0 ? "text-green-400" : weeklyOccupancy >= 80 ? "text-red-500" : "text-yellow-400";

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
                          if (roomInfo.isSitting) {
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

                  {roomInfo.isSitting ? (
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
                            {roomInfo.occupants && roomInfo.occupants.length > 0 ? (
                              roomInfo.occupants.map((occupant, index) => (
                                <tr key={occupant.Id || index} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{occupant.occupantId || occupant.Id || "N/A"}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{occupant.occupantName || "N/A"}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {occupant.scheduledDate ? moment(occupant.scheduledDate).format("DD/MM/YYYY") : "N/A"}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {occupant.scheduledEndDate
                                      ? moment(occupant.scheduledEndDate).format("DD/MM/YYYY")
                                      : occupant.scheduledDate
                                      ? moment(occupant.scheduledDate).format("DD/MM/YYYY")
                                      : "N/A"}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    {(() => {
                                      // For sitting rooms, check if end date is in the past
                                      if (roomInfo.isSitting) {
                                        const endDate = occupant.scheduledEndDate
                                          ? moment(occupant.scheduledEndDate)
                                          : occupant.scheduledDate
                                          ? moment(occupant.scheduledDate)
                                          : null;

                                        const isEndDateInPast = endDate && endDate.isBefore(moment(), "day");

                                        if (isEndDateInPast) {
                                          return <span className="text-gray-400">Expired</span>;
                                        }
                                      }

                                      return occupant.isEditable === "true" && isManagedByThisUser ? (
                                        <button className="text-[#F26722] hover:text-[#a5705a] transition-colors" onClick={() => handleEditOccupant(occupant)}>
                                          Edit
                                        </button>
                                      ) : (
                                        <span className="text-gray-400">Not editable</span>
                                      );
                                    })()}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                                  No occupants found
                                </td>
                              </tr>
                            )}
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
        <div className="fixed inset-0 bg-[#00000070] bg-opacity-50 text-gray-500 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Edit Occupant</h3>

            {/* Validation Errors */}
            {editValidationErrors.length > 0 && (
              <div className="bg-red-100 border border-red-300 text-red-700 rounded p-3 mb-4">
                <div className="flex items-center mb-2">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm font-medium">Please fix the following errors:</span>
                </div>
                <ul className="text-sm list-disc ml-6">
                  {editValidationErrors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Occupant: {editingOccupant.occupantName || editingOccupant.Id}</label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={editFormData.startDate}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Start date cannot be modified</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={editFormData.endDate}
                  min={editFormData.startDate > moment().format("YYYY-MM-DD") ? editFormData.startDate : moment().format("YYYY-MM-DD")}
                  onChange={(e) => setEditFormData({ ...editFormData, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F26722]"
                />
                <p className="text-xs text-gray-500 mt-1">End date must be after start date and not before today</p>
              </div>

              {/* Only show time fields for non-sitting room types */}
              {!roomInfo?.isSitting && (
                <>
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
                </>
              )}
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={handleUnallocateOccupant}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
              >
                Un-allocate
              </button>
              <div className="flex space-x-3">
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
        </div>
      )}
    </>
  ) : (
    <div>Room Info Not Found</div>
  );
}

export default RoomPage;
