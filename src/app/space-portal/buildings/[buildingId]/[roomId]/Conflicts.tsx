import React, { useEffect, useState } from "react";
import { Clock, Calendar, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { checkSlotConflicts, Slot } from "@/utils/slotsHelper";
import moment from "moment";

interface ConflictSlotsListProps {
  existingSlots: Slot[];
  createdSlots: Slot[];
  onSlotGroupsChange: (groups: { resolved: Slot[]; unresolved: Slot[] }) => void;
}

export const ConflictSlotsList: React.FC<ConflictSlotsListProps> = ({ existingSlots, createdSlots, onSlotGroupsChange }) => {
  const [conflicts, setConflicts] = useState<Slot[]>([]);
  const [editableConflicts, setEditableConflicts] = useState<Slot[]>([]);
  const [activeConflictId, setActiveConflictId] = useState<string | null>(null);
  const [conflictStatus, setConflictStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const overlapErrors = checkSlotConflicts(createdSlots, existingSlots);
    setConflicts(overlapErrors);
  }, [createdSlots, existingSlots]);

  useEffect(() => {
    setEditableConflicts(conflicts);
  }, [conflicts]);

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

    const nonConflicting = createdSlots.filter((slot) => !conflicts.some((c) => c.id === slot.id));

    onSlotGroupsChange({
      resolved: [...resolved, ...nonConflicting],
      unresolved,
    });
  }, [editableConflicts, conflictStatus, createdSlots, conflicts, onSlotGroupsChange]);

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

    let freeIntervals: { start: number; end: number }[] = [];
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

  return (
    <div className="space-y-4 w-100">
      <div className="flex flex-row justify-between">
        <h2 className="text-sm font-semibold text-red-600 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Conflicting slots cannot be created!!
        </h2>
      </div>
      <div className="overflow-y-scroll h-[70vh]">
        {editableConflicts.map((slot) => {
          const isConflicting = conflictStatus[slot.id];
          const isActive = activeConflictId === slot.id;

          return (
            <div
              key={slot.id}
              className={`rounded-lg p-2 shadow-sm mb-2 border ${isConflicting ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"}`}
            >
              <div className="flex items-center justify-between">
                <div className={`flex items-center gap-2 font-medium ${isConflicting ? "text-red-700" : "text-green-700"}`}>
                  <Calendar className="w-4 h-4" />
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDateChange(slot.id, -1)} className="text-gray-500 hover:text-gray-800">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-bold text-gray-800">{moment(slot.date, "YYYY-MM-DD").format("DD-MM-YYYY")}</span>
                    <button onClick={() => handleDateChange(slot.id, 1)} className="text-gray-500 hover:text-gray-800">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setActiveConflictId(isActive ? null : slot.id)}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  <Eye className="w-4 h-4" />
                  View Day Schedule
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm px-2 py-1 rounded-md border bg-white">
                <input
                  type="time"
                  value={slot.start}
                  onChange={(e) => handleTimeChange(slot.id, "start", e.target.value)}
                  className="border rounded px-1 py-0.5 text-sm"
                />
                →
                <input
                  type="time"
                  value={slot.end}
                  onChange={(e) => handleTimeChange(slot.id, "end", e.target.value)}
                  className="border rounded px-1 py-0.5 text-sm"
                />
              </div>

              {isActive && (
                <div className="mt-4 border-t pt-4 grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700">Existing Slots:</h3>
                    <ul className="space-y-1">
                      {existingSlots.filter((s) => s.date === slot.date).length > 0 ? (
                        existingSlots
                          .filter((s) => s.date === slot.date)
                          .map((s, i) => (
                            <li key={i} className="text-xs text-gray-600">
                              {s.start} → {s.end}
                            </li>
                          ))
                      ) : (
                        <li className="text-xs text-gray-500 italic">No existing slots on this day.</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700">Available Time Slots:</h3>
                    <ul className="space-y-1">
                      {calculateAvailableSlots(slot.date).length > 0 ? (
                        calculateAvailableSlots(slot.date).map((s, i) => (
                          <li key={i} className="text-xs text-green-600 cursor-pointer hover:underline" onClick={() => handleAvailableSlotClick(slot.id, s)}>
                            {s}
                          </li>
                        ))
                      ) : (
                        <li className="text-xs text-gray-500 italic">No available slots.</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
