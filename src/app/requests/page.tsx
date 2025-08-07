"use client";
import React, {
  JSX,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import SideNav from "@/components/SideNav";
import Header from "@/components/Header";
import useSideNavState from "@/hooks/useSideNavState";
import Image from "next/image";
import { Button } from "@tremor/react";
import Pagination from "@/components/PageNumberIndicator";

interface RoomRequest {
  requestID: string;
  employeeName: string;
  employeeDepartment: string;
  requestedRoomType: string;
  purpose: string;
  priority: string;
  requestDate: string;
  requiredDate: string;
  requiredTimeStart: string;
  requiredTimeEnd: string;
  status: string;
  allocatedRoomID: string | null;
  approvedBy: string | null;
  approvalDate: string | null;
  recurrence: string;
}

const data: RoomRequest[] = [
  {
    requestID: "REQ001",
    employeeName: "EMP001",
    employeeDepartment: "HR",
    requestedRoomType: "Conference Room",
    purpose: "Team Meeting - Q3 Planning",
    priority: "High",
    requestDate: "2024-07-25",
    requiredDate: "2024-08-10",
    requiredTimeStart: "09:00",
    requiredTimeEnd: "11:00",
    status: "Approved",
    allocatedRoomID: "CR005",
    approvedBy: "EMP005",
    approvalDate: "2024-07-26",
    recurrence: "None",
  },
  {
    requestID: "REQ002",
    employeeName: "EMP002",
    employeeDepartment: "Marketing",
    requestedRoomType: "Training Room",
    purpose: "New Product Training",
    priority: "Medium",
    requestDate: "2024-07-28",
    requiredDate: "2024-08-15",
    requiredTimeStart: "13:00",
    requiredTimeEnd: "17:00",
    status: "Pending",
    allocatedRoomID: null,
    approvedBy: null,
    approvalDate: null,
    recurrence: "Weekly",
  },
  {
    requestID: "REQ003",
    employeeName: "EMP003",
    employeeDepartment: "IT",
    requestedRoomType: "Small Meeting Room",
    purpose: "Client Demo",
    priority: "High",
    requestDate: "2024-07-29",
    requiredDate: "2024-08-05",
    requiredTimeStart: "10:30",
    requiredTimeEnd: "11:30",
    status: "Approved",
    allocatedRoomID: "SMR002",
    approvedBy: "EMP006",
    approvalDate: "2024-07-30",
    recurrence: "None",
  },
  {
    requestID: "REQ004",
    employeeName: "EMP004",
    employeeDepartment: "Sales",
    requestedRoomType: "Conference Room",
    purpose: "Sales Strategy Session",
    priority: "Medium",
    requestDate: "2024-07-30",
    requiredDate: "2024-08-20",
    requiredTimeStart: "09:00",
    requiredTimeEnd: "12:00",
    status: "Approved",
    allocatedRoomID: "CR001",
    approvedBy: "EMP005",
    approvalDate: "2024-07-31",
    recurrence: "Monthly",
  },
  {
    requestID: "REQ005",
    employeeName: "EMP001",
    employeeDepartment: "HR",
    requestedRoomType: "Interview Room",
    purpose: "Candidate Interview",
    priority: "High",
    requestDate: "2024-08-01",
    requiredDate: "2024-08-12",
    requiredTimeStart: "10:00",
    requiredTimeEnd: "10:45",
    status: "Approved",
    allocatedRoomID: "IR003",
    approvedBy: "EMP005",
    approvalDate: "2024-08-01",
    recurrence: "None",
  },
  {
    requestID: "REQ006",
    employeeName: "EMP007",
    employeeDepartment: "Finance",
    requestedRoomType: "Board Room",
    purpose: "Board Meeting",
    priority: "Critical",
    requestDate: "2024-08-02",
    requiredDate: "2024-09-01",
    requiredTimeStart: "09:00",
    requiredTimeEnd: "16:00",
    status: "Pending",
    allocatedRoomID: null,
    approvedBy: null,
    approvalDate: null,
    recurrence: "Monthly",
  },
  {
    requestID: "REQ007",
    employeeName: "EMP008",
    employeeDepartment: "Operations",
    requestedRoomType: "Conference Room",
    purpose: "Project Review",
    priority: "Medium",
    requestDate: "2024-08-03",
    requiredDate: "2024-08-18",
    requiredTimeStart: "14:00",
    requiredTimeEnd: "15:30",
    status: "Rejected",
    allocatedRoomID: null,
    approvedBy: "EMP005",
    approvalDate: "2024-08-04",
    recurrence: "None",
  },
  {
    requestID: "REQ008",
    employeeName: "EMP009",
    employeeDepartment: "R&D",
    requestedRoomType: "Lab",
    purpose: "Experiment Setup",
    priority: "Low",
    requestDate: "2024-08-04",
    requiredDate: "2024-08-25",
    requiredTimeStart: "08:00",
    requiredTimeEnd: "12:00",
    status: "Approved",
    allocatedRoomID: "LAB001",
    approvedBy: "EMP006",
    approvalDate: "2024-08-05",
    recurrence: "None",
  },
  {
    requestID: "REQ009",
    employeeName: "EMP010",
    employeeDepartment: "Customer Support",
    requestedRoomType: "Training Room",
    purpose: "Customer Service Workshop",
    priority: "High",
    requestDate: "2024-08-05",
    requiredDate: "2024-09-01",
    requiredTimeStart: "09:00",
    requiredTimeEnd: "17:00",
    status: "Pending",
    allocatedRoomID: null,
    approvedBy: null,
    approvalDate: null,
    recurrence: "Quarterly",
  },
  {
    requestID: "REQ010",
    employeeName: "EMP002",
    employeeDepartment: "Marketing",
    requestedRoomType: "Small Meeting Room",
    purpose: "Brainstorming Session",
    priority: "Medium",
    requestDate: "2024-08-06",
    requiredDate: "2024-08-08",
    requiredTimeStart: "14:00",
    requiredTimeEnd: "15:00",
    status: "Approved",
    allocatedRoomID: "SMR001",
    approvedBy: "EMP005",
    approvalDate: "2024-08-06",
    recurrence: "None",
  },
];
const tableHeadersList: { [key: string]: keyof RoomRequest } = {
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
  const { isSideNavOpen, toggleSideNav } = useSideNavState();
  const [sortState, setSortState] = useState<sortingTypes>("");
  const [activeHeader, setActiveHeader] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<{
    [key: string]: string[];
  }>({});
  const [filteredList, setFilteredList] = useState(data);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  useEffect(() => {
    const listAfterFilters = filterData(data, appliedFilters, searchQuery);
    const sortedList = sortData(
      listAfterFilters,
      activeHeader as keyof RoomRequest,
      sortState
    );
    setFilteredList(sortedList);
  }, [data, activeHeader, sortState, appliedFilters, searchQuery]);

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

  const [curruntPage, setCurruntPage] = useState(3);
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 font-sans md:grid md:grid-cols-[256px_1fr] w-full overscroll-contain">
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-gray-50 transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isSideNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SideNav onClose={toggleSideNav} />
      </div>

      {isSideNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={toggleSideNav}
        />
      )}

      <div className="flex flex-1 flex-col">
        <div className="sticky top-0 z-30 flex w-full items-center justify-between border-b bg-white p-4 shadow-sm md:hidden">
          <button onClick={toggleSideNav} className="text-gray-900">
            <Menu size={24} />
          </button>
          <h1 className="text-xl font-bold text-gray-800">Buildings</h1>
          <div className="w-6" />
        </div>

        <div className="hidden md:block">
          <Header />
        </div>

        <main className="flex w-full overflow-y-auto p-4 md:p-6 ">
          <section>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800 mb-2 md:mb-0">
                Room Request Overview
              </h2>
              <div className="flex items-center space-x-4">
                <input
                  type="text"
                  placeholder="Search"
                  value={searchQuery ? searchQuery : ""}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border border-gray-300 rounded-md py-2 px-4 text-sm focus:outline-none text-gray-700 focus:ring-1 focus:ring-blue-500"
                />
                <div className="relative " ref={filterRef}>
                  <button
                    onClick={() =>
                      setIsFilterDropdownOpen(!isFilterDropdownOpen)
                    }
                    className="flex flex-row items-center text-gray-600 text-sm bg-gray-100 py-2 px-4 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors duration-150"
                  >
                    <img
                      src={"/images/bx-filter-alt.svg"}
                      alt="icon filter"
                      className="h-5 w-5 mr-2 fill-gray-600"
                    />
                    Filter
                    {Object.values(appliedFilters).flat().length > 0 && (
                      <span className="ml-2 bg-blue-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs">
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
                                onChange={() =>
                                  handleFilterChange("priority", p)
                                }
                                className="mr-2 rounded text-blue-600"
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
                                className="mr-2 rounded text-blue-600"
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

            <div className="flex flex-wrap space-x-2 mb-4">
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
              <div className="min-w-2xl max-w-6xl w-6xl p-2 overflow-x-scroll bg-white">
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
                                    ? "fill-blue-400 visible"
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
                                    ? "fill-blue-400 visible"
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
                    totalPages={10}
                  />
                </div>
                <div className="mt-2 text-gray-600 flex items-center mr-6">
                  <span className="text-sm text-nowrap mr-2">
                    Rows per page:
                  </span>
                  <select
                    className="border rounded border-gray-300 p-1"
                    name="rowscount"
                    id="rows"
                  >
                    <option value="10">10</option>
                    <option value="10">20</option>
                    <option value="10">30</option>
                    <option value="10">50</option>
                  </select>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
