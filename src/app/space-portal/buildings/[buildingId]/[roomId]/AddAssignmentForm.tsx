import React, { useState, useEffect } from "react";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { Department, Faculty } from "@/types";

type AcademicYear = {
  id: string;
  name: string;
  Code?: string;
  Description?: string;
};
type AcademicSession = {
  id: string;
  name: string;
  Code?: string;
  "Academic Year"?: string;
};
type FormProps = {
  onClose: () => void;
  initialDate?: Date;
  initialStartTime?: string;
  initialEndTime?: string;
  initialSlot?: { start: string; end: string };
  occupants?: any[];
};

const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function WeekdaySelector({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {WEEK_DAYS.map((day) => (
        <button
          type="button"
          key={day}
          className={`px-2 py-1 rounded ${
            value.includes(day)
              ? "bg-orange-500 text-white"
              : "bg-gray-100 text-gray-700"
          }`}
          onClick={() =>
            onChange(
              value.includes(day)
                ? value.filter((d) => d !== day)
                : [...value, day]
            )
          }
        >
          {day}
        </button>
      ))}
    </div>
  );
}

// Helper for time slot list
const defaultTimeSlots = [
  { start: "09:00", end: "10:00" },
  { start: "10:00", end: "11:00" },
  { start: "11:00", end: "12:00" },
  { start: "12:00", end: "13:00" },
  { start: "13:00", end: "14:00" },
  { start: "14:00", end: "15:00" },
  { start: "15:00", end: "16:00" },
  { start: "16:00", end: "17:00" },
];

// Helper: Convert date string to Date
function toDate(dateStr: string) {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

// Helper: Convert time string to minutes
function toMinutes(t: string | Date) {
  if (typeof t === "string") {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  } else if (t instanceof Date) {
    return t.getHours() * 60 + t.getMinutes();
  }
  return 0;
}

// Generate all allocation slots based on form data
function generateAllocations({
  customStartDate,
  customEndDate,
  dateType,
  selectedDays,
  customStartTime,
  customEndTime,
}: {
  customStartDate: string;
  customEndDate: string;
  dateType: string;
  selectedDays: string[];
  customStartTime: string;
  customEndTime: string;
}) {
  const allocations: { date: string; start: string; end: string }[] = [];
  const start = toDate(customStartDate);
  const end =
    dateType === "custom" && customEndDate ? toDate(customEndDate) : start;
  if (!start || !end) return allocations;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (
      dateType !== "day" &&
      selectedDays.length > 0 &&
      !selectedDays.includes(d.toLocaleDateString("en-US", { weekday: "long" }))
    ) {
      continue;
    }
    allocations.push({
      date: d.toISOString().split("T")[0],
      start: customStartTime,
      end: customEndTime,
    });
  }
  return allocations;
}

// Overlap check
function checkOverlap(
  allocations: { date: string; start: string; end: string }[],
  occupants: any[]
) {
  const errors: string[] = [];
  allocations.forEach((alloc) => {
    occupants.forEach((occ) => {
      // Date match
      let occDate: Date | null = null;
      if (typeof occ.scheduledDate === "string") {
        occDate = toDate(occ.scheduledDate);
      } else if (occ.scheduledDate instanceof Date) {
        occDate = occ.scheduledDate;
      }
      if (!occDate) return;
      if (alloc.date === occDate.toISOString().split("T")[0]) {
        // Time overlap
        const allocStart = toMinutes(alloc.start);
        const allocEnd = toMinutes(alloc.end);
        const occStart = toMinutes(occ.startTime);
        const occEnd = toMinutes(occ.endTime);
        if (!(allocEnd <= occStart || allocStart >= occEnd)) {
          errors.push(
            `Overlap on ${alloc.date} (${alloc.start}-${alloc.end}) with ${occ.occupantName} (${occ.startTime}-${occ.endTime})`
          );
        }
      }
    });
  });
  return errors;
}

