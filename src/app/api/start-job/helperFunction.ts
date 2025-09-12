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
  dayStart = "09:00",
  dayEnd = "18:00"
): WeekVacantSlots {
  const grouped: Record<
    keyof WeekVacantSlots,
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

    const weekday = start.format("dddd") as keyof WeekVacantSlots;
    grouped[weekday].push({ start, end });
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

  // Calculate vacant slots
  for (const weekday of Object.keys(grouped) as (keyof WeekVacantSlots)[]) {
    const daySchedules = grouped[weekday];

    if (daySchedules.length === 0) {
      result[weekday].push(`${dayStart}-${dayEnd}`);
      continue;
    }

    // Use first schedule’s date as reference
    const refDate = daySchedules[0].start.format("YYYY-MM-DD");
    const workStart = moment(`${refDate} ${dayStart}`, "YYYY-MM-DD HH:mm");
    const workEnd = moment(`${refDate} ${dayEnd}`, "YYYY-MM-DD HH:mm");

    // Sort & merge occupied slots
    const merged: { start: moment.Moment; end: moment.Moment }[] = [];
    daySchedules.sort((a, b) => a.start.diff(b.start));

    for (const slot of daySchedules) {
      if (merged.length === 0) {
        merged.push(slot);
      } else {
        const last = merged[merged.length - 1];
        if (slot.start.isBefore(last.end)) {
          last.end = moment.max(last.end, slot.end); // merge overlap
        } else {
          merged.push(slot);
        }
      }
    }

    // Find vacant slots
    let prevEnd = workStart.clone();
    for (const slot of merged) {
      if (slot.start.isAfter(prevEnd)) {
        result[weekday].push(
          `${prevEnd.format("HH:mm")}-${slot.start.format("HH:mm")}`
        );
      }
      prevEnd = moment.max(prevEnd, slot.end);
    }
    if (prevEnd.isBefore(workEnd)) {
      result[weekday].push(
        `${prevEnd.format("HH:mm")}-${workEnd.format("HH:mm")}`
      );
    }
  }

  return result;
}

export function getRoomOccupancyByWeekday(schedules: Occupant[]): WeekSummary {
  const totals: Omit<WeekSummary, "Weekly"> = {
    Monday: 0,
    Tuesday: 0,
    Wednesday: 0,
    Thursday: 0,
    Friday: 0,
    Saturday: 0,
    Sunday: 0,
  };

  for (const { scheduledDate, startTime, endTime } of schedules) {
    const start = moment(`${scheduledDate} ${startTime}`, "YYYY-MM-DD HH:mm");
    let end = moment(`${scheduledDate} ${endTime}`, "YYYY-MM-DD HH:mm");

    if (!start.isValid() || !end.isValid()) continue;

    if (end.isBefore(start)) {
      end = end.add(1, "day"); // handle overnight
    }

    const duration = end.diff(start, "minutes");
    const weekday = start.format("dddd") as keyof typeof totals;

    totals[weekday] += duration;
  }

  return {
    ...totals,
    Weekly: Object.values(totals).reduce((a, b) => a + b, 0),
  };
}
