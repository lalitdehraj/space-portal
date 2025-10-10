import React, { useState, useEffect } from "react";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { Employee, RoomInfo, SpaceAllocation, UserProfile, Maintenance, Occupant } from "@/types";
import { useSelector } from "react-redux";
import { Check, X } from "lucide-react";
import moment from "moment";
import { RootState } from "@/app/store";

// Helper function to group consecutive dates and format conflicts
const groupConsecutiveDates = (dates: string[]): string => {
  if (dates.length === 0) return "";
  if (dates.length === 1) return moment(dates[0]).format("MMM DD, YYYY");

  const sortedDates = [...dates].sort();
  const ranges: string[] = [];
  let start = moment(sortedDates[0]);
  let end = moment(sortedDates[0]);

  for (let i = 1; i < sortedDates.length; i++) {
    const current = moment(sortedDates[i]);
    const prev = moment(sortedDates[i - 1]);

    if (current.diff(prev, "days") === 1) {
      end = current;
    } else {
      if (start.isSame(end)) {
        ranges.push(start.format("MMM DD, YYYY"));
      } else {
        ranges.push(`${start.format("MMM DD")} - ${end.format("MMM DD, YYYY")}`);
      }
      start = current;
      end = current;
    }
  }

  // Add the last range
  if (start.isSame(end)) {
    ranges.push(start.format("MMM DD, YYYY"));
  } else {
    ranges.push(`${start.format("MMM DD")} - ${end.format("MMM DD, YYYY")}`);
  }

  return ranges.join(", ");
};

type FormProps = {
  roomInfo: RoomInfo;
  onClose: () => void;
  onSuccessfulAllocation: (allocations: SpaceAllocation[]) => void;
};

