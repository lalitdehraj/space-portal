import React, { useState, useEffect } from "react";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { Clock, Calendar, Eye, Save } from "lucide-react";
import { Department, Employee, Faculty, Occupant, RoomInfo, SpaceAllocation, UserProfile } from "@/types";
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
  occupants?: Occupant[];
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
  const [remarks, setRemarks] = useState("");
  const [dateType, setDateType] = useState<Recurrence>("day");
  const [startDate, setCustomStartDate] = useState(initialDate ? initialDate : "");
  const [endDate, setCustomEndDate] = useState("");
  const [isConflictsViewVisible, setIsConflictsViewVisible] = useState(false);
  const [timeType, setTimeType] = useState("custom");
  const [employeeId, setEmployeeId] = useState("");
  const [startTime, setCustomStartTime] = useState(initialStartTime || "");
  const [endTime, setCustomEndTime] = useState(initialEndTime || "");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);

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
    }
  }, [timeType]);

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
        purpose: "",
      } as SpaceAllocation;
    });
  }

  // Basic validation
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const errors: string[] = [];
    if (!employeeId) errors.push("Employee is required.");
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

    const fetchExistingSlots = async () => {
      const requestbody = {
        roomID: `${roomInfo.parentId ? roomInfo.parentId : roomInfo.id}`,
        subroomID: `${roomInfo.parentId ? roomInfo.id : 0}`,
        academicYr: acadmeicYear,
        acadSess: acadmeicSession,
        startDate: moment().format("YYYY-MM-DD"),
        endDate: academicSessionEndDate,
      };
      const response = await callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, requestbody);
      if (response.success) {
        return response.data?.occupants;
      } else {
        const occ: Occupant[] = [];
        return occ;
      }
    };
    const existingOccupants = await fetchExistingSlots();
    const existingSlots = existingOccupants?.map((o) => {
      return {
        date: moment(o.scheduledDate).format("YYYY-MM-DD"),
        start: o.startTime,
        end: o.endTime,
      };
    }) as Slot[];
    const overlapErrors = checkSlotConflicts(createdSlots, existingSlots);
    console.log("Errors  ", errors);
    console.log("Allocations  ", createdSlots);
    console.log("overlaps ", overlapErrors);
    setAllocationSlotsList(createdSlots);
    setExistingBookedSlots(existingSlots);

    if (errors.length === 0 && overlapErrors.length > 0) {
      setIsConflictsViewVisible(true);
      setOverLaps(overlapErrors);
    } else {
      console.log("Write these allocations to DB", createdSlots);
      onSuccessfulSlotsCreation(createSpaceAllocations(createdSlots));
      onClose();
    }
  };
  const [overLaps, setOverLaps] = useState<Slot[]>([]);
  const [allocaionSlotsList, setAllocationSlotsList] = useState<Slot[]>([]);
  const [existingBookedSlots, setExistingBookedSlots] = useState<Slot[]>([]);

  useEffect(() => {
    if (!allocaionSlotsList) return;
    const overlap = checkSlotConflicts(allocaionSlotsList, existingBookedSlots);
    setOverLaps(overlap);
    if (overlap.length > 0) return;
    onSuccessfulSlotsCreation(createSpaceAllocations(allocaionSlotsList));
    console.log("Allocations : ", allocaionSlotsList);
    console.log("Overlaps: ", overlap);
  }, [allocaionSlotsList]);

  const handleProceedAnyway = () => {
    const list = allocaionSlotsList.filter((slot) => {
      return !overLaps.includes(slot);
    });
    onSuccessfulSlotsCreation(createSpaceAllocations(list));
    setIsConflictsViewVisible(false);
    onClose();
  };

  return (
    <section className="fixed inset-0 z-50 h-screen  w-screen bg-[#00000070] flex items-center justify-center text-gray-500">
      <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl px-8 py-2">
        {!isConflictsViewVisible && (
          <div className="max-h-[80vh] bg-white overflow-y-scroll mr-4 pr-2">
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Close">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
              {/* Department or Faculty */}
              <div className="flex flex-row gap-4">
                <div className="flex-1">
                  <label htmlFor="dept-faculty" className="block text-xs font-medium text-gray-700">
                    Select Department or Faculty
                  </label>
                  <select
                    id="dept-faculty"
                    name="dept-faculty"
                    className="mt-1 block text-sm w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                    value={employeeId}
                    onChange={(e) => {
                      setEmployeeId(e.target.value);
                    }}
                    required
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
              <div>
                <label className="block text-sm text-gray-700">Time</label>
                <div className="flex space-x-4">
                  <select
                    className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                    value={timeType}
                    onChange={(e) => setTimeType(e.target.value)}
                  >
                    <option value="custom">Custom Range</option>
                    <option value="firstHalf">First Half</option>
                    <option value="secondHalf">Second Half</option>
                    <option value="fullDay">Full Day</option>
                  </select>
                </div>
                {timeType === "custom" && (
                  <div className="flex flex-col md:flex-row md:space-x-4">
                    <div className="md:w-1/2 w-full">
                      <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                      <input
                        type="time"
                        className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                        value={startTime}
                        onChange={(e) => setCustomStartTime(e.target.value)}
                      />
                    </div>
                    <div className="md:w-1/2 w-full mt-4 md:mt-0">
                      <label className="block text-xs text-gray-500 mb-1">End Time</label>
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
              <div className="flex justify-center">
                <button type="submit" className="px-3 py-2 bg-[#F26722] text-white rounded-lg shadow-md hover:bg-[#a5705a] transition duration-300 mb-6">
                  Allocate
                </button>
              </div>
            </form>
          </div>
        )}
        {isConflictsViewVisible && (
          <div className="max-h-[80vh] bg-white overflow-y-scroll mr-4 pr-2">
            <ConflictSlotsList
              existingSlots={existingBookedSlots}
              conflicts={overLaps}
              handleProceedAnyway={handleProceedAnyway}
              onClose={(allocationPerformed) => {
                if (allocationPerformed) onClose();
                setIsConflictsViewVisible(false);
              }}
              onUpdateSlot={(date, oldSlot, updatedSlot) => {
                const newList = allocaionSlotsList.map((slot) => (areSlotsEqual(oldSlot, slot) ? updatedSlot : slot));
                setAllocationSlotsList(newList);
              }}
            />
          </div>
        )}
      </div>
    </section>
  );
}

// interface ConflictSlotsListProps {
//   existingSlots:Slot[]
//   conflicts: Slot[];
//   onClose: () => void;
//   onViewDay: (date: string) => void; // callback when user wants to see the schedule
//   onUpdateSlot: (date: string, oldSlot: Slot, updated: Slot) => void; // new callback
// }

// const ConflictSlotsList: React.FC<ConflictSlotsListProps> = ({
//   existingSlots,
//   conflicts,
//   onViewDay,
//   onClose,
//   onUpdateSlot,
// }) => {
//   // group conflicts by date
//   const grouped = conflicts.reduce<Record<string, Slot[]>>((acc, slot) => {
//     if (!acc[slot.date]) acc[slot.date] = [];
//     acc[slot.date].push(slot);
//     return acc;
//   }, {});

//   return (
//     <div className="space-y-4 ">
//       <div className="flex flex-row justify-between ">
//         <h2 className="text-lg font-semibold text-red-600  flex items-center gap-2">
//           <Clock className="w-5 h-5" />
//           Conflicting Slots
//         </h2>
//         <X
//           className="w-6 h-6 stroke-gray-500 hover:stroke-gray-700"
//           onClick={onClose}
//         />
//       </div>
//       {Object.entries(grouped).map(([date, slots]) => (
//         <div
//           key={date}
//           className="rounded-lg border border-red-300 bg-red-50 p-4 shadow-sm"
//         >
//           <div className="flex items-center justify-between">
//             <div className="flex items-center gap-2 text-red-700 font-medium">
//               <Calendar className="w-4 h-4" />
//               {date}
//             </div>
//             <button
//               onClick={() => onViewDay(date)}
//               className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
//             >
//               <Eye className="w-4 h-4" />
//               View Day Schedule
//             </button>
//           </div>

//           <ul className="mt-2 space-y-2">
//             {slots.map((slot, i) => {
//               const [start, setStart] = useState(slot.start);
//               const [end, setEnd] = useState(slot.end);

//               return (
//                 <li
//                   key={i}
//                   className="flex items-center gap-2 text-sm text-gray-800 bg-white border border-red-200 px-2 py-1 rounded-md"
//                 >
//                   <input
//                     type="time"
//                     value={start}
//                     onChange={(e) => setStart(e.target.value)}
//                     className="border rounded px-1 py-0.5 text-sm"
//                   />
//                   →
//                   <input
//                     type="time"
//                     value={end}
//                     onChange={(e) => setEnd(e.target.value)}
//                     className="border rounded px-1 py-0.5 text-sm"
//                   />
//                   <button
//                     onClick={() =>
//                       onUpdateSlot(date, slot, { ...slot, start, end })
//                     }
//                     className="ml-auto flex items-center gap-1 text-green-600 hover:underline"
//                   >
//                     <Save className="w-4 h-4" />
//                     Save
//                   </button>
//                 </li>
//               );
//             })}
//           </ul>
//         </div>
//       ))}

//       {conflicts.length === 0 && (
//         <div className="flex flex-row">
//           <p className="text-sm text-gray-500">✅ No conflicts found. </p>
//           <p className="text-sm text-gray-500"> ✅ Allocation successful.</p>
//         </div>
//       )}
//     </div>
//   );
// };
