// utils/generateSlots.ts
import moment from "moment";

export type Recurrence = "day" | "week" | "month" | "activeSession" | "custom";

export type Slot = {
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end: string; // HH:mm
};

/**
 * Normalize weekday input (numbers 0..6 or strings like "monday"/"Mon")
 * returns Set<number> with 0=Sun ... 6=Sat
 */
function normalizeWeekdays(
  days?: Array<number | string> | null
): Set<number> | null {
  if (!days || !days.length) return null;

  const nameToNum: Record<string, number> = {
    SUN: 0,
    SUNDAY: 0,
    MON: 1,
    MONDAY: 1,
    TUE: 2,
    TUESDAY: 2,
    TUES: 2,
    WED: 3,
    WEDNESDAY: 3,
    THU: 4,
    THURSDAY: 4,
    THURS: 4,
    FRI: 5,
    FRIDAY: 5,
    SAT: 6,
    SATURDAY: 6,
  };

  const set = new Set<number>();
  for (const d of days) {
    if (typeof d === "number") {
      if (d < 0 || d > 6) throw new Error(`Weekday number out of range: ${d}`);
      set.add(d);
    } else {
      const key = d.trim().toUpperCase();
      if (key in nameToNum) set.add(nameToNum[key]);
      else throw new Error(`Unknown weekday string: ${d}`);
    }
  }
  return set;
}

/**
 * Main generator.
 *
 * @param params.startDate 'YYYY-MM-DD' (for day/week/month) ; ignored for activeSession (uses today)
 * @param params.startTime 'HH:mm'
 * @param params.endTime 'HH:mm'
 * @param params.recurrence one of: 'day'|'week'|'month'|'activeSession'
 * @param params.academicSessionEndDate 'YYYY-MM-DD' (required for activeSession)
 * @param params.repeatOnDays optional array of weekdays (numbers 0..6 or strings)
 */
export function buildSlotsWithWeekdays(params: {
  startDate: string;
  startTime: string;
  endTime: string;
  recurrence: Recurrence;
  academicSessionEndDate?: string;
  repeatOnDays?: Array<number | string>;
  customEndDate?: string; // 👈 for custom recurrence
  respectSessionEndDate?: boolean; // 👈 new flag
}): Slot[] {
  const {
    startDate,
    startTime,
    endTime,
    recurrence,
    academicSessionEndDate,
    repeatOnDays,
    customEndDate,
    respectSessionEndDate = true,
  } = params;

  // validate time
  if (
    !moment(startTime, "HH:mm", true).isValid() ||
    !moment(endTime, "HH:mm", true).isValid()
  ) {
    throw new Error("startTime or endTime not in HH:mm format");
  }
  if (!moment(endTime, "HH:mm").isAfter(moment(startTime, "HH:mm"))) {
    throw new Error("endTime must be after startTime");
  }

  let rangeStart: moment.Moment;
  let rangeEnd: moment.Moment;

  if (recurrence === "activeSession") {
    if (!academicSessionEndDate)
      throw new Error("academicSessionEndDate required for activeSession");
    rangeStart = moment(); // today
    rangeEnd = moment(academicSessionEndDate, "YYYY-MM-DD");
  } else if (recurrence === "custom") {
    rangeStart = moment(startDate, "YYYY-MM-DD");
    rangeEnd = moment(customEndDate, "YYYY-MM-DD");
    if (!rangeStart.isValid() || !rangeEnd.isValid()) {
      throw new Error("Invalid custom date range");
    }
  } else {
    rangeStart = moment(startDate, "YYYY-MM-DD");
    if (!rangeStart.isValid()) throw new Error("startDate is invalid");

    if (recurrence === "day") {
      rangeEnd = rangeStart.clone();
    } else if (recurrence === "week") {
      rangeEnd = rangeStart.clone().add(6, "days");
    } else if (recurrence === "month") {
      rangeEnd = rangeStart.clone().add(1, "month").subtract(1, "day");
    } else {
      throw new Error("Unknown recurrence");
    }

    // ✅ only apply cutoff for week/month/day if required
    if (respectSessionEndDate && academicSessionEndDate) {
      const sessionEnd = moment(academicSessionEndDate, "YYYY-MM-DD");
      if (sessionEnd.isBefore(rangeEnd)) {
        rangeEnd = sessionEnd;
      }
    }
  }

  if (rangeEnd.isBefore(rangeStart, "day")) {
    throw new Error("rangeEnd is before rangeStart");
  }

  const weekdaySet = normalizeWeekdays(repeatOnDays ?? null);
  const slots: Slot[] = [];

  if (weekdaySet && weekdaySet.size > 0) {
    for (const weekday of weekdaySet) {
      let cursor = rangeStart.clone();
      if (cursor.day() !== weekday) {
        const daysToAdd = (weekday - cursor.day() + 7) % 7;
        cursor.add(daysToAdd, "days");
      }
      while (cursor.isSameOrBefore(rangeEnd, "day")) {
        slots.push({
          date: cursor.format("YYYY-MM-DD"),
          start: startTime,
          end: endTime,
        });
        cursor.add(7, "days");
      }
    }

    return slots.sort((a, b) => a.date.localeCompare(b.date));
  }

  // fallback: daily slots
  let cursor = rangeStart.clone();
  while (cursor.isSameOrBefore(rangeEnd, "day")) {
    slots.push({
      date: cursor.format("YYYY-MM-DD"),
      start: startTime,
      end: endTime,
    });
    cursor.add(1, "day");
  }

  return slots;
}

