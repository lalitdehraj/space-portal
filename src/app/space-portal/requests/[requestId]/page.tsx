"use client";
import React, { useEffect, useState } from "react";
import { RoomRequestTable, RoomRequest } from "@/types";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { useSelector } from "react-redux";
import { useParams, useSearchParams } from "next/navigation";
import { decrypt } from "@/utils/encryption";
import { useRouter } from "next/navigation";
import { formatDate, getTimeDifference } from "@/utils";
import RequestApproval from "@/components/RequestApproval";

// Helper function to format time by removing seconds
const formatTime = (timeString: string) => {
  if (!timeString) return "";
  return timeString.split(":").slice(0, 2).join(":");
};

const DetailRow = ({ label, value }: { label: string; value?: string | null }) => (
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
  const academicYear = useSelector((state: any) => state.dataState.selectedAcademicYear);
  const academicSession = useSelector((state: any) => state.dataState.selectedAcademicSession);
  const [requestData, setRequestData] = useState<RoomRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const fetchRoomsRequest = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const pageSize = searchParams.get("limit");
      const curruntPage = searchParams.get("offSet");
      let response = await callApi<RoomRequestTable>(`${process.env.NEXT_PUBLIC_GET_REQUEST_LIST}` || URL_NOT_FOUND, {
        limit: pageSize,
        offset: curruntPage,
        acadSess: academicSession,
        acadYr: academicYear,
      });
      const foundRequest = response.data?.requests.filter((request) => request.requestID === requestId)[0];
      if (!foundRequest) {
        setError("Request not found");
      }
      setRequestData(foundRequest || null);
    } catch (err) {
      console.error("Error fetching request:", err);
      setError("Failed to load request details");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (academicYear && academicSession && requestId) {
      fetchRoomsRequest();
    }
  }, [academicYear, academicSession, requestId]);

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

  const [isFormVisible, setIsFormVisible] = useState(false);

  const duration = getTimeDifference(startTime || "", endTime || "");
  const isApproved = initialStatus === "Approved";
  const isRejected = initialStatus === "Rejected";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading request details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-red-500">{error}</div>
        <button
          className="px-4 py-2 bg-[#F26722] text-white rounded-md hover:bg-[#a5705a]"
          onClick={() => router.back()}
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!requestData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-gray-500">Request not found</div>
        <button
          className="px-4 py-2 bg-[#F26722] text-white rounded-md hover:bg-[#a5705a]"
          onClick={() => router.back()}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between">
        <h2 className="text-base font-semibold text-gray-800 md:ml-2">{`Request No. ${requestID ? `${requestID}` : ""}`}</h2>
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
              <DetailRow label="Employee Department" value={employeeDepartment} />
              <DetailRow label="Room Type" value={requestedRoomType} />
              <div className="flex justify-between items-center border-b pb-0.5 border-gray-200">
                <span className="text-gray-900 font-[550] text-sm">Status:</span>
                <span className={`text-gray-700 text-sm py-0.5 px-2 rounded-2xl ${initialStatus ? getStatusClass(initialStatus) : ""}`}>
                  {initialStatus || "N/A"}
                </span>
              </div>
              <DetailRow label="Purpose" value={purpose} />
              <div className="flex justify-between items-center border-b pb-0.5 border-gray-200">
                <span className="text-gray-900 font-[550] text-sm">Priority:</span>
                <span className={`text-gray-700 text-sm py-0.5 px-2 rounded-2xl ${priority ? getPriorityClass(priority) : ""}`}>{priority || "N/A"}</span>
              </div>
              {startDate && endDate && (
                <DetailRow
                  label="Date"
                  value={
                    recurrence?.split(",")?.[0] === "0"
                      ? formatDate(startDate).split(" ")?.[0]
                      : `${formatDate(startDate).split(" ")?.[0]} - ${formatDate(endDate).split(" ")?.[0]}`
                  }
                />
              )}
              <DetailRow label="Time" value={`${formatTime(startTime || "")} - ${formatTime(endTime || "")}`} />
              {duration && <DetailRow label="Duration" value={`${duration.hours} hour ${duration.minutes} minutes`} />}
              {recurrence && <DetailRow label="Recurrence" value={getRecurranceString(recurrence)} />}
              {requestDate && <DetailRow label="Requested on" value={formatDate(requestDate).split(" ")?.[0]} />}
              {isApproved && <DetailRow label="Allocated Room" value={allocatedRoomID} />}
              {isApproved && <DetailRow label="Approved By" value={approvedBy} />}
              {isApproved && <DetailRow label="Approval Date" value={approvalDate} />}
              {isRejected && <DetailRow label="Rejection Reason" value={description} />}
              {isRejected && <DetailRow label="Rejected By" value={approvedBy} />}
              {isRejected && <DetailRow label="Rejection Date" value={approvalDate} />}
            </div>

            <div className="flex flex-row gap-8">
              {purposeDesc && (
                <div className="w-full flex flex-col">
                  <label className="text-sm text-gray-900 font-[550] mb-2">Purpose Description</label>
                  <textarea value={purposeDesc} disabled={true} rows={3} className="text-sm p-2 border border-gray-200 rounded-sm" />
                </div>
              )}
              {(isApproved || isRejected) && description && (
                <div className="w-full flex flex-col">
                  <label className="text-sm text-gray-900 font-[550] mb-2">{isApproved ? "Remarks" : "Rejection Reason"}</label>
                  <textarea rows={3} value={description} disabled={true} className="text-sm p-2 border border-gray-200 rounded-sm" />
                </div>
              )}
            </div>

            {!isApproved && !isRejected && (
              <div className="flex justify-center mt-12">
                <button
                  type="button"
                  className="px-6 py-3 rounded-lg shadow-md transition duration-300 bg-orange-500 text-white hover:bg-orange-600 font-medium"
                  onClick={() => setIsFormVisible(true)}
                >
                  Review Request
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isFormVisible && requestData && (
        <RequestApproval
          requestData={requestData}
          onApprovalComplete={() => fetchRoomsRequest()}
          onClose={() => setIsFormVisible(false)}
        />
      )}
    </div>
  );
}

