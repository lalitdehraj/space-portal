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
}

const MaintenanceCardModal: React.FC<MaintenanceCardModalProps> = ({ room, onClose }) => {
  const [maintenanceType, setMaintenanceType] = useState("routine");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(moment().format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(moment().format("YYYY-MM-DD"));
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
    if (!startDate || !endDate || !roomInfo) {
      setConflictMessage("");
      return;
    }

    checkForConflicts();
  }, [startDate, endDate, roomInfo, maintenanceRecords]);

  // Check for conflicts with existing occupants or maintenance
  const checkForConflicts = () => {
    const selectedStartDate = moment(startDate);
    const selectedEndDate = moment(endDate);

    // Check for occupants in the room during the selected date range
    const conflictingOccupants =
      roomInfo?.occupants?.filter((occupant) => {
        const occupantDate = moment(occupant.scheduledDate);

        // Check if occupant date falls within the selected date range
        return occupantDate.isSameOrAfter(selectedStartDate, "day") && occupantDate.isSameOrBefore(selectedEndDate, "day");
      }) || [];

    // Check for existing maintenance during the selected date range
    const conflictingMaintenance = maintenanceRecords.filter((maintenance) => {
      // Only check active maintenance for the same room (considering parent/subroom relationship)
      const matchesRoom = maintenance.roomid === room.roomId || maintenance.roomid === room.parentId || (room.parentId && maintenance.roomid === room.parentId);

      if (!maintenance.isMainteneceActive || !matchesRoom) {
        return false;
      }

      const maintenanceDate = moment(maintenance.maintanceDate);

      // Check if maintenance date falls within the selected date range
      return maintenanceDate.isSameOrAfter(selectedStartDate, "day") && maintenanceDate.isSameOrBefore(selectedEndDate, "day");
    });

    const hasOccupants = conflictingOccupants.length > 0;
    const hasMaintenanceConflict = conflictingMaintenance.length > 0;

    // Set conflict message with details
    if (hasOccupants && hasMaintenanceConflict) {
      setConflictMessage(
        `❌ Cannot schedule maintenance: ${conflictingOccupants.length} occupant(s) found in this room and ${conflictingMaintenance.length} maintenance schedule(s) overlap.`
      );
    } else if (hasOccupants) {
      setConflictMessage(`❌ Cannot schedule maintenance: There are ${conflictingOccupants.length} occupant(s) in this room during the selected dates.`);
    } else if (hasMaintenanceConflict) {
      setConflictMessage(`❌ Cannot schedule maintenance: ${conflictingMaintenance.length} existing maintenance schedule(s) overlap with the selected dates.`);
    } else {
      setConflictMessage("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check for conflicts before submitting
    if (conflictMessage) {
      alert(conflictMessage);
      return;
    }

    setIsSubmitting(true);

    // TODO: Implement maintenance request submission logic
    console.log("Maintenance request:", {
      roomId: room.roomId,
      roomName: room.roomName,
      buildingId: room.buildingId,
      maintenanceType,
      description,
      startDate,
      endDate,
    });

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      onClose();
    }, 1000);
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
        {!conflictMessage && startDate && endDate && !isLoadingData && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700 font-medium">✓ Room is available for the selected dates</p>
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
              disabled={isSubmitting || isLoadingData || !!conflictMessage}
              className="flex-1 px-4 py-2 text-white bg-[#F26722] rounded-md hover:bg-[#a5705a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? "Submitting..." : isLoadingData ? "Loading..." : conflictMessage ? "Cannot Submit - Conflict" : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MaintenanceCardModal;