export default function AddAssignmentForm({
  onClose,
  initialDate,
  initialStartTime,
  initialEndTime,
  initialSlot,
  occupants = [],
}: FormProps) {
  const [academicYear, setAcademicYear] = useState("");
  const [academicSession, setAcademicSession] = useState("");
  const [departmentOrFaculty, setDepartmentOrFaculty] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState("");
  const [purpose, setPurpose] = useState("");
  const [remarks, setRemarks] = useState("");
  const [dateType, setDateType] = useState("day");
  const [customStartDate, setCustomStartDate] = useState(
    initialDate ? initialDate.toISOString().split("T")[0] : ""
  );
  const [customEndDate, setCustomEndDate] = useState("");
  const [timeType, setTimeType] = useState("fullDay");
  const [customStartTime, setCustomStartTime] = useState(
    initialStartTime || ""
  );
  const [customEndTime, setCustomEndTime] = useState(initialEndTime || "");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(
    null
  );
  const [academicYearsList, setAcademicYearsList] = useState<AcademicYear[]>(
    []
  );
  const [academicSessionsList, setAcademicSessionsList] = useState<
    AcademicSession[]
  >([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);

  useEffect(() => {
    function isDepartmentArray(
      data: Department[] | Faculty[]
    ): data is Department[] {
      // Assuming a Department has a unique property like `faculty_id`
      return data.length > 0 && "faculty_id" in data[0];
    }
    const fetchFacultyOrDepartment = async () => {
      const response = await callApi<Department[] | Faculty[]>(
        process.env.NEXT_PUBLIC_GET_FACULTY_OR_DEPARTMENT || URL_NOT_FOUND,
        {
          filterValue: departmentOrFaculty.toUpperCase().trim(),
        }
      );
      if (response.success) {
        console.log(response);
        if (
          departmentOrFaculty === "Department" &&
          isDepartmentArray(response?.data!)
        ) {
          setDepartments(response.data);
        } else {
          setFaculties(response.data as Faculty[]); // You may still need an assertion here
        }
      }
    };
    fetchFacultyOrDepartment();
  }, [departmentOrFaculty]);
  useEffect(() => {
    const fetchAcademicData = async () => {
      // Fetch Academic Years
      const responseYear = await callApi<{ "Academic Year": AcademicYear[] }>(
        process.env.NEXT_PUBLIC_GET_ACADMIC_YEARS || URL_NOT_FOUND
      );
      if (responseYear.success) {
        // Use .reverse() if you want latest first, as in Header.tsx
        setAcademicYearsList(
          responseYear.data?.["Academic Year"]?.reverse() || []
        );
      }

      // Fetch Academic Sessions
      const responseSession = await callApi<{
        "Academic Session": AcademicSession[];
      }>(process.env.NEXT_PUBLIC_GET_ACADMIC_SESSIONS || URL_NOT_FOUND);
      if (responseSession.success) {
        setAcademicSessionsList(
          responseSession.data?.["Academic Session"] || []
        );
      }
    };
    fetchAcademicData();
  }, []);

  useEffect(() => {
    // Fill slot details if provided
    if (initialDate)
      setCustomStartDate(initialDate.toISOString().split("T")[0]);
    if (initialStartTime) setCustomStartTime(initialStartTime);
    if (initialEndTime) setCustomEndTime(initialEndTime);
    if (initialSlot) {
      const idx = defaultTimeSlots.findIndex(
        (slot) =>
          slot.start === initialSlot.start && slot.end === initialSlot.end
      );
      setSelectedSlotIndex(idx !== -1 ? idx : null);
      setCustomStartTime(initialSlot.start);
      setCustomEndTime(initialSlot.end);
      setTimeType("list");
    }
  }, [initialDate, initialStartTime, initialEndTime, initialSlot]);

  useEffect(() => {
    // Calculate end date from dateType
    if (!customStartDate) {
      setCustomEndDate("");
      return;
    }
    let newEndDate = customStartDate;
    if (dateType === "week") {
      const start = new Date(customStartDate);
      start.setDate(start.getDate() + 6);
      newEndDate = start.toISOString().split("T")[0];
    } else if (dateType === "month") {
      const start = new Date(customStartDate);
      start.setMonth(start.getMonth() + 1);
      start.setDate(start.getDate() - 1);
      newEndDate = start.toISOString().split("T")[0];
    } else if (dateType === "activeSession" && academicSession) {
      newEndDate = "2025-12-31";
    }
    setCustomEndDate(newEndDate);
  }, [dateType, customStartDate, academicSession]);

  useEffect(() => {
    // Auto-set time for fullDay/halfDay
    if (timeType === "fullDay") {
      setCustomStartTime("09:00");
      setCustomEndTime("17:00");
    } else if (timeType === "firstHalf") {
      setCustomStartTime("09:00");
      setCustomEndTime("13:00");
    } else if (timeType === "secondHalf") {
      setCustomStartTime("13:00");
      setCustomEndTime("17:00");
    }
  }, [timeType]);

  // Generate time slots based on form data
  const timeSlotOptions = [...defaultTimeSlots];

  // Basic validation
  const handleSubmit = (e: any) => {
    e.preventDefault();
    const errors: string[] = [];
    if (!academicYear) errors.push("Academic Year is required.");
    if (!academicSession) errors.push("Academic Session is required.");
    if (!departmentOrFaculty) errors.push("Department/Faculty is required.");
    if (departmentOrFaculty === "department" && !selectedDepartment)
      errors.push("Department is required.");
    if (departmentOrFaculty === "faculty" && !selectedFaculty)
      errors.push("Faculty is required.");
    if (!customStartDate) errors.push("Start Date is required.");
    if (dateType === "custom" && !customEndDate)
      errors.push("End Date is required for custom range.");
    if (!customStartTime) errors.push("Start Time is required.");
    if (!customEndTime) errors.push("End Time is required.");
    if (customStartTime >= customEndTime)
      errors.push("End time must be after start time.");

    // Generate allocations and check overlap
    const allocations = generateAllocations({
      customStartDate,
      customEndDate,
      dateType,
      selectedDays,
      customStartTime,
      customEndTime,
    });
    const overlapErrors = checkOverlap(allocations, occupants);
    errors.push(...overlapErrors);

    setValidationErrors(errors);
    if (errors.length > 0) return;
    // Proceed with allocation logic (API call etc.)
    onClose();
  };

  return (
    <section className="fixed inset-0 z-50 h-screen w-screen bg-[#00000070] flex items-center justify-center text-gray-500">
      <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl p-8">
        <div className="max-h-[70vh] bg-white overflow-y-scroll mr-4 pr-2">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <h2 className="font-semibold text-gray-700 mb-6">Allocate Room</h2>
          {validationErrors.length > 0 && (
            <div className="bg-red-100 border border-red-300 text-red-700 rounded p-2 mb-4">
              <ul className="text-sm list-disc ml-4">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Academic Year & Session */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700">
                  Academic Year
                </label>
                <select
                  className="mt-1 block text-sm w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select Academic Year
                  </option>
                  {academicYearsList.map((year) => (
                    <option key={year.Code} value={year.Code}>
                      {year.Description}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700">
                  Academic Session
                </label>
                <select
                  className="mt-1 block text-sm w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  value={academicSession}
                  onChange={(e) => setAcademicSession(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select Academic Session
                  </option>
                  {academicSessionsList.map((session) => (
                    <option key={session.Code} value={session.Code}>
                      {session.Code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {/* Department or Faculty */}
            <div className="flex flex-row gap-4">
              <div className="flex-1">
                <label
                  htmlFor="dept-faculty"
                  className="block text-xs font-medium text-gray-700"
                >
                  Select Department or Faculty
                </label>
                <select
                  id="dept-faculty"
                  name="dept-faculty"
                  className="mt-1 block text-sm w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  value={departmentOrFaculty}
                  onChange={(e) => {
                    setDepartmentOrFaculty(e.target.value);
                    setSelectedDepartment("");
                    setSelectedFaculty("");
                  }}
                  required
                >
                  <option value="" disabled>
                    Select an option
                  </option>
                  <option value="department">Department</option>
                  <option value="faculty">Faculty</option>
                </select>
              </div>
              {departmentOrFaculty === "department" && (
                <div className="flex-1">
                  <label
                    htmlFor="department"
                    className="block text-xs font-medium text-gray-700"
                  >
                    Select Department
                  </label>
                  <select
                    id="department"
                    name="department"
                    className="mt-1 block text-sm w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select a department
                    </option>
                    {departments.map((dept) => (
                      <option key={dept.departmentId} value={dept.departmentId}>
                        {dept.departmentName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {departmentOrFaculty === "faculty" && (
                <div className="flex-1">
                  <label
                    htmlFor="faculty"
                    className="block text-xs font-medium text-gray-700"
                  >
                    Select Faculty
                  </label>
                  <select
                    id="faculty"
                    name="faculty"
                    className="mt-1 block w-full text-sm px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                    value={selectedFaculty}
                    onChange={(e) => setSelectedFaculty(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select a faculty
                    </option>
                    {faculties.map((faculty) => (
                      <option key={faculty.facultyId} value={faculty.facultyId}>
                        {faculty.facultyName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {/* Date Selection */}
            <div>
              {dateType !== "custom" ? (
                <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 w-full">
                  <div className="flex flex-col space-y-4 md:space-y-0 md:space-x-4 w-1/2">
                    <label className="block text-sm text-gray-700">
                      Date Type
                    </label>
                    <select
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      value={dateType}
                      onChange={(e) => setDateType(e.target.value)}
                    >
                      <option value="day">Day</option>
                      <option value="week">Week</option>
                      <option value="month">Month</option>
                      <option value="activeSession">Active Session</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </div>
                  {(dateType === "day" ||
                    dateType === "week" ||
                    dateType === "month") && (
                    <div className="w-full md:w-1/2 mt-1">
                      <label className="block text-xs text-gray-500">
                        Start Date
                      </label>
                      <input
                        type="date"
                        className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col md:flex-row md:space-x-4">
                  <div className="md:w-1/2 w-full">
                    <label className="block text-sm text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div className="md:w-1/2 w-full mt-4 md:mt-0">
                    <label className="block text-sm text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                  <div className="mt-3 md:mt-0 flex items-end">
                    <button
                      type="button"
                      className="px-3 py-2 text-xs bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                      onClick={() => {
                        setDateType("day");
                        setCustomStartDate("");
                        setCustomEndDate("");
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
              {dateType !== "day" && (
                <div className="mt-4">
                  <label className="block text-sm text-gray-700 mb-1">
                    Recurrence
                  </label>
                  <WeekdaySelector
                    value={selectedDays}
                    onChange={setSelectedDays}
                  />
                </div>
              )}
            </div>
            {/* Time Selection */}
            <div>
              <label className="block text-sm text-gray-700">Time</label>
              <div className="flex space-x-4">
                <select
                  className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  value={timeType}
                  onChange={(e) => setTimeType(e.target.value)}
                >
                  <option value="fullDay">Full Day</option>
                  <option value="firstHalf">First Half</option>
                  <option value="secondHalf">Second Half</option>
                  <option value="custom">Custom Range</option>
                  <option value="list">Select from List</option>
                </select>
              </div>
              {timeType === "list" && (
                <div className="mt-2">
                  <label className="block text-xs text-gray-500 mb-1">
                    Select Time Slot
                  </label>
                  <select
                    className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                    value={selectedSlotIndex ?? ""}
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      setSelectedSlotIndex(idx);
                      setCustomStartTime(timeSlotOptions[idx].start);
                      setCustomEndTime(timeSlotOptions[idx].end);
                    }}
                  >
                    <option value="" disabled>
                      Select slot
                    </option>
                    {timeSlotOptions.map((slot, idx) => (
                      <option key={idx} value={idx}>
                        {slot.start} - {slot.end}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {timeType === "custom" && (
                <div className="flex flex-col md:flex-row md:space-x-4">
                  <div className="md:w-1/2 w-full">
                    <label className="block text-xs text-gray-500 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      value={customStartTime}
                      onChange={(e) => setCustomStartTime(e.target.value)}
                    />
                  </div>
                  <div className="md:w-1/2 w-full mt-4 md:mt-0">
                    <label className="block text-xs text-gray-500 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      value={customEndTime}
                      onChange={(e) => setCustomEndTime(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
            {/* Keys & Remarks */}
            <div>
              <label className="block text-sm text-gray-700">Keys</label>
              <input
                className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                type="text"
                placeholder="Assigned Key numbers e.g.: 002,005"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm text-gray-700">Remarks</label>
              <textarea
                className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                rows={3}
                placeholder="Remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
            <div className="flex justify-center">
              <button
                type="submit"
                className="px-3 py-2 bg-[#F26722] text-white rounded-lg shadow-md hover:bg-[#a5705a] transition duration-300 mb-6"
              >
                Allocate
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
