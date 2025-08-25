"use client";
import React, { useEffect, useState } from "react";
import Pagination from "@/components/PageNumberIndicator";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { useSelector } from "react-redux";
import {
  Building1,
  Report,
  AcademicSession,
  AcademicYear,
  Room1,
} from "@/types";
import { formatDate } from "@/utils";
import { setAcademicYear } from "@/app/feature/dataSlice";
import {
  AcademicYearResponse,
  AcademicSessionResponse,
} from "@/components/Header";

type ReportsResponse = {
  pageSize: number;
  currentPage: number;
  totalPages: number;
  reports?: Report[];
};

const tableHeadersList: { [key: string]: keyof Report } = {
  "Serial No.": "id",
  Name: "fileName",
  "Created on": "createdAt",
  Size: "size",
  "Start Date": "startDate",
  "End Date": "endDate",
  Download: "id",
};
type sortingTypes = "asc" | "desc" | "";

const parseSizeToBytes = (sizeString: string): number => {
  const [value, unit] = sizeString.split(" ");
  const numericValue = parseFloat(value);
  if (isNaN(numericValue)) {
    return 0;
  }

  switch (unit.toUpperCase()) {
    case "KB":
      return Math.round(numericValue * 1024);
    case "MB":
      return Math.round(numericValue * 1024 * 1024);
    case "GB":
      return Math.round(numericValue * 1024 * 1024 * 1024);
    default:
      return Math.round(numericValue);
  }
};

