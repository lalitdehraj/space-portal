import React, { useState, useEffect } from "react";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { Employee, RoomInfo, SpaceAllocation, UserProfile } from "@/types";
import { useSelector } from "react-redux";
import { Check, X } from "lucide-react";
import moment from "moment";
import { RootState } from "@/app/store";

type FormProps = {
  roomInfo: RoomInfo;
  onClose: () => void;
  onSuccessfulAllocation: (allocation: SpaceAllocation) => void;
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

  const createSpaceAllocation = (): SpaceAllocation => {
    return {
      allocationDate: startDate,
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
      allocatedfrom: "Direct Allocation",
      allocatedBy: user?.employeeId || "",
      purpose: purpose,
      types: allocationType,
      keyAssigned: keysAssigned,
    } as SpaceAllocation;
  };

  const handleAllocate = async () => {
    setIsValidationVisible(true);
    if (validationErrors.length === 0) {
      try {
        const allocation = createSpaceAllocation();
        onSuccessfulAllocation(allocation);
        setSuccessMessage("Allocation created successfully!");
        setTimeout(() => {
          onClose();
        }, 1500);
      } catch (error) {
        console.error("Error creating allocation:", error);
        setValidationErrors(["Failed to create allocation. Please try again."]);
      }
    }
  };

  return (
    <section className="fixed inset-0 z-50 h-screen w-screen bg-[#00000070] flex items-center justify-center text-gray-500">
      <div className="max-h-[80vh] relative w-full max-w-lg bg-white rounded-xl shadow-2xl px-8 py-6 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-gray-700 text-lg">{roomInfo.roomType.toLowerCase() === "cabin" ? "Assign Cabin" : "Assign Workstation"}</h2>
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
                  max={academicSessionEndDate}
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
                  max={academicSessionEndDate}
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
          <button onClick={handleAllocate} className="px-4 py-2 text-sm font-medium text-white bg-[#F26722] rounded-md hover:bg-[#a5705a] transition-colors">
            {roomInfo.roomType.toLowerCase() === "cabin" ? "Assign Cabin" : "Assign Workstation"}
          </button>
        </div>
      </div>
    </section>
  );
}
