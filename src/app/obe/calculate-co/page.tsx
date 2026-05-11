"use client";

import React, { useState, useEffect, useRef } from "react";
import SideNav from "@/components/SideNav";
import Header from "@/components/Header";
import useSideNavState from "@/hooks/useSideNavState";
import { Menu } from "lucide-react";
import { useSession } from "next-auth/react";
import { useSelector } from "react-redux";
import { RootState } from "@/app/store";
import { CoAttainmentResultView } from "@/components/CoAttainmentResultView";
import { callApiViaProxy } from "@/utils/proxyApiIntercepter";
import { buildCourseExitFeedbackGetUrl, COURSE_EXIT_FEEDBACK_POST_URL } from "@/utils/courseExitFeedbackApi";
import {
  COPO_BLOB_GET_URL_TEST,
  COPO_BLOB_SAVE_URL_TEST,
  base64Utf8ToJson,
  extractBase64FromCOPOApiResponse,
  jsonToBase64Utf8,
} from "@/utils/coPoAttainmentBlobApi";
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

type CourseExitFeedbackItem = {
  coNo?: string;
  feedbackValue?: number | string;
};

function normalizeCourseExitCoNo(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function normalizeOutcomeValuesForSubmission(outcomeValues: Record<number, number | undefined>): Record<string, number> {
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
  const [lockedFeedbackIndexes, setLockedFeedbackIndexes] = useState<Record<number, boolean>>({});
  const [loadingFeedbackValues, setLoadingFeedbackValues] = useState(false);
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
          email: "kusumlata.jain@jaipur.manipal.edu",
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
      setLockedFeedbackIndexes({});
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

  useEffect(() => {
    if (!selectedProgramCode || !selectedCourseCode || !headerAcademicYear || !headerAcademicSession || courseOutcomes.length === 0) {
      setLockedFeedbackIndexes({});
      if (courseOutcomes.length === 0) setOutcomeValues({});
      setLoadingFeedbackValues(false);
      return;
    }
    let cancelled = false;
    const fetchExistingFeedback = async () => {
      setLoadingFeedbackValues(true);
      try {
        const endpoint = buildCourseExitFeedbackGetUrl({
          acadYear: headerAcademicYear,
          acadSession: headerAcademicSession,
          courseId: selectedCourseCode,
          programCode: selectedProgramCode,
        });
        const res = await callApiViaProxy<unknown>(endpoint, undefined, undefined, "GET");
        if (cancelled) return;
        const rows = Array.isArray(res.data) ? (res.data as CourseExitFeedbackItem[]) : [];
        const byCo = new Map<string, number>();
        rows.forEach((r) => {
          const key = normalizeCourseExitCoNo(r.coNo);
          const v = Number(r.feedbackValue);
          if (key && Number.isFinite(v)) byCo.set(key, v);
        });
        const prefilled: Record<number, number | undefined> = {};
        const locked: Record<number, boolean> = {};
        courseOutcomes.forEach((co, index) => {
          const key = normalizeCourseExitCoNo(co["Sno Description"]);
          const existing = byCo.get(key);
          if (existing !== undefined) {
            prefilled[index] = existing;
            locked[index] = true;
          }
        });
        setOutcomeValues((prev) => {
          const next: Record<number, number | undefined> = {};
          courseOutcomes.forEach((_, index) => {
            if (locked[index]) next[index] = prefilled[index];
            else if (prev[index] !== undefined) next[index] = prev[index];
          });
          return next;
        });
        setLockedFeedbackIndexes(locked);
      } catch (err) {
        if (!cancelled) {
          console.error("fetchExistingFeedback error:", err);
          setLockedFeedbackIndexes({});
        }
      } finally {
        if (!cancelled) setLoadingFeedbackValues(false);
      }
    };
    fetchExistingFeedback();
    return () => {
      cancelled = true;
    };
  }, [selectedProgramCode, selectedCourseCode, headerAcademicYear, headerAcademicSession, courseOutcomes]);

  useEffect(() => {
    if (!selectedProgramCode || !selectedCourseId || !headerAcademicYear || !headerAcademicSession) return;
    if (isSubmitting) return;
    let cancelled = false;
    const loadSavedAttainment = async () => {
      try {
        const res = await callApiViaProxy<unknown>(
          COPO_BLOB_GET_URL_TEST,
          {
            academicYear: headerAcademicYear,
            academicSession: headerAcademicSession,
            courseId: selectedCourseId,
            programCode: selectedProgramCode,
          },
          undefined,
          "POST"
        );
        if (cancelled || !res.success || res.data == null) return;
        const b64 = extractBase64FromCOPOApiResponse(res.data);
        if (!b64) return;
        if (cancelled) return;
        const parsed = base64Utf8ToJson<{ calculatedData?: Record<string, unknown>; message?: string }>(b64);
        if (cancelled) return;
        setCalculationResult((prev) => prev ?? parsed);
      } catch {
        /* ignore missing blob */
      }
    };
    loadSavedAttainment();
    return () => {
      cancelled = true;
    };
  }, [selectedProgramCode, selectedCourseId, headerAcademicYear, headerAcademicSession, isSubmitting]);

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
          outcomeValues: normalizeOutcomeValuesForSubmission(outcomeValues),
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

            const completedResult = statusData.result as { calculatedData?: Record<string, unknown>; message?: string } | undefined;
            if (completedResult) {
              try {
                const base64Value = jsonToBase64Utf8(completedResult);
                const safeName = `COPO_${selectedCourseCode}_${headerAcademicYear}`.replace(/[^a-zA-Z0-9_-]/g, "_");
                const blobSave = await callApiViaProxy<unknown>(
                  COPO_BLOB_SAVE_URL_TEST,
                  {
                    academicYear: headerAcademicYear,
                    academicSession: headerAcademicSession,
                    courseId: selectedCourseId,
                    programCode: selectedProgramCode,
                    base64Value,
                    fileName: safeName || "COPO",
                    fileExtension: ".json",
                  },
                  undefined,
                  "POST"
                );
                if (!blobSave.success) {
                  console.error("Save COPO attainment blob failed:", blobSave.error);
                }
              } catch (err) {
                console.error("Save COPO attainment blob error:", err);
              }
            }

            const normalizedOutcomeValues = normalizeOutcomeValuesForSubmission(outcomeValues);
            const savePayloads = courseOutcomes
              .map((co, index) => ({ co, index }))
              .filter(({ index }) => !lockedFeedbackIndexes[index] && normalizedOutcomeValues[String(index)] !== undefined)
              .map(({ co, index }) => ({
                acadYear: headerAcademicYear,
                acadSession: headerAcademicSession,
                courseId: selectedCourseCode,
                programCode: selectedProgramCode,
                coNo: String(co["Sno Description"] ?? "").trim(),
                feedbackValue: normalizedOutcomeValues[String(index)],
              }))
              .filter((x) => x.coNo);
            if (savePayloads.length > 0) {
              const saveResults = await Promise.all(
                savePayloads.map((payload) => callApiViaProxy<unknown>(COURSE_EXIT_FEEDBACK_POST_URL, payload, undefined, "POST"))
              );
              const failed = saveResults.filter((r) => !r.success);
              if (failed.length > 0) {
                console.error("Some feedback values could not be saved:", failed.map((f) => f.error));
                alert("Calculation completed, but some feedback values could not be saved.");
              } else {
                const nextLocked = { ...lockedFeedbackIndexes };
                courseOutcomes.forEach((_, index) => {
                  if (normalizedOutcomeValues[String(index)] !== undefined) nextLocked[index] = true;
                });
                setLockedFeedbackIndexes(nextLocked);
              }
            }

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
    setLockedFeedbackIndexes({});
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
                          ) : loadingFeedbackValues ? (
                            <tr>
                              <td colSpan={3} className="text-center py-8">
                                <div className="flex items-center justify-center space-x-2">
                                  <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                  <span className="text-gray-600">Loading existing feedback values...</span>
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
                                    disabled={Boolean(lockedFeedbackIndexes[index])}
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
                                    className="w-full px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 disabled:bg-gray-100 disabled:text-gray-500"
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
                      <CoAttainmentResultView
                        result={calculationResult}
                        programCode={selectedProgramCode}
                        courseCode={selectedCourseCode}
                        academicSession={headerAcademicSession || ""}
                        semester={selectedSemester}
                      />
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