export function checkSlotConflicts(
  newSlots: Slot[],
  existingSlots: Slot[]
): Slot[] {
  const conflicts: Slot[] = [];

  for (const newSlot of newSlots) {
    for (const existingSlot of existingSlots) {
      if (newSlot.date === existingSlot.date) {
        const newStart = moment(
          `${newSlot.date} ${newSlot.start}`,
          "YYYY-MM-DD HH:mm"
        );
        const newEnd = moment(
          `${newSlot.date} ${newSlot.end}`,
          "YYYY-MM-DD HH:mm"
        );
        const existStart = moment(
          `${existingSlot.date} ${existingSlot.start}`,
          "YYYY-MM-DD HH:mm"
        );
        const existEnd = moment(
          `${existingSlot.date} ${existingSlot.end}`,
          "YYYY-MM-DD HH:mm"
        );

        const overlaps =
          newStart.isBefore(existEnd) && newEnd.isAfter(existStart);

        if (overlaps) {
          // conflicts.push(existingSlot);
          conflicts.push(newSlot);
          break; // no need to check more existing slots for this one
        }
      }
    }
  }

  return conflicts; // return list of slots that are in conflict
}

const s = buildSlotsWithWeekdays({
  startDate: "2025-09-04",
  startTime: "09:00",
  endTime: "10:00",
  recurrence: "month",
  repeatOnDays: [1, 3, 5], // Mon, Wed, Fri
});

const existingSlots: Slot[] = [
  { date: "2025-09-05", start: "09:15", end: "10:05" },
  { date: "2025-09-05", start: "10:20", end: "11:00" },
  { date: "2025-09-05", start: "11:10", end: "11:55" },
  { date: "2025-09-05", start: "12:05", end: "12:45" },
  { date: "2025-09-05", start: "14:00", end: "14:40" },
  { date: "2025-09-05", start: "15:15", end: "16:00" },
  { date: "2025-09-05", start: "16:20", end: "17:10" },
  { date: "2025-09-06", start: "09:00", end: "10:00" },
  { date: "2025-09-06", start: "11:00", end: "11:45" },
  { date: "2025-09-06", start: "14:10", end: "15:00" },
  { date: "2025-09-06", start: "15:20", end: "16:00" },
  { date: "2025-09-06", start: "16:30", end: "17:15" },
];

const newSlots: Slot[] = [
  { date: "2025-09-05", start: "09:00", end: "09:20" }, // ✅ no conflict
  { date: "2025-09-05", start: "09:30", end: "09:50" }, // ❌ conflict (09:15–10:05)
  { date: "2025-09-05", start: "10:05", end: "10:15" }, // ✅ no conflict
  { date: "2025-09-05", start: "10:40", end: "10:50" }, // ❌ conflict (10:20–11:00)
  { date: "2025-09-05", start: "11:00", end: "11:20" }, // ❌ conflict (11:10–11:55)
  { date: "2025-09-05", start: "12:50", end: "13:20" }, // ✅ no conflict
  { date: "2025-09-05", start: "14:20", end: "14:30" }, // ❌ conflict (14:00–14:40)
  { date: "2025-09-05", start: "15:00", end: "15:10" }, // ✅ no conflict
  { date: "2025-09-05", start: "15:30", end: "15:45" }, // ❌ conflict (15:15–16:00)
  { date: "2025-09-06", start: "09:30", end: "09:50" }, // ❌ conflict (09:00–10:00)
  { date: "2025-09-06", start: "10:15", end: "10:45" }, // ✅ no conflict
  { date: "2025-09-06", start: "11:30", end: "11:50" }, // ❌ conflict (11:00–11:45)
];

const conflicts = checkSlotConflicts(newSlots, existingSlots);

if (conflicts.length > 0) {
  // console.log("Conflicting slots found:", conflicts);
} else {
  console.log("No conflicts, safe to insert into DB.");
}
