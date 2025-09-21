"use client";
import React, { useState, useEffect } from "react";
import { RoomRequest, Building, Room, SpaceAllocation, UserProfile, Maintenance } from "@/types";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { useSelector } from "react-redux";
import moment from "moment";
import { areSlotsEqual, checkSlotConflicts, Slot } from "@/utils/slotsHelper";
import { ConflictResolution } from "@/components/ConflictResolution";
import { formatDate } from "@/utils";

// Helper function to format time by removing seconds
const formatTime = (timeString: string) => {
  if (!timeString) return "";
  return timeString.split(":").slice(0, 2).join(":");
};

type RequestApprovalProps = {
  requestData: RoomRequest;
  onApprovalComplete: () => void;
  onClose: () => void;
};

export default function RequestApproval({ requestData, onApprovalComplete, onClose }: RequestApprovalProps) {
  const user: UserProfile | null = useSelector((state: any) => state.dataState.user);
  const academicYear = useSelector((state: any) => state.dataState.selectedAcademicYear);
  const academicSession = useSelector((state: any) => state.dataState.selectedAcademicSession);
  const academicSessionEndDate = useSelector((state: any) => state.dataState.selectedAcademicSessionEndDate);

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [keys, setKeys] = useState<string>("");
  const [conflicts, setConflicts] = useState<Slot[]>([]);
  const [showConflicts, setShowConflictsView] = useState(false);
  const [allocationSlotsList, setAllocationSlotsList] = useState<Slot[]>([]);
  const [existingBookedSlots, setExistingBookedSlots] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [maintenanceData, setMaintenanceData] = useState<Maintenance[]>([]);

  // Fetch buildings
  useEffect(() => {
    const fetchBuildings = async () => {
      const reqBody = { acadSession: academicSession, acadYear: academicYear };
      const response = await callApi<Building[]>(process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND, reqBody);
      if (response.success) setBuildings(response.data || []);
    };
    fetchBuildings();
  }, [academicSession, academicYear]);

  // Fetch rooms for selected building/floor
  useEffect(() => {
    const fetchRoomsForBuilding = async (buildingId: string) => {
      const building = buildings.find((b) => b.id === buildingId);
      if (!building) return setRooms([]);
      const floorIds = building.floors?.map((f) => f.id) || [];
      if (floorIds.length === 0) return setRooms([]);
      const reqBody = {
        buildingNo: buildingId,
        floorID: selectedFloorId,
        curreentTime: moment().format("HH:mm"),
      };
      const response = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, reqBody);
      setRooms(response.data || []);
    };
    if (selectedBuildingId) {
      fetchRoomsForBuilding(selectedBuildingId);
      setSelectedRoomId("");
    } else setRooms([]);
  }, [selectedBuildingId, selectedFloorId, buildings, academicSession, academicYear]);

  // Fetch maintenance data
  useEffect(() => {
    const fetchMaintenanceData = async () => {
      try {
        const response = await callApi<Maintenance[]>(process.env.NEXT_PUBLIC_GET_MAINTENANCE_DATA || URL_NOT_FOUND);
        if (response.success) {
          setMaintenanceData(response.data || []);
        }
      } catch (error) {
        console.error("Error fetching maintenance data:", error);
      }
    };
    fetchMaintenanceData();
  }, []);

  // Create slots from recurrence
  function createSlotsFromRecurrence(startDate: string, endDate: string, startTime: string, endTime: string, recurrence: string): Slot[] {
    const DATE_FMT = "YYYY-MM-DD";
    if (!startDate || !startTime || !endTime) return [];
    const start = moment(new Date(startDate), DATE_FMT, true);
    const last = moment(new Date(endDate), DATE_FMT, true);
    if (!start.isValid() || !last.isValid() || last.isBefore(start, "day")) return [];
    const tFormats = ["HH:mm:ss", "H:mm:ss"];
    const startTimeMoment = moment(startTime, tFormats, true);
    const endTimeMoment = moment(endTime, tFormats, true);
    if (!startTimeMoment.isValid() || !endTimeMoment.isValid()) return [];
    if (!endTimeMoment.isAfter(startTimeMoment)) return [];

    // Day name to weekday number mapping (ISO weekday: 1=Monday, 2=Tuesday, etc.)
    const dayNameToWeekday: { [key: string]: number } = {
      Mon: 1,
      Monday: 1,
      Tue: 2,
      Tuesday: 2,
      Wed: 3,
      Wednesday: 3,
      Thu: 4,
      Thursday: 4,
      Fri: 5,
      Friday: 5,
      Sat: 6,
      Saturday: 6,
      Sun: 7,
      Sunday: 7,
    };

    const recurrenceList = (recurrence || "").split(",").map((r) => r.trim());
    const hasRecurrence = recurrenceList.some((r) => r !== "0" && r !== "");
    const slots: Slot[] = [];
    const makeId = (m: moment.Moment) => `${m.format("YYYYMMDD")}_${startTime.replace(/:/g, "")}_${endTime.replace(/:/g, "")}`;

    if (!hasRecurrence) {
      slots.push({
        date: start.format(DATE_FMT),
        start: startTime,
        end: endTime,
        id: makeId(start),
      });
      return slots;
    }

    // Convert day names to weekday numbers
    const recurrenceDays = recurrenceList
      .map((day) => {
        const dayTrimmed = day.trim();
        // Check if it's a day name
        if (dayNameToWeekday.hasOwnProperty(dayTrimmed)) {
          return dayNameToWeekday[dayTrimmed];
        }
        // Check if it's a number (legacy support)
        const num = parseInt(dayTrimmed);
        if (!isNaN(num) && num >= 1 && num <= 7) {
          return num;
        }
        return null;
      })
      .filter((day) => day !== null) as number[];

    if (recurrenceDays.length === 0) return [];

    for (let current = start.clone(); current.isSameOrBefore(last, "day"); current.add(1, "day")) {
      if (recurrenceDays.includes(current.isoWeekday())) {
        slots.push({
          date: current.format(DATE_FMT),
          start: startTime,
          end: endTime,
          id: makeId(current),
        });
      }
    }
    return slots;
  }

  const generateSlots = () => {
    if (!requestData) return [];
    return createSlotsFromRecurrence(requestData.startDate, requestData.endDate, requestData.startTime, requestData.endTime, requestData.recurrence);
  };

  const validateConflicts = async (slots: Slot[]) => {
    const fetchExistingSlots = async () => {
      const requestbody = {
        roomID: selectedRoomId,
        subroomID: 0,
        academicYr: academicYear,
        acadSess: academicSession,
        startDate: moment().format("YYYY-MM-DD"),
        endDate: academicSessionEndDate,
      };
      const response = await callApi(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, requestbody);
      if (response.success) {
        const existingSlots: Slot[] =
          (response.data as any)?.occupants?.map((o: any) => ({
            date: moment(o.scheduledDate).format("YYYY-MM-DD"),
            start: o.startTime,
            end: o.endTime,
            id: `${moment(o.scheduledDate).format("YYYYMMDD")}_${o.startTime.replace(/:/g, "")}_${o.endTime.replace(/:/g, "")}`,
          })) || [];

        // Convert maintenance data to slots
        const maintenanceSlots = maintenanceData
          .filter((maintenance) => maintenance.isMainteneceActive)
          .map((maintenance) => {
            const startTimeStr = maintenance.startTime.split("T")[1]?.split("Z")[0] || "09:00:00";
            const endTimeStr = maintenance.endTime.split("T")[1]?.split("Z")[0] || "10:30:00";
            return {
              id: `maintenance-${maintenance.id}`,
              date: moment(maintenance.maintanceDate).format("YYYY-MM-DD"),
              start: startTimeStr.substring(0, 5),
              end: endTimeStr.substring(0, 5),
            };
          });

        // Combine existing slots with maintenance slots
        const allExistingSlots = [...existingSlots, ...maintenanceSlots];
        setExistingBookedSlots(allExistingSlots);
        return allExistingSlots;
      }
      return [];
    };
    const existingSlots = await fetchExistingSlots();
    return checkSlotConflicts(slots, existingSlots);
  };

  const createSpaceAllocations = (slots: Slot[]): SpaceAllocation[] => {
    if (!requestData) return [];
    return slots.map((slot) => ({
      allocationDate: slot.date,
      startTime: `${slot.start}:00`,
      endTime: `${slot.end}:00`,
      keyAssigned: keys,
      subRoom: "0",
      allocatedRoomID: selectedRoomId,
      buildingId: selectedBuildingId,
      academicSession: academicSession,
      academicYear: academicYear,
      allocatedTo: requestData.employeeName,
      isAllocationActive: true,
      remarks: description,
      types: "3",
      allocatedOnDate: moment().format("YYYY-MM-DD"),
      allocatedfrom: requestData.requestID || "",
      allocatedBy: user?.employeeId || "",
      purpose: requestData.purpose || "",
    }));
  };

  const handleApprove = async () => {
    if (!selectedRoomId || !keys.trim()) {
      alert("Please select Room and assign Keys before approval.");
      return;
    }

    setIsLoading(true);
    try {
      const slots = generateSlots();
      const conflictsFound = await validateConflicts(slots);
      setAllocationSlotsList(slots);

      if (conflictsFound.length > 0) {
        // Check if there are any unresolved maintenance conflicts
        const hasUnresolvedMaintenanceConflicts = conflictsFound.some((slot) => {
          return existingBookedSlots.some((s) => s.date === slot.date && s.id?.startsWith("maintenance-") && !(s.end <= slot.start || s.start >= slot.end));
        });

        if (hasUnresolvedMaintenanceConflicts) {
          alert("❌ Cannot proceed! You have unresolved conflicts with maintenance schedules. Please adjust your time slots to avoid maintenance periods.");
          setIsLoading(false);
          return;
        }

        setConflicts(conflictsFound);
        setShowConflictsView(true);
        setIsLoading(false);
        return;
      }

      await processApproval(slots);
    } catch (error) {
      console.error("Error during approval:", error);
      alert("Error occurred during approval process.");
    } finally {
      setIsLoading(false);
    }
  };

  const processApproval = async (slots: Slot[]) => {
    const allocations = createSpaceAllocations(slots);

    // Insert allocations
    let allSucceeded = true;
    for (const allocation of allocations) {
      const resp = await callApi(process.env.NEXT_PUBLIC_INSERT_SPACE_ALLOCATION_ENTRY || URL_NOT_FOUND, allocation);
      if (!resp?.data) allSucceeded = false;
    }

    if (allSucceeded) {
      const resp = await callApi(process.env.NEXT_PUBLIC_UPDATE_REQUEST || URL_NOT_FOUND, {
        requestID: requestData.requestID,
        description,
        status: 2, // Approved
        allocatedRoomID: selectedRoomId,
        approvedBy: user?.employeeId,
        approvalDate: moment().format("YYYY-MM-DD"),
      });
      if (resp.data) {
        alert("Request approved successfully!");
        onApprovalComplete();
        onClose();
      } else {
        alert("Error while approving request!");
      }
    } else {
      alert("Error occurred while creating allocations!");
    }
  };

  const handleReject = async () => {
    if (!description.trim()) {
      alert("Please provide rejection reason.");
      return;
    }

    setIsLoading(true);
    try {
      const resp = await callApi(process.env.NEXT_PUBLIC_UPDATE_REQUEST || URL_NOT_FOUND, {
        requestID: requestData.requestID,
        description,
        status: 3, // Rejected
        approvedBy: user?.employeeId,
        approvalDate: moment().format("YYYY-MM-DD"),
        allocatedRoomID: "",
      });
      if (resp.data) {
        alert("Request rejected successfully!");
        onApprovalComplete();
        onClose();
      } else {
        alert("Error while rejecting request!");
      }
    } catch (error) {
      console.error("Error during rejection:", error);
      alert("Error occurred during rejection process.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConflictResolution = async (resolvedSlots: Slot[]) => {
    await processApproval(resolvedSlots);
  };

  const handleProceedAnyway = () => {
    const list = allocationSlotsList.filter((slot) => !conflicts.some((c) => areSlotsEqual(slot, c)));
    handleConflictResolution(list);
    setShowConflictsView(false);
  };

  if (showConflicts) {
    return (
      <ConflictResolution
        existingSlots={existingBookedSlots}
        conflictingSlots={conflicts}
        onResolve={handleConflictResolution}
        onProceedAnyway={handleProceedAnyway}
        onClose={() => setShowConflictsView(false)}
      />
    );
  }

  return (
    <section className="fixed inset-0 z-50 h-screen w-screen bg-[#00000070] flex items-center justify-center text-gray-500">
      <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl p-6">
        <div className="max-h-[80vh] bg-white overflow-y-scroll mr-4 pr-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Request Approval</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Request Details */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">Request Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Request ID:</span> {requestData.requestID}
              </div>
              <div>
                <span className="font-medium">Employee:</span> {requestData.employeeName}
              </div>
              <div>
                <span className="font-medium">Department:</span> {requestData.employeeDepartment}
              </div>
              <div>
                <span className="font-medium">Purpose:</span> {requestData.purpose}
              </div>
              <div>
                <span className="font-medium">Date:</span> {formatDate(requestData.startDate).split(" ")?.[0]} -{" "}
                {formatDate(requestData.endDate).split(" ")?.[0]}
              </div>
              <div>
                <span className="font-medium">Time:</span> {formatTime(requestData.startTime)} - {formatTime(requestData.endTime)}
              </div>
            </div>
          </div>

          {/* Room Selection */}
          <div className="space-y-4 mb-6">
            <h3 className="font-semibold text-gray-800">Room Allocation</h3>

            <div className="flex flex-col md:flex-row md:space-x-4">
              <div className="w-full">
                <label className="block text-sm text-gray-700 mb-1">Building</label>
                <select
                  className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  value={selectedBuildingId}
                  onChange={(e) => setSelectedBuildingId(e.target.value)}
                >
                  <option value="">Select building</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:w-1/2 w-full mt-4 md:mt-0">
                <label className="block text-sm text-gray-700 mb-1">Floor</label>
                <select
                  className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  value={selectedFloorId}
                  onChange={(e) => setSelectedFloorId(e.target.value)}
                  disabled={!selectedBuildingId}
                >
                  <option value="">Select floor</option>
                  {buildings
                    .filter((b) => b.id === selectedBuildingId)
                    .map((b) =>
                      b.floors.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))
                    )}
                </select>
              </div>
              <div className="md:w-1/2 w-full mt-4 md:mt-0">
                <label className="block text-sm text-gray-700 mb-1">Room</label>
                <select
                  className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  disabled={!selectedFloorId}
                >
                  <option value="">Select room</option>
                  {rooms.map((r) => (
                    <option key={r.roomId} value={r.roomId}>
                      {r.roomName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-700">Keys</label>
              <input
                className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                type="text"
                value={keys}
                onChange={(e) => setKeys(e.target.value)}
                placeholder="Assigned Key numbers e.g.: 002,005"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700">Remarks</label>
              <textarea
                className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                rows={3}
                value={description}
                placeholder="Remarks"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center space-x-6 mt-8 mb-2">
            <button
              type="button"
              className="px-4 py-2 rounded-lg shadow-md transition duration-300 bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-50"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg shadow-md transition duration-300 bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
              onClick={handleReject}
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : "Reject"}
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg shadow-md transition duration-300 bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
              onClick={handleApprove}
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : "Approve"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
