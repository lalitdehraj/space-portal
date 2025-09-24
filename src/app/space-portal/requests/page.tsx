"use client";
import React, { useEffect, useState, useRef } from "react";
import Pagination from "@/components/PageNumberIndicator";
import { RoomRequestTable, RoomRequest, AcademicSessions, Building, Room } from "@/types";
import { api, callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { useSelector } from "react-redux";
import { useRouter, useSearchParams } from "next/navigation";
import { encrypt } from "@/utils/encryption";

const tableHeadersList: { [key: string]: keyof RoomRequest } = {
  "Request No.": "requestID",
  "Req By Employee": "employeeName",
  Department: "employeeDepartment",
  "Room Type": "requestedRoomType",
  Purpose: "purpose",
  Priority: "priority",
  "Request Date": "requestDate",
  "Required Date": "startDate",
  Time: "startTime",
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

function sortData(data: RoomRequest[], key: keyof RoomRequest, sortOrder: sortingTypes) {
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

function filterData(data: RoomRequest[], filters: { [key: string]: string[] }, searchQuery: string) {
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
  const router = useRouter();
  const [curruntPage, setCurruntPage] = useState(1);
  const acadmeicYear = useSelector((state: any) => state.dataState.selectedAcademicYear);
  const acadmeicSession = useSelector((state: any) => state.dataState.selectedAcademicSession);
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
    const listAfterFilters = filterData(requestList, appliedFilters, searchQuery);
    const sortedList = sortData(listAfterFilters, activeHeader as keyof RoomRequest, sortState);
    setFilteredList(sortedList);
  }, [requestList, activeHeader, sortState, appliedFilters, searchQuery]);

  const [totalPages, setTotalPages] = useState(0);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  useEffect(() => {
    const fetchRoomsRequest = async () => {
      if (!(acadmeicSession && acadmeicSession && pageSize)) return;
      setIsLoadingRequests(true);
      try {
        let response = await callApi<RoomRequestTable>(`${process.env.NEXT_PUBLIC_GET_REQUEST_LIST}` || URL_NOT_FOUND, {
          limit: pageSize,
          offset: curruntPage,
          acadSess: acadmeicSession,
          acadYr: acadmeicYear,
        });
        console.log(response);
        setTotalPages(parseInt(response.data?.totalPages || "0"));
        setCurruntPage(parseInt(response.data?.curruntPage || "0"));
        setRequestList(response.data?.requests || []);
      } catch (error) {
        console.error("Error fetching requests:", error);
      } finally {
        setIsLoadingRequests(false);
      }
    };
    fetchRoomsRequest();
  }, [acadmeicYear, acadmeicSession, pageSize, curruntPage]);

  const filterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [filterRef]);

  const handleSort = (header: string) => {
    if (activeHeader !== tableHeadersList[header]) {
      setActiveHeader(tableHeadersList[header]);
      setSortState("asc");
    } else if (sortState === "asc") {
      setSortState("desc");
    } else if (sortState === "desc") {
      setSortState("");
      setActiveHeader("");
    }
  };

  const handleFilterChange = (filterType: string, value: string) => {
    setAppliedFilters((prevFilters) => {
      const currentOptions = prevFilters[filterType] || [];
      const newOptions = currentOptions.includes(value) ? currentOptions.filter((item) => item !== value) : [...currentOptions, value];
      return {
        ...prevFilters,
        [filterType]: newOptions,
      };
    });
  };

  const handleRemoveFilter = (filterType: string, value: string) => {
    setAppliedFilters((prevFilters) => {
      const newFilters = { ...prevFilters };
      newFilters[filterType] = newFilters[filterType].filter((item) => item !== value);
      return newFilters;
    });
  };

  const handleRequestClick = (request: RoomRequest) => {
    router.push(`/space-portal/requests/${encrypt(request.requestID)}?limit=${pageSize}&offSet=${curruntPage}`);
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between">
        <h2 className="text-base font-semibold text-gray-800 md:ml-2">Room Request Overview</h2>
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
              <img src={"/images/bx-filter-alt.svg"} alt="icon filter" className="h-5 w-5 mr-2 fill-gray-600" />
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
                    <h4 className="text-sm font-semibold mb-2 text-gray-500">Priority</h4>
                    {Object.keys(priorityOrder).map((p) => (
                      <label key={p} className="flex items-center text-gray-700">
                        <input
                          type="checkbox"
                          checked={appliedFilters.priority?.includes(p) || false}
                          onChange={() => handleFilterChange("priority", p)}
                          className="mr-2 rounded text-orange-600"
                        />
                        {p}
                      </label>
                    ))}
                  </div>
                  <hr className="my-2" />
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-gray-500">Status</h4>
                    {Object.keys(statusOrder).map((s) => (
                      <label key={s} className="flex items-center text-gray-700">
                        <input
                          type="checkbox"
                          checked={appliedFilters.status?.includes(s) || false}
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
            <span key={`${key}-${value}`} className="flex items-center bg-gray-200 text-gray-800 text-sm px-3 py-1 rounded-full">
              {value}
              <button onClick={() => handleRemoveFilter(key, value)} className="ml-2 text-gray-500 hover:text-gray-900 focus:outline-none">
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
                  <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider cursor-pointer group">
                    <div className="flex items-center" onClick={() => handleSort(header)}>
                      {header}
                      <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible invisible">
                        <svg
                          className={`h-3 w-3 ${
                            activeHeader === tableHeadersList[header] && sortState === "asc" ? "fill-orange-400 visible" : "fill-gray-400"
                          } `}
                          aria-hidden="true"
                          name="asc"
                          viewBox="0 0 20 20"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <path d="M10.707 3.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L9 6.414V17a1 1 0 102 0V6.414l5.293 5.293a1 1 0 001.414-1.414l-7-7z" />
                        </svg>
                        <svg
                          className={` h-3 w-3 ${
                            activeHeader === tableHeadersList[header] && sortState === "desc" ? "fill-orange-400 visible" : "fill-gray-400"
                          } `}
                          aria-hidden="true"
                          name="desc"
                          viewBox="0 0 20 20"
                          onClick={(e) => {
                            e.stopPropagation();
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
              {isLoadingRequests ? (
                <tr>
                  <td colSpan={Object.keys(tableHeadersList).length}>
                    <div className="flex justify-center items-center h-32">
                      <svg className="animate-spin h-12 w-12 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <p className="ml-2 text-gray-600">Loading requests...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={Object.keys(tableHeadersList).length}>
                    <div className="flex justify-center items-center h-32 text-gray-500">No requests found.</div>
                  </td>
                </tr>
              ) : (
                filteredList.map((request) => (
                  <tr key={request.requestID} className="hover:bg-gray-50">
                    <td
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 cursor-pointer hover:text-indigo-800"
                      onClick={() => {
                        handleRequestClick(request);
                      }}
                    >
                      {request.requestID}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{request.employeeName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{request.employeeDepartment}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{request.requestedRoomType}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{request.purpose}</td>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{request.requestDate?.split("T")?.[0]}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {`${request.startDate?.split("T")?.[0]} ${request.startDate !== request.endDate ? ` - ${request.endDate?.split("T")?.[0]}` : ""}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{`${request.startTime} - ${request.endTime}`}</td>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{request.allocatedRoomID || "N/A"}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{request.approvedBy || "N/A"}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{request.approvalDate || "N/A"}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{request.recurrence}</td>
                  </tr>
                ))
              )}
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
            <select onChange={(e) => setPageSize(e.target.value)} className="border rounded border-gray-300 p-1" name="rowscount" id="rows">
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="30">30</option>
              <option value="50">50</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
