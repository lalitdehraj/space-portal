import { Occupant } from "@/types";
import moment from "moment";

type WeekSummary = {
  Monday: number;
  Tuesday: number;
  Wednesday: number;
  Thursday: number;
  Friday: number;
  Saturday: number;
  Sunday: number;
  Weekly: number;
};

type WeekVacantSlots = {
  Monday: string[];
  Tuesday: string[];
  Wednesday: string[];
  Thursday: string[];
  Friday: string[];
  Saturday: string[];
  Sunday: string[];
};

export function getVacantSlotsByWeekday(
  schedules: Occupant[],
  startDate?: string,
  endDate?: string,
  dayStart = "09:00",
  dayEnd = "18:00"
): WeekVacantSlots {
  // Group schedules by date and weekday (to handle multiple dates of same weekday)
  const groupedByDate: Record<string, { start: moment.Moment; end: moment.Moment }[]> = {};

  // Group schedules by date
  for (const { scheduledDate, startTime, endTime } of schedules) {
    const start = moment(`${scheduledDate} ${startTime}`, "YYYY-MM-DD HH:mm");
    let end = moment(`${scheduledDate} ${endTime}`, "YYYY-MM-DD HH:mm");

    if (!start.isValid() || !end.isValid()) continue;
    if (end.isBefore(start)) end = end.add(1, "day"); // overnight

    // Only include slots that overlap with work hours (9:00-18:00)
    const slotDate = start.format("YYYY-MM-DD");
    const workStart = moment(`${slotDate} ${dayStart}`, "YYYY-MM-DD HH:mm");
    const workEnd = moment(`${slotDate} ${dayEnd}`, "YYYY-MM-DD HH:mm");

    // Skip if slot is completely outside work hours
    if (end.isSameOrBefore(workStart) || start.isSameOrAfter(workEnd)) {
      continue;
    }

    // Clamp slot to work hours
    const clampedStart = moment.max(start, workStart);
    const clampedEnd = moment.min(end, workEnd);

    if (!groupedByDate[slotDate]) {
      groupedByDate[slotDate] = [];
    }
    groupedByDate[slotDate].push({ start: clampedStart, end: clampedEnd });
  }

  const result: WeekVacantSlots = {
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: [],
  };

  // Get date range for generating vacant slots
  let dateRangeStart: moment.Moment | null = null;
  let dateRangeEnd: moment.Moment | null = null;

  if (startDate && endDate) {
    dateRangeStart = moment(startDate, "YYYY-MM-DD");
    dateRangeEnd = moment(endDate, "YYYY-MM-DD");
  } else if (Object.keys(groupedByDate).length > 0) {
    // Use date range from schedules if no range provided
    const dates = Object.keys(groupedByDate).sort();
    dateRangeStart = moment(dates[0], "YYYY-MM-DD");
    dateRangeEnd = moment(dates[dates.length - 1], "YYYY-MM-DD");
  }

  if (!dateRangeStart || !dateRangeEnd) {
    return result;
  }

  // Generate vacant slots for each date in range
  let current = dateRangeStart.clone();
  while (current.isSameOrBefore(dateRangeEnd)) {
    const currentDate = current.format("YYYY-MM-DD");
    const weekday = current.format("dddd") as keyof WeekVacantSlots;
    const workStart = moment(`${currentDate} ${dayStart}`, "YYYY-MM-DD HH:mm");
    const workEnd = moment(`${currentDate} ${dayEnd}`, "YYYY-MM-DD HH:mm");

    const daySchedules = groupedByDate[currentDate] || [];

    if (daySchedules.length === 0) {
      // Entire day is vacant
      result[weekday].push(`${currentDate} ${dayStart}-${dayEnd}`);
    } else {
      // Sort & merge occupied slots
      const merged: { start: moment.Moment; end: moment.Moment }[] = [];
      daySchedules.sort((a, b) => a.start.diff(b.start));

      for (const slot of daySchedules) {
        if (merged.length === 0) {
          merged.push(slot);
        } else {
          const last = merged[merged.length - 1];
          if (slot.start.isBefore(last.end) || slot.start.isSame(last.end)) {
            last.end = moment.max(last.end, slot.end); // merge overlap
          } else {
            merged.push(slot);
          }
        }
      }

      // Find vacant slots within work hours
      let prevEnd = workStart.clone();
      for (const slot of merged) {
        if (slot.start.isAfter(prevEnd)) {
          // Only add if the vacant slot is within work hours
          const vacantStart = prevEnd.isBefore(workStart) ? workStart : prevEnd;
          const vacantEnd = slot.start.isAfter(workEnd) ? workEnd : slot.start;
          
          if (vacantEnd.isAfter(vacantStart)) {
            result[weekday].push(
              `${currentDate} ${vacantStart.format("HH:mm")}-${vacantEnd.format("HH:mm")}`
            );
          }
        }
        prevEnd = moment.max(prevEnd, slot.end);
      }
      
      // Check for vacant slot after last occupied slot
      if (prevEnd.isBefore(workEnd)) {
        result[weekday].push(
          `${currentDate} ${prevEnd.format("HH:mm")}-${workEnd.format("HH:mm")}`
        );
      }
    }

    current.add(1, "day");
  }

  return result;
}

