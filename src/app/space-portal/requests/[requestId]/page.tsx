"use client";
import React, { useEffect, useState, useRef } from "react";
import { RoomRequestTable, RoomRequest, Building, Room } from "@/types";
import { api, callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { useSelector } from "react-redux";
import { useParams, useSearchParams } from "next/navigation";
import { decrypt } from "@/utils/encryption";
import { useRouter } from "next/navigation";
import { formatDate, getTimeDifference } from "@/utils";

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
const getRecurranceString = (recc: string) => {
  let recString = "";
  let list = recc.split(",");
  list.map((str, index) => {
    switch (str) {
      case "1":
        recString = recString + "Mon";
        break;
      case "2":
        recString = recString + "Tues";
        break;
      case "3":
        recString = recString + "Wed";
        break;
      case "4":
        recString = recString + "Thus";
        break;
      case "5":
        recString = recString + "Fri";
        break;
      case "6":
        recString = recString + "Sat";
        break;
      case "7":
        recString = recString + "Sun";
        break;
      default:
        recString = "None";
    }
    if (list.length - 1 !== index) recString = recString + ",";
  });
  return recString;
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
  useEffect(() => {
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
      console.log(response.data);
      setRequestData(
        response.data?.requests.filter(
          (request) => request.requestID === requestId
        )[0] || null
      );
    };
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

  const [approvedStatus, setApprovedStatus] = useState(initialStatus || "");
  const [rejectionReason, setRejectionReason] = useState("");

  const [approvalStatus, setApprovalStatus] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);

  useEffect(() => {
    if (initialStatus) {
      setApprovedStatus(initialStatus);
    }
  }, [initialStatus]);

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
          onClick={() => {
            router.back();
          }}
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
                  value={`${duration.hours} hour  ${duration.minutes} minutes`}
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
                  className="px-3 py-2 rounded-lg shadow-md transition duration-300 bg-gray-100 text-gray-500 hover:bg-gray-200"
                  onClick={handleReject}
                >
                  Reject
                </button>
                <button
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
          onClosePressed={() => {
            setIsFormVisible(false);
          }}
        />
      )}
    </div>
  );
}

type FormProps = {
  isApproved: boolean;
  requestData?: RoomRequest | null;
  onClosePressed: () => void;
};

function RequestApprovalForm({
  isApproved,
  requestData,
  onClosePressed,
}: FormProps) {
  const acadmeicYear = useSelector(
    (state: any) => state.dataState.academicYear
  );
  const acadmeicSession = useSelector(
    (state: any) => state.dataState.academicSession
  );
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  useEffect(() => {
    const fetchBuildings = async () => {
      const reqBody = {
        acadSession: `${acadmeicSession}`,
        acadYear: `${acadmeicYear}`,
      };

      const response = await callApi<Building[]>(
        process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND,
        reqBody
      );
      if (response.success) {
        setBuildings(response.data || []);
      }
    };
    fetchBuildings();
  }, [acadmeicSession, acadmeicYear]);
  useEffect(() => {
    const fetchRoomsForBuilding = async (buildingId: string) => {
      const building = buildings.find((b) => b.id === buildingId);
      if (!building) {
        setRooms([]);
        return;
      }
      const floorIds = building.floors?.map((f) => f.floorId) || [];
      if (floorIds.length === 0) {
        setRooms([]);
        return;
      }
      const reqBody = {
        buildingNo: `${buildingId}`,
        floorID: `${selectedFloorId}`,
        // acadSession: `${acadmeicSession}`,
        // acadYear: `${acadmeicYear}`,
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
    } else {
      setRooms([]);
      setSelectedRoomId("");
    }
  }, [
    selectedBuildingId,
    acadmeicSession,
    acadmeicYear,
    buildings,
    selectedFloorId,
  ]);
  const [dateType, setDateType] = useState("academicSession");
  const [timeType, setTimeType] = useState("fullDay");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [customStartTime, setCustomStartTime] = useState("");
  const [customEndTime, setCustomEndTime] = useState("");
  const handleSubmit = () => {};

  return (
    <section className="fixed inset-0 z-50 h-screen w-screen bg-[#00000070] flex items-center justify-center text-gray-500">
      {/* Form container with styling */}
      <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl p-6 transform transition-all duration-300 ease-in-out scale-95 md:scale-100">
        <div className="max-h-[80vh] bg-white overflow-y-scroll  mr-4 pr-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-900 font-[550] text-sm">
              {isApproved ? "Approve" : "Reject"}
            </span>
          </div>

          {isApproved && (
            <div className="mt-2 pt-2 border-t-2 border-gray-200">
              <div className="space-y-4">
                <div className="space-y-2">
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
                  </div>
                  <div className="flex flex-col md:flex-row md:space-x-4">
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
                        {buildings.filter((b) => b.id === selectedBuildingId)
                          .length > 0
                          ? buildings
                              .filter((b) => b.id === selectedBuildingId)[0]
                              .floors.map((f) => (
                                <option key={f.floorId} value={f.floorId}>
                                  {f.floorName}
                                </option>
                              ))
                          : null}
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
                </div>

                <div>
                  <label className="block text-sm text-gray-700">Keys</label>
                  <input
                    className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                    type="text"
                    placeholder="Assigned Key numbers e.g.: 002,005"
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-sm text-gray-700">Remarks</label>
                  <textarea
                    className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                    rows={5}
                    placeholder="Remarks"
                  />
                </div>
              </div>
            </div>
          )}
          {!isApproved && (
            <div className="mt-2 pt-4 border-t-2 border-gray-200">
              <div className="space-y-4">
                <form>
                  <label
                    htmlFor="rejectionReason"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Rejection Reason
                  </label>
                  <textarea
                    rows={3}
                    id="rejectionReason"
                    className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                    value={requestData?.description}
                    placeholder="e.g., No Room available"
                    onChange={(e) => {}}
                    required
                  />
                </form>
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
      </div>
    </section>
  );
}
