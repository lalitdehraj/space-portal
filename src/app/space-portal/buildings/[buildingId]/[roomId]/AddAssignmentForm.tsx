import React, { useState, useEffect } from "react";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { Employee, Occupant, RoomInfo, SpaceAllocation, UserProfile } from "@/types";
import { useSelector } from "react-redux";
import { areSlotsEqual, buildSlotsWithWeekdays, checkSlotConflicts, Recurrence, Slot } from "@/utils/slotsHelper";
import { Check, X } from "lucide-react";
import moment from "moment";
import { ConflictSlotsList } from "./Conflicts";

type FormProps = {
  roomInfo: RoomInfo;
  onClose: () => void;
  onSuccessfulSlotsCreation: (allocations: SpaceAllocation[]) => void;
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
};

const WEEK_DAYS = ["Mon", "Tues", "Wed", "Thu", "Fri", "Sat", "Sun"];

function WeekdaySelector({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {WEEK_DAYS.map((day) => {
        const isSelected = value.includes(day);
        return (
          <button
            type="button"
            key={day}
            className={`flex items-center gap-1 px-2 py-1 rounded transition ${isSelected ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700"}`}
            onClick={() => onChange(isSelected ? value.filter((d) => d !== day) : [...value, day])}
          >
            {isSelected && <Check size={14} strokeWidth={3} />}
            <span>{day}</span>
          </button>
        );
      })}
    </div>
  );
}