export default function CabinWorkstationAllocationForm({ roomInfo, onClose, onSuccessfulAllocation }: FormProps) {
  const user: UserProfile | null = useSelector((state: RootState) => state.dataState.user);
  const acadmeicYear = useSelector((state: RootState) => state.dataState.selectedAcademicYear);
  const acadmeicSession = useSelector((state: RootState) => state.dataState.selectedAcademicSession);
  const academicSessionEndDate = useSelector((state: RootState) => state.dataState.selectedAcademicSessionEndDate);

  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState(moment().format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(academicSessionEndDate);
  const [purpose, setPurpose] = useState("");
  const [remarks, setRemarks] = useState("");
  const [allocationType, setAllocationType] = useState("");
  const [keysAssigned, setKeysAssigned] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [isValidationVisible, setIsValidationVisible] = useState(false);
  const [hasConflicts, setHasConflicts] = useState(false);
  const [conflictDetails, setConflictDetails] = useState<string[]>([]);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);

  useEffect(() => {
    const fetchEmployees = async () => {
      const { data: employees } = await callApi<Employee[]>(process.env.NEXT_PUBLIC_GET_EMPLOYEES || URL_NOT_FOUND, {
        employeeCode: "",
      });
      if (employees) setEmployeesList(employees);
    };
    fetchEmployees();
  }, []);

  // Function to check maintenance conflicts for the specific room
  const checkMaintenanceConflicts = async (): Promise<string[]> => {
    if (!startDate || !endDate) return [];

    try {
      const response = await callApi<Maintenance[]>(process.env.NEXT_PUBLIC_GET_MAINTENANCE_DATA || URL_NOT_FOUND);
      if (!response.success || !response.data) return [];

      const allocationStart = moment(startDate);
      const allocationEnd = moment(endDate);
      const conflictDates: string[] = [];

      response.data.forEach((maintenance) => {
        // Only check maintenance for this specific room
        if (!maintenance.isMainteneceActive) return;
        if (maintenance.buildingId !== roomInfo.building || maintenance.roomid !== roomInfo.id) return;

        const maintenanceDate = moment(maintenance.maintanceDate).format("YYYY-MM-DD");
        const maintenanceStart = moment(`${maintenanceDate} ${maintenance.startTime.split("T")[1]?.split("Z")[0]?.substring(0, 5) || "00:00"}`);
        const maintenanceEnd = moment(`${maintenanceDate} ${maintenance.endTime.split("T")[1]?.split("Z")[0]?.substring(0, 5) || "00:00"}`);

        // Check if allocation period overlaps with maintenance
        if (maintenanceEnd.isAfter(allocationStart, "day") && maintenanceStart.isBefore(allocationEnd, "day")) {
          conflictDates.push(maintenanceDate);
        }
      });

      // Group consecutive dates and format the conflict message
      if (conflictDates.length > 0) {
        const groupedDates = groupConsecutiveDates(conflictDates);
        const startTime =
          response.data
            .find((m) => m.buildingId === roomInfo.building && m.roomid === roomInfo.id && m.isMainteneceActive)
            ?.startTime.split("T")[1]
            ?.split("Z")[0]
            ?.substring(0, 5) || "00:00";
        const endTime =
          response.data
            .find((m) => m.buildingId === roomInfo.building && m.roomid === roomInfo.id && m.isMainteneceActive)
            ?.endTime.split("T")[1]
            ?.split("Z")[0]
            ?.substring(0, 5) || "00:00";

        return [`Maintenance scheduled ${groupedDates} (${startTime} - ${endTime})`];
      }

      return [];
    } catch (error) {
      console.error("Error checking maintenance conflicts:", error);
      return [];
    }
  };

  // Function to check grouped occupant conflicts
  const checkGroupedOccupantConflicts = async (): Promise<string[]> => {
    if (!startDate || !endDate) return [];

    try {
      const allocationStart = moment(startDate);
      const allocationEnd = moment(endDate);
      const conflicts: string[] = [];

      // Check existing occupants in the room
      if (roomInfo.occupants && roomInfo.occupants.length > 0) {
        roomInfo.occupants.forEach((occupant) => {
          if (!occupant.scheduledDate) return;

          const occupantStartDate = moment(occupant.scheduledDate);
          const occupantEndDate = occupant.scheduledEndDate ? moment(occupant.scheduledEndDate) : occupantStartDate;

          // For faculty sittings, check date range overlap
          // For other room types, check if dates overlap
          const hasOverlap = occupantEndDate.isAfter(allocationStart, "day") && occupantStartDate.isBefore(allocationEnd, "day");

          if (hasOverlap) {
            const occupantName = occupant.occupantName || occupant.Id || "Unknown";

            // For faculty sittings, show the date range
            if (occupant.scheduledEndDate) {
              const startDateStr = occupantStartDate.format("MMM DD, YYYY");
              const endDateStr = occupantEndDate.format("MMM DD, YYYY");
              conflicts.push(`Occupied by ${occupantName} (${startDateStr} - ${endDateStr})`);
            } else {
              // For single-day allocations, show the specific date
              const occupantDate = occupantStartDate.format("MMM DD, YYYY");
              const timeRange = occupant.startTime && occupant.endTime ? ` (${occupant.startTime} - ${occupant.endTime})` : "";
              conflicts.push(`Occupied by ${occupantName} on ${occupantDate}${timeRange}`);
            }
          }
        });
      }

      return conflicts;
    } catch (error) {
      console.error("Error checking occupant conflicts:", error);
      return [];
    }
  };

  // Function to check all conflicts for sitting rooms
  const checkAllConflicts = async () => {
    // Only check conflicts for sitting rooms (cabins, workstations, offices)
    if (!roomInfo.isSitting) {
      setHasConflicts(false);
      setConflictDetails([]);
      return;
    }

    if (!startDate || !endDate) {
      setHasConflicts(false);
      setConflictDetails([]);
      return;
    }

    setIsCheckingConflicts(true);
    try {
      const [maintenanceConflicts, occupantConflicts] = await Promise.all([checkMaintenanceConflicts(), checkGroupedOccupantConflicts()]);

      const allConflicts = [...maintenanceConflicts, ...occupantConflicts];
      setHasConflicts(allConflicts.length > 0);
      setConflictDetails(allConflicts);
    } catch (error) {
      console.error("Error checking conflicts:", error);
      setHasConflicts(false);
      setConflictDetails([]);
    } finally {
      setIsCheckingConflicts(false);
    }
  };

  // Check conflicts when dates change
  useEffect(() => {
    checkAllConflicts();
  }, [startDate, endDate]);

  useEffect(() => {
    const errors: string[] = [];
    if (!employeeId) errors.push("Employee is required.");
    if (!startDate) errors.push("Start Date is required.");
    if (!endDate) errors.push("End Date is required.");
    if (startDate >= endDate) errors.push("End Date must be after Start Date.");
    if (!purpose) errors.push("Purpose is required.");
    if (!remarks) errors.push("Remarks are required.");
    if (!allocationType) errors.push("Allocation Type is required.");
    if (!keysAssigned) errors.push("Key Assigned is required.");

    const startMoment = moment(startDate);
    if (startMoment.isBefore(moment(), "day")) errors.push("Start Date cannot be in the past.");

    setValidationErrors(errors);
  }, [employeeId, startDate, endDate, purpose, remarks, allocationType, keysAssigned]);

  const createSpaceAllocations = (): SpaceAllocation[] => {
    // Create single allocation entry for faculty sitting
    const allocation: SpaceAllocation = {
      allocationDate: startDate,
      allocatedEndDate: endDate,
      startTime: "09:00:00",
      endTime: "18:00:00",
      subRoom: roomInfo.parentId ? roomInfo.id : "",
      allocatedRoomID: roomInfo.parentId ? roomInfo.parentId : roomInfo.id,
      buildingId: roomInfo.building,
      academicSession: acadmeicSession,
      academicYear: acadmeicYear,
      allocatedTo: employeeId,
      isAllocationActive: true,
      remarks: remarks,
      allocatedOnDate: moment().format("YYYY-MM-DD"),
      allocatedfrom: "faculty sitting",
      allocatedBy: user?.employeeId || "",
      purpose: purpose,
      types: allocationType,
      keyAssigned: keysAssigned,
    };

    return [allocation];
  };

  const handleAllocate = async () => {
    setIsValidationVisible(true);
    if (validationErrors.length === 0 && !hasConflicts) {
      try {
        const allocations = createSpaceAllocations();
        onSuccessfulAllocation(allocations);
        setSuccessMessage(
          `Faculty sitting allocated successfully! Period: ${moment(startDate).format("MMM DD, YYYY")} - ${moment(endDate).format("MMM DD, YYYY")}`
        );
        setTimeout(() => {
          onClose();
        }, 1500);
      } catch (error) {
        console.error("Error creating allocations:", error);
        setValidationErrors(["Failed to create allocations. Please try again."]);
      }
    }
  };

  return (
    <section className="fixed inset-0 z-50 h-screen w-screen bg-[#00000070] flex items-center justify-center text-gray-500">
      <div className="max-h-[80vh] relative w-full max-w-lg bg-white rounded-xl shadow-2xl px-8 py-6 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-gray-700 text-lg">
            {roomInfo.roomType.toLowerCase() === "cabin"
              ? "Assign Cabin"
              : roomInfo.roomType.toLowerCase() === "workstation"
              ? "Assign Workstation"
              : "Assign Office"}
          </h2>
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Close">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div>
          {successMessage && (
            <div className="bg-green-100 border border-green-300 text-green-700 rounded p-3 mb-4">
              <p className="text-sm">{successMessage}</p>
            </div>
          )}
          {validationErrors.length > 0 && isValidationVisible && (
            <div className="relative bg-red-100 border border-red-300 text-red-700 rounded p-3 mb-4">
              <button onClick={() => setIsValidationVisible(false)} className="absolute top-2 right-2 text-red-700 hover:text-red-900">
                <X size={16} />
              </button>
              <ul className="text-sm list-disc ml-4 pr-6">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Conflict Warning - Only for sitting rooms */}
          {roomInfo.isSitting && hasConflicts && (
            <div className="bg-red-100 border border-red-300 text-red-700 rounded p-3 mb-4">
              <div className="flex items-center mb-3">
                <X size={16} className="mr-2" />
                <span className="text-sm font-medium">Conflicts Detected - Cannot Assign</span>
              </div>
              <div className="bg-white rounded border border-red-200 p-3">
                <div className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Schedule Conflicts</div>
                <div className="space-y-2">
                  {conflictDetails.map((conflict, idx) => (
                    <div key={idx} className="text-sm text-red-700 py-1 px-2 bg-red-50 rounded border-l-2 border-red-300">
                      {conflict}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Conflict Checking Indicator */}
          {roomInfo.isSitting && isCheckingConflicts && (
            <div className="bg-blue-100 border border-blue-300 text-blue-700 rounded p-3 mb-4">
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                <span className="text-sm">Checking for conflicts...</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <form className="space-y-4">
            {/* Employee Selection */}
            <div>
              <label htmlFor="employee" className="block text-sm font-medium text-gray-700 mb-1">
                Select Employee
              </label>
              <select
                id="employee"
                className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-[#F26722]"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                <option value="" disabled>
                  Select an employee
                </option>
                {employeesList.map((employee: Employee) => (
                  <option value={employee.employeeCode} key={employee.employeeCode}>
                    {`${employee.employeeName} (${employee.employeeCode})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  min={moment().format("YYYY-MM-DD")}
                  className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-[#F26722]"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  min={startDate}
                  className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-[#F26722]"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Allocation Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Allocation Type</label>
              <select
                className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-[#F26722]"
                value={allocationType}
                onChange={(e) => setAllocationType(e.target.value)}
              >
                <option value="" disabled>
                  Select allocation type
                </option>
                <option value="4">Permanent Assignment</option>
                <option value="5">Temporary Assignment</option>
                <option value="6">Project Based</option>
                <option value="7">Contract Based</option>
              </select>
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
              <input
                className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-[#F26722]"
                type="text"
                placeholder="Enter purpose of assignment"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>

            {/* Key Assigned */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key Assigned</label>
              <input
                className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-[#F26722]"
                type="text"
                placeholder="Enter key number(s) e.g.: 002, 005"
                value={keysAssigned}
                onChange={(e) => setKeysAssigned(e.target.value)}
              />
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
              <textarea
                className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-[#F26722]"
                rows={3}
                placeholder="Additional remarks or notes"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>

            {/* Room Info Display */}
            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Assignment Details</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <span className="font-medium">Room:</span> {roomInfo.roomName || roomInfo.id}
                </p>
                <p>
                  <span className="font-medium">Type:</span> {roomInfo.roomType}
                </p>
                <p>
                  <span className="font-medium">Capacity:</span> {roomInfo.capacity}
                </p>
                <p>
                  <span className="font-medium">Area:</span> {roomInfo.roomArea} Sq. ft.
                </p>
              </div>
            </div>

            {/* Allocation Preview */}
            {startDate && endDate && startDate <= endDate && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
                <h4 className="text-sm font-medium text-blue-700 mb-2">Allocation Preview</h4>
                <div className="text-sm text-blue-600">
                  <p>
                    <span className="font-medium">Duration:</span> {moment(endDate).diff(moment(startDate), "days") + 1} days
                  </p>
                  <p>
                    <span className="font-medium">Period:</span> {moment(startDate).format("MMM DD, YYYY")} - {moment(endDate).format("MMM DD, YYYY")}
                  </p>
                  <p>
                    <span className="font-medium">Daily Schedule:</span> 9:00 AM - 6:00 PM
                  </p>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAllocate}
            disabled={validationErrors.length > 0 || hasConflicts || isCheckingConflicts}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              validationErrors.length > 0 || hasConflicts || isCheckingConflicts
                ? "text-gray-400 bg-gray-200 cursor-not-allowed"
                : "text-white bg-[#F26722] hover:bg-[#a5705a]"
            }`}
          >
            {isCheckingConflicts
              ? "Checking Conflicts..."
              : hasConflicts
              ? "Cannot Assign - Conflicts Detected"
              : roomInfo.roomType.toLowerCase() === "cabin"
              ? "Assign Cabin"
              : roomInfo.roomType.toLowerCase() === "workstation"
              ? "Assign Workstation"
              : "Assign Office"}
          </button>
        </div>
      </div>
    </section>
  );
}
