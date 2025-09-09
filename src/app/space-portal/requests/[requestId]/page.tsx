"use client";
import React, { useEffect, useState } from "react";
import {
  RoomRequestTable,
  RoomRequest,
  Building,
  Room,
  SpaceAllocation,
  Occupant,
  RoomInfo,
  UserProfile,
} from "@/types";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { useSelector } from "react-redux";
import { useParams, useSearchParams } from "next/navigation";
import { decrypt } from "@/utils/encryption";
import { useRouter } from "next/navigation";
import { formatDate, getTimeDifference } from "@/utils";
import moment from "moment";
import { areSlotsEqual, checkSlotConflicts, Slot } from "@/utils/slotsHelper";
import { ConflictSlotsList } from "../../buildings/[buildingId]/[roomId]/Conflicts";

const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) => (
  <div className="flex justify-between items-center border-b border-gray-200 pb-0.5">
    <span className="text-gray-900 font-[550] text-sm">{label}:</span>
    <span className="text-gray-700 text-sm">{value || "N/A"}</span>
  </div>
);

const getStatusClass = (status: string) => {
  switch (status) {
    case "Approved":
      return "bg-green-200 text-green-800";
    case "Rejected":
      return "bg-red-200 text-red-800";
    default:
      return "bg-yellow-200 text-yellow-800";
  }
};

const getPriorityClass = (status: string) => {
  switch (status) {
    case "High":
      return "bg-red-100 text-red-800";
    case "Medium":
      return "bg-yellow-100 text-yellow-800";
    case "Low":
      return "bg-green-100 text-green-800";
    default:
      return "bg-purple-100 text-purple-800";
  }
};

const getRecurranceString = (recc: string) => {
  let recString = "";
  let list = recc.split(",");
  list.map((str, index) => {
    switch (str) {
      case "1":
        recString += "Mon";
        break;
      case "2":
        recString += "Tues";
        break;
      case "3":
        recString += "Wed";
        break;
      case "4":
        recString += "Thus";
        break;
      case "5":
        recString += "Fri";
        break;
      case "6":
        recString += "Sat";
        break;
      case "7":
        recString += "Sun";
        break;
      default:
        recString = "None";
    }
    if (list.length - 1 !== index) recString += ",";
  });
  return recString;
};

