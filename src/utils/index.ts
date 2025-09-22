export function removeSpaces(str: string): string {
  return str.replace(/ /g, "");
}

/**
 * Validates if a date string is in YYYY-MM-DD format and not empty
 * @param dateString - The date string to validate
 * @returns boolean - true if valid, false otherwise
 */
export function isValidDateFormat(dateString: string): boolean {
  if (!dateString || dateString.trim() === "") return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(dateString);
}

/**
 * Validates if both start and end dates are valid and start date is not after end date
 * @param startDate - Start date string in YYYY-MM-DD format
 * @param endDate - End date string in YYYY-MM-DD format
 * @returns boolean - true if both dates are valid and start <= end
 */
export function isValidDateRange(startDate: string, endDate: string): boolean {
  if (!isValidDateFormat(startDate) || !isValidDateFormat(endDate)) return false;

  const start = new Date(startDate);
  const end = new Date(endDate);

  return start <= end;
}

export function formatDate(dateString: Date | string) {
  const date = dateString instanceof Date ? dateString : new Date(dateString);

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");

  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  return `${day}/${month}/${year} ${formattedHours}:${minutes}${ampm}`;
}

export function formatDateOnly(dateString: Date | string) {
  const date = dateString instanceof Date ? dateString : new Date(dateString);

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  return `${day}/${month}/${year}`;
}

export function formatFileSize(bytes: string | number): string {
  const size = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;

  if (isNaN(size) || size === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let unitIndex = 0;
  let fileSize = size;

  while (fileSize >= 1024 && unitIndex < units.length - 1) {
    fileSize /= 1024;
    unitIndex++;
  }

  return `${fileSize.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function compareDates(dateA: Date, dateB: Date) {
  if (!(dateA instanceof Date) || !(dateB instanceof Date)) {
    console.error("Invalid input: Both arguments must be Date objects.");
    return NaN;
  }

  // Compare the numeric timestamp values
  const timeA = dateA.getTime();
  const timeB = dateB.getTime();

  if (timeA < timeB) {
    return -1;
  } else if (timeA > timeB) {
    return 1;
  } else {
    return 0;
  }
}

export const getTodaysDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0"); // Months are 0-indexed
  const day = now.getDate().toString().padStart(2, "0");
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");

  const minDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
  const minDate = `${year}-${month}-${day}`;
  return { minDateTime, minDate };
};

function parseSession(session: { Code: string; "Academic Year": string }) {
  const monthMap: Record<string, number> = {
    JAN: 1,
    FEB: 2,
    MAR: 3,
    APR: 4,
    MAY: 5,
    JUN: 6,
    JUL: 7,
    AUG: 8,
    SEP: 9,
    OCT: 10,
    NOV: 11,
    DEC: 12,
  };

  const [range, yearStr] = session.Code.split(" "); // e.g. ["AUG-NOV", "2018"]
  const [startMonthAbbr, endMonthAbbr] = range.split("-"); // ["AUG", "NOV"]

  const year = parseInt(yearStr, 10);

  const startMonth = monthMap[startMonthAbbr.toUpperCase()];
  const endMonth = monthMap[endMonthAbbr.toUpperCase()];

  if (!startMonth || !endMonth) {
    throw new Error("Invalid month abbreviation in session code");
  }

  // Start date is always 1st of start month
  const startDate = new Date(year, startMonth - 1, 1);

  // End date is last day of end month → use 0th day of next month
  const endDate = new Date(year, endMonth, 0);

  return {
    startDate: startDate.toISOString().split("T")[0], // "2018-08-01"
    endDate: endDate.toISOString().split("T")[0], // "2018-11-30"
  };
}

export function addDaysToDate(date: Date, days: number): Date {
  // Create a new Date object to avoid modifying the original one
  const newDate = new Date(date);

  // Get the current day of the month and add the specified number of days
  newDate.setDate(newDate.getDate() + days);

  return newDate;
}

export function createDateFromDDMMYYYY(dateString: string): Date | null {
  const parts = dateString.split("-");

  if (parts.length !== 3) {
    console.error("Invalid date format. Expected 'DD-MM-YYYY'.");
    return null;
  }

  // Parse the parts as numbers
  const day = parseInt(parts[0], 10);
  // Subtract 1 from the month because the Date constructor uses a 0-based month index (0-11)
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);

  // Basic validation to ensure the parts are valid numbers
  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    console.error("Invalid date components. Make sure day, month, and year are numbers.");
    return null;
  }

  // Create the Date object using the reliable YYYY, MM, DD format
  const date = new Date(year, month, day);

  // Return the date object, and you can add more validation here if needed
  return date;
}

export function getTimeDifference(startTime: string, endTime: string): { hours: number; minutes: number; seconds: number } | null {
  if (!startTime && !endTime) return null;
  // Regex to validate the time format 'HH:mm:ss'
  const timeRegex = /^(?:2[0-3]|[01]?[0-9]):[0-5]?[0-9]:[0-5]?[0-9]$/;

  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    console.error("Invalid time format. Please use 'HH:mm:ss'.");
    return null;
  }

  // Create Date objects from the time strings on an arbitrary day (e.g., Jan 1, 1970)
  const [startHour, startMinute, startSecond] = startTime.split(":").map(Number);
  const [endHour, endMinute, endSecond] = endTime.split(":").map(Number);

  const startDate = new Date();
  startDate.setHours(startHour, startMinute, startSecond, 0);

  const endDate = new Date();
  endDate.setHours(endHour, endMinute, endSecond, 0);

  // If the end time is before the start time (e.g., 01:00:00 - 23:00:00),
  // add a day to the end date to handle the overnight difference correctly.
  if (endDate.getTime() < startDate.getTime()) {
    endDate.setDate(endDate.getDate() + 1);
  }

  // Calculate the difference in milliseconds
  const diffInMilliseconds = endDate.getTime() - startDate.getTime();

  // Convert milliseconds to hours, minutes, and seconds
  const diffInSeconds = Math.floor(diffInMilliseconds / 1000);
  const hours = Math.floor(diffInSeconds / 3600);
  const minutes = Math.floor((diffInSeconds % 3600) / 60);
  const seconds = diffInSeconds % 60;

  return { hours, minutes, seconds };
}
