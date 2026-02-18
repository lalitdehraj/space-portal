"use client";

import React, { useState, useEffect, useRef } from "react";
import SideNav from "@/components/SideNav";
import Header from "@/components/Header";
import useSideNavState from "@/hooks/useSideNavState";
import { Menu } from "lucide-react";
import { useSession } from "next-auth/react";
import { useSelector } from "react-redux";
import { RootState } from "@/app/store";
import { callApiViaProxy } from "@/utils/proxyApiIntercepter";
import { URL_NOT_FOUND, OBE_GET_EMPLOYEE_DETAILS_PATH, OBE_GET_COURSE_COORDINATOR_PATH } from "@/constants";
import { CourseCoordinatorRow, GetCourseCoordinatorResponse } from "@/types";

export type CourseOutcome = {
  Sno: number;
  "Sno Description": string;
  Description: string;
};

export type CourseOutcomeResponse =
  | CourseOutcome[]
  | {
      "Course Outcome"?: CourseOutcome[];
      value?: CourseOutcome[];
      [key: string]: unknown;
    };

// Response type for GetProgramOutcomeAndMappingValue (used in results section)
export interface POItem {
  id: string;
  description: string;
  Type: string; // "PO" | "PSO"
}

export interface POMappingItem {
  pOMapNo: string;
  outComeNo: string;
  coRelationValue: string;
}

export interface GetProgramOutcomeAndMappingResponse {
  POs: POItem[];
  POMappingList: POMappingItem[];
}