export function getRoomOccupancyByWeekday(
  schedules: Occupant[],
  startDate?: string,
  endDate?: string
): WeekSummary {
  // Group schedules by weekday and merge overlapping slots
  const grouped: Record<
    keyof Omit<WeekSummary, "Weekly">,
    { start: moment.Moment; end: moment.Moment }[]
  > = {
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: [],
  };

  // Group schedules by weekday
  for (const { scheduledDate, startTime, endTime } of schedules) {
    const start = moment(`${scheduledDate} ${startTime}`, "YYYY-MM-DD HH:mm");
    let end = moment(`${scheduledDate} ${endTime}`, "YYYY-MM-DD HH:mm");

    if (!start.isValid() || !end.isValid()) continue;
    if (end.isBefore(start)) end = end.add(1, "day"); // overnight

    const weekday = start.format("dddd") as keyof typeof grouped;
    grouped[weekday].push({ start, end });
  }

  const totals: Omit<WeekSummary, "Weekly"> = {
    Monday: 0,
    Tuesday: 0,
    Wednesday: 0,
    Thursday: 0,
    Friday: 0,
    Saturday: 0,
    Sunday: 0,
  };

  // Merge overlapping slots and calculate total occupied time per weekday
  for (const weekday of Object.keys(grouped) as (keyof typeof totals)[]) {
    const daySchedules = grouped[weekday];
    
    if (daySchedules.length === 0) {
      totals[weekday] = 0;
      continue;
    }

    // Sort by start time
    daySchedules.sort((a, b) => a.start.diff(b.start));

    // Merge overlapping intervals
    const merged: { start: moment.Moment; end: moment.Moment }[] = [];
    for (const slot of daySchedules) {
      if (merged.length === 0) {
        merged.push(slot);
      } else {
        const last = merged[merged.length - 1];
        if (slot.start.isBefore(last.end) || slot.start.isSame(last.end)) {
          // Overlapping or adjacent - merge them
          last.end = moment.max(last.end, slot.end);
        } else {
          // Non-overlapping - add as new slot
          merged.push(slot);
        }
      }
    }

    // Calculate total occupied minutes from merged slots
    // Only count minutes within 9:00-18:00 (540 minutes per day)
    const dayStart = "09:00";
    const dayEnd = "18:00";
    
    totals[weekday] = merged.reduce((sum, slot) => {
      // Clamp slot times to work hours (9:00-18:00)
      const slotDate = slot.start.format("YYYY-MM-DD");
      const workStart = moment(`${slotDate} ${dayStart}`, "YYYY-MM-DD HH:mm");
      const workEnd = moment(`${slotDate} ${dayEnd}`, "YYYY-MM-DD HH:mm");
      
      // Calculate intersection of slot with work hours
      const actualStart = moment.max(slot.start, workStart);
      const actualEnd = moment.min(slot.end, workEnd);
      
      if (actualEnd.isAfter(actualStart)) {
        return sum + actualEnd.diff(actualStart, "minutes");
      }
      return sum;
    }, 0);
  }

  const weeklyTotal = Object.values(totals).reduce((a, b) => a + b, 0);

  return {
    ...totals,
    Weekly: weeklyTotal,
  };
}
