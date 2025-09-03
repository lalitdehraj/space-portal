import React from "react";
import { addDaysToDate, createDateFromDDMMYYYY } from "@/utils";

type Occupant = {
  occupantName?: string;
  type?: string;
  eventId: string;
  startTime?: string | Date;
  scheduledDate?: string | Date;
  endTime?: string | Date;
};

type OccupantWithPercentage = Occupant & {
  percentage: number;
  offset: number;
};

type WeeklyTimetableProps = {
  startDate: Date;
  setStartDate: React.Dispatch<React.SetStateAction<Date>>;
  occupants: Occupant[];
  academicSessionStartDate: string;
  academicSessionEndDate: string;
  onClickTimeTableSlot: (
    date: Date,
    slot: { start: string; end: string }
  ) => void;
};

function toMinutes(t: string | Date) {
  if (typeof t === "string") {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  } else if (t instanceof Date) {
    return t.getHours() * 60 + t.getMinutes();
  }
  return 0;
}

function getOccupantsForSlotWithPercentage(
  date: Date,
  slot: { start: string; end: string },
  occupants: Occupant[]
): OccupantWithPercentage[] {
  const slotStart = toMinutes(slot.start);
  const slotEnd = toMinutes(slot.end);
  const slotDuration = slotEnd - slotStart;

  return occupants
    .map((occupant) => {
      if (!occupant.startTime || !occupant.endTime || !occupant.scheduledDate) {
        return null;
      }
      let scheduledDate: Date | null = null;
      if (typeof occupant.scheduledDate === "string") {
        scheduledDate = new Date(occupant.scheduledDate);
        if (isNaN(scheduledDate.getTime())) {
          scheduledDate = createDateFromDDMMYYYY(occupant.scheduledDate);
        }
      } else if (occupant.scheduledDate instanceof Date) {
        scheduledDate = occupant.scheduledDate;
      }
      if (!scheduledDate) return null;
      if (scheduledDate.toDateString() !== date.toDateString()) return null;

      const occupantStart = toMinutes(occupant.startTime);
      const occupantEnd = toMinutes(occupant.endTime);

      const overlapStart = Math.max(slotStart, occupantStart);
      const overlapEnd = Math.min(slotEnd, occupantEnd);

      const overlapDuration = Math.max(0, overlapEnd - overlapStart);

      if (overlapDuration > 0) {
        return {
          ...occupant,
          percentage: (overlapDuration / slotDuration) * 100,
          offset: ((overlapStart - slotStart) / slotDuration) * 100,
        };
      }
      return null;
    })
    .filter((p): p is OccupantWithPercentage => p !== null);
}

