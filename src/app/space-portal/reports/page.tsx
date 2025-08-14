"use client";
import React, { useEffect, useState } from "react";
import Pagination from "@/components/PageNumberIndicator";
import { api, callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { useSelector } from "react-redux";
import { Report } from "@/types";
import { formatDate } from "@/utils";

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
    console.log("filteredList: ", filteredList);
    const sortedList = sortData(
      filteredList,
      activeHeader as keyof Report,
      sortState
    );
    setFilteredList(sortedList);
  }, [reportsList, activeHeader, sortState, searchQuery]);

  const [totalPages, setTotalPages] = useState(0);
  useEffect(() => {
    const fetchReports = async () => {
      let response = await callApi<ReportsResponse>(
        api.get(`${process.env.NEXT_PUBLIC_GET_REPORTS}` || URL_NOT_FOUND, {
          params: {
            limit: pageSize,
            offset: curruntPage,
            acadmeicSession: acadmeicSession,
            acadmeicYear: acadmeicYear,
          },
        })
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
    </>
  );
}
