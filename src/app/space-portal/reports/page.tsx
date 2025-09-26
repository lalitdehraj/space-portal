"use client";
import React, { useEffect, useState } from "react";
import Pagination from "@/components/PageNumberIndicator";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { useSelector } from "react-redux";
import { Building, Report, AcademicSession, AcademicYear, Room, Department, Faculty } from "@/types";
import { formatDateOnly, formatFileSize } from "@/utils";
import { AcademicYearResponse, AcademicSessionResponse } from "@/components/Header";
import { useBuildingsData } from "@/hooks/useBuildingsData";
import moment from "moment";

const tableHeadersList: { [key: string]: keyof Report } = {
  "Serial No.": "id",
  Name: "fileName",
  "Created on": "fileCreatedOn",
  Size: "fileSize",
  "Start Date": "startDate",
  "End Date": "endDate",
  Download: "id",
};
type sortingTypes = "asc" | "desc" | "";

const parseSizeToBytes = (sizeString?: string): number => {
  if (!sizeString || typeof sizeString !== "string") return 0;
  const parts = sizeString.trim().split(" ");
  if (parts.length === 0) return 0;
  const numericValue = parseFloat(parts[0].replace(",", ""));
  const unit = parts.length > 1 ? parts[1] : "";

  if (isNaN(numericValue)) return 0;

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
  if (!data || !Array.isArray(data)) return [];
  if (sortOrder === "") return data;
  return [...data].sort((a, b) => {
    let valueA: any = a[key];
    let valueB: any = b[key];

    if (valueA === null || valueA === undefined) valueA = "";
    if (valueB === null || valueB === undefined) valueB = "";

    let comparison = 0;
    if (key === "fileSize") {
      const bytesA = parseSizeToBytes(valueA as string);
      const bytesB = parseSizeToBytes(valueB as string);
      comparison = bytesA - bytesB;
    } else if (typeof valueA === "string" && typeof valueB === "string") {
      comparison = valueA.localeCompare(valueB);
    } else {
      if (valueA > valueB) {
        comparison = 1;
      } else if (valueA < valueB) {
        comparison = -1;
      } else {
        comparison = 0;
      }
    }
    return sortOrder === "desc" ? comparison * -1 : comparison;
  });
}

