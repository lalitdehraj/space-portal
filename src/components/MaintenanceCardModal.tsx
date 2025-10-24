"use client";

import React, { useState, useEffect } from "react";
import { Room, RoomInfo, Maintenance } from "@/types";
import { X } from "lucide-react";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import moment from "moment";
import { useSelector } from "react-redux";
import { RootState } from "@/app/store";

interface MaintenanceCardModalProps {
  room: Room;
  onClose: () => void;
  onSuccess?: () => void;
}

const MaintenanceCardModal: React.FC<MaintenanceCardModalProps> = ({ room, onClose, onSuccess }) => {
  const [maintenanceType, setMaintenanceType] = useState("routine");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(moment().format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(moment().format("YYYY-MM-DD"));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [maintenanceRecords, setMaintenanceRecords] = useState<Maintenance[]>([]);
  const [conflictMessage, setConflictMessage] = useState<string>("");

  // Get academic year and session from Redux
  const academicYear = useSelector((state: RootState) => state.dataState.selectedAcademicYear);
  const academicSession = useSelector((state: RootState) => state.dataState.selectedAcademicSession);
  const academicSessionStartDate = useSelector((state: RootState) => state.dataState.selectedAcademicSessionStartDate);
  const academicSessionEndDate = useSelector((state: RootState) => state.dataState.selectedAcademicSessionEndDate);

  // Fetch room info to get occupants
  const fetchRoomInfo = async () => {
    if (!academicYear || !academicSession || !academicSessionStartDate || !academicSessionEndDate) return;

    try {
      const requestBody = {
        roomID: room.parentId || room.roomId,
        subroomID: room.parentId ? room.roomId : "",
        academicYr: academicYear,
        acadSess: academicSession,
        startDate: academicSessionStartDate,
        endDate: academicSessionEndDate,
      };

      const response = await callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, requestBody);

      if (response.success && response.data) {
        setRoomInfo(response.data);
      }
    } catch (error) {
      console.error("Error fetching room info:", error);
    }
  };

  // Fetch maintenance records
  const fetchMaintenanceRecords = async () => {
    try {
      const response = await callApi<Maintenance[]>(process.env.NEXT_PUBLIC_GET_MAINTENANCE_DATA || URL_NOT_FOUND);

      if (response.success && response.data) {
        setMaintenanceRecords(response.data);
      }
    } catch (error) {
      console.error("Error fetching maintenance records:", error);
    }
  };

  // Fetch data when component mounts
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      await Promise.all([fetchRoomInfo(), fetchMaintenanceRecords()]);
      setIsLoadingData(false);
    };

    fetchData();
  }, [academicYear, academicSession, academicSessionStartDate, academicSessionEndDate]);

  // Check for conflicts when dates change
  useEffect(() => {
    if (!startDate || !endDate || !startTime || !endTime || !roomInfo) {
      setConflictMessage("");
      return;
    }

    checkForConflicts();
  }, [startDate, endDate, startTime, endTime, roomInfo, maintenanceRecords]);

  // Check for conflicts with existing occupants or maintenance
  const checkForConflicts = () => {
    const selectedStartDate = moment(startDate);
    const selectedEndDate = moment(endDate);

    console.log("Checking conflicts for date range:", startDate, "to", endDate);
    console.log("Room info occupants:", roomInfo?.occupants);

    // Check for occupants in the room during the selected date range and time
    const conflictingOccupants =
      roomInfo?.occupants?.filter((occupant) => {
        const occupantStartDate = moment(occupant.scheduledDate);
        const occupantEndDate = moment(occupant.scheduledEndDate);

        console.log("Checking occupant:", {
          name: occupant.occupantName,
          type: occupant.type,
          isSitting: occupant.isSittingActive,
          dateRange: `${occupantStartDate.format("YYYY-MM-DD")} to ${occupantEndDate.format("YYYY-MM-DD")}`,
          timeRange: `${occupant.startTime} - ${occupant.endTime}`,
        });

        // Check if occupant's date range overlaps with the maintenance date range
        // For sitting allocations, check the full date range (scheduledDate to scheduledEndDate)
        const dateRangesOverlap = occupantStartDate.isSameOrBefore(selectedEndDate, "day") && occupantEndDate.isSameOrAfter(selectedStartDate, "day");

        if (!dateRangesOverlap) {
          console.log("  -> Date ranges don't overlap");
          return false;
        }

        // If date ranges overlap, check for time overlap
        // Parse times - handle both formats with and without leading spaces
        const occupantStartTimeStr = occupant.startTime.trim();
        const occupantEndTimeStr = occupant.endTime.trim();

        // Create moment objects for time comparison on any overlapping date
        const maintenanceStartMoment = moment(`${startTime}`, "HH:mm");
        const maintenanceEndMoment = moment(`${endTime}`, "HH:mm");
        const occupantStartMoment = moment(`${occupantStartTimeStr}`, "HH:mm");
        const occupantEndMoment = moment(`${occupantEndTimeStr}`, "HH:mm");

        // Check for time overlap using standard interval overlap logic
        const timeOverlaps = maintenanceStartMoment.isBefore(occupantEndMoment) && maintenanceEndMoment.isAfter(occupantStartMoment);

        console.log("  -> Date ranges overlap, checking time:", {
          maintenanceTime: `${startTime} - ${endTime}`,
          occupantTime: `${occupantStartTimeStr} - ${occupantEndTimeStr}`,
          timeOverlaps,
        });

        return timeOverlaps;
      }) || [];

    console.log("Total conflicting occupants:", conflictingOccupants.length);

    // Check for existing maintenance during the selected date range and time
    const conflictingMaintenance = maintenanceRecords.filter((maintenance) => {
      // Only check active maintenance for the same room (considering parent/subroom relationship)
      const matchesRoom = maintenance.roomid === room.roomId || maintenance.roomid === room.parentId || (room.parentId && maintenance.roomid === room.parentId);

      if (!maintenance.isMainteneceActive || !matchesRoom) {
        return false;
      }

      const existingMaintenanceStartDate = moment(maintenance.maintanceDate);
      const existingMaintenanceEndDate =
        maintenance.maintanceEndDate && maintenance.maintanceEndDate !== "0001-01-01T00:00:00"
          ? moment(maintenance.maintanceEndDate)
          : existingMaintenanceStartDate;

      // Check if existing maintenance date range overlaps with the selected date range
      const dateRangesOverlap =
        existingMaintenanceStartDate.isSameOrBefore(selectedEndDate, "day") && existingMaintenanceEndDate.isSameOrAfter(selectedStartDate, "day");

      if (!dateRangesOverlap) {
        return false;
      }

      // Check for time overlap on any overlapping date
      // Parse existing maintenance times - handle both formats
      const existingStartTime = maintenance.startTime.includes("T")
        ? maintenance.startTime.split("T")[1]?.split(":").slice(0, 2).join(":")
        : maintenance.startTime;
      const existingEndTime = maintenance.endTime.includes("T") ? maintenance.endTime.split("T")[1]?.split(":").slice(0, 2).join(":") : maintenance.endTime;

      // Check time overlap using standard interval overlap logic
      const existingMaintenanceStartMoment = moment(existingStartTime, "HH:mm");
      const existingMaintenanceEndMoment = moment(existingEndTime, "HH:mm");
      const newMaintenanceStartMoment = moment(startTime, "HH:mm");
      const newMaintenanceEndMoment = moment(endTime, "HH:mm");

      const timeOverlaps = newMaintenanceStartMoment.isBefore(existingMaintenanceEndMoment) && newMaintenanceEndMoment.isAfter(existingMaintenanceStartMoment);

      return timeOverlaps;
    });

    const hasOccupants = conflictingOccupants.length > 0;
    const hasMaintenanceConflict = conflictingMaintenance.length > 0;

    // Set conflict message with details
    if (hasOccupants && hasMaintenanceConflict) {
      setConflictMessage(
        `❌ Cannot schedule maintenance: ${conflictingOccupants.length} occupant(s) found in this room and ${conflictingMaintenance.length} maintenance schedule(s) overlap with the selected date range and time.`
      );
    } else if (hasOccupants) {
      setConflictMessage(
        `❌ Cannot schedule maintenance: There are ${conflictingOccupants.length} occupant(s) in this room during the selected date range and time.`
      );
    } else if (hasMaintenanceConflict) {
      setConflictMessage(
        `❌ Cannot schedule maintenance: ${conflictingMaintenance.length} existing maintenance schedule(s) overlap with the selected date range and time.`
      );
    } else {
      setConflictMessage("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Ensure room data is loaded before submitting
    if (!roomInfo || isLoadingData) {
      alert("Please wait for room data to load before submitting");
      return;
    }

    // Check for conflicts before submitting
    if (conflictMessage) {
      alert(conflictMessage);
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedStartDate = moment(startDate);
      const selectedEndDate = moment(endDate);
      const daysCount = selectedEndDate.diff(selectedStartDate, "days") + 1;

      // Create a single maintenance record for the entire date range
      const maintenanceData = {
        buildingId: room.buildingId,
        roomid: room.parentId || room.roomId, // Use parentId if it's a subroom, otherwise use roomId
        maintanceDate: startDate,
        maintanceEndDate: endDate,
        startTime: `${startTime}:00`, // Add seconds to match API format
        endTime: `${endTime}:00`, // Add seconds to match API format
        maintainenceType: maintenanceType,
        description: description,
        isMainteneceActive: "true",
      };

      const response = await callApi(process.env.NEXT_PUBLIC_GET_INSERT_MAINTENANCE_DATA || URL_NOT_FOUND, maintenanceData);

      if (response.success) {
        alert(`Maintenance scheduled successfully for ${daysCount} day${daysCount > 1 ? "s" : ""} (${startDate} to ${endDate})`);
        if (onSuccess) onSuccess();
        onClose();
      } else {
        alert("Failed to schedule maintenance");
      }
    } catch (error) {
      console.error("Error scheduling maintenance:", error);
      alert("Failed to schedule maintenance");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#00000070] text-gray-500 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Maintenance Request</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-800">{room.roomName}</h3>
          <p className="text-sm text-gray-600">Building: {room.buildingId}</p>
          <p className="text-sm text-gray-600">Capacity: {room.roomCapactiy}</p>
          <p className="text-sm text-gray-600">Type: {room.roomType}</p>
        </div>

        {/* Loading State */}
        {isLoadingData && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
              <p className="text-sm text-blue-700">Loading room data...</p>
            </div>
          </div>
        )}

        {/* Conflict Message */}
        {conflictMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 font-medium">{conflictMessage}</p>
          </div>
        )}

        {/* Success Message - No Conflicts */}
        {!conflictMessage && startDate && endDate && startTime && endTime && !isLoadingData && roomInfo && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700 font-medium">
              ✓ Room is available for the selected date range and time
              {startDate !== endDate && (
                <span className="block mt-1 text-xs">
                  ({moment(endDate).diff(moment(startDate), "days") + 1} day{moment(endDate).diff(moment(startDate), "days") > 0 ? "s" : ""})
                </span>
              )}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Maintenance Type</label>
            <select
              value={maintenanceType}
              onChange={(e) => setMaintenanceType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-orange-500"
              required
            >
              <option value="routine">Routine Maintenance</option>
              <option value="repair">Repair</option>
              <option value="cleaning">Cleaning</option>
              <option value="inspection">Inspection</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>

          <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={moment().format("YYYY-MM-DD")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-orange-500"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || moment().format("YYYY-MM-DD")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-orange-500"
                required
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-orange-500"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                min={startTime}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-orange-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-orange-500"
              placeholder="Describe the maintenance issue..."
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingData || !roomInfo || !!conflictMessage}
              className="flex-1 px-4 py-2 text-white bg-[#F26722] rounded-md hover:bg-[#a5705a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting
                ? "Submitting..."
                : isLoadingData
                ? "Loading..."
                : !roomInfo
                ? "Loading Room Data..."
                : conflictMessage
                ? "Cannot Submit - Conflict"
                : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MaintenanceCardModal;