// Helper for time slot list
const defaultTimeSlots: any = [];
for (let m = 9 * 60; m < 18 * 60; m += 45) {
  const startHours = Math.floor(m / 60);
  const startMinutes = m % 60;

  const endMinutesTotal = m + 45;
  const endHours = Math.floor(endMinutesTotal / 60);
  const endMinutes = endMinutesTotal % 60;

  const start = `${String(startHours).padStart(2, "0")}:${String(startMinutes).padStart(2, "0")}`;
  const end = `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;

  defaultTimeSlots.push({ start, end });
}

export default function AddAssignmentForm({
  roomInfo,
  onClose,
  onSuccessfulSlotsCreation: onSuccessfulSlotsCreation,
  initialDate,
  initialStartTime,
  initialEndTime,
}: FormProps) {
  const user: UserProfile | null = useSelector((state: any) => state.dataState.user);
  const acadmeicYear = useSelector((state: any) => state.dataState.selectedAcademicYear);
  const acadmeicSession = useSelector((state: any) => state.dataState.selectedAcademicSession);
  const academicSessionEndDate = useSelector((state: any) => state.dataState.selectedAcademicSessionEndDate);
  const [purpose, setPurpose] = useState("");
  const [keys, setKeys] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [remarks, setRemarks] = useState("");
  const [dateType, setDateType] = useState<Recurrence>("day");
  const [startDate, setCustomStartDate] = useState(initialDate ? initialDate : "");
  const [endDate, setCustomEndDate] = useState("");
  const [isConflictsViewVisible, setIsConflictsViewVisible] = useState(false);
  const [timeType, setTimeType] = useState("custom");
  const [employeeId, setEmployeeId] = useState("");
  const [startTime, setCustomStartTime] = useState(initialStartTime || "");
  const [endTime, setCustomEndTime] = useState(initialEndTime || "");
  const [timeSlot, setTimeSlot] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [allocationSlotsList, setAllocationSlotsList] = useState<Slot[]>([]);
  const [existingBookedSlots, setExistingBookedSlots] = useState<Slot[]>([]);
  const [isValidationVisible, setIsValidationVisible] = useState(false);
  const [type, setType] = useState(false);
  const [slotGroups, setSlotGroups] = useState<{ resolved: Slot[]; unresolved: Slot[] }>({
    resolved: [],
    unresolved: [],
  });

  useEffect(() => {
    const fetchEmployees = async () => {
      const { data: employees } = await callApi<Employee[]>(process.env.NEXT_PUBLIC_GET_EMPLOYEES || URL_NOT_FOUND, {
        employeeCode: "",
      });
      if (employees) setEmployeesList(employees);
    };
    fetchEmployees();
  }, []);

  useEffect(() => {
    // Fill slot details if provided
    if (initialDate) setCustomStartDate(initialDate);
    if (initialStartTime) setCustomStartTime(initialStartTime);
    if (initialEndTime) setCustomEndTime(initialEndTime);
  }, [initialDate, initialStartTime, initialEndTime]);

  useEffect(() => {
    // Calculate end date from dateType
    if (!startDate) {
      setCustomEndDate("");
      return;
    }
    let newEndDate = startDate;
    if (dateType === "week") {
      const start = new Date(startDate);
      start.setDate(start.getDate() + 6);
      newEndDate = start.toISOString().split("T")[0];
    } else if (dateType === "month") {
      const start = new Date(startDate);
      start.setMonth(start.getMonth() + 1);
      start.setDate(start.getDate() - 1);
      newEndDate = start.toISOString().split("T")[0];
    } else if (dateType === "activeSession") {
      newEndDate = academicSessionEndDate;
    }
    setCustomEndDate(newEndDate);
  }, [dateType, startDate]);

  useEffect(() => {
    // Auto-set time for fullDay/halfDay
    if (timeType === "fullDay") {
      setCustomStartTime("09:00");
      setCustomEndTime("18:00");
    } else if (timeType === "firstHalf") {
      setCustomStartTime("09:00");
      setCustomEndTime("13:30");
    } else if (timeType === "secondHalf") {
      setCustomStartTime("13:30");
      setCustomEndTime("18:00");
    } else if (timeType === "slots") {
      switch (timeSlot) {
        case "1": {
          setCustomStartTime("09:00");
          setCustomEndTime("10:00");
          break;
        }
        case "2": {
          setCustomStartTime("10:00");
          setCustomEndTime("11:00");
          break;
        }
        case "3": {
          setCustomStartTime("11:00");
          setCustomEndTime("12:00");
          break;
        }
        case "4": {
          setCustomStartTime("12:00");
          setCustomEndTime("13:00");
          break;
        }
        case "5": {
          setCustomStartTime("13:00");
          setCustomEndTime("14:00");
          break;
        }
        case "6": {
          setCustomStartTime("14:00");
          setCustomEndTime("15:00");
          break;
        }
        case "7": {
          setCustomStartTime("15:00");
          setCustomEndTime("16:00");
          break;
        }
        case "8": {
          setCustomStartTime("16:00");
          setCustomEndTime("17:00");
          break;
        }
        case "9": {
          setCustomStartTime("17:00");
          setCustomEndTime("18:00");
          break;
        }
      }
    }
  }, [timeType, timeSlot]);

  function createSpaceAllocations(slots: Slot[]): SpaceAllocation[] {
    return slots.map((slot) => {
      return {
        allocationDate: slot.date,
        startTime: `${slot.start}:00`,
        endTime: `${slot.end}:00`,
        keyAssigned: keys,
        subRoom: roomInfo.parentId ? roomInfo.id : 0,
        allocatedRoomID: roomInfo.parentId ? roomInfo.parentId : roomInfo.id,
        buildingId: roomInfo.building,
        academicSession: acadmeicSession,
        academicYear: acadmeicYear,
        allocatedTo: employeeId,
        isAllocationActive: true,
        remarks: remarks,
        allocatedOnDate: moment().format("YYYY-MM-DD"),
        allocatedfrom: "Direct Allocation",
        allocatedBy: user?.employeeId || "",
        purpose: purpose,
      } as SpaceAllocation;
    });
  }

  useEffect(() => {
    const errors: string[] = [];
    if (timeType === "slots" && !timeSlot) {
      errors.push("Please select a time slot.");
    }
    if (!employeeId) errors.push("Employee is required.");
    if (dateType !== "day" && selectedDays.length === 0) errors.push("Please select week days");
    if (!startDate) errors.push("Start Date is required.");
    if (dateType === "custom" && !endDate) errors.push("End Date is required for custom range.");
    if (!startTime) errors.push("Start Time is required.");
    if (!endTime) errors.push("End Time is required.");

    const slotDate = moment(startDate);
    const startSlotTime = moment(startTime, "HH:mm");
    const exactSlotStartTime = slotDate.hour(startSlotTime.hour()).minute(startSlotTime.minute());
    if (exactSlotStartTime.isBefore(moment())) errors.push("Start time is in past.");
    if (startTime >= endTime) errors.push("End time must be after start time.");

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    } else {
      setValidationErrors([]);
    }
  }, [employeeId, startDate, endDate, startTime, endTime, keys, purpose, remarks, selectedDays]);

  useEffect(() => {
    if (!startDate || !endDate || !startTime || !endTime) {
      setAllocationSlotsList([]);
      return;
    }
    if (dateType !== "day" && selectedDays.length === 0) {
      setAllocationSlotsList([]);
      return;
    }
    const slotDate = moment(startDate);
    const startSlotTime = moment(startTime, "HH:mm");
    const exactSlotStartTime = slotDate.hour(startSlotTime.hour()).minute(startSlotTime.minute());
    if (exactSlotStartTime.isBefore(moment())) {
      setAllocationSlotsList([]);
      return;
    }
    if (startTime >= endTime) {
      setAllocationSlotsList([]);
      return;
    }
    // Generate allocations and check overlap
    const createdSlots = buildSlotsWithWeekdays({
      startDate: startDate,
      customEndDate: endDate,
      recurrence: dateType,
      repeatOnDays: selectedDays,
      startTime: startTime,
      respectSessionEndDate: true,
      endTime: endTime,
    });
    const existingSlots = roomInfo.occupants?.map((o) => {
      return {
        date: moment(o.scheduledDate).format("YYYY-MM-DD"),
        start: o.startTime,
        end: o.endTime,
      };
    }) as Slot[];
    const overlapErrors = checkSlotConflicts(createdSlots, existingSlots);
    setAllocationSlotsList(createdSlots);
    setExistingBookedSlots(existingSlots);
    // setConflictingSlots(overlapErrors || []);

    if (overlapErrors.length > 0) {
      setIsConflictsViewVisible(true);
    } else {
      setIsConflictsViewVisible(false);
    }
  }, [startDate, endDate, startTime, endTime, selectedDays]);

  // Basic validation
  const handleAllocate = () => {
    setIsValidationVisible(true);
    if (validationErrors.length === 0) {
      if (slotGroups.unresolved.length > 0) {
        const confirmProceed = window.confirm(
          `⚠️ Some slots are still in conflict:\n${slotGroups.unresolved
            .map((s) => `${s.date} ${s.start} → ${s.end}`)
            .join("\n")}\n\nDo you want to proceed anyway?`
        );
        if (confirmProceed) {
          console.log(slotGroups, allocationSlotsList);
          onSuccessfulSlotsCreation(createSpaceAllocations(slotGroups.resolved));
          setIsConflictsViewVisible(false);
        }
      } else {
        console.log(slotGroups, allocationSlotsList);
        onSuccessfulSlotsCreation(createSpaceAllocations(slotGroups.resolved));
      }
      setSuccessMessage("Slots allocated successfully!");
      setTimeout(() => {
        onClose();
      }, 1500);
    }
  };

  return (
    <section className="fixed inset-0 z-50 h-screen  w-screen bg-[#00000070] flex items-center justify-center text-gray-500">
      <div className="max-h-[80vh] relative w-full max-w-2xl bg-white rounded-xl shadow-2xl px-8 py-2 flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold text-gray-700  mt-2 mb-4">Allocate Room</h2>
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Close">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div>
          {successMessage && (
            <div className="bg-green-100 border border-green-300 text-green-700 rounded p-2 mb-2">
              <p className="text-sm">{successMessage}</p>
            </div>
          )}
          {validationErrors.length > 0 && isValidationVisible && (
            <div className="relative bg-red-100 border border-red-300 text-red-700 rounded p-2 mb-2">
              {/* Close Icon aligned top-right */}
              <button onClick={() => setIsValidationVisible(false)} className="absolute top-1 right-1 text-red-700 hover:text-red-900">
                <X size={16} />
              </button>

              <ul className="text-sm list-disc ml-4 pr-6">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className=" flex-1 overflow-y-auto">
          <form className="space-y-4">
            {/* Department or Faculty */}
            <div className="flex flex-row gap-4">
              <div className="flex-1">
                <label htmlFor="dept-faculty" className="block text-xs font-medium text-gray-700">
                  Select Employee
                </label>
                <select
                  id="dept-faculty"
                  name="dept-faculty"
                  className="mt-1 block text-sm w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  value={employeeId}
                  onChange={(e) => {
                    setEmployeeId(e.target.value);
                  }}
                >
                  <option value="" disabled>
                    Select an option
                  </option>
                  {employeesList.map((e: Employee) => (
                    <option value={e.employeeCode} key={e.employeeCode}>{`${e.employeeName} (${e.employeeCode})`}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Date Selection */}
            <div>
              {dateType !== "custom" ? (
                <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 w-full">
                  <div className="flex flex-col space-y-4 md:space-y-0 md:space-x-4 w-1/2">
                    <label className="block text-sm text-gray-700">Date Type</label>
                    <select
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      value={dateType}
                      onChange={(e) => setDateType(e.target.value as Recurrence)}
                    >
                      <option value="day">Day</option>
                      <option value="week">Week</option>
                      <option value="month">Month</option>
                      <option value="activeSession">Active Session</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </div>
                  {(dateType === "day" || dateType === "week" || dateType === "month") && (
                    <div className="w-full md:w-1/2 mt-1">
                      <label className="block text-xs text-gray-500">Start Date</label>
                      <input
                        type="date"
                        min={moment().format("YYYY-MM-DD")}
                        max={academicSessionEndDate}
                        className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                        value={startDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col md:flex-row md:space-x-4">
                  <div className="md:w-1/2 w-full">
                    <label className="block text-sm text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      value={startDate}
                      min={moment().format("YYYY-MM-DD")}
                      max={academicSessionEndDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div className="md:w-1/2 w-full mt-4 md:mt-0">
                    <label className="block text-sm text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      value={endDate}
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
                  <label className="block text-sm text-gray-700 mb-1">Recurrence</label>
                  <WeekdaySelector value={selectedDays} onChange={setSelectedDays} />
                </div>
              )}
            </div>
            {/* Time Selection */}
            <div className="flex space-x-4 items-end">
              <div className="block w-full">
                <label className="block text-sm text-gray-700">Time</label>
                <select
                  className="block w-full h-fit px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  value={timeType}
                  onChange={(e) => setTimeType(e.target.value)}
                >
                  <option value="custom">Custom Range</option>
                  <option value="slots">Select from Slots</option>
                  <option value="firstHalf">First Half</option>
                  <option value="secondHalf">Second Half</option>
                  <option value="fullDay">Full Day</option>
                </select>
              </div>
              {timeType === "slots" && (
                <div className="block w-full">
                  <label className="block text-[10px] text-gray-500">Select Slot</label>
                  <select
                    onChange={(e) => setTimeSlot(e.target.value)}
                    value={timeSlot}
                    className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  >
                    <option value="0" disabled={timeSlot !== "0"}>
                      Select Slot
                    </option>
                    <option value="1">09:00 - 10:00</option>
                    <option value="2">10:00 - 11:00</option>
                    <option value="3">11:00 - 12:00</option>
                    <option value="4">12:00 - 13:00</option>
                    <option value="5">13:00 - 14:00</option>
                    <option value="6">14:00 - 15:00</option>
                    <option value="7">15:00 - 16:00</option>
                    <option value="8">16:00 - 17:00</option>
                    <option value="9">17:00 - 18:00</option>
                  </select>
                </div>
              )}
              {timeType === "custom" && (
                <div className="flex flex-col md:flex-row md:space-x-2 w-full ">
                  <div className="md:w-1/2 w-full">
                    <label className="block text-[10px] text-gray-500">Start Time</label>
                    <input
                      type="time"
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      value={startTime}
                      onChange={(e) => setCustomStartTime(e.target.value)}
                    />
                  </div>
                  <div className="md:w-1/2 w-full mt-4 md:mt-0">
                    <label className="block text-[10px] text-gray-500">End Time</label>
                    <input
                      type="time"
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      value={endTime}
                      onChange={(e) => setCustomEndTime(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
            {/* Keys & Remarks */}
            <div>
              <label className="block text-sm text-gray-700">Purpose</label>
              <input
                className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                type="text"
                placeholder="Assigned Key numbers e.g.: 002,005"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700">Keys</label>
              <input
                className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                type="text"
                placeholder="Assigned Key numbers e.g.: 002,005"
                value={keys}
                onChange={(e) => setKeys(e.target.value)}
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
          </form>
        </div>
        {/* Footer (optional, stays pinned) */}
        <div className="flex justify-center py-2">
          <button onClick={handleAllocate} className="px-3 py-2 bg-[#F26722] text-white rounded-lg shadow-md hover:bg-[#a5705a] transition duration-300 mb-6">
            Allocate
          </button>
        </div>
      </div>
      <div>
        <div className={`max-h-[80vh] bg-white ml-2 p-2 rounded-md ${isConflictsViewVisible ? " block " : " hidden "}`}>
          <ConflictSlotsList existingSlots={existingBookedSlots} createdSlots={allocationSlotsList} onSlotGroupsChange={setSlotGroups} />
        </div>
      </div>
    </section>
  );
}