export default function UtilizationReport() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [polling, setPolling] = useState(false);
  const [isLoadingReports, setIsLoadingReports] = useState(false);

  const startJob = async (fileName: string) => {
    const res = await fetch("/api/start-job", {
      method: "POST",
      body: JSON.stringify({ fileKey: fileName || "temp" }),
      headers: { "Content-Type": "application/json" },
    });

    const data = await res.json();
    setJobId(data.jobId);
    setReady(false);

    if (data.alreadyExists && data.downloadUrl) {
      window.open(data.downloadUrl, "_blank");
      setReady(true);
    } else {
      setPolling(true);
    }
  };

  useEffect(() => {
    if (!polling || !jobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/job-status?jobId=${jobId}`);
        const data = await res.json();

        if (data.ready) {
          setReady(true);
          setPolling(false);
          if (data.downloadUrl) window.open(data.downloadUrl, "_blank");
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [polling, jobId]);

  const [curruntPage, setCurruntPage] = useState(1);
  const acadmeicYear = useSelector((state: any) => state.dataState.academicYear);
  const acadmeicSession = useSelector((state: any) => state.dataState.academicSession);
  const [sortState, setSortState] = useState<sortingTypes>("");
  const [activeHeader, setActiveHeader] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [reportsList, setReportsList] = useState<Report[]>([]);

  const [filteredList, setFilteredList] = useState<Report[]>([]);
  const [pageSize, setPageSize] = useState("10");

  function filterData(data: Report[], searchQuery: string) {
    if (!data || !Array.isArray(data)) return [];
    if (!searchQuery) return data;
    const filteredBySearch = data.filter((item) => {
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
    const filtered = filterData(reportsList || [], searchQuery);
    const sorted = sortData(filtered, (activeHeader as keyof Report) || ("id" as keyof Report), sortState);
    setFilteredList(sorted || []);
  }, [reportsList, activeHeader, sortState, searchQuery]);

  const [generateReportVisible, setGenerateReportVisible] = useState(false);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    const fetchReports = async () => {
      setIsLoadingReports(true);
      try {
        const response = await callApi<Report[]>(process.env.NEXT_PUBLIC_GET_UTILIZATION_REPORT_API || URL_NOT_FOUND);

        if (response.success && response.data) {
          setReportsList(response.data);
          setTotalPages(1); // Since the API doesn't provide pagination info, set to 1
        } else {
          console.warn("API response not successful:", response);
          setReportsList([]);
        }
      } catch (error) {
        console.error("Error fetching reports:", error);
        setReportsList([]);
      } finally {
        setIsLoadingReports(false);
      }
    };
    fetchReports();
  }, [acadmeicYear, acadmeicSession, pageSize, curruntPage]);

  // Improved sorting toggle behavior:
  const handleSort = (header: string, requestedOrder: sortingTypes) => {
    const key = tableHeadersList[header];
    if (!key) return;

    if (activeHeader === key) {
      // cycle: asc -> desc -> none
      if (sortState === "asc" && requestedOrder === "asc") {
        setSortState("desc");
      } else if (sortState === "desc" && requestedOrder === "desc") {
        setSortState("");
        setActiveHeader("");
      } else {
        setSortState(requestedOrder);
      }
    } else {
      setActiveHeader(String(key));
      setSortState(requestedOrder);
    }
  };

  const handleDownloadClick = (request: Report) => {
    startJob(request.fileName);
  };

  return (
    <>
      <div>
        <div className="flex flex-col md:flex-row justify-between">
          <h2 className="text-base font-semibold text-gray-800 md:ml-2">Overall Reports</h2>
          <div className="flex items-center space-x-4">
            {polling && (
              <div className="flex items-center text-sm text-orange-600">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-orange-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Generating report...
              </div>
            )}
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
                      <div className="flex items-center" onClick={() => handleSort(header, "asc")}>
                        {header}
                        {header != "Serial No." && header != "Download" && (
                          <span className="ml-2 flex-none rounded text-gray-400 group-hover:visible invisible">
                            <svg
                              className={`h-5 w-5 ${
                                activeHeader === tableHeadersList[header] && sortState === "asc" ? "fill-orange-400 visible" : "fill-gray-400"
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
                                activeHeader === tableHeadersList[header] && sortState === "desc" ? "fill-orange-400 visible" : "fill-gray-400"
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
                {isLoadingReports ? (
                  <tr>
                    <td colSpan={Object.keys(tableHeadersList).length + 1}>
                      <div className="flex justify-center items-center h-32">
                        <svg className="animate-spin h-12 w-12 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      </div>
                    </td>
                  </tr>
                ) : filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={Object.keys(tableHeadersList).length + 1}>
                      <div className="flex justify-center items-center h-32 text-gray-500">No reports found.</div>
                    </td>
                  </tr>
                ) : (
                  (filteredList || []).map((report, index) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{index + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{report.fileName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDateOnly(report.fileCreatedOn)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatFileSize(report.fileSize)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDateOnly(report.startDate)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDateOnly(report.endDate)}</td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-indigo-400 cursor-pointer hover:text-indigo-700"
                        onClick={() => {
                          handleDownloadClick(report);
                        }}
                      >
                        Download
                      </td>
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
              <select onChange={(e) => setPageSize(e.target.value)} className="border rounded border-gray-300 p-1" name="rowscount" id="rows" value={pageSize}>
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
          startJob={startJob} // Pass startJob to the form
          buildings={[]}
          setJobId={setJobId}
          setReady={setReady}
          setPolling={setPolling}
          // we won't pass buildings here because GenerateReportForm fetches them internally
        />
      )}
    </>
  );
}

type FormProps = {
  onClosePressed: () => void;
  startJob: (fileName: string) => void;
  buildings?: Building[]; // not used, kept for compatibility
  setJobId: (jobId: string) => void;
  setReady: (ready: boolean) => void;
  setPolling: (polling: boolean) => void;
};

function GenerateReportForm({ onClosePressed, startJob, setJobId, setReady, setPolling }: FormProps) {
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [timePeriod, setTimePeriod] = useState<string>("thisWeek");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [selectedFaculty, setSelectedFaculty] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");
  const [rooms, setRooms] = useState<Room[]>([]);

  // Use custom hook for buildings data
  const { buildings } = useBuildingsData();
  const [reportType, setReportType] = useState("room");
  const [academicYearsList, setAcademicYearsList] = useState<AcademicYear[]>();
  const [academicSessionsList, setAcademicSessionsList] = useState<AcademicSession[]>();
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isGenerateDisabled, setIsGenerateDisabled] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>("");
  const user = useSelector((state: any) => state.dataState.user);
  const acadmeicYear = useSelector((state: any) => state.dataState.selectedAcademicYear);
  const acadmeicSession = useSelector((state: any) => state.dataState.selectedAcademicSession);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);

  useEffect(() => {
    const getAcadmicCalender = async () => {
      try {
        const responseYear = await callApi<AcademicYearResponse>(process.env.NEXT_PUBLIC_GET_ACADMIC_YEARS || URL_NOT_FOUND);
        if (responseYear.success) {
          const acadYearsList = responseYear.data?.["Academic Year"]?.reverse();
          setAcademicYearsList(acadYearsList);
        }

        let responseSession = await callApi<AcademicSessionResponse>(process.env.NEXT_PUBLIC_GET_ACADMIC_SESSIONS || URL_NOT_FOUND);

        if (responseSession.success) {
          setAcademicSessionsList(responseSession.data?.["Academic Session"]);
        }
      } catch (err) {
        console.error("Error fetching academic calendar:", err);
      }
    };
    getAcadmicCalender();
  }, []);

  // fetch departments & faculties (endpoints are optional; set env vars if available)
  useEffect(() => {
    if (!reportType) return;
    if (reportType === "department") {
      const fetchDepartments = async () => {
        const response = await callApi<Department[]>(process.env.NEXT_PUBLIC_GET_FACULTY_OR_DEPARTMENT || URL_NOT_FOUND, {
          filterValue: reportType.toUpperCase().trim(),
        });
        if (response.success && response.data) {
          setDepartments(response.data);
        }
      };
      fetchDepartments();
    } else {
      const fetchFaculties = async () => {
        const response = await callApi<Faculty[]>(process.env.NEXT_PUBLIC_GET_FACULTY_OR_DEPARTMENT || URL_NOT_FOUND, {
          filterValue: reportType.toUpperCase().trim(),
        });
        if (response.success && response.data) {
          setFaculties(response.data);
        }
      };
      fetchFaculties();
    }
  }, [reportType]);

  useEffect(() => {
    const fetchAllSessions = async () => {
      try {
        const response = await callApi<AcademicSessionResponse>(process.env.NEXT_PUBLIC_GET_ACADMIC_SESSIONS || URL_NOT_FOUND);
        if (response.success && response.data?.["Academic Session"]) {
          setAcademicSessionsList(response.data["Academic Session"]);
        }
      } catch (err) {
        console.error("Error fetching all sessions:", err);
      }
    };
    fetchAllSessions();
  }, []);

  useEffect(() => {
    if (timePeriod === "thisWeek") {
      const startOfWeek = moment().startOf("isoWeek"); // Monday
      const endOfWeek = moment().endOf("isoWeek"); // Sunday
      setCustomStartDate(startOfWeek.format("YYYY-MM-DD"));
      setCustomEndDate(endOfWeek.format("YYYY-MM-DD"));
    } else if (timePeriod === "thisMonth") {
      const startOfMonth = moment().startOf("month");
      const endOfMonth = moment().endOf("month");
      setCustomStartDate(startOfMonth.format("YYYY-MM-DD"));
      setCustomEndDate(endOfMonth.format("YYYY-MM-DD"));
    } else if (timePeriod === "active") {
      // let backend resolve the active session range
      const session = academicSessionsList?.find((s) => s.Code === user?.activeSession);
      setCustomStartDate(session?.["Start Session"] || "");
      setCustomEndDate(session?.["End Session"] || "");
    } else if (timePeriod === "year") {
      // controlled by academic year dropdown
      setCustomStartDate("");
      setCustomEndDate("");
    } else if (timePeriod === "session") {
      // controlled by academic session dropdown
      const session = academicSessionsList?.find((s) => s.Code === selectedSession);
      setCustomStartDate(session?.["Start Session"] || "");
      setCustomEndDate(session?.["End Session"] || "");
    } else if (timePeriod === "custom") {
      // do not reset here → user will pick manually
    } else {
      setCustomStartDate("");
      setCustomEndDate("");
    }
  }, [timePeriod]);

  useEffect(() => {
    let isValid = true;

    if (reportType === "building" && !selectedBuildingId) {
      isValid = false;
    } else if (reportType === "room" && (!selectedBuildingId || !selectedRoomId)) {
      isValid = false;
    } else if (reportType === "department" && !selectedDepartment) {
      isValid = false;
    } else if (reportType === "faculty" && !selectedFaculty) {
      isValid = false;
    }

    if (timePeriod === "") {
      isValid = false;
    }
    if (timePeriod === "custom" && (!customStartDate || !customEndDate)) {
      isValid = false;
    }

    setIsGenerateDisabled(!isValid);
  }, [reportType, selectedBuildingId, selectedRoomId, selectedFloorId, timePeriod, customStartDate, customEndDate]);

  useEffect(() => {
    const fetchRoomsForBuilding = async (buildingId: string) => {
      const building = buildings.find((b) => b.id === buildingId);
      if (!building) {
        setRooms([]);
        return;
      }
      // try to fetch rooms; if API not present, keep rooms empty
      try {
        const reqBody = {
          buildingNo: `${buildingId}`,
          floorID: `${selectedFloorId}`,
          curreentTime: moment().format("HH:mm"),
        };
        const response = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, reqBody);
        if (response && response.success) setRooms(response.data || []);
        else setRooms([]);
      } catch (err) {
        console.error("Error fetching rooms", err);
        setRooms([]);
      }
    };

    if (selectedBuildingId) {
      fetchRoomsForBuilding(selectedBuildingId);
      setSelectedRoomId("");
    } else {
      setRooms([]);
      setSelectedRoomId("");
    }
  }, [selectedBuildingId, acadmeicSession, acadmeicYear, buildings, selectedFloorId]);

  useEffect(() => {
    setSelectedBuildingId("");
    setSelectedFloorId("");
    setSelectedRoomId("");
    setSelectedDepartment("");
    setSelectedFaculty("");
  }, [reportType]);

  useEffect(() => {}, [timePeriod]);

  const handleSubmit = async () => {
    setIsGenerating(true);
    setError("");

    try {
      // Determine start & end date based on time period
      let startDate = customStartDate;
      let endDate = customEndDate;

      if (timePeriod === "thisWeek") {
        startDate = moment().startOf("isoWeek").format("YYYY-MM-DD"); // Monday
        endDate = moment().endOf("isoWeek").format("YYYY-MM-DD"); // Sunday
      } else if (timePeriod === "thisMonth") {
        startDate = moment().startOf("month").format("YYYY-MM-DD");
        endDate = moment().endOf("month").format("YYYY-MM-DD");
      } else if (timePeriod === "active" || timePeriod === "year" || timePeriod === "session") {
        startDate = "";
        endDate = "";
      }

      let fileName = "";
      if (reportType === "room") {
        fileName = `room_${selectedRoomId}_${acadmeicYear}_${acadmeicSession}`;
      } else if (reportType === "building") {
        fileName = `building_${selectedBuildingId}_${acadmeicYear}_${acadmeicSession}`;
      } else if (reportType === "department") {
        fileName = `department_${selectedDepartment}_${acadmeicYear}_${acadmeicSession}`;
      } else if (reportType === "faculty") {
        fileName = `faculty_${selectedFaculty}_${acadmeicYear}_${acadmeicSession}`;
      }
      let isNeededToGenrate= false
      if(timePeriod === "active" || timePeriod === "thisWeek" || timePeriod === "thisMonth"){
        isNeededToGenrate = true;
      }

      const response = await fetch("/api/start-job", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileKey: fileName,
          roomID: selectedRoomId,
          reportType,
          isNeededToGenrate,
          buildingId: selectedBuildingId,
          departmentId: selectedDepartment,
          facultyId: selectedFaculty,
          subroomID: 0,
          academicYr: acadmeicYear,
          acadSess: acadmeicSession,
          startDate: startDate,
          endDate: endDate,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setJobId(data.jobId);
        setReady(false);
        setPolling(true);
        onClosePressed(); // Close the modal
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to start report generation");
      }
    } catch (error) {
      console.error("Error starting report generation:", error);
      setError("Network error occurred. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section className="fixed inset-0 z-50 h-screen w-screen bg-[#00000070] flex items-center justify-center text-gray-500">
      <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl p-6 transform transition-all duration-300 ease-in-out scale-95 md:scale-100">
        <div className="max-h-[80vh] bg-white pr-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-900 font-[550] text-sm">Generate Report</span>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
          <div className="border-t-2 border-gray-200 mt-2 pt-2 space-y-2">
            <div className="flex flex-col md:flex-row md:space-x-4">
              <div className="w-full">
                <label className="block text-sm text-gray-700 mb-1">Report type</label>
                <select
                  className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  value={reportType}
                  onChange={(e) => {
                    setReportType(e.target.value);
                  }}
                >
                  <option value="room">Room Report</option>
                  <option value="building">Building Report</option>
                  <option value="department">Department Report</option>
                  <option value="faculty">Faculty Report</option>
                </select>
              </div>
            </div>
            {(reportType === "room" || reportType === "building") && (
              <div className="flex flex-col md:flex-row md:space-x-4">
                <div className="w-full">
                  <label className="block text-sm text-gray-700 mb-1">Building</label>
                  <select
                    className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                    value={selectedBuildingId}
                    onChange={(e) => setSelectedBuildingId(e.target.value)}
                  >
                    <option value="">Select building</option>
                    <option value="allBuildings">All buildings</option>
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            {reportType === "room" && (
              <div className="flex flex-col md:flex-row md:space-x-4">
                <div className="md:w-1/2 w-full mt-4 md:mt-0">
                  <label className="block text-sm text-gray-700 mb-1">Floor</label>
                  <select
                    className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                    value={selectedFloorId}
                    onChange={(e) => setSelectedFloorId(e.target.value)}
                    disabled={!selectedBuildingId}
                  >
                    <option value="">Select floor</option>
                    {buildings.filter((b) => b.id === selectedBuildingId).length > 0
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
                  <label className="block text-sm text-gray-700 mb-1">Room</label>
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
            )}
            {
              <div className="flex flex-col md:flex-row md:space-x-4">
                {reportType === "department" && (
                  <div className="w-full mt-4 md:mt-0">
                    <label className="block text-sm text-gray-700 mb-1">Department</label>
                    <select
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      value={selectedDepartment}
                      onChange={(e) => {
                        setSelectedDepartment(e.target.value);
                      }}
                    >
                      <option value="">Select department</option>
                      {departments.map((f) => (
                        <option key={f.departmentId} value={f.departmentId}>
                          {f.departmentName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {reportType === "faculty" && (
                  <div className="w-full mt-4 md:mt-0">
                    <label className="block text-sm text-gray-700 mb-1">Faculty</label>
                    <select
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      value={selectedFaculty}
                      onChange={(e) => setSelectedFaculty(e.target.value)}
                    >
                      <option value="">Select faculty</option>
                      {faculties.map((r) => (
                        <option key={r.facultyId} value={r.facultyId}>
                          {`${r.facultyName} ( ${r.facultyId} )`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            }
            {timePeriod !== "custom" ? (
              <div className="flex flex-col md:flex-row md:space-x-4">
                <div className="md:w-1/2 w-full">
                  <label className="block text-sm text-gray-700 mb-1">Period</label>
                  <select
                    className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                    value={timePeriod}
                    onChange={(e) => setTimePeriod(e.target.value)}
                  >
                    <option value="">Select Duration</option>
                    <option value={"thisWeek"}>This Week</option>
                    <option value={"thisMonth"}>This Month</option>
                    <option value={"active"}>Active Session</option>
                    {/* <option value={"year"}>Academic Year</option> */}
                    <option value={"session"}>Academic Session</option>
                    {/* <option value={"custom"}>Custom Duration</option> */}
                  </select>
                </div>
                {timePeriod === "year" && (
                  <div className="md:w-1/2 w-full mt-4 md:mt-0">
                    <label className="block text-sm text-gray-700 mb-1">Year</label>
                    <select
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                    >
                      <option value="">Select year</option>
                      {academicYearsList?.map((y) => (
                        <option key={y.Code} value={y.Code}>
                          {y.Code}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {timePeriod === "session" && (
                  <div className="md:w-1/2 w-full mt-4 md:mt-0">
                    <label className="block text-sm text-gray-700 mb-1">Session</label>
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
                  <label className="block text-sm text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="md:w-1/2 w-full mt-4 md:mt-0">
                  <label className="block text-sm text-gray-700 mb-1">End Date</label>
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
              className={`px-3 py-2 rounded-lg shadow-md transition duration-300 ${
                isGenerateDisabled || isGenerating ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-orange-500 text-white hover:bg-orange-600"
              }`}
              onClick={handleSubmit}
              disabled={isGenerateDisabled || isGenerating}
            >
              {isGenerating ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Generating...
                </div>
              ) : (
                "Generate"
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
