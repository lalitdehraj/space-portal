
export function removeSpaces(str: string): string {
  return str.replace(/ /g, "");
}

export function formatDate(dateString: string) {
  const date = new Date(dateString);

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");

  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  return `${day}-${month}-${year} ${formattedHours}:${minutes}${ampm}`;
}

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
    endDate: endDate.toISOString().split("T")[0],     // "2018-11-30"
  };
}