export default function RequestInfoPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = decrypt(params.requestId?.toString() || "");
  const acadmeicYear = useSelector(
    (state: any) => state.dataState.selectedAcademicYear
  );
  const acadmeicSession = useSelector(
    (state: any) => state.dataState.selectedAcademicSession
  );
  const [requestData, setRequestData] = useState<RoomRequest | null>(null);
  const searchParams = useSearchParams();

  const fetchRoomsRequest = async () => {
    const pageSize = searchParams.get("limit");
    const curruntPage = searchParams.get("offSet");
    let response = await callApi<RoomRequestTable>(
      `${process.env.NEXT_PUBLIC_GET_REQUEST_LIST}` || URL_NOT_FOUND,
      {
        limit: pageSize,
        offset: curruntPage,
        acadSess: acadmeicSession,
        acadYr: acadmeicYear,
      }
    );
    setRequestData(
      response.data?.requests.filter(
        (request) => request.requestID === requestId
      )[0] || null
    );
  };

  useEffect(() => {
    fetchRoomsRequest();
  }, []);

  const {
    requestID,
    employeeName,
    employeeDepartment,
    requestedRoomType,
    purpose,
    priority,
    requestDate,
    startDate,
    endDate,
    startTime,
    endTime,
    recurrence,
    status: initialStatus,
    allocatedRoomID,
    approvedBy,
    purposeDesc,
    description,
    approvalDate,
  } = requestData || {};

  const [approvalStatus, setApprovalStatus] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);

  const duration = getTimeDifference(startTime || "", endTime || "");
  const isApproved = initialStatus === "Approved";
  const isRejected = initialStatus === "Rejected";

  const handleReject = () => {
    setIsFormVisible(true);
    setApprovalStatus(false);
  };
  const handleAccept = () => {
    setIsFormVisible(true);
    setApprovalStatus(true);
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between">
        <h2 className="text-base font-semibold text-gray-800 md:ml-2">
          {`Request No. ${requestID ? `${requestID}` : ""}`}
        </h2>
        <button
          className="mt-4 flex h-fit items-center rounded-md bg-[#F26722] px-4 py-2 text-xs text-white shadow-md transition-all hover:bg-[#a5705a] md:mt-0"
          onClick={() => router.back()}
        >
          Back
        </button>
      </div>

      <div className="bg-white h-fit rounded-lg mt-2 shadow-md p-2 border border-gray-200 w-full text-gray-600">
        <div className="w-full p-2 ">
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full">
              <DetailRow label="Requested By" value={employeeName} />
              <DetailRow
                label="Employee Department"
                value={employeeDepartment}
              />
              <DetailRow label="Room Type" value={requestedRoomType} />
              <div className="flex justify-between items-center border-b pb-0.5 border-gray-200">
                <span className="text-gray-900 font-[550] text-sm">
                  Status:
                </span>
                <span
                  className={`text-gray-700 text-sm py-0.5 px-2 rounded-2xl ${
                    initialStatus ? getStatusClass(initialStatus) : ""
                  }`}
                >
                  {initialStatus || "N/A"}
                </span>
              </div>
              <DetailRow label="Purpose" value={purpose} />
              <div className="flex justify-between items-center border-b pb-0.5 border-gray-200">
                <span className="text-gray-900 font-[550] text-sm">
                  Priority:
                </span>
                <span
                  className={`text-gray-700 text-sm py-0.5 px-2 rounded-2xl ${
                    priority ? getPriorityClass(priority) : ""
                  }`}
                >
                  {priority || "N/A"}
                </span>
              </div>
              {startDate && endDate && (
                <DetailRow
                  label="Date"
                  value={
                    recurrence?.split(",")?.[0] === "0"
                      ? formatDate(startDate).split(" ")?.[0]
                      : `${formatDate(startDate).split(" ")?.[0]} - ${
                          formatDate(endDate).split(" ")?.[0]
                        }`
                  }
                />
              )}
              <DetailRow label="Time" value={`${startTime} - ${endTime}`} />
              {duration && (
                <DetailRow
                  label="Duration"
                  value={`${duration.hours} hour ${duration.minutes} minutes`}
                />
              )}
              {recurrence && (
                <DetailRow
                  label="Recurrence"
                  value={getRecurranceString(recurrence)}
                />
              )}
              {requestDate && (
                <DetailRow
                  label="Requested on"
                  value={formatDate(requestDate).split(" ")?.[0]}
                />
              )}
              {isApproved && (
                <DetailRow label="Allocated Room" value={allocatedRoomID} />
              )}
              {isApproved && (
                <DetailRow label="Approved By" value={approvedBy} />
              )}
              {isApproved && (
                <DetailRow label="Approval Date" value={approvalDate} />
              )}
              {isRejected && (
                <DetailRow label="Rejection Reason" value={description} />
              )}
              {isRejected && (
                <DetailRow label="Rejected By" value={approvedBy} />
              )}
              {isRejected && (
                <DetailRow label="Rejection Date" value={approvalDate} />
              )}
            </div>

            <div className="flex flex-row gap-8">
              {purposeDesc && (
                <div className="w-full flex flex-col">
                  <label className="text-sm text-gray-900 font-[550] mb-2">
                    Purpose Description
                  </label>
                  <textarea
                    value={purposeDesc}
                    disabled={true}
                    rows={3}
                    className="text-sm p-2 border border-gray-200 rounded-sm"
                  />
                </div>
              )}
              {(isApproved || isRejected) && description && (
                <div className="w-full flex flex-col">
                  <label className="text-sm text-gray-900 font-[550] mb-2">
                    {isApproved ? "Remarks" : "Rejection Reason"}
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    disabled={true}
                    className="text-sm p-2 border border-gray-200 rounded-sm"
                  />
                </div>
              )}
            </div>

            {!isApproved && !isRejected && (
              <div className="flex justify-center space-x-8 mt-12">
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg shadow-md transition duration-300 bg-gray-100 text-gray-500 hover:bg-gray-200"
                  onClick={handleReject}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg shadow-md transition duration-300 bg-orange-500 text-white hover:bg-orange-600"
                  onClick={handleAccept}
                >
                  Accept
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isFormVisible && (
        <RequestApprovalForm
          isApproved={approvalStatus}
          requestData={requestData}
          onRequestApproval={() => fetchRoomsRequest()}
          onClosePressed={() => setIsFormVisible(false)}
        />
      )}
    </div>
  );
}

type FormProps = {
  isApproved: boolean;
  requestData?: RoomRequest | null;
  onClosePressed: () => void;
  onRequestApproval: () => void;
};

