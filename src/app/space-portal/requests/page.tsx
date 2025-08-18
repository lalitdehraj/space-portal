"use client";
import React, { useEffect, useState, useRef } from "react";
import Pagination from "@/components/PageNumberIndicator";
import {
  RoomRequestTable,
  RoomRequest,
  AcademicSessions,
  Building1,
  Room1,
} from "@/types";
import { api, callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { useSelector } from "react-redux";

const tableHeadersList: { [key: string]: keyof RoomRequest } = {
  "Request No.": "requestID",
  "Req By Employee": "employeeName",
  Department: "employeeDepartment",
  "Room Type": "requestedRoomType",
  Purpose: "purpose",
  Priority: "priority",
  "Request Date": "requestDate",
  "Required Date": "requiredDate",
  Time: "requiredTimeStart",
  Status: "status",
  "Allocated Room": "allocatedRoomID",
  "Approved By": "approvedBy",
  "Approval Date": "approvalDate",
  Recurrence: "recurrence",
};
type sortingTypes = "asc" | "desc" | "";
const priorityOrder: { [key: string]: number } = {
  Critical: 1,
  High: 2,
  Medium: 3,
  Low: 4,
};

const statusOrder: { [key: string]: number } = {
  Pending: 1,
  Approved: 2,
  Rejected: 3,
};
const recurrenceStatus: { [key: string]: number } = {
  None: 1,
  Daily: 2,
  Weekly: 3,
  Monthly: 4,
  Quarterly: 5,
};

function sortData(
  data: RoomRequest[],
  key: keyof RoomRequest,
  sortOrder: sortingTypes
) {
  if (sortOrder === "") return data;
  return [...data].sort((a, b) => {
    let valueA: any = a[key];
    let valueB: any = b[key];

    if (key === "priority") {
      valueA = priorityOrder[valueA] || 999;
      valueB = priorityOrder[valueB] || 999;
    } else if (key === "status") {
      valueA = statusOrder[valueA] || 999;
      valueB = statusOrder[valueB] || 999;
    } else if (key === "recurrence") {
      valueA = recurrenceStatus[valueA] || 1;
      valueB = recurrenceStatus[valueB] || 1;
    }

    if (valueA === null || valueA === undefined) valueA = "";
    if (valueB === null || valueB === undefined) valueB = "";

    let comparison = 0;

    if (typeof valueA === "string" && typeof valueB === "string") {
      comparison = valueA.localeCompare(valueB);
    } else {
      if (valueA > valueB) {
        comparison = 1;
      } else if (valueA < valueB) {
        comparison = -1;
      }
    }
    return sortOrder === "desc" ? comparison * -1 : comparison;
  });
}

function filterData(
  data: RoomRequest[],
  filters: { [key: string]: string[] },
  searchQuery: string
) {
  let filteredBySearch = data.filter((item) => {
    const searchableKeys = Object.values(tableHeadersList);

    return searchableKeys.some((key) => {
      const value = item[key];
      if (value === null || value === undefined) {
        return false;
      }
      return String(value).toLowerCase().includes(searchQuery.toLowerCase());
    });
  });
  return filteredBySearch.filter((item) => {
    return Object.keys(filters).every((key) => {
      const filterKey = key as keyof RoomRequest;
      if (filters[key].length === 0) return true;
      return filters[key].includes(item[filterKey] as string);
    });
  });
}

export default function RequestApprovalPage() {
  const [curruntPage, setCurruntPage] = useState(1);
  const acadmeicYear = useSelector(
    (state: any) => state.dataState.academicYear
  );
  const acadmeicSession = useSelector(
    (state: any) => state.dataState.academicSession
  );
  const [sortState, setSortState] = useState<sortingTypes>("");
  const [activeHeader, setActiveHeader] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [requestList, setRequestList] = useState<RoomRequest[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<{
    [key: string]: string[];
  }>({});
  const [filteredList, setFilteredList] = useState<RoomRequest[]>([]);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [pageSize, setPageSize] = useState("10");

  useEffect(() => {
    const listAfterFilters = filterData(
      requestList,
      appliedFilters,
      searchQuery
    );
    const sortedList = sortData(
      listAfterFilters,
      activeHeader as keyof RoomRequest,
      sortState
    );
    setFilteredList(sortedList);
  }, [requestList, activeHeader, sortState, appliedFilters, searchQuery]);

  const [totalPages, setTotalPages] = useState(0);
  useEffect(() => {
    const fetchRoomsRequest = async () => {
      let response = await callApi<RoomRequestTable>(
        api.get(
          `${process.env.NEXT_PUBLIC_GET_REQUEST_LIST}` || URL_NOT_FOUND,
          {
            params: {
              limit: pageSize,
              offset: curruntPage,
              acadmeicSession: acadmeicSession,
              acadmeicYear: acadmeicYear,
            },
          }
        )
      );
      let res = response;
      console.log("res:  ", JSON.stringify(res));
      setTotalPages(parseInt(res.data?.totalPages || "0"));

      setCurruntPage(parseInt(res.data?.curruntPage || "0"));
      setRequestList(res.data?.rooms || []);
    };
    fetchRoomsRequest();
  }, [acadmeicYear, acadmeicSession, pageSize, curruntPage]);

  const filterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node)
      ) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [filterRef]);

  const handleSort = (header: string, sortOrder: sortingTypes) => {
    setActiveHeader(tableHeadersList[header]);
    setSortState(
      activeHeader === tableHeadersList[header] && sortState === sortOrder
        ? ""
        : sortOrder
    );
  };

  const handleFilterChange = (filterType: string, value: string) => {
    setAppliedFilters((prevFilters) => {
      const currentOptions = prevFilters[filterType] || [];
      const newOptions = currentOptions.includes(value)
        ? currentOptions.filter((item) => item !== value)
        : [...currentOptions, value];
      return {
        ...prevFilters,
        [filterType]: newOptions,
      };
    });
  };

  const handleRemoveFilter = (filterType: string, value: string) => {
    setAppliedFilters((prevFilters) => {
      const newFilters = { ...prevFilters };
      newFilters[filterType] = newFilters[filterType].filter(
        (item) => item !== value
      );
      return newFilters;
    });
  };

  const [isRequestDetailsVisible, setIsRequestDetailsVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RoomRequest>();
  const handleRequestClick = (request: RoomRequest) => {
    setIsRequestDetailsVisible(true);
    setSelectedRequest(request);
  };

  return (
    <>
      <div>
        <div className="flex flex-col md:flex-row justify-between">
          <h2 className="text-base font-semibold text-gray-800 md:ml-2">
            Room Request Overview
          </h2>
          <div className="flex items-center space-x-4">
            <input
              type="text"
              placeholder="Search"
              value={searchQuery ? searchQuery : ""}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-gray-300 rounded-md py-1 px-2 text-sm focus:outline-none text-gray-700 focus:ring-1 focus:ring-orange-500"
            />
            <div className="relative " ref={filterRef}>
              <button
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                className="flex flex-row items-center text-gray-600 text-sm bg-gray-100 py-1 px-2 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors duration-150"
              >
                <img
                  src={"/images/bx-filter-alt.svg"}
                  alt="icon filter"
                  className="h-5 w-5 mr-2 fill-gray-600"
                />
                Filter
                {Object.values(appliedFilters).flat().length > 0 && (
                  <span className="ml-2 bg-orange-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs">
                    {Object.values(appliedFilters).flat().length}
                  </span>
                )}
              </button>
              {isFilterDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-300 rounded-md shadow-lg p-4 z-10">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold mb-2 text-gray-500">
                        Priority
                      </h4>
                      {Object.keys(priorityOrder).map((p) => (
                        <label
                          key={p}
                          className="flex items-center text-gray-700"
                        >
                          <input
                            type="checkbox"
                            checked={
                              appliedFilters.priority?.includes(p) || false
                            }
                            onChange={() => handleFilterChange("priority", p)}
                            className="mr-2 rounded text-orange-600"
                          />
                          {p}
                        </label>
                      ))}
                    </div>
                    <hr className="my-2" />
                    <div>
                      <h4 className="text-sm font-semibold mb-2 text-gray-500">
                        Status
                      </h4>
                      {Object.keys(statusOrder).map((s) => (
                        <label
                          key={s}
                          className="flex items-center text-gray-700"
                        >
                          <input
                            type="checkbox"
                            checked={
                              appliedFilters.status?.includes(s) || false
                            }
                            onChange={() => handleFilterChange("status", s)}
                            className="mr-2 rounded text-orange-600"
                          />
                          {s}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap space-x-2 mb-2">
          {Object.entries(appliedFilters).flatMap(([key, values]) =>
            values.map((value) => (
              <span
                key={`${key}-${value}`}
                className="flex items-center bg-gray-200 text-gray-800 text-sm px-3 py-1 rounded-full"
              >
                {value}
                <button
                  onClick={() => handleRemoveFilter(key, value)}
                  className="ml-2 text-gray-500 hover:text-gray-900 focus:outline-none"
                >
                  &times;
                </button>
              </span>
            ))
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-2 border border-gray-200 w-full">
          <div className="min-w-2xl max-w-6xl w-[100vw] p-2 overflow-x-scroll bg-white">
            <table className="divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(tableHeadersList).map((header) => (
                    <th
                      key={header}
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider cursor-pointer group"
                    >
                      <div
                        className="flex items-center"
                        onClick={() => handleSort(header, "asc")}
                      >
                        {header}
                        <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible invisible">
                          <svg
                            className={`h-5 w-5 ${
                              activeHeader === tableHeadersList[header] &&
                              sortState === "asc"
                                ? "fill-orange-400 visible"
                                : "fill-gray-400"
                            } `}
                            aria-hidden="true"
                            name="asc"
                            viewBox="0 0 20 20"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSort(header, "asc");
                            }}
                          >
                            <path d="M10.707 3.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L9 6.414V17a1 1 0 102 0V6.414l5.293 5.293a1 1 0 001.414-1.414l-7-7z" />
                          </svg>
                          <svg
                            className={`mt-1 h-5 w-5 ${
                              activeHeader === tableHeadersList[header] &&
                              sortState === "desc"
                                ? "fill-orange-400 visible"
                                : "fill-gray-400"
                            } `}
                            aria-hidden="true"
                            name="desc"
                            viewBox="0 0 20 20"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSort(header, "desc");
                            }}
                          >
                            <path d="M9.293 16.707a1 1 0 001.414 0l7-7a1 1 0 00-1.414-1.414L11 13.586V3a1 1 0 10-2 0v10.586l-5.293-5.293a1 1 0 00-1.414 1.414l7 7z" />
                          </svg>
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredList.map((request) => (
                  <tr key={request.requestID} className="hover:bg-gray-50">
                    <td
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 cursor-pointer hover:text-indigo-800"
                      onClick={() => {
                        handleRequestClick(request);
                      }}
                    >
                      {request.requestID}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {request.employeeName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {request.employeeDepartment}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {request.requestedRoomType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {request.purpose}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                              ${
                                request.priority === "High"
                                  ? "bg-red-100 text-red-800"
                                  : request.priority === "Medium"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : request.priority === "Low"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-purple-100 text-purple-800"
                              }`}
                      >
                        {request.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {request.requestDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {request.requiredDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {`${request.requiredTimeStart} - ${request.requiredTimeEnd}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                              ${
                                request.status === "Approved"
                                  ? "bg-green-100 text-green-800"
                                  : request.status === "Pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {request.allocatedRoomID || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {request.approvedBy || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {request.approvalDate || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {request.recurrence}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="w-full mt-4 flex ">
            <div className="w-full flex flex-row justify-center">
              <Pagination
                currentPage={curruntPage}
                onPageChange={(pageNumber) => {
                  setCurruntPage(pageNumber);
                }}
                totalPages={totalPages}
              />
            </div>
            <div className="mt-2 text-gray-600 flex items-center mr-6">
              <span className="text-sm text-nowrap mr-2">Rows per page:</span>
              <select
                onChange={(e) => setPageSize(e.target.value)}
                className="border rounded border-gray-300 p-1"
                name="rowscount"
                id="rows"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="30">30</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      {isRequestDetailsVisible && (
        <AddRequestForm
          onClose={() => {
            setIsRequestDetailsVisible(false);
          }}
          requestData={selectedRequest}
        />
      )}
    </>
  );
}

type FormProps = {
  onClose: () => void;
  requestData?: RoomRequest;
};

const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) => (
  <div className="flex justify-between items-center border-b pb-2">
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

function AddRequestForm({ onClose, requestData }: FormProps) {
  const {
    requestID,
    employeeName,
    employeeDepartment,
    requestedRoomType,
    purpose,
    priority,
    requestDate,
    requiredDate,
    requiredTimeStart,
    recurrence,
    status: initialStatus,
    allocatedRoomID,
    approvedBy,
    rejectionReason: initialRejectionReason,
    approvalDate,
  } = requestData || {};

  const [allocatedRoom, setAllocatedRoom] = useState("");
  const [approvedStatus, setApprovedStatus] = useState(initialStatus || "");
  const [rejectionReason, setRejectionReason] = useState("");
  const acadmeicYear = useSelector(
    (state: any) => state.dataState.academicYear
  );
  const acadmeicSession = useSelector(
    (state: any) => state.dataState.academicSession
  );
  const [buildings, setBuildings] = useState<Building1[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [rooms, setRooms] = useState<Room1[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");

  useEffect(() => {
    const fetchBuildings = async () => {
      let response = await callApi<Building1[]>(
        api.get(process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND, {
          params: {
            acadmeicSession: acadmeicSession,
            acadmeicYear: acadmeicYear,
          },
        })
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
      const floorIds = building.floors?.map((f) => f.id) || [];
      if (floorIds.length === 0) {
        setRooms([]);
        return;
      }
      const roomLists = await Promise.all(
        floorIds.map(async (floorId) => {
          const res = await callApi<Room1[]>(
            api.get(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, {
              params: {
                buildingId: buildingId,
                floorId: floorId,
                acadmeicSession: acadmeicSession,
                acadmeicYear: acadmeicYear,
              },
            })
          );
          return res.data || [];
        })
      );
      const merged = roomLists.flat();
      setRooms(merged);
    };
    if (selectedBuildingId) {
      fetchRoomsForBuilding(selectedBuildingId);
      setSelectedRoomId("");
    } else {
      setRooms([]);
      setSelectedRoomId("");
    }
  }, [selectedBuildingId, acadmeicSession, acadmeicYear, buildings]);

  const [dateType, setDateType] = useState("academicSession");
  const [timeType, setTimeType] = useState("fullDay");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [customStartTime, setCustomStartTime] = useState("");
  const [customEndTime, setCustomEndTime] = useState("");

  useEffect(() => {
    if (initialStatus) {
      setApprovedStatus(initialStatus);
    }
  }, [initialStatus]);

  const handleSubmit = () => {
    console.log("Form submitted with the following data:", {
      status: approvedStatus,
      allocatedRoom,
      rejectionReason,
    });
  };

  return (
    <section className="fixed inset-0 z-50 h-screen w-screen bg-[#00000070] flex items-center justify-center text-gray-500">
      <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl p-8 transform transition-all duration-300 ease-in-out scale-95 md:scale-100">
        <div className="max-h-[70vh] bg-white overflow-y-scroll mr-4 pr-2">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition duration-300"
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

          <h2 className="font-semibold text-gray-700 mb-6">
            {`Request No. ${requestID ? `${requestID}` : ""}`}
          </h2>

          <div className="space-y-4">
            {/* <DetailRow label="Request No" value={requestID} /> */}
            <DetailRow label="Requested By" value={employeeName} />
            {/* <DetailRow label="Department" value={employeeDepartment} /> */}
            <DetailRow label="Room Type" value={requestedRoomType} />
            <DetailRow label="Purpose" value={purpose} />
            {/* <DetailRow label="Priority" value={priority} /> */}
            {/* <DetailRow label="Request Date" value={requestDate} /> */}
            {/* <DetailRow label="Required Date" value={requiredDate} /> */}
            {/* <DetailRow label="Time" value={requiredTimeStart} /> */}
            <DetailRow label="Recurrence" value={recurrence} />

            <div className="flex justify-between items-center">
              <span className="text-gray-900 font-[550] text-sm">Status:</span>
              <select
                className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusClass(
                  approvedStatus
                )}`}
                disabled={initialStatus !== "Pending"}
                onChange={(e) => setApprovedStatus(e.target.value)}
                value={approvedStatus}
              >
                <option value="Pending">Pending</option>
                <option value="Approved">Approve</option>
                <option value="Rejected">Reject</option>
              </select>
            </div>

            {initialStatus === "Approved" && (
              <>
                <DetailRow label="Allocated Room" value={allocatedRoomID} />
                <DetailRow label="Approved By" value={approvedBy} />
                <DetailRow label="Approval Date" value={approvalDate} />
              </>
            )}
            {initialStatus === "Rejected" && (
              <>
                <DetailRow label="Reason" value={initialRejectionReason} />
                <DetailRow label="Approved By" value={approvedBy} />
                <DetailRow label="Approval Date" value={approvalDate} />
              </>
            )}

            {initialStatus === "Pending" && approvedStatus === "Approved" && (
              <div className="mt-8 pt-4 border-t-2 border-gray-200">
                <div className="space-y-4">
                  <div className="space-y-4 mb-6">
                    <div className="flex flex-col md:flex-row md:space-x-4">
                      <div className="md:w-1/2 w-full">
                        <label className="block text-sm text-gray-700 mb-1">
                          Building
                        </label>
                        <select
                          className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                          value={selectedBuildingId}
                          onChange={(e) =>
                            setSelectedBuildingId(e.target.value)
                          }
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
                          Room
                        </label>
                        <select
                          className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                          value={selectedRoomId}
                          onChange={(e) => setSelectedRoomId(e.target.value)}
                          disabled={!selectedBuildingId}
                        >
                          <option value="">Select room</option>
                          {rooms.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.roomName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 mb-6 ">
                    <label className="block text-sm text-gray-700 ">Date</label>
                    {dateType !== "custom" ? (
                      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 w-full">
                        <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4 w-1/2">
                          <select
                            className="block w-full mt-3 px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                            value={dateType}
                            onChange={(e) => setDateType(e.target.value)}
                          >
                            <option value="day">Day</option>
                            <option value="week">Week</option>
                            <option value="month">Month</option>
                            <option value="academicSession">
                              Academic Session
                            </option>
                            <option value="custom">Custom Range</option>
                          </select>
                        </div>
                        {(dateType === "day" ||
                          dateType === "week" ||
                          dateType === "month") && (
                          <div className="w-full md:w-1/2">
                            <label className="block text-xs text-gray-500">
                              Start Date
                            </label>
                            <input
                              type="date"
                              className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                              value={customStartDate}
                              onChange={(e) =>
                                setCustomStartDate(e.target.value)
                              }
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
                  </div>

                  <div className="space-y-2 mb-6">
                    <label className="block text-sm text-gray-700">Time</label>
                    {timeType !== "custom" ? (
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
                        </select>
                      </div>
                    ) : (
                      <div className="flex flex-col md:flex-row md:space-x-4">
                        <div className="md:w-1/2 w-full">
                          <label className="block text-sm text-gray-700 mb-1">
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
                          <label className="block text-sm text-gray-700 mb-1">
                            End Time
                          </label>
                          <input
                            type="time"
                            className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                            value={customEndTime}
                            onChange={(e) => setCustomEndTime(e.target.value)}
                          />
                        </div>
                        <div className="mt-3 md:mt-0 flex items-end">
                          <button
                            type="button"
                            className="px-3 py-2 text-xs bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                            onClick={() => {
                              setTimeType("fullDay");
                              setCustomStartTime("");
                              setCustomEndTime("");
                            }}
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {initialStatus === "Pending" && approvedStatus === "Rejected" && (
              <div className="mt-8 pt-4 border-t-2 border-gray-200">
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="rejectionReason"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Reason
                    </label>
                    <input
                      type="text"
                      id="rejectionReason"
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="e.g., No Room available"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {initialStatus === "Pending" && (
              <div className="flex justify-center space-x-6 mt-8 mb-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg shadow-md transition duration-300 bg-gray-100 text-gray-700 hover:bg-gray-200"
                  onClick={onClose}
                >
                  Close
                </button>
                {approvedStatus !== "Pending" && (
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg shadow-md transition duration-300 bg-orange-500 text-white hover:bg-orange-600"
                    onClick={handleSubmit}
                  >
                    Submit
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
