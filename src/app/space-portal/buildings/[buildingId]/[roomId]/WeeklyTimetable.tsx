"use client";

import React from "react";
import { addDaysToDate } from "@/utils";
import moment from "moment";
import { Occupant, Maintenance } from "@/types";
import AllocationDetailsModal from "@/components/AllocationDetailsModal";
import UpdateSlotModal from "@/components/UpdateSlotModal";
import MaintenanceInfoModal from "@/components/MaintenanceInfoModal";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";

type WeeklyTimetableProps = {
  startDate: Date;
  isManagedByThisUser: Boolean;
  setStartDate: React.Dispatch<React.SetStateAction<Date>>;
  occupants: Occupant[];
  maintenanceData: Maintenance[];
  academicSessionStartDate: string;
  academicSessionEndDate: string;
  onClickTimeTableSlot: (date: string, slot: { start: string; end: string }) => void;
  refreshData: () => void;
  roomId: string;
  roomParentId?: string;
};

function WeeklyTimetable({
  occupants,
  maintenanceData,
  isManagedByThisUser,
  startDate,
  setStartDate,
  onClickTimeTableSlot,
  academicSessionStartDate,
  academicSessionEndDate,
  refreshData,
  roomId,
  roomParentId,
}: WeeklyTimetableProps) {
  const startHour = 9;
  const endHour = 18;
  const slotInterval = 60; // minutes
  const slotHeight = 64; // taller row height for readability

  /** Build slots */
  const timeSlots: { start: string; end: string }[] = [];
  for (let m = startHour * 60; m < endHour * 60; m += slotInterval) {
    const startHours = Math.floor(m / 60);
    const startMinutes = m % 60;
    const endMinutesTotal = m + slotInterval;
    const endHours = Math.floor(endMinutesTotal / 60);
    const endMinutes = endMinutesTotal % 60;

    timeSlots.push({
      start: `${String(startHours).padStart(2, "0")}:${String(startMinutes).padStart(2, "0")}`,
      end: `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`,
    });
  }

  /** Session boundaries */
  const sessionStartDate = academicSessionStartDate ? new Date(academicSessionStartDate) : null;
  const sessionEndDate = academicSessionEndDate ? new Date(academicSessionEndDate) : null;

  /** Always align week start to Monday */
  let clampedStartDate = moment(startDate).startOf("isoWeek").toDate();

  if (sessionStartDate && clampedStartDate < sessionStartDate) {
    clampedStartDate = sessionStartDate;
  }
  if (sessionEndDate) {
    const lastPossibleStart = moment(sessionEndDate).startOf("isoWeek").toDate();
    if (clampedStartDate > lastPossibleStart) {
      clampedStartDate = lastPossibleStart;
    }
  }

  /** Generate days for the current week (Mon–Sun) */
  const upcomingDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDaysToDate(clampedStartDate, i);
    if (sessionEndDate && d > sessionEndDate) break;
    upcomingDates.push(d);
  }

  /** Slot availability check */
  const isSlotAvailable = (date: Date, slot: { start: string; end: string }) => {
    const [endHour, endMinute] = slot.end.split(":").map(Number);
    const slotDateTimeEnd = moment(date).hour(endHour).minute(endMinute).second(0).millisecond(0);

    const now = moment();
    return slotDateTimeEnd.isSameOrAfter(now);
  };

  const [selectedOccupant, setSelectedOccupant] = React.useState<Occupant | null>(null);
  const [showUpdateModal, setShowUpdateModal] = React.useState<boolean>(false);
  const [selectedMaintenance, setSelectedMaintenance] = React.useState<Maintenance | null>(null);

  /** Navigation */
  const handlePrevWeek = () => {
    const prevStart = moment(clampedStartDate).subtract(1, "week").toDate();
    if (sessionStartDate && prevStart < sessionStartDate) {
      setStartDate(sessionStartDate);
    } else {
      setStartDate(prevStart);
    }
  };

  const handleNextWeek = () => {
    const nextStart = moment(clampedStartDate).add(1, "week").toDate();
    if (sessionEndDate) {
      const lastPossibleStart = moment(sessionEndDate).startOf("isoWeek").toDate();
      if (nextStart > lastPossibleStart) {
        setStartDate(lastPossibleStart);
      } else {
        setStartDate(nextStart);
      }
    } else {
      setStartDate(nextStart);
    }
  };

  const handleDelete = async (id: string) => {
    const response = await callApi(process.env.NEXT_PUBLIC_UPDATE_SPACE_ALLOCATION_ENTRY || URL_NOT_FOUND, {
      allocationEntNo: id,
      isAllocationActive: false,
      roomID: selectedOccupant?.roomId,
      subRoomID: selectedOccupant?.subroomId,
      startTime: selectedOccupant?.startTime ? moment(selectedOccupant.startTime, "HH:mm").format("HH:mm:ss") : "",
      endTime: selectedOccupant?.endTime ? moment(selectedOccupant.endTime, "HH:mm").format("HH:mm:ss") : "",
      remarks: "",
      scheduledDate: selectedOccupant?.scheduledDate ? moment(selectedOccupant.scheduledDate).format("YYYY-MM-DD") : "",
    });
    if (response.success) {
      setSelectedOccupant(null);
      refreshData();
    }
  };

  const handleUpdate = () => {
    setShowUpdateModal(true);
  };

  const handleUpdateSuccess = () => {
    setShowUpdateModal(false);
    setSelectedOccupant(null);
    refreshData();
  };

  return (
    <div className="flex flex-col items-center min-h-screen font-sans antialiased">
      <div className="w-full max-w-7xl rounded-lg shadow-lg bg-white overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-200">
          <button
            className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
            onClick={handlePrevWeek}
            disabled={(sessionStartDate && clampedStartDate.getTime() === sessionStartDate.getTime()) ?? true}
          >
            Previous
          </button>
          <div className="font-semibold text-gray-700">
            Week of{" "}
            {upcomingDates[0]?.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}{" "}
            -{" "}
            {upcomingDates[upcomingDates.length - 1]?.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
          <button
            className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
            onClick={handleNextWeek}
            disabled={(sessionEndDate && upcomingDates[upcomingDates.length - 1]?.toDateString() === sessionEndDate.toDateString()) ?? true}
          >
            Next
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto p-3">
          <table className="w-full text-left min-w-[900px] border-collapse">
            <thead className="bg-white sticky top-0 z-10 shadow-sm">
              <tr>
                <th key={"time"} className="px-4 py-3 text-sm font-medium text-gray-500 w-24">
                  Time
                </th>
                {upcomingDates.map((date, index) => (
                  <th key={index} className="px-2 py-3 text-xs font-medium text-gray-500 text-center border-l border-gray-200 min-w-[140px]">
                    {date.toLocaleDateString("en-US", { weekday: "short" })}
                    <br />
                    <span className="text-sm font-bold text-gray-800">
                      {date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {/* Time column */}
                <td key={"time-column"} className="align-top bg-white sticky left-0 px-2 border-r border-gray-200">
                  {timeSlots.map((slot) => (
                    <div key={slot.start} className="h-16 flex items-start text-xs text-gray-700">
                      {slot.start}
                    </div>
                  ))}
                </td>

                {/* Day columns */}
                {upcomingDates.map((date) => (
                  <td key={date.toISOString()} className="relative border-l border-gray-200 align-top">
                    {/* Grid slots */}
                    {timeSlots.map((slot) => {
                      const isAvailable = isSlotAvailable(date, slot);
                      return (
                        <div
                          key={slot.start}
                          className={`relative h-16 border-b border-gray-200 cursor-pointer transition-colors ${
                            isAvailable ? "bg-green-100 hover:bg-green-200" : "bg-gray-100"
                          }`}
                          onClick={() => isAvailable && onClickTimeTableSlot(moment(date).format("YYYY-MM-DD"), slot)}
                        />
                      );
                    })}

                    {/* Occupants floating */}
                    {occupants
                      .filter((o) => {
                        const scheduledDate = new Date(o.scheduledDate as any);
                        return scheduledDate.toDateString() === date.toDateString();
                      })
                      .map((occupant) => {
                        const startMins = parseInt(occupant.startTime.split(":")[0]) * 60 + parseInt(occupant.startTime.split(":")[1]);
                        const endMins = parseInt(occupant.endTime.split(":")[0]) * 60 + parseInt(occupant.endTime.split(":")[1]);
                        const dayStartMins = startHour * 60;

                        const top = ((startMins - dayStartMins) / slotInterval) * slotHeight;
                        const height = ((endMins - startMins) / slotInterval) * slotHeight;

                        const isEditable = occupant.isEditable === "true";
                        const bgColor = isEditable ? "bg-blue-100" : "bg-yellow-100";
                        const borderColor = isEditable ? "border-blue-300" : "border-yellow-300";
                        const hoverColor = isEditable ? "hover:bg-blue-200" : "hover:bg-yellow-200";
                        const textColor = isEditable ? "text-blue-800" : "text-yellow-800";
                        const subTextColor = isEditable ? "text-blue-600" : "text-yellow-600";

                        return (
                          <div
                            key={occupant.Id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOccupant(occupant);
                            }}
                            className={`absolute left-1 right-1 ${bgColor} border ${borderColor} rounded-md px-2 py-1 text-xs cursor-pointer ${hoverColor} transition-colors shadow-sm`}
                            style={{ top, height }}
                          >
                            <div className={`font-medium ${textColor} truncate`}>{occupant.occupantName}</div>
                            <div className={`${subTextColor} text-[11px] truncate`}>
                              {occupant.type} • {`${occupant.startTime}`} -{`${occupant.endTime}`}
                            </div>
                          </div>
                        );
                      })}

                    {/* Maintenance slots floating */}
                    {maintenanceData
                      .filter((maintenance) => {
                        const maintenanceDate = new Date(maintenance.maintanceDate);
                        const isDateMatch = maintenanceDate.toDateString() === date.toDateString();
                        const isActive = maintenance.isMainteneceActive;

                        // Check if maintenance is for this room or its parent room
                        const isRoomMatch = maintenance.roomid === roomId;
                        const isParentMatch = roomParentId && maintenance.roomid === roomParentId;

                        return isDateMatch && isActive && (isRoomMatch || isParentMatch);
                      })
                      .map((maintenance) => {
                        // Parse time from the API format (e.g., "0001-01-02T09:00:00Z")
                        const startTimeStr = maintenance.startTime.split("T")[1]?.split("Z")[0] || "09:00:00";
                        const endTimeStr = maintenance.endTime.split("T")[1]?.split("Z")[0] || "10:30:00";

                        const startMins = parseInt(startTimeStr.split(":")[0]) * 60 + parseInt(startTimeStr.split(":")[1]);
                        const endMins = parseInt(endTimeStr.split(":")[0]) * 60 + parseInt(endTimeStr.split(":")[1]);
                        const dayStartMins = startHour * 60;

                        const top = ((startMins - dayStartMins) / slotInterval) * slotHeight;
                        const height = ((endMins - startMins) / slotInterval) * slotHeight;

                        return (
                          <div
                            key={`maintenance-${maintenance.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMaintenance(maintenance);
                            }}
                            className="absolute left-1 right-1 bg-red-100 border border-red-300 rounded-md px-2 py-1 text-xs cursor-pointer hover:bg-red-200 transition-colors shadow-sm"
                            style={{ top, height }}
                          >
                            <div className="font-medium text-red-800 truncate">🔧 Maintenance</div>
                            <div className="text-red-600 text-[11px] truncate">
                              {maintenance.maintainenceType || "Scheduled"} • {startTimeStr.substring(0, 5)} - {endTimeStr.substring(0, 5)}
                            </div>
                            {maintenance.description && <div className="text-red-500 text-[10px] truncate mt-1">{maintenance.description}</div>}
                          </div>
                        );
                      })}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {selectedOccupant && (
        <AllocationDetailsModal
          occupant={selectedOccupant}
          isManagedByThisUser={isManagedByThisUser}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          onClose={() => setSelectedOccupant(null)}
        />
      )}

      {showUpdateModal && selectedOccupant && (
        <UpdateSlotModal
          occupant={selectedOccupant}
          occupants={occupants}
          onClose={() => setShowUpdateModal(false)}
          onUpdate={handleUpdateSuccess}
          academicSessionStartDate={academicSessionStartDate}
          academicSessionEndDate={academicSessionEndDate}
        />
      )}

      {selectedMaintenance && <MaintenanceInfoModal maintenance={selectedMaintenance} onClose={() => setSelectedMaintenance(null)} />}
    </div>
  );
}

export default WeeklyTimetable;