function sortData(data: Report[], key: keyof Report, sortOrder: sortingTypes) {
  if (sortOrder === "") return data;
  return [...data].sort((a, b) => {
    let valueA: any = a[key];
    let valueB: any = b[key];

    if (valueA === null || valueA === undefined) valueA = "";
    if (valueB === null || valueB === undefined) valueB = "";

    let comparison = 0;
    if (key === "size") {
      const bytesA = parseSizeToBytes(valueA);
      const bytesB = parseSizeToBytes(valueB);
      if (bytesA > bytesB) {
        comparison = 1;
      } else if (bytesA < bytesB) {
        comparison = -1;
      } else {
        comparison = 0;
      }
    } else if (typeof valueA === "string" && typeof valueB === "string") {
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

export default function UtilizationReport() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [polling, setPolling] = useState(false);

  const startJob = async (fileName: string) => {
    const res = await fetch("/api/start-job", {
      method: "POST",
      body: JSON.stringify({ fileKey: fileName || "temp" }),
      headers: { "Content-Type": "application/json" },
    });

    const data = await res.json();
    setJobId(data.jobId);
    setReady(false);

    if (data.alreadyExists) {
      window.open(data.downloadUrl, "_blank");
      setReady(true);
    } else {
      setPolling(true);
    }
  };

  useEffect(() => {
    if (!polling || !jobId) return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/job-status?jobId=${jobId}`);
      const data = await res.json();

      if (data.ready) {
        setReady(true);
        setPolling(false);
        window.open(data.downloadUrl, "_blank");
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [polling, jobId]);

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
  const [reportsList, setReportsList] = useState<Report[]>([]);

  const [filteredList, setFilteredList] = useState<Report[]>([]);
  const [pageSize, setPageSize] = useState("10");

  function filterData(data: Report[], searchQuery: string) {
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
    return filteredBySearch;
  }
  useEffect(() => {
    const filteredList = filterData(reportsList, searchQuery);
    const sortedList = sortData(
      filteredList,
      activeHeader as keyof Report,
      sortState
    );
    setFilteredList(sortedList);
  }, [reportsList, activeHeader, sortState, searchQuery]);

  const [generateReportVisible, setGenerateReportVisible] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  useEffect(() => {
    const fetchReports = async () => {
      const requestBody = {
        limit: pageSize,
        offset: curruntPage,
        acadmeicSession: acadmeicSession,
        acadmeicYear: acadmeicYear,
      };
      let response = await callApi<ReportsResponse>(
        `${process.env.NEXT_PUBLIC_GET_REPORTS}` || URL_NOT_FOUND,
        requestBody
      );
      let res = response;
      setTotalPages(res.data?.totalPages || 0);

      setCurruntPage(res.data?.currentPage || 0);
      setReportsList(res.data?.reports || []);
    };
    fetchReports();
  }, [acadmeicYear, acadmeicSession, pageSize, curruntPage]);

  const handleSort = (header: string, sortOrder: sortingTypes) => {
    setActiveHeader(tableHeadersList[header]);
    setSortState(
      activeHeader === tableHeadersList[header] && sortState === sortOrder
        ? ""
        : sortOrder
    );
  };

  const handleDownloadClick = (request: Report) => {
    startJob(request.id);
  };

  return (
    <>
      <div>
        <div className="flex flex-col md:flex-row justify-between">
          <h2 className="text-base font-semibold text-gray-800 md:ml-2">
            Overall Reports
          </h2>
          <div className="flex items-center space-x-4">
            <input
              type="text"
              placeholder="Search"
              value={searchQuery ? searchQuery : ""}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-gray-300 rounded-md py-1 px-2 text-sm focus:outline-none text-gray-700 focus:ring-1 focus:ring-orange-500"
            />
            <button
              className="flex h-fit items-center rounded-md bg-[#F26722] px-4 py-2 text-xs text-white shadow-md transition-all hover:bg-[#a5705a]"
              onClick={() => setGenerateReportVisible(true)}
            >
              Generate Report
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-2 border border-gray-200 w-full mt-2">
          <div className="min-w-2xl w-[100vw] max-w-6xl p-2 overflow-x-scroll bg-white">
            <table className="divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(tableHeadersList).map((header) => (
                    <th
                      key={header}
                      scope="col"
                      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider cursor-pointer group ${
                        header === "Name" ? "w-full" : ""
                      }`}
                    >
                      <div
                        className="flex items-center"
                        onClick={() => handleSort(header, "asc")}
                      >
                        {header}
                        {header != "Serial No." && header != "Download" && (
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
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredList.map((report, index) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {report.fileName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatDate(report.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {report.size}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {report.startDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {report.endDate}
                    </td>
                    <td
                      className="px-6 py-4 whitespace-nowrap text-sm text-indigo-400 cursor-pointer hover:text-indigo-700"
                      onClick={() => {
                        handleDownloadClick(report);
                      }}
                    >
                      Download
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
      {generateReportVisible && (
        <GenerateReportForm
          onClosePressed={() => setGenerateReportVisible(false)}
        />
      )}
    </>
  );
}

type FormProps = {
  onClosePressed: () => void;
};

function GenerateReportForm({ onClosePressed }: FormProps) {
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [timePeriod, setTimePeriod] = useState<string>("");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");
  const [buildings, setBuildings] = useState<Building1[]>([]);
  const [rooms, setRooms] = useState<Room1[]>([]);
  const [reportType, setReportType] = useState("room");
  const [academicYearsList, setAcademicYearsList] = useState<AcademicYear[]>();
  const [academicSessionsList, setAcademicSessionsList] =
    useState<AcademicSession[]>();
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const acadmeicYear = useSelector(
    (state: any) => state.dataState.academicYear
  );
  const acadmeicSession = useSelector(
    (state: any) => state.dataState.academicSession
  );

  useEffect(() => {
    const getAcadmicCalender = async () => {
      const responseYear = await callApi<AcademicYearResponse>(
        process.env.NEXT_PUBLIC_GET_ACADMIC_YEARS || URL_NOT_FOUND
      );
      if (responseYear.success) {
        const acadYearsList = responseYear.data?.["Academic Year"]?.reverse();
        setAcademicYearsList(acadYearsList);
      }

      let responseSession = await callApi<AcademicSessionResponse>(
        process.env.NEXT_PUBLIC_GET_ACADMIC_SESSIONS || URL_NOT_FOUND
      );

      if (responseSession.success) {
        setAcademicSessionsList(responseSession.data?.["Academic Session"]);
      }
    };
    getAcadmicCalender();
  }, []);
  useEffect(() => {
    const fetchBuildings = async () => {
      const reqBody = {
        acadSession: `${acadmeicSession}`,
        acadYear: `${acadmeicYear}`,
      };

      const response = await callApi<Building1[]>(
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
      const floorIds = building.floors?.map((f) => f.id) || [];
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
      const response = await callApi<Room1[]>(
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
  useEffect(() => {
    setSelectedBuildingId("");
    setSelectedFloorId("");
    setSelectedRoomId("");
  }, [reportType]);

  const handleSubmit = () => {};
  return (
    <section className="fixed inset-0 z-50 h-screen w-screen bg-[#00000070] flex items-center justify-center text-gray-500">
      <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl p-6 transform transition-all duration-300 ease-in-out scale-95 md:scale-100">
        <div className="max-h-[80vh] bg-white pr-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-900 font-[550] text-sm">
              Generate Report
            </span>
          </div>

          <div className="border-t-2 border-gray-200 mt-2 pt-2 space-y-2">
            <div className="flex flex-col md:flex-row md:space-x-4">
              <div className="w-full">
                <label className="block text-sm text-gray-700 mb-1">
                  Report type
                </label>
                <select
                  className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  value={reportType}
                  onChange={(e) => {
                    setReportType(e.target.value);
                  }}
                >
                  <option value="room">Room Report</option>
                  <option value="building">Building Report</option>
                </select>{" "}
              </div>
            </div>
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
            {reportType === "room" && (
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
                            <option key={f.id} value={f.id}>
                              {f.name}
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
                      <option key={r.id} value={r.id}>
                        {r.roomName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            {timePeriod !== "custom" ? (
              <div className="flex flex-col md:flex-row md:space-x-4">
                <div className="md:w-1/2 w-full">
                  <label className="block text-sm text-gray-700 mb-1">
                    Period
                  </label>
                  <select
                    className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                    value={timePeriod}
                    onChange={(e) => setTimePeriod(e.target.value)}
                  >
                    <option value="">Select Duration</option>
                    <option value={"active"}>Active Session</option>
                    <option value={"year"}>Academic Year</option>
                    <option value={"session"}>Academic Session</option>
                    <option value={"last30"}>Last 30 Days</option>
                    <option value={"last7"}>Last 7 Days</option>
                    <option value={"custom"}>Custom Duration</option>
                  </select>
                </div>
                {timePeriod === "year" && (
                  <div className="md:w-1/2 w-full mt-4 md:mt-0">
                    <label className="block text-sm text-gray-700 mb-1">
                      Year
                    </label>
                    <select
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                    >
                      <option value="">Select year</option>
                      {academicYearsList?.map((y) => (
                        <option key={y.Code} value={y.Code}>
                          {y.Description}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {timePeriod === "session" && (
                  <div className="md:w-1/2 w-full mt-4 md:mt-0">
                    <label className="block text-sm text-gray-700 mb-1">
                      Session
                    </label>
                    <select
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      value={selectedSession}
                      onChange={(e) => setSelectedSession(e.target.value)}
                    >
                      <option value="">Select session</option>
                      {academicSessionsList?.map((y) => (
                        <option key={y.Code} value={y.Code}>
                          {y.Code}
                        </option>
                      ))}
                    </select>
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
                      setTimePeriod("");
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
              Generate
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