function RequestApprovalForm({
  isApproved,
  requestData,
  onClosePressed,
  onRequestApproval,
}: FormProps) {
  const user: UserProfile | null = useSelector(
    (state: any) => state.dataState.user
  );
  const acadmeicYear = useSelector(
    (state: any) => state.dataState.selectedAcademicYear
  );
  const acadmeicSession = useSelector(
    (state: any) => state.dataState.selectedAcademicSession
  );
  const academicSessionEndDate = useSelector(
    (state: any) => state.dataState.selectedAcademicSessionEndDate
  );

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [keys, setKeys] = useState<string>("");
  const [conflicts, setConflicts] = useState<Slot[]>([]);
  const [showConflicts, setShowConflictsView] = useState(false);
  const [allocationSlotsList, setAllocationSlotsList] = useState<Slot[]>([]);
  const [existingBookedSlots, setExistingBookedSlots] = useState<Slot[]>([]);

  // Fetch buildings
  useEffect(() => {
    const fetchBuildings = async () => {
      const reqBody = { acadSession: acadmeicSession, acadYear: acadmeicYear };
      const response = await callApi<Building[]>(
        process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND,
        reqBody
      );
      if (response.success) setBuildings(response.data || []);
    };
    fetchBuildings();
  }, [acadmeicSession, acadmeicYear]);

  // Fetch rooms for selected building/floor
  useEffect(() => {
    const fetchRoomsForBuilding = async (buildingId: string) => {
      const building = buildings.find((b) => b.id === buildingId);
      if (!building) return setRooms([]);
      const floorIds = building.floors?.map((f) => f.id) || [];
      if (floorIds.length === 0) return setRooms([]);
      const reqBody = {
        buildingNo: buildingId,
        floorID: selectedFloorId,
        curreentTime: moment().format("HH:mm"),
      };
      const response = await callApi<Room[]>(
        process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND,
        reqBody
      );
      setRooms(response.data || []);
    };
    if (selectedBuildingId) {
      fetchRoomsForBuilding(selectedBuildingId);
      setSelectedRoomId("");
    } else setRooms([]);
  }, [
    selectedBuildingId,
    selectedFloorId,
    buildings,
    acadmeicSession,
    acadmeicYear,
  ]);

  // Create slots from recurrence
  function createSlotsFromRecurrence(
    startDate: string,
    endDate: string,
    startTime: string,
    endTime: string,
    recurrence: string
  ): Slot[] {
    const DATE_FMT = "YYYY-MM-DD";
    if (!startDate || !startTime || !endTime) return [];
    const start = moment(new Date(startDate), DATE_FMT, true);
    const last = moment(new Date(endDate), DATE_FMT, true);
    if (!start.isValid() || !last.isValid() || last.isBefore(start, "day"))
      return [];
    const tFormats = ["HH:mm:ss", "H:mm:ss"];
    const startTimeMoment = moment(startTime, tFormats, true);
    const endTimeMoment = moment(endTime, tFormats, true);
    if (!startTimeMoment.isValid() || !endTimeMoment.isValid()) return [];
    if (!endTimeMoment.isAfter(startTimeMoment)) return [];
    const recurrenceList = (recurrence || "").split(",").map((r) => r.trim());
    const hasRecurrence = recurrenceList.some((r) => r !== "0");
    const slots: Slot[] = [];
    const makeId = (m: moment.Moment) =>
      `${m.format("YYYYMMDD")}_${startTime.replace(/:/g, "")}_${endTime.replace(
        /:/g,
        ""
      )}`;
    if (!hasRecurrence) {
      slots.push({
        date: start.format(DATE_FMT),
        start: startTime,
        end: endTime,
        id: makeId(start),
      });
      return slots;
    }
    const recurrenceDays = recurrenceList
      .map(Number)
      .filter((n) => !isNaN(n) && n >= 1 && n <= 7);
    if (recurrenceDays.length === 0) return [];
    for (
      let current = start.clone();
      current.isSameOrBefore(last, "day");
      current.add(1, "day")
    ) {
      if (recurrenceDays.includes(current.isoWeekday())) {
        slots.push({
          date: current.format(DATE_FMT),
          start: startTime,
          end: endTime,
          id: makeId(current),
        });
      }
    }
    return slots;
  }

  const generateSlots = () => {
    if (!requestData) return [];
    return createSlotsFromRecurrence(
      requestData.startDate,
      requestData.endDate,
      requestData.startTime,
      requestData.endTime,
      requestData.recurrence
    );
  };

  const validateConflicts = async (slots: Slot[]) => {
    const fetchExistingSlots = async () => {
      const requestbody = {
        roomID: selectedRoomId,
        subroomID: 0,
        academicYr: acadmeicYear,
        acadSess: acadmeicSession,
        startDate: moment().format("YYYY-MM-DD"),
        endDate: academicSessionEndDate,
      };
      const response = await callApi<RoomInfo>(
        process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND,
        requestbody
      );
      if (response.success) {
        const existingSlots: Slot[] =
          response.data?.occupants?.map((o) => ({
            date: moment(o.scheduledDate).format("YYYY-MM-DD"),
            start: o.startTime,
            end: o.endTime,
            id: `${moment(o.scheduledDate).format(
              "YYYYMMDD"
            )}_${o.startTime.replace(/:/g, "")}_${o.endTime.replace(/:/g, "")}`,
          })) || [];
        setExistingBookedSlots(existingSlots);
        return existingSlots;
      }
      return [];
    };
    const existingSlots = await fetchExistingSlots();
    return checkSlotConflicts(slots, existingSlots);
  };

  const createSpaceAllocations = (slots: Slot[]): SpaceAllocation[] => {
    if (!requestData) return [];
    return slots.map((slot) => ({
      allocationDate: slot.date,
      startTime: slot.start,
      endTime: slot.end,
      keyAssigned: keys,
      allocatedRoomID: selectedRoomId,
      buildingId: selectedBuildingId,
      academicSession: acadmeicSession,
      academicYear: acadmeicYear,
      allocatedTo: requestData.employeeName,
      isAllocationActive: true,
      remarks: description,
      allocatedOnDate: moment().format("YYYY-MM-DD"),
      allocatedfrom: requestData.requestID || "",
      allocatedBy: user?.employeeId || "",
      purpose: requestData.purpose || "",
    }));
  };

  const handleSubmit = async (event?: any) => {
    event?.preventDefault();
    if (!requestData) return;

    if (isApproved) {
      if (!selectedRoomId || !keys.trim()) {
        alert("Please select Room and assign Keys before approval.");
        return;
      }
      const slots = generateSlots();
      const conflictsFound = await validateConflicts(slots);
      setAllocationSlotsList(slots);

      if (conflictsFound.length > 0) {
        setConflicts(conflictsFound);
        setShowConflictsView(true);
        return;
      }

      const allocations = createSpaceAllocations(slots);
      // Insert allocations
      let allSucceeded = true;
      for (const allocation of allocations) {
        const resp = await callApi(
          process.env.NEXT_PUBLIC_INSERT_SPACE_ALLOCATION_ENTRY ||
            URL_NOT_FOUND,
          allocation
        );
        if (!resp?.data) allSucceeded = false;
      }

      if (allSucceeded) {
        const resp = await callApi(
          process.env.NEXT_PUBLIC_UPDATE_REQUEST || URL_NOT_FOUND,
          {
            requestID: requestData.requestID,
            description,
            status: 2, // Approved
            allocatedRoomID: selectedRoomId,
            approvedBy: user?.employeeId,
            approvalDate: moment().format("YYYY-MM-DD"),
          }
        );
        if (resp.data) {
          alert("Request approved successfully!");
          onRequestApproval();
          onClosePressed();
        } else alert("Error while approving request!");
      }
    } else {
      // Reject logic
      if (!description.trim()) {
        alert("Please provide rejection reason.");
        return;
      }
      const resp = await callApi(
        process.env.NEXT_PUBLIC_UPDATE_REQUEST || URL_NOT_FOUND,
        {
          requestID: requestData.requestID,
          description,
          status: 3, // Rejected
          approvedBy: user?.employeeId,
          approvalDate: moment().format("YYYY-MM-DD"),
          allocatedRoomID: "",
        }
      );
      if (resp.data) {
        alert("Request rejected successfully!");
        onRequestApproval();
        onClosePressed();
      } else alert("Error while rejecting request!");
    }
  };

  const handleProceedAnyway = () => {
    const list = allocationSlotsList.filter(
      (slot) => !conflicts.some((c) => areSlotsEqual(slot, c))
    );
    onSuccessfulSlotsCreation(createSpaceAllocations(list));
    setShowConflictsView(false);
  };

  const onSuccessfulSlotsCreation = async (allocations: SpaceAllocation[]) => {
    for (const allocation of allocations) {
      await callApi(
        process.env.NEXT_PUBLIC_INSERT_SPACE_ALLOCATION_ENTRY || URL_NOT_FOUND,
        allocation
      );
    }
    if (allocations.length > 0) {
      await callApi(process.env.NEXT_PUBLIC_UPDATE_REQUEST || URL_NOT_FOUND, {
        requestID: requestData?.requestID,
        description,
        status: 2,
        allocatedRoomID: selectedRoomId,
        approvedBy: user?.employeeId,
        approvalDate: moment().format("YYYY-MM-DD"),
      });
      alert("Request approved successfully!");
      onRequestApproval();
      onClosePressed();
    }
  };

  return (
    <section className="fixed inset-0 z-50 h-screen w-screen bg-[#00000070] flex items-center justify-center text-gray-500">
      <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl p-6">
        {!showConflicts && (
          <div className="max-h-[80vh] bg-white overflow-y-scroll mr-4 pr-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-900 font-[550] text-sm">
                {isApproved ? "Approve" : "Reject"}
              </span>
            </div>

            {/* Form Fields remain same as your original design */}
            {isApproved && (
              <div className="mt-2 pt-2 border-t-2 border-gray-200">
                <div className="space-y-4">
                  {/* Building / Floor / Room Selects */}
                  <div className="flex flex-col md:flex-row md:space-x-4">
                    <div className="w-full">
                      <label className="block text-sm text-gray-700 mb-1">
                        Building
                      </label>
                      <select
                        className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                        value={selectedBuildingId}
                        onChange={(e) => setSelectedBuildingId(e.target.value)}
                      >
                        <option value="">Select building</option>
                        {buildings.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:w-1/2 w-full mt-4 md:mt-0">
                      <label className="block text-sm text-gray-700 mb-1">
                        Floor
                      </label>
                      <select
                        className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                        value={selectedFloorId}
                        onChange={(e) => setSelectedFloorId(e.target.value)}
                        disabled={!selectedBuildingId}
                      >
                        <option value="">Select floor</option>
                        {buildings
                          .filter((b) => b.id === selectedBuildingId)
                          .map((b) =>
                            b.floors.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))
                          )}
                      </select>
                    </div>
                    <div className="md:w-1/2 w-full mt-4 md:mt-0">
                      <label className="block text-sm text-gray-700 mb-1">
                        Room
                      </label>
                      <select
                        className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                        value={selectedRoomId}
                        onChange={(e) => setSelectedRoomId(e.target.value)}
                        disabled={!selectedFloorId}
                      >
                        <option value="">Select room</option>
                        {rooms.map((r) => (
                          <option key={r.roomId} value={r.roomId}>
                            {r.roomName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700">Keys</label>
                    <input
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      type="text"
                      value={keys}
                      onChange={(e) => setKeys(e.target.value)}
                      placeholder="Assigned Key numbers e.g.: 002,005"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm text-gray-700">
                      Remarks
                    </label>
                    <textarea
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      rows={3}
                      value={description}
                      placeholder="Remarks"
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {!isApproved && (
              <div className="mt-2 pt-4 border-t-2 border-gray-200">
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rejection Reason
                  </label>
                  <textarea
                    rows={3}
                    className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                    value={description}
                    placeholder="e.g., No Room available"
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-center space-x-6 mt-8 mb-2">
              <button
                type="button"
                className="px-3 py-2 rounded-lg shadow-md transition duration-300 bg-gray-100 text-gray-500 hover:bg-gray-200"
                onClick={onClosePressed}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg shadow-md transition duration-300 bg-orange-500 text-white hover:bg-orange-600"
                onClick={handleSubmit}
              >
                Submit
              </button>
            </div>
          </div>
        )}

        {showConflicts && (
          <div className="max-h-[80vh] bg-white overflow-y-scroll mr-4 pr-2">
            <ConflictSlotsList
              handleProceedAnyway={handleProceedAnyway}
              existingSlots={existingBookedSlots}
              conflicts={conflicts}
              onClose={() => {
                setShowConflictsView(false);
                if (conflicts.length < 1) onClosePressed();
              }}
              onUpdateSlot={(date, oldSlot, updatedSlot) => {
                const newList = allocationSlotsList.map((slot) =>
                  areSlotsEqual(oldSlot, slot) ? updatedSlot : slot
                );
                setAllocationSlotsList(newList);
              }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