function OBEFormPage() {
  const { data: session } = useSession();
  const { isSideNavOpen, toggleSideNav } = useSideNavState();

  // Academic year and session from top header (Redux)
  const headerAcademicYear = useSelector((state: RootState) => state.dataState.selectedAcademicYear);
  const headerAcademicSession = useSelector((state: RootState) => state.dataState.selectedAcademicSession);

  // GetCourseCoOrdinator result - drives Program / Course Code / Semester dropdowns and Course ID
  const [coordinatorList, setCoordinatorList] = useState<CourseCoordinatorRow[]>([]);
  const [loadingCoordinator, setLoadingCoordinator] = useState(true);

  const [selectedCourseCode, setSelectedCourseCode] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [courseOutcomes, setCourseOutcomes] = useState<CourseOutcome[]>([]);
  const [loadingOutcomes, setLoadingOutcomes] = useState(false);
  const [selectedProgramCode, setSelectedProgramCode] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [outcomeValues, setOutcomeValues] = useState<Record<number, number | undefined>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calculationResult, setCalculationResult] = useState<{
    calculatedData?: {
      internalAttainment?: Record<string, unknown>;
      externalAttainment?: Record<string, unknown>;
      exactAttainment?: Record<string, unknown>;
      studentData?: Record<string, unknown>;
      [key: string]: unknown;
    };
  } | null>(null);
  const [calculationProgress, setCalculationProgress] = useState<number>(0);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [isCancelled, setIsCancelled] = useState<boolean>(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const shouldPollRef = useRef<boolean>(false);

  // Fetch GetEmployeDetails then GetCourseCoOrdinator to drive Program / Course Code / Semester (and Course ID from selected row)
  useEffect(() => {
    const email = session?.user?.email;
    if (!email) {
      setLoadingCoordinator(false);
      return;
    }
    let cancelled = false;
    setLoadingCoordinator(true);
    const loadCoordinatorList = async () => {
      try {
        const empRes = await callApiViaProxy<{
          values?: Array<{ employeeNo?: string; activeSession?: string; activeYear?: string }>;
        }>(OBE_GET_EMPLOYEE_DETAILS_PATH, {
          email,
        });
        if (cancelled || !empRes.success || !empRes.data?.values?.length) {
          if (!cancelled) setCoordinatorList([]);
          return;
        }
        const emp = empRes.data.values[0];
        const employeeNo = emp?.employeeNo;

        if (!employeeNo || !headerAcademicYear || !headerAcademicSession) {
          if (!cancelled) setCoordinatorList([]);
          return;
        }
        const coordRes = await callApiViaProxy<GetCourseCoordinatorResponse>(OBE_GET_COURSE_COORDINATOR_PATH, {
          acadYear: headerAcademicYear || emp.activeYear,
          acadSess: headerAcademicSession || emp.activeSession,
          facultyCode: employeeNo,
        });
        if (!cancelled && coordRes.success && coordRes.data?.values?.length) {
          setCoordinatorList(coordRes.data.values);
        } else if (!cancelled) {
          setCoordinatorList([]);
        }
      } catch (err) {
        console.error("loadCoordinatorList error:", err);
        if (!cancelled) setCoordinatorList([]);
      } finally {
        if (!cancelled) setLoadingCoordinator(false);
      }
    };
    loadCoordinatorList();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.email, headerAcademicYear, headerAcademicSession]);

  // Derived from GetCourseCoOrdinator: unique Program Codes
  const programCodesList = Array.from(new Set(coordinatorList.map((r) => r["Program Code"]).filter(Boolean))).sort();

  // After program selected: unique Course Codes for that program
  const courseCodesForProgram = !selectedProgramCode
    ? []
    : Array.from(
        new Set(
          coordinatorList
            .filter((r) => r["Program Code"] === selectedProgramCode)
            .map((r) => r["Course Code"])
            .filter(Boolean)
        )
      ).sort();

  // After program + course code selected: unique Semester Codes
  const semesterCodesForProgramCourse =
    !selectedProgramCode || !selectedCourseCode
      ? []
      : Array.from(
          new Set(
            coordinatorList
              .filter((r) => r["Program Code"] === selectedProgramCode && r["Course Code"] === selectedCourseCode)
              .map((r) => r["Semester Code"])
              .filter(Boolean)
          )
        ).sort();

  // When program + course code + semester selected, set Course ID from the matching row (no dropdown)
  useEffect(() => {
    if (!selectedProgramCode || !selectedCourseCode || !selectedSemester || !coordinatorList.length) {
      setSelectedCourseId("");
      return;
    }
    const row = coordinatorList.find(
      (r) => r["Program Code"] === selectedProgramCode && r["Course Code"] === selectedCourseCode && r["Semester Code"] === selectedSemester
    );
    setSelectedCourseId(row ? row["Course ID"] : "");
  }, [selectedProgramCode, selectedCourseCode, selectedSemester, coordinatorList]);

  // Reset course ID when course code changes
  useEffect(() => {
    setSelectedCourseId("");
    setCourseOutcomes([]);
    setOutcomeValues({});
  }, [selectedCourseCode]);

  // Fetch course outcomes (GetCourseOutcome) when course ID, year, session are selected
  useEffect(() => {
    if (!selectedCourseId || !headerAcademicYear || !headerAcademicSession) {
      setCourseOutcomes([]);
      setOutcomeValues({});
      setLoadingOutcomes(false);
      return;
    }
    const fetchCourseOutcomes = async () => {
      setLoadingOutcomes(true);
      try {
        const response = await callApiViaProxy<CourseOutcomeResponse>(process.env.NEXT_PUBLIC_GET_COURSE_OUTCOME || URL_NOT_FOUND, {
          acadSess: headerAcademicSession,
          acadYear: headerAcademicYear,
          courseID: selectedCourseId,
        });
        if (response.success && response.data) {
          const data = response.data as Record<string, unknown> | CourseOutcome[];
          let outcomesData: CourseOutcome[] = [];
          if (Array.isArray(data)) {
            outcomesData = data as CourseOutcome[];
          } else if (data && typeof data === "object" && data["Course Outcome"] && Array.isArray(data["Course Outcome"])) {
            outcomesData = data["Course Outcome"] as CourseOutcome[];
          } else if (data && typeof data === "object" && data.value && Array.isArray(data.value)) {
            outcomesData = data.value as CourseOutcome[];
          } else if (data && typeof data === "object") {
            const record = data as Record<string, unknown>;
            const arrayKey = Object.keys(record).find((key) => Array.isArray(record[key]) && (record[key] as unknown[]).length > 0);
            if (arrayKey) {
              outcomesData = record[arrayKey] as CourseOutcome[];
            }
          }
          setCourseOutcomes(outcomesData);
        } else {
          setCourseOutcomes([]);
        }
      } catch (err) {
        console.error("fetchCourseOutcomes error:", err);
        setCourseOutcomes([]);
      } finally {
        setLoadingOutcomes(false);
      }
    };
    fetchCourseOutcomes();
  }, [selectedCourseId, headerAcademicYear, headerAcademicSession]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      shouldPollRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate that all outcome values are provided
    const allOutcomesHaveValues = courseOutcomes.every((_, index) => outcomeValues[index] !== undefined);

    if (!allOutcomesHaveValues) {
      alert("Please fill in all outcome values before submitting.");
      return;
    }

    setIsSubmitting(true);
    setCalculationResult(null);
    setCalculationProgress(0);
    setIsCancelled(false);
    setCurrentJobId(null);

    // Clear any existing polling interval and stop polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    shouldPollRef.current = false;

    try {
      // Start the calculation job
      const response = await fetch("/api/calculate-co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseCode: selectedCourseCode,
          courseId: selectedCourseId,
          academicYear: headerAcademicYear,
          academicSession: headerAcademicSession,
          semester: selectedSemester,
          courseOutcomes: courseOutcomes,
          outcomeValues: (() => {
            const entries = Object.entries(outcomeValues);
            const values = entries.map(([, v]) => Number(v));
            const allInZeroToThree = values.length > 0 && values.every((v) => v >= 0 && v <= 3);
            return Object.fromEntries(
              entries.map(([k, v]) => {
                const num = Number(v);
                const sent = allInZeroToThree ? num : (num * 3) / 100;
                return [k, Math.round(sent * 100) / 100];
              })
            );
          })(),
          programCode: selectedProgramCode || undefined,
        }),
      });

      // Check if response is OK before parsing JSON
      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (!data.success || !data.jobId) {
        throw new Error(data.error || "Failed to start calculation");
      }

      const jobId = data.jobId;
      console.log("Calculation started with jobId:", jobId);

      if (!jobId) {
        throw new Error("No jobId received from server");
      }

      // Store current job ID
      setCurrentJobId(jobId);

      // Track when polling started
      const pollingStartTime = Date.now();

      // Enable polling
      shouldPollRef.current = true;

      // Small delay before first poll to ensure job is fully created on server
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Helper function to stop polling
      const stopPolling = () => {
        console.log("Stopping polling for jobId:", jobId);
        shouldPollRef.current = false;
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };

      // Start polling for status
      const pollStatus = async () => {
        // Check if polling should continue - exit early if stopped
        if (!shouldPollRef.current) {
          console.log("Polling stopped, exiting pollStatus");
          return;
        }

        try {
          // UUIDs don't need encoding, but encodeURIComponent is safe and Next.js will decode automatically
          // However, let's use the jobId directly in the URL - Next.js handles it properly
          const statusUrl = `/api/calculate-co/status?jobId=${jobId}`;
          const pollingDuration = Date.now() - pollingStartTime;
          console.log(`[Poll ${pollingDuration}ms] Checking status for jobId: ${jobId}`);

          const statusResponse = await fetch(statusUrl);

          // Check if response is OK before parsing JSON
          if (!statusResponse.ok) {
            const statusText = statusResponse.statusText;
            let errorMessage = `HTTP error! status: ${statusResponse.status}`;
            try {
              const errorData = await statusResponse.json();
              errorMessage = errorData.error || errorMessage;
            } catch (e) {
              errorMessage = statusText || errorMessage;
            }

            // If 404, it might be a timing issue - check how long we've been polling
            if (statusResponse.status === 404) {
              console.warn(`[Poll] Job not found (404) for jobId: ${jobId} after ${pollingDuration}ms. This might be a timing issue.`);

              // If we've been polling for more than 10 seconds, something is wrong
              if (pollingDuration > 10000) {
                console.error("Job not found after 10 seconds. Stopping polling.");
                stopPolling();
                setIsSubmitting(false);
                setCalculationProgress(0);
                alert("Job not found. The calculation may have failed. Please try submitting again.");
                return;
              }

              // Otherwise, just return and retry on next interval
              return;
            }

            throw new Error(errorMessage);
          }

          const statusData = await statusResponse.json();

          if (!statusData.success) {
            throw new Error(statusData.error || "Failed to get job status");
          }

          // Update progress
          if (statusData.progress !== undefined) {
            setCalculationProgress(statusData.progress);
          }

          // Check if job is complete, failed, or cancelled - stop polling
          if (statusData.status === "completed") {
            // Stop polling immediately
            stopPolling();

            // Update UI with result
            setCalculationResult(statusData.result);
            setIsSubmitting(false);
            setCurrentJobId(null);
            console.log("Calculation completed. Polling stopped.");
            return;
          } else if (statusData.status === "failed") {
            // Stop polling immediately
            stopPolling();

            setIsSubmitting(false);
            setCalculationProgress(0);
            setCurrentJobId(null);
            alert(`Calculation failed: ${statusData.error || "Unknown error"}`);
            console.error("Calculation failed. Polling stopped.");
            return;
          } else if (statusData.status === "cancelled") {
            // Stop polling immediately
            stopPolling();

            setIsSubmitting(false);
            setCalculationProgress(0);
            setIsCancelled(true);
            setCurrentJobId(null);
            console.log("Calculation cancelled. Polling stopped.");
            return;
          }
          // If status is "pending" or "processing", continue polling
          console.log(`Job status: ${statusData.status}, progress: ${statusData.progress}%`);
        } catch (error) {
          console.error("Polling error:", error);
          // For other errors (not 404), log but continue polling (might be transient network issues)
          // 404 errors are already handled above
          const pollingDuration = Date.now() - pollingStartTime;

          // If we've been polling for a very long time with errors, stop
          if (pollingDuration > 30000) {
            console.error("Polling errors persist after 30 seconds. Stopping.");
            stopPolling();
            setIsSubmitting(false);
            setCalculationProgress(0);
            alert("An error occurred while checking calculation status. Please try submitting again.");
          }
        }
      };

      // Poll immediately, then set up interval
      pollStatus();

      // Set up interval to poll every 2 seconds
      const interval = setInterval(() => {
        // Check if polling should continue
        if (!shouldPollRef.current) {
          // If polling stopped, clear interval and exit
          console.log("Polling stopped, clearing interval");
          if (pollingIntervalRef.current === interval) {
            clearInterval(interval);
            pollingIntervalRef.current = null;
          }
          return;
        }
        // Continue polling
        pollStatus();
      }, 2000);
      pollingIntervalRef.current = interval;
    } catch (error) {
      console.error("Submit error:", error);
      // Stop polling on error
      shouldPollRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setIsSubmitting(false);
      setCalculationProgress(0);
      alert(`An error occurred while submitting: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // Handle cancel calculation
  const handleCancel = async () => {
    if (!currentJobId) {
      return;
    }

    try {
      // Stop polling immediately
      shouldPollRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      // Call cancel endpoint
      const cancelResponse = await fetch(`/api/calculate-co?jobId=${currentJobId}`, {
        method: "DELETE",
      });

      if (cancelResponse.ok) {
        const cancelData = await cancelResponse.json();
        if (cancelData.success) {
          setIsCancelled(true);
          setIsSubmitting(false);
          setCurrentJobId(null);
          console.log("Calculation cancelled successfully");
        } else {
          console.error("Failed to cancel:", cancelData.error);
          alert(`Failed to cancel calculation: ${cancelData.error || "Unknown error"}`);
        }
      } else {
        console.error("Cancel request failed:", cancelResponse.status);
        // Even if the API call fails, we've stopped polling
        setIsCancelled(true);
        setIsSubmitting(false);
        setCurrentJobId(null);
      }
    } catch (error) {
      console.error("Error cancelling calculation:", error);
      // Even if there's an error, we've stopped polling
      setIsCancelled(true);
      setIsSubmitting(false);
      setCurrentJobId(null);
      alert("Error cancelling calculation. Polling has been stopped.");
    }
  };

  // Reset calculation results and polling when any dropdown changes (so we don't show stale results)
  const resetCalculationState = () => {
    shouldPollRef.current = false;
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setCalculationResult(null);
    setCalculationProgress(0);
    setCurrentJobId(null);
    setIsCancelled(false);
  };

  // Handle form reset (for the lower clear button)
  const handleResetForm = () => {
    // Stop any polling (shouldn't happen if button is disabled correctly, but safety check)
    shouldPollRef.current = false;
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Reset form state (academic year/session stay from header)
    setSelectedProgramCode("");
    setSelectedSemester("");
    setSelectedCourseCode("");
    setSelectedCourseId("");
    setCourseOutcomes([]);
    setOutcomeValues({});
    setCalculationResult(null);
    setCalculationProgress(0);
    setCurrentJobId(null);
    setIsCancelled(false);
    setIsSubmitting(false);

    console.log("Form reset successfully");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-500 font-sans md:grid md:grid-cols-[256px_1fr] text-gray-500">
      <div
        className={`fixed inset-y-0 left-0 z-50 w-full transform bg-gray-500 transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isSideNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SideNav onClose={toggleSideNav} />
      </div>

      {isSideNavOpen && <div className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden" onClick={toggleSideNav} />}

      <div className="flex flex-1 flex-col bg-white">
        <div className="sticky top-0 z-30 flex w-full items-center justify-between border-b p-4 shadow-sm md:hidden bg-white">
          <button onClick={toggleSideNav} className="text-gray-900">
            <Menu size={24} />
          </button>
          <h1 className="text-xl font-bold text-gray-800">Calculate CO</h1>
          <div className="w-6" />
        </div>

        <div className="hidden md:block">
          <Header />
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <section className="mb-8">
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Calculate CO Form</h2>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  {/* Programme Code (from GetCourseCoOrdinator) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Programme Code</label>
                    <select
                      value={selectedProgramCode}
                      onChange={(e) => {
                        setSelectedProgramCode(e.target.value);
                        setSelectedSemester("");
                        setSelectedCourseCode("");
                        setSelectedCourseId("");
                        setCourseOutcomes([]);
                        setOutcomeValues({});
                        resetCalculationState();
                      }}
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                      disabled={loadingCoordinator || !coordinatorList.length}
                    >
                      <option value="">{loadingCoordinator ? "Loading..." : !coordinatorList.length ? "No coordinator data" : "Select Programme Code"}</option>
                      {programCodesList.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Course Code (from GetCourseCoOrdinator, filtered by programme) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Course Code</label>
                    <select
                      value={selectedCourseCode}
                      onChange={(e) => {
                        setSelectedCourseCode(e.target.value);
                        setSelectedSemester("");
                        setSelectedCourseId("");
                        setCourseOutcomes([]);
                        setOutcomeValues({});
                        resetCalculationState();
                      }}
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                      disabled={!selectedProgramCode}
                    >
                      <option value="">{!selectedProgramCode ? "Select Programme Code first" : "Select Course Code"}</option>
                      {courseCodesForProgram.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Semester (from GetCourseCoOrdinator, filtered by programme + course code) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
                    <select
                      value={selectedSemester}
                      onChange={(e) => {
                        setSelectedSemester(e.target.value);
                        setSelectedCourseId("");
                        setCourseOutcomes([]);
                        setOutcomeValues({});
                        resetCalculationState();
                      }}
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                      disabled={!selectedCourseCode}
                    >
                      <option value="">{!selectedCourseCode ? "Select Course Code first" : "Select Semester"}</option>
                      {semesterCodesForProgramCourse.map((sem) => (
                        <option key={sem} value={sem}>
                          {sem}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Course ID is set automatically from selected row (no dropdown) */}
                </div>

                {/* Course Outcomes Table */}
                {selectedCourseId && headerAcademicYear && headerAcademicSession && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Course Feedback</h3>

                    <div className="bg-white rounded-lg shadow-md p-2 border border-gray-200 w-full">
                      <table className="min-w-full text-sm text-gray-700">
                        <thead>
                          <tr className="bg-gray-100 text-left">
                            <th className="px-4 py-2">CO.No.</th>
                            <th className="px-4 py-2">Description</th>
                            <th className="px-4 py-2 flex items-center">
                              Average Feedback
                              <p className="text-xs ml-2 text-gray-500">(Enter 0–3 or 0–100 )</p>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="text-[13px]">
                          {loadingOutcomes ? (
                            <tr>
                              <td colSpan={3} className="text-center py-8">
                                <div className="flex items-center justify-center space-x-2">
                                  <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                  <span className="text-gray-600">Loading course outcomes...</span>
                                </div>
                              </td>
                            </tr>
                          ) : courseOutcomes.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="text-center py-4">
                                No course outcomes available.
                              </td>
                            </tr>
                          ) : (
                            courseOutcomes.map((outcome, index) => (
                              <tr key={index}>
                                <td className="px-4 py-2">{outcome["Sno Description"] || ""}</td>
                                <td className="px-4 py-2">{outcome.Description || ""}</td>
                                <td className="px-4 py-2">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={outcomeValues[index] ?? ""}
                                    onChange={(e) => {
                                      const value = parseFloat(e.target.value);
                                      if ((value >= 0 && value <= 100) || e.target.value === "") {
                                        setOutcomeValues((prev) => {
                                          const newValues = { ...prev };
                                          if (e.target.value === "") {
                                            delete newValues[index];
                                          } else {
                                            newValues[index] = value;
                                          }
                                          return newValues;
                                        });
                                      }
                                    }}
                                    className="w-full px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                    placeholder="0"
                                  />
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Calculation Progress */}
                {isSubmitting && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Calculating...</h3>
                    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                        <div className="bg-orange-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${calculationProgress}%` }}></div>
                      </div>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-gray-600">Progress: {calculationProgress}%</p>
                        <button
                          type="button"
                          onClick={handleCancel}
                          className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition duration-200 text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cancelled Message */}
                {isCancelled && !isSubmitting && (
                  <div className="mt-8">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">Calculation has been cancelled.</p>
                    </div>
                  </div>
                )}

                {/* Calculation Results (id used for print-only targeting) */}
                {calculationResult && !isSubmitting && (
                  <div id="calculation-results-print" className="mt-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Calculation Results</h3>
                    <div className="bg-white rounded-lg p-6 border border-gray-200">
                      {(() => {
                        const calculatedData = calculationResult?.calculatedData;
                        if (!calculatedData) return null;

                        // Calculate total unique students across all exam methods
                        const allStudentNumbers = new Set<string>();
                        if (calculatedData.studentData) {
                          Object.values(calculatedData.studentData).forEach((students: unknown) => {
                            if (Array.isArray(students)) {
                              students.forEach((student: { studentNo?: string }) => {
                                if (student.studentNo) {
                                  allStudentNumbers.add(student.studentNo);
                                }
                              });
                            }
                          });
                        }
                        const totalStudents = allStudentNumbers.size;

                        // Get all COs from courseOutcomes (all 5 COs)
                        // Use courseOutcomes from the component state to get all COs
                        const allCOsFromOutcomes = courseOutcomes.map((outcome) => outcome["Sno Description"]);

                        // Helper function to convert decimal to percentage
                        const toPercentage = (value: number | undefined, showDash: boolean = false): string => {
                          if (value === undefined || value === null) {
                            return showDash ? "-" : "0.00";
                          }
                          return (value * 100).toFixed(2);
                        };

                        // Helper function to format coAttainmentLevel (levels: 1, 2, or 3)
                        const formatAttainmentLevel = (value: number | undefined): string => {
                          if (value === undefined || value === null || value === 0) return "0";
                          return Math.round(value).toString();
                        };

                        // Helper function to check if a CO has calculated values
                        const hasCalculatedValues = (co: string): boolean => {
                          return (
                            calculatedData.internalAttainment?.[co] !== undefined ||
                            calculatedData.externalAttainment?.[co] !== undefined ||
                            calculatedData.exactAttainment?.[co] !== undefined
                          );
                        };

                        const sortedCOs = allCOsFromOutcomes.sort();

                        // All POs sorted by name (left to right); prefer full list from API, else fallback to mapped POs
                        const poListFromApi = (calculatedData.POs || []) as POItem[];
                        const mappedPOIds = Object.keys(calculatedData.poSumPerPO || {});
                        const allPOIdsSorted = (poListFromApi.length > 0 ? poListFromApi.map((p) => p.id) : mappedPOIds).sort((a, b) =>
                          a.localeCompare(b, undefined, { numeric: true })
                        );

                        return (
                          <div className="space-y-6">
                            {/* Program code, Course code, Academic session, Batch year, Total students — one gray section */}
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-0">
                              <div className="flex items-center justify-between py-2 first:pt-0">
                                <span className="text-sm font-medium text-gray-700">Program code:</span>
                                <span className="text-lg font-bold text-gray-900">{selectedProgramCode || "—"}</span>
                              </div>
                              <div className="border-t border-gray-200" />
                              <div className="flex items-center justify-between py-2">
                                <span className="text-sm font-medium text-gray-700">Course code:</span>
                                <span className="text-lg font-bold text-gray-900">{selectedCourseCode || "—"}</span>
                              </div>
                              <div className="border-t border-gray-200" />
                              <div className="flex items-center justify-between py-2">
                                <span className="text-sm font-medium text-gray-700">Academic session:</span>
                                <span className="text-lg font-bold text-gray-900">{headerAcademicSession || "—"}</span>
                              </div>
                              <div className="border-t border-gray-200" />
                              <div className="flex items-center justify-between py-2">
                                <span className="text-sm font-medium text-gray-700">Semester:</span>
                                <span className="text-lg font-bold text-gray-900">{selectedSemester || "—"}</span>
                              </div>
                              <div className="border-t border-gray-200" />
                              <div className="flex items-center justify-between py-2 last:pb-0">
                                <span className="text-sm font-medium text-gray-700">Total Students:</span>
                                <span className="text-lg font-bold text-gray-900">{totalStudents}</span>
                              </div>
                            </div>

                            {/* CO Attainment Table (same style as PO tables: green header/first column, orange data cells) */}
                            <div className="bg-white rounded-lg p-2 border border-gray-200 w-full overflow-x-auto">
                              <table className="min-w-full text-sm text-gray-800 border-collapse">
                                <thead>
                                  <tr className="bg-green-200 border border-green-300">
                                    <th className="px-3 py-2 text-left font-semibold border border-green-300 min-w-16">CO.No.</th>
                                    <th className="px-3 py-2 text-center font-semibold border border-green-300">Internal Attainment (%)</th>
                                    <th className="px-3 py-2 text-center font-semibold border border-green-300">External Attainment (%)</th>
                                    <th className="px-3 py-2 text-center font-semibold border border-green-300">Exact Attainment (%)</th>
                                    <th className="px-3 py-2 text-center font-semibold border border-green-300">CO Attainment Level</th>
                                  </tr>
                                </thead>
                                <tbody className="text-[13px]">
                                  {sortedCOs.length === 0 ? (
                                    <tr>
                                      <td colSpan={5} className="text-center py-8 text-gray-500 border border-orange-200 bg-orange-50">
                                        No course outcomes available
                                      </td>
                                    </tr>
                                  ) : (
                                    sortedCOs.map((co) => {
                                      const hasValues = hasCalculatedValues(co);
                                      const internal = calculatedData.internalAttainment?.[co];
                                      const external = calculatedData.externalAttainment?.[co];
                                      const exact = calculatedData.exactAttainment?.[co];
                                      const attainmentLevel = calculatedData.coAttainmentLevel?.[co];

                                      return (
                                        <tr key={co}>
                                          <td className="px-3 py-2 font-medium bg-green-200 border border-green-300">{co}</td>
                                          <td className="px-3 py-2 text-center border border-orange-200 bg-orange-50">
                                            {hasValues ? `${toPercentage(internal)}%` : "-"}
                                          </td>
                                          <td className="px-3 py-2 text-center border border-orange-200 bg-orange-50">
                                            {hasValues ? `${toPercentage(external)}%` : "-"}
                                          </td>
                                          <td className="px-3 py-2 text-center border border-orange-200 bg-orange-50">
                                            {hasValues ? `${toPercentage(exact)}%` : "-"}
                                          </td>
                                          <td className="px-3 py-2 text-center border border-orange-200 bg-orange-50">
                                            {hasValues ? formatAttainmentLevel(attainmentLevel) : "-"}
                                          </td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                            </div>

                            {/* PO to CO Map Table (green header, orange data cells - Excel style); all POs sorted by name */}
                            {calculatedData.poToCoMap && Object.keys(calculatedData.poToCoMap).length > 0 && allPOIdsSorted.length > 0 && (
                              <div className="bg-white rounded-lg p-2 border border-gray-200 w-full overflow-x-auto">
                                <table className="min-w-full text-sm text-gray-800 border-collapse">
                                  <thead>
                                    <tr className="bg-green-200 border border-green-300">
                                      <th className="px-3 py-2 text-left font-semibold border border-green-300 min-w-16">CO</th>
                                      {allPOIdsSorted.map((poId) => (
                                        <th key={poId} className="px-3 py-2 text-center font-semibold border border-green-300 whitespace-nowrap">
                                          {poId}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="text-[13px]">
                                    {Object.entries(calculatedData.poToCoMap).map(([coId, row]) => {
                                      const poRow = row as Record<string, number | "--">;
                                      return (
                                        <tr key={coId}>
                                          <td className="px-3 py-2 font-medium bg-green-200 border border-green-300">{coId}</td>
                                          {allPOIdsSorted.map((poId) => {
                                            const val = poRow[poId];
                                            return (
                                              <td key={poId} className="px-3 py-2 text-center border border-orange-200 bg-orange-50">
                                                {typeof val === "number" ? val.toFixed(2) : val === "--" ? "--" : "—"}
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* PO Sum and Average table (Excel style); all POs sorted by name */}
                            {allPOIdsSorted.length > 0 && (
                              <div className="bg-white rounded-lg p-2 border border-gray-200 w-full overflow-x-auto">
                                <table className="min-w-full text-sm text-gray-700 border-collapse">
                                  <thead>
                                    <tr className="bg-green-200 border border-green-300">
                                      <th className="px-4 py-2 font-semibold text-left border border-green-300 w-24"> </th>
                                      {allPOIdsSorted.map((poId) => (
                                        <th key={poId} className="px-2 py-2 text-center font-semibold border border-green-300">
                                          {poId}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="text-[13px]">
                                    <tr className="bg-gray-50 border border-gray-200">
                                      <td className="px-4 py-2 font-medium text-gray-700 border border-gray-200">PO Sum</td>
                                      {allPOIdsSorted.map((poId) => {
                                        const sum = (calculatedData.poSumPerPO as Record<string, number> | undefined)?.[poId];
                                        return (
                                          <td key={poId} className="px-4 py-2 text-center font-medium text-gray-900 border border-gray-200">
                                            {typeof sum === "number" ? sum.toFixed(2) : "—"}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                    <tr className="bg-gray-100 border border-gray-200">
                                      <td className="px-4 py-2 font-medium text-gray-700 border border-gray-200">Average</td>
                                      <td colSpan={allPOIdsSorted.length} className="px-4 py-2 text-center font-medium text-gray-900 border border-gray-200">
                                        {typeof calculatedData.poAverageValue === "number" ? calculatedData.poAverageValue.toFixed(2) : "—"}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Buttons: Print when results exist, otherwise Submit and Clear */}
                <div className="flex justify-end space-x-3 pt-4">
                  {calculationResult && !isSubmitting ? (
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="px-4 py-2 rounded-lg shadow-md transition duration-300 bg-orange-500 text-white hover:bg-orange-600 text-sm font-medium"
                    >
                      Print
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleResetForm}
                        disabled={isSubmitting}
                        className="px-4 py-2 rounded-lg bg-gray-300 text-gray-700 hover:bg-gray-400 transition duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Clear
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg shadow-md transition duration-300 bg-orange-500 text-white hover:bg-orange-600 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={
                          !selectedCourseId ||
                          !selectedCourseCode ||
                          !headerAcademicYear ||
                          !headerAcademicSession ||
                          isSubmitting ||
                          courseOutcomes.length === 0 ||
                          !courseOutcomes.every((_, index) => outcomeValues[index] !== undefined)
                        }
                      >
                        {isSubmitting ? "Calculating..." : "Submit"}
                      </button>
                    </>
                  )}
                </div>
              </form>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default OBEFormPage;
