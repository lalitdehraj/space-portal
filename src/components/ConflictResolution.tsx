"use client";
import React, { useEffect, useState } from "react";
import { Clock, Calendar, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { Slot } from "@/utils/slotsHelper";
import moment from "moment";

interface ConflictResolutionProps {
  existingSlots: Slot[];
  conflictingSlots: Slot[];
  onResolve: (resolvedSlots: Slot[]) => void;
  onProceedAnyway: () => void;
  onClose: () => void;
}

export const ConflictResolution: React.FC<ConflictResolutionProps> = ({ existingSlots, conflictingSlots, onResolve, onProceedAnyway, onClose }) => {
  const [editableConflicts, setEditableConflicts] = useState<Slot[]>([]);
  const [activeConflictId, setActiveConflictId] = useState<string | null>(null);
  const [conflictStatus, setConflictStatus] = useState<Record<string, boolean>>({});
  const [slotGroups, setSlotGroups] = useState<{ resolved: Slot[]; unresolved: Slot[] }>({
    resolved: [],
    unresolved: [],
  });

  useEffect(() => {
    setEditableConflicts(conflictingSlots);
  }, [conflictingSlots]);

  useEffect(() => {
    validateConflicts(editableConflicts);
  }, [editableConflicts, existingSlots]);

  useEffect(() => {
    const resolved: Slot[] = [];
    const unresolved: Slot[] = [];

    editableConflicts.forEach((slot) => {
      if (conflictStatus[slot.id] === false) resolved.push(slot);
      else unresolved.push(slot);
    });

    setSlotGroups({
      resolved,
      unresolved,
    });
  }, [editableConflicts, conflictStatus]);

  const handleDateChange = (slotId: string, days: number) => {
    setEditableConflicts((prevConflicts) =>
      prevConflicts.map((slot) => {
        if (slot.id === slotId) {
          const currentDate = new Date(slot.date);
          currentDate.setDate(currentDate.getDate() + days);
          const newDate = currentDate.toISOString().split("T")[0];
          return { ...slot, date: newDate };
        }
        return slot;
      })
    );
  };

  const handleTimeChange = (slotId: string, field: "start" | "end", value: string) => {
    setEditableConflicts((prevConflicts) => prevConflicts.map((slot) => (slot.id === slotId ? { ...slot, [field]: value } : slot)));
  };

  const validateConflicts = (slots: Slot[]) => {
    const status: Record<string, boolean> = {};
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();

    slots.forEach((slot) => {
      let isInvalid = false;

      const start = new Date(`${slot.date}T${slot.start}`);
      const end = new Date(`${slot.date}T${slot.end}`);

      // Validation rules
      if (slot.date < today) {
        isInvalid = true; // past date
      }
      if (slot.date === today && start < now) {
        isInvalid = true; // start time already passed
      }
      if (end <= start) {
        isInvalid = true; // end not after start
      }

      // Overlap check with existing
      const overlaps = existingSlots.some((s) => s.date === slot.date && !(s.end <= slot.start || s.start >= slot.end));

      status[slot.id] = isInvalid || overlaps;
    });
    setConflictStatus(status);
  };

  const calculateAvailableSlots = (date: string) => {
    const today = new Date().toISOString().split("T")[0];
    const currentTime = new Date();
    if (new Date(date) < new Date(today)) return [];

    const workingStart = 9 * 60;
    const workingEnd = 18 * 60;

    const occupiedIntervals = existingSlots
      .filter((s) => s.date === date)
      .map((slot) => ({
        start: parseInt(slot.start.split(":")[0]) * 60 + parseInt(slot.start.split(":")[1]),
        end: parseInt(slot.end.split(":")[0]) * 60 + parseInt(slot.end.split(":")[1]),
      }))
      .sort((a, b) => a.start - b.start);

    const freeIntervals: { start: number; end: number }[] = [];
    let currentPosition = workingStart;

    if (date === today) {
      const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
      currentPosition = Math.max(currentPosition, currentMinutes);
    }

    occupiedIntervals.forEach((interval) => {
      if (currentPosition < interval.start) {
        freeIntervals.push({ start: currentPosition, end: interval.start });
      }
      currentPosition = Math.max(currentPosition, interval.end);
    });

    if (currentPosition < workingEnd) {
      freeIntervals.push({ start: currentPosition, end: workingEnd });
    }

    return freeIntervals.map((interval) => {
      const startHour = String(Math.floor(interval.start / 60)).padStart(2, "0");
      const startMin = String(interval.start % 60).padStart(2, "0");
      const endHour = String(Math.floor(interval.end / 60)).padStart(2, "0");
      const endMin = String(interval.end % 60).padStart(2, "0");
      return `${startHour}:${startMin} → ${endHour}:${endMin}`;
    });
  };

  const handleAvailableSlotClick = (slotId: string, timeString: string) => {
    const [start, end] = timeString.split(" → ");
    handleTimeChange(slotId, "start", start);
    handleTimeChange(slotId, "end", end);
  };

  // Helper function to check if a conflict is specifically with maintenance
  const hasMaintenanceConflict = (slot: Slot) => {
    return existingSlots.some((s) => s.date === slot.date && s.id?.startsWith("maintenance-") && !(s.end <= slot.start || s.start >= slot.end));
  };

  const handleResolveConflicts = () => {
    if (slotGroups.unresolved.length > 0) {
      const confirmProceed = window.confirm(
        `⚠️ Some slots are still in conflict:\n${slotGroups.unresolved
          .map((s) => `${s.date} ${s.start} → ${s.end}`)
          .join("\n")}\n\nDo you want to proceed anyway?`
      );
      if (confirmProceed) {
        onResolve(slotGroups.resolved);
      }
    } else {
      onResolve(slotGroups.resolved);
    }
  };

  return (
    <section className="fixed inset-0 z-50 h-screen w-screen bg-[#00000070] flex items-center justify-center text-gray-500">
      <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl p-6">
        <div className="max-h-[80vh] bg-white overflow-y-scroll mr-4 pr-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-red-600 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Conflict Resolution Required
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              The following time slots conflict with existing allocations. Please adjust the dates or times to resolve conflicts.
            </p>
          </div>

          <div className="space-y-4">
            {editableConflicts.map((slot) => {
              const isConflicting = conflictStatus[slot.id];
              const isActive = activeConflictId === slot.id;
              const hasMaintenance = hasMaintenanceConflict(slot);

              return (
                <div
                  key={slot.id}
                  className={`rounded-lg p-4 shadow-sm border ${
                    isConflicting ? (hasMaintenance ? "border-red-400 bg-red-100" : "border-red-300 bg-red-50") : "border-green-300 bg-green-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`flex items-center gap-2 font-medium ${isConflicting ? "text-red-700" : "text-green-700"}`}>
                      <Calendar className="w-4 h-4" />
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDateChange(slot.id, -1)} className="text-gray-500 hover:text-gray-800 p-1 rounded hover:bg-gray-200">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="font-bold text-gray-800 px-2">{moment(slot.date, "YYYY-MM-DD").format("DD-MM-YYYY")}</span>
                        <button onClick={() => handleDateChange(slot.id, 1)} className="text-gray-500 hover:text-gray-800 p-1 rounded hover:bg-gray-200">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                      {hasMaintenance && <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded-full">Maintenance</span>}
                    </div>
                    <button
                      onClick={() => setActiveConflictId(isActive ? null : slot.id)}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                      <Eye className="w-4 h-4" />
                      {isActive ? "Hide" : "View"} Day Schedule
                    </button>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-sm px-3 py-2 rounded-md border bg-white">
                    <input
                      type="time"
                      value={slot.start}
                      onChange={(e) => handleTimeChange(slot.id, "start", e.target.value)}
                      className="border rounded px-2 py-1 text-sm focus:outline-none focus:border-orange-500"
                    />
                    <span className="text-gray-500">→</span>
                    <input
                      type="time"
                      value={slot.end}
                      onChange={(e) => handleTimeChange(slot.id, "end", e.target.value)}
                      className="border rounded px-2 py-1 text-sm focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  {isActive && (
                    <div className="mt-4 border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Existing Slots:</h3>
                        <div className="max-h-32 overflow-y-auto">
                          {existingSlots.filter((s) => s.date === slot.date).length > 0 ? (
                            <ul className="space-y-1">
                              {existingSlots
                                .filter((s) => s.date === slot.date)
                                .map((s, i) => {
                                  const isMaintenance = s.id?.startsWith("maintenance-");
                                  return (
                                    <li
                                      key={i}
                                      className={`text-xs px-2 py-1 rounded ${
                                        isMaintenance ? "text-red-600 font-medium bg-red-100" : "text-gray-600 bg-gray-100"
                                      }`}
                                    >
                                      {s.start} → {s.end}
                                      {isMaintenance && " 🔧"}
                                    </li>
                                  );
                                })}
                            </ul>
                          ) : (
                            <p className="text-xs text-gray-500 italic">No existing slots on this day.</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Available Time Slots:</h3>
                        <div className="max-h-32 overflow-y-auto">
                          {calculateAvailableSlots(slot.date).length > 0 ? (
                            <ul className="space-y-1">
                              {calculateAvailableSlots(slot.date).map((s, i) => (
                                <li
                                  key={i}
                                  className="text-xs text-green-600 cursor-pointer hover:underline bg-green-50 px-2 py-1 rounded hover:bg-green-100"
                                  onClick={() => handleAvailableSlotClick(slot.id, s)}
                                >
                                  {s}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-gray-500 italic">No available slots.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {isConflicting && (
                    <div className="mt-2 text-xs text-red-600">
                      ⚠️ This slot conflicts with existing allocations
                      {hasMaintenance && " (including maintenance schedules)"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">Resolution Summary</h3>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Resolved slots:</span>
                <span className="text-green-600 font-medium">{slotGroups.resolved.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Unresolved conflicts:</span>
                <span className="text-red-600 font-medium">{slotGroups.unresolved.length}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center space-x-4 mt-6">
            <button
              type="button"
              className="px-4 py-2 rounded-lg shadow-md transition duration-300 bg-gray-100 text-gray-500 hover:bg-gray-200"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg shadow-md transition duration-300 bg-yellow-500 text-white hover:bg-yellow-600"
              onClick={onProceedAnyway}
            >
              Proceed Anyway
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg shadow-md transition duration-300 bg-orange-500 text-white hover:bg-orange-600"
              onClick={handleResolveConflicts}
            >
              Resolve Conflicts
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
