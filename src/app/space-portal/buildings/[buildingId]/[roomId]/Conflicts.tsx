import React, { useEffect, useState } from "react";
import {
  Clock,
  X,
  Calendar,
  Eye,
  Save,
  ChevronLeft,
  ChevronRight,
  TriangleAlert,
} from "lucide-react";
import { Slot } from "@/utils/slotsHelper";

interface ConflictSlotsListProps {
  existingSlots: Slot[];
  conflicts: Slot[];
  handleProceedAnyway: () => void;
  onClose: (allocationPerformed: Boolean) => void;
  onUpdateSlot: (date: string, oldSlot: Slot, updated: Slot) => void;
}

export const ConflictSlotsList: React.FC<ConflictSlotsListProps> = ({
  existingSlots,
  conflicts,
  handleProceedAnyway,
  onClose,
  onUpdateSlot,
}) => {
  const [editableConflicts, setEditableConflicts] = useState<Slot[]>([]);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  useEffect(() => {
    setEditableConflicts(conflicts);
  }, [conflicts]);

  const groupedConflicts = editableConflicts.reduce<Record<string, Slot[]>>(
    (acc, slot) => {
      const key = slot.date;
      if (!acc[key]) acc[key] = [];
      acc[key].push(slot);
      return acc;
    },
    {}
  );

  const handleDateChange = (slotId: string, days: number) => {
    setEditableConflicts((prevConflicts) =>
      prevConflicts.map((slot) => {
        if (slot.id === slotId) {
          const currentDate = new Date(slot.date);
          currentDate.setDate(currentDate.getDate() + days);
          const newDate = currentDate.toISOString().split("T")[0];
          // Only update activeDate if it's currently showing this slot's original date
          if (activeDate === slot.date) {
            setActiveDate(newDate);
          }
          return { ...slot, date: newDate };
        }
        return slot;
      })
    );
  };

  const handleTimeChange = (
    slotId: string,
    field: "start" | "end",
    value: string
  ) => {
    setEditableConflicts((prevConflicts) =>
      prevConflicts.map((slot) =>
        slot.id === slotId ? { ...slot, [field]: value } : slot
      )
    );
  };

  const handleSave = (oldSlot: Slot, updatedSlot: Slot) => {
    onUpdateSlot(updatedSlot.date, oldSlot, updatedSlot);
  };

  const calculateAvailableSlots = (date: string) => {
    const today = new Date().toISOString().split("T")[0];
    const currentTime = new Date();

    if (new Date(date) < new Date(today)) {
      return [];
    }

    const workingStart = 9 * 60; // 9:00 AM in minutes
    const workingEnd = 18 * 60; // 6:00 PM in minutes

    // Only consider EXISTING slots for calculating availability
    const occupiedIntervals = existingSlots
      .filter((s) => s.date === date)
      .map((slot) => ({
        start:
          parseInt(slot.start.split(":")[0]) * 60 +
          parseInt(slot.start.split(":")[1]),
        end:
          parseInt(slot.end.split(":")[0]) * 60 +
          parseInt(slot.end.split(":")[1]),
      }))
      .sort((a, b) => a.start - b.start);

    let freeIntervals = [];
    let currentPosition = workingStart;

    if (date === today) {
      const currentMinutes =
        currentTime.getHours() * 60 + currentTime.getMinutes();
      currentPosition = Math.max(currentPosition, currentMinutes);
    }

    occupiedIntervals.forEach((interval) => {
      const effectiveStart = Math.max(currentPosition, interval.start);
      const effectiveEnd = Math.min(workingEnd, interval.end);

      if (currentPosition < effectiveStart) {
        freeIntervals.push({ start: currentPosition, end: effectiveStart });
      }
      currentPosition = Math.max(currentPosition, effectiveEnd);
    });

    if (currentPosition < workingEnd) {
      freeIntervals.push({ start: currentPosition, end: workingEnd });
    }

    return freeIntervals.map((interval) => {
      const startHour = String(Math.floor(interval.start / 60)).padStart(
        2,
        "0"
      );
      const startMin = String(interval.start % 60).padStart(2, "0");
      const endHour = String(Math.floor(interval.end / 60)).padStart(2, "0");
      const endMin = String(interval.end % 60).padStart(2, "0");
      return `${startHour}:${startMin} → ${endHour}:${endMin}`;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-row justify-between">
        <h2 className="text-lg font-semibold text-red-600 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Conflicting Slots
        </h2>
        <X
          className="w-6 h-6 stroke-gray-500 hover:stroke-gray-700 cursor-pointer"
          onClick={() => onClose(conflicts.length === 0)}
        />
      </div>
      {Object.entries(groupedConflicts).map(([date, slots]) => {
        const originalDate =
          conflicts.find((c) => c.id === slots[0].id)?.date || date;
        return (
          <div
            key={date}
            className="rounded-lg border border-red-300 bg-red-50 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-700 font-medium">
                <Calendar className="w-4 h-4" />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDateChange(slots[0].id, -1)}
                    className="text-gray-500 hover:text-gray-800"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-gray-800">{date}</span>
                  <button
                    onClick={() => handleDateChange(slots[0].id, 1)}
                    className="text-gray-500 hover:text-gray-800"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <button
                onClick={() => setActiveDate(activeDate === date ? null : date)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
              >
                <Eye className="w-4 h-4" />
                View Day Schedule
              </button>
            </div>
            <ul className="mt-2 space-y-2">
              {slots.map((slot) => {
                const originalSlot = conflicts.find((s) => s.id === slot.id);
                return (
                  <li
                    key={slot.id}
                    className="flex items-center gap-2 text-sm text-gray-800 bg-white border border-red-200 px-2 py-1 rounded-md"
                  >
                    <input
                      type="time"
                      value={slot.start}
                      onChange={(e) =>
                        handleTimeChange(slot.id, "start", e.target.value)
                      }
                      className="border rounded px-1 py-0.5 text-sm"
                    />
                    →
                    <input
                      type="time"
                      value={slot.end}
                      onChange={(e) =>
                        handleTimeChange(slot.id, "end", e.target.value)
                      }
                      className="border rounded px-1 py-0.5 text-sm"
                    />
                    <button
                      onClick={() =>
                        originalSlot && handleSave(originalSlot, slot)
                      }
                      className="ml-auto flex items-center gap-1 text-green-600 hover:underline"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                  </li>
                );
              })}
            </ul>

            {activeDate === date && (
              <div className="mt-4 border-t pt-4 grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Existing Slots:
                  </h3>
                  <ul className="space-y-1">
                    {existingSlots.filter((s) => s.date === date).length > 0 ? (
                      existingSlots
                        .filter((s) => s.date === date)
                        .map((slot, i) => (
                          <li key={i} className="text-xs text-gray-600">
                            {slot.start} → {slot.end}
                          </li>
                        ))
                    ) : (
                      <li className="text-xs text-gray-500 italic">
                        No existing slots on this day.
                      </li>
                    )}
                  </ul>
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Available Time Slots:
                  </h3>
                  <ul className="space-y-1">
                    {calculateAvailableSlots(date).length > 0 ? (
                      calculateAvailableSlots(date).map((slot, i) => (
                        <li key={i} className="text-xs text-green-600">
                          {slot}
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-gray-500 italic">
                        No available slots.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {conflicts.length === 0 && (
        <div className="flex flex-row">
          <p className="text-sm text-gray-500">✅ No conflicts found. </p>
          <p className="text-sm text-gray-500">✅ Allocation successful.</p>
        </div>
      )}
      {conflicts.length > 0 && (
        <div className=" flex justify-center flex-col">
          <label className="flex felx-row text-red-700 p-4">
            <TriangleAlert className="mr-4" />
            Conflicted slots cannot be created!!
          </label>
          <button
            onClick={handleProceedAnyway}
            type="submit"
            className="mb-4 px-3 py-2 bg-[#F26722] text-white rounded-lg shadow-md hover:bg-[#a5705a] transition duration-300"
          >
            Proceed
          </button>
        </div>
      )}
    </div>
  );
};