function WeeklyTimetable({
  occupants,
  startDate,
  setStartDate,
  onClickTimeTableSlot,
  academicSessionStartDate,
  academicSessionEndDate,
}: WeeklyTimetableProps) {
  // Hourly slots: 09:00–10:00, 10:00–11:00, ..., 16:00–17:00
  const timeSlots = [];
  for (let h = 9; h < 17; h++) {
    const start = `${String(h).padStart(2, "0")}:00`;
    const end = `${String(h + 1).padStart(2, "0")}:00`;
    timeSlots.push({ start, end });
  }

  // Session boundaries
  const sessionStartDate = academicSessionStartDate
    ? new Date(academicSessionStartDate)
    : null;
  const sessionEndDate = academicSessionEndDate
    ? new Date(academicSessionEndDate)
    : null;

  // Clamp startDate to session boundaries
  let clampedStartDate = startDate;
  if (sessionStartDate && clampedStartDate < sessionStartDate) {
    clampedStartDate = sessionStartDate;
  }
  if (sessionEndDate) {
    const lastPossibleStart = new Date(sessionEndDate);
    lastPossibleStart.setDate(lastPossibleStart.getDate() - 6);
    if (clampedStartDate > lastPossibleStart) {
      clampedStartDate = lastPossibleStart;
    }
  }

  // Generate 7 days, but do not go beyond sessionEndDate
  const upcomingDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDaysToDate(clampedStartDate, i);
    if (sessionEndDate && d > sessionEndDate) break;
    upcomingDates.push(d);
  }

  const isWithinAcademicSession = (date: Date) => {
    if (!sessionStartDate || !sessionEndDate) return true;
    return date >= sessionStartDate && date <= sessionEndDate;
  };

  const isSlotAvailable = (
    date: Date,
    slot: { start: string; end: string }
  ) => {
    if (!isWithinAcademicSession(date)) return false;

    // Block assignment for slots in the past (before current time)
    const now = new Date();
    const slotDateTimeEnd = new Date(date);
    const [endHour, endMinute] = slot.end.split(":").map(Number);
    slotDateTimeEnd.setHours(endHour, endMinute, 0, 0);

    // If slot ends before now and is today or earlier, block assignment
    if (
      date < now ||
      (date.toDateString() === now.toDateString() && slotDateTimeEnd <= now)
    ) {
      return false;
    }

    const slotOccupants = getOccupantsForSlotWithPercentage(
      date,
      slot,
      occupants
    );
    return slotOccupants.length === 0;
  };

  // Navigation handlers
  const handlePrevWeek = () => {
    const prevStart = addDaysToDate(clampedStartDate, -7);
    if (sessionStartDate && prevStart < sessionStartDate) {
      setStartDate(sessionStartDate);
    } else {
      setStartDate(prevStart);
    }
  };
  const handleNextWeek = () => {
    const nextStart = addDaysToDate(clampedStartDate, 7);
    if (sessionEndDate) {
      const lastPossibleStart = new Date(sessionEndDate);
      lastPossibleStart.setDate(lastPossibleStart.getDate() - 6);
      if (nextStart > lastPossibleStart) {
        setStartDate(lastPossibleStart);
      } else {
        setStartDate(nextStart);
      }
    } else {
      setStartDate(nextStart);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen font-sans antialiased">
      <div className="w-full max-w-6xl rounded-lg shadow-lg bg-white overflow-hidden">
        <div className="flex justify-between items-center px-4 py-2 bg-gray-50">
          <button
            className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
            onClick={handlePrevWeek}
            disabled={
              sessionStartDate &&
              clampedStartDate.getTime() === sessionStartDate.getTime()
            }
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
            {upcomingDates[upcomingDates.length - 1]?.toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric", year: "numeric" }
            )}
          </div>
          <button
            className="px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
            onClick={handleNextWeek}
            disabled={
              sessionEndDate &&
              upcomingDates[upcomingDates.length - 1]?.toDateString() ===
                sessionEndDate.toDateString()
            }
          >
            Next
          </button>
        </div>
        <div className="overflow-x-auto p-2">
          <table className="w-full text-left min-w-[800px] border-collapse">
            <thead className="bg-white sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 text-sm font-medium text-gray-500 w-24">
                  Time
                </th>
                {upcomingDates.map((date, index) => (
                  <th
                    key={index}
                    className="px-2 py-3 text-xs font-medium text-gray-500 text-center border-l border-gray-200 min-w-[120px]"
                  >
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
            <tbody className="divide-y divide-gray-200 cursor-pointer">
              {timeSlots.map((slot) => (
                <tr key={slot.start} className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-sm font-medium text-gray-700 sticky left-0 bg-white">
                    {slot.start} - {slot.end}
                  </td>
                  {upcomingDates.map((date) => {
                    const slotOccupants = getOccupantsForSlotWithPercentage(
                      date,
                      slot,
                      occupants
                    );
                    const isAvailable = isSlotAvailable(date, slot);

                    return (
                      <td
                        key={`${date.toISOString()}-${slot.start}`}
                        className={` border-l border-gray-100 h-16 w-16`}
                        onClick={() => {
                          if (isAvailable) {
                            onClickTimeTableSlot(date, slot);
                          }
                        }}
                      >
                        {slotOccupants.length > 0 ? (
                          <div className="relative h-full text-center w-full flex flex-col">
                            {slotOccupants.map((occupant) => (
                              <div
                              onClick={()=>{alert(JSON.stringify(occupant))}}
                                key={occupant.eventId}
                                className="absolute bg-blue-100 border border-blue-300 rounded-md p-1 text-xs cursor-pointer hover:bg-blue-200 transition-colors h-full w-full"
                                style={{
                                  top: `${occupant.offset}%`,
                                  height: `${occupant.percentage}%`,
                                }}
                                title={`${occupant.occupantName} (${
                                  typeof occupant.startTime === "string"
                                    ? occupant.startTime
                                    : occupant.startTime
                                        ?.toTimeString()
                                        .slice(0, 5)
                                }-${
                                  typeof occupant.endTime === "string"
                                    ? occupant.endTime
                                    : occupant.endTime
                                        ?.toTimeString()
                                        .slice(0, 5)
                                })`}
                              >
                                <div className="font-medium text-blue-800 truncate ">
                                  {occupant.occupantName}
                                </div>
                                <div className="text-blue-600 text-[10px] truncate">
                                  {occupant.type} •{" "}
                                  {typeof occupant.startTime === "string"
                                    ? occupant.startTime
                                    : occupant.startTime
                                        ?.toTimeString()
                                        .slice(0, 5)}
                                  -
                                  {typeof occupant.endTime === "string"
                                    ? occupant.endTime
                                    : occupant.endTime
                                        ?.toTimeString()
                                        .slice(0, 5)}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : isAvailable ? (
                          <div
                            className="text-green-600 text-center justify-center items-center text-xs cursor-pointer hover:bg-green-50 p-1 rounded transition-colors h-full w-full"
                            title="Click to allocate"
                          >
                            <label>Allocate</label>
                          </div>
                        ) : (
                          <div className="text-gray-400 text-xs">Past</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default WeeklyTimetable;
