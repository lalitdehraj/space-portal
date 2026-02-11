"use client";

import React, { useState, useEffect, useRef } from "react";
import SideNav from "@/components/SideNav";
import Header from "@/components/Header";
import useSideNavState from "@/hooks/useSideNavState";
import { Menu } from "lucide-react";
import { callApiViaProxy } from "@/utils/proxyApiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { AcademicYear, AcademicSession } from "@/types";

export type AcademicYearResponse = {
  "Academic Year": AcademicYear[];
};

export type AcademicSessionResponse = {
  "Academic Session": AcademicSession[];
};

export type Course = {
  "Course ID": string;
  "Course Code": string;
  "Subject Code"?: string; // Add this for API response
  Description?: string; // Add this for API response
  ThresHold: number;
};

export type CourseListResponse =
  | Course[]
  | { value?: Course[]; [key: string]: any };

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
      [key: string]: any;
    };
export type ProgramCodeItem = {
  code: string;
  description: string;
  academicYears: string[];
  /** Faculty code/id - API may use facultyCode or facultyId */
  facultyCode?: string;
  facultyId?: string;
};

export type ProgramCodeResponse = {
  programCode: ProgramCodeItem[];
};

/** Normalize raw program item from API (handles facultyCode/facultyId and casing) */
function normalizeProgramItem(raw: Record<string, unknown>): ProgramCodeItem {
  const code = (raw.code ?? raw.Code) as string;
  const description = (raw.description ?? raw.Description) as string;
  const academicYears = (raw.academicYears ??
    raw.AcademicYears ??
    []) as string[];
  const facultyCode = (raw.facultyCode ?? raw.FacultyCode) as
    | string
    | undefined;
  const facultyId = (raw.facultyId ?? raw.FacultyId) as string | undefined;
  return { code, description, academicYears, facultyCode, facultyId };
}

export type FacultyDepartmentItem = {
  facultyId: string;
  facultyName: string;
};

/** GetCourseListOBE: empty facultyCode → faculties; with facultyCode → programme + semester */
export type CourseListOBEFacultyValue = { "Faculty Code": string };
export type CourseListOBEProgrammeValue = {
  "Programme Code": string;
  Semester: string;
};
export type CourseListOBEResponse =
  | { values: CourseListOBEFacultyValue[] }
  | { values: CourseListOBEProgrammeValue[] };

// Response type for GetProgramOutcomeAndMappingValue
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
  const { isSideNavOpen, toggleSideNav } = useSideNavState();

  // Local state for form-specific academic year and session (separate from navbar)
  const [formAcademicYear, setFormAcademicYear] = useState<string>("");
  const [formAcademicSession, setFormAcademicSession] = useState<string>("");

  // Local state
  const [academicYearsList, setAcademicYearsList] = useState<
    AcademicYear[] | undefined
  >();
  const [academicSessionsList, setAcademicSessionsList] = useState<
    AcademicSession[] | undefined
  >();
  const [sessionsPerYear, setSessionsPerYear] = useState<string[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseCode, setSelectedCourseCode] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [batchYear, setBatchYear] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [courseOutcomes, setCourseOutcomes] = useState<CourseOutcome[]>([]);
  const [loadingOutcomes, setLoadingOutcomes] = useState(false);
  const [programsList, setProgramsList] = useState<ProgramCodeItem[]>([]);
  const [selectedProgramCode, setSelectedProgramCode] = useState<string>("");
  const [facultyDepartmentsList, setFacultyDepartmentsList] = useState<
    FacultyDepartmentItem[]
  >([]);
  const [selectedFacultyCode, setSelectedFacultyCode] = useState<string>("");
  const [facultyCodesFromOBE, setFacultyCodesFromOBE] = useState<string[]>([]);
  const [loadingFacultiesOBE, setLoadingFacultiesOBE] = useState(false);
  const [programmeSemesterList, setProgrammeSemesterList] = useState<
    CourseListOBEProgrammeValue[]
  >([]);
  const [loadingProgrammeOBE, setLoadingProgrammeOBE] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [outcomeValues, setOutcomeValues] = useState<
    Record<number, number | undefined>
  >({});
  const [threshold, setThreshold] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calculationResult, setCalculationResult] = useState<any>(null);
  const [calculationProgress, setCalculationProgress] = useState<number>(0);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [isCancelled, setIsCancelled] = useState<boolean>(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const shouldPollRef = useRef<boolean>(false);

  // Fetch academic years and sessions
  useEffect(() => {
    const getAcademicCalendar = async () => {
      try {
        const responseYear = await callApiViaProxy<AcademicYearResponse>(
          process.env.NEXT_PUBLIC_GET_ACADMIC_YEARS_OBE || URL_NOT_FOUND,
        );
        if (responseYear.success) {
          const acadYearsList = responseYear.data?.["Academic Year"]?.reverse();
          setAcademicYearsList(acadYearsList);
        }

        const responseSession = await callApiViaProxy<AcademicSessionResponse>(
          process.env.NEXT_PUBLIC_GET_ACADMIC_SESSIONS_OBE || URL_NOT_FOUND,
        );
        if (responseSession.success) {
          setAcademicSessionsList(
            responseSession.data?.["Academic Session"] || [],
          );
        }
      } catch (err) {
        console.error("getAcademicCalendar error:", err);
      }
    };
    getAcademicCalendar();
  }, []);

  // Build sessionsPerYear based on selected academicYear (form-specific)
  useEffect(() => {
    if (!formAcademicYear || !academicSessionsList || !academicYearsList)
      return;
    const filteredList = academicSessionsList?.filter(
      (year) => year["Academic Year"] == formAcademicYear,
    );
    const unique = new Map<string, string[]>();
    if (!filteredList) return;
    for (const item of filteredList) {
      if (unique.has(item.Code)) {
        unique.get(item.Code)?.push(item.Code);
      } else {
        unique.set(item.Code, [item.Code]);
      }
    }
    setSessionsPerYear(Array.from(unique.keys()) || []);
  }, [formAcademicYear, academicSessionsList, academicYearsList]);

  // Reset Faculty / Programme / Semester when year or session changes
  useEffect(() => {
    setSelectedFacultyCode("");
    setFacultyCodesFromOBE([]);
    setProgrammeSemesterList([]);
    setSelectedProgramCode("");
    setSelectedSemester("");
  }, [formAcademicYear, formAcademicSession]);

  // GetCourseListOBE with empty facultyCode → fetch faculties for dropdown
  useEffect(() => {
    if (!formAcademicYear || !formAcademicSession) return;
    const fetchFacultiesOBE = async () => {
      setLoadingFacultiesOBE(true);
      try {
        const response = await callApiViaProxy<CourseListOBEResponse>(
          process.env.NEXT_PUBLIC_GET_COURSE_LIST_OBE || URL_NOT_FOUND,
          {
            acadYear: formAcademicYear,
            acadSess: formAcademicSession,
            facultyCode: "",
          },
        );
        if (response.success && response.data?.values) {
          const values = response.data.values as CourseListOBEFacultyValue[];
          const codes = Array.from(
            new Set(values.map((v) => v["Faculty Code"]).filter(Boolean)),
          ).sort();
          setFacultyCodesFromOBE(codes);
        } else {
          setFacultyCodesFromOBE([]);
        }
      } catch (err) {
        console.error("fetchFacultiesOBE error:", err);
        setFacultyCodesFromOBE([]);
      } finally {
        setLoadingFacultiesOBE(false);
      }
    };
    fetchFacultiesOBE();
  }, [formAcademicYear, formAcademicSession]);

  // GetCourseListOBE with facultyCode → fetch programme code + semester
  useEffect(() => {
    if (!formAcademicYear || !formAcademicSession || !selectedFacultyCode)
      return;
    const fetchProgrammeSemesterOBE = async () => {
      setLoadingProgrammeOBE(true);
      try {
        const response = await callApiViaProxy<CourseListOBEResponse>(
          process.env.NEXT_PUBLIC_GET_COURSE_LIST_OBE || URL_NOT_FOUND,
          {
            acadYear: formAcademicYear,
            acadSess: formAcademicSession,
            facultyCode: selectedFacultyCode,
          },
        );
        if (response.success && response.data?.values) {
          const values = response.data.values as CourseListOBEProgrammeValue[];
          setProgrammeSemesterList(values);
        } else {
          setProgrammeSemesterList([]);
        }
      } catch (err) {
        console.error("fetchProgrammeSemesterOBE error:", err);
        setProgrammeSemesterList([]);
      } finally {
        setLoadingProgrammeOBE(false);
      }
    };
    fetchProgrammeSemesterOBE();
  }, [formAcademicYear, formAcademicSession, selectedFacultyCode]);

  // Reset Programme + Semester when faculty changes
  useEffect(() => {
    setSelectedProgramCode("");
    setSelectedSemester("");
  }, [selectedFacultyCode]);

  // Fetch courses (GetCourseList) when year, session, faculty, programme code, semester are selected
  useEffect(() => {
    if (
      !formAcademicYear ||
      !formAcademicSession ||
      !selectedFacultyCode ||
      !selectedProgramCode ||
      !selectedSemester
    ) {
      setCourses([]);
      return;
    }
    const fetchCourses = async () => {
      setLoading(true);
      try {
        const response = await callApiViaProxy<CourseListResponse>(
          process.env.NEXT_PUBLIC_GET_COURSE_LIST || URL_NOT_FOUND,
          {
            acadYear: formAcademicYear,
            acadSess: formAcademicSession,
            programCode: selectedProgramCode,
            semester: selectedSemester,
            facultyCode: selectedFacultyCode,
          },
        );
        if (!response.success) {
          console.error("Course list API error:", response.error);
          setCourses([]);
          return;
        }
        if (response.data) {
          let coursesData: Course[] = [];
          const data = response.data as Record<string, unknown>;
          if (Array.isArray(data)) {
            coursesData = data as Course[];
          } else if (data.value && Array.isArray(data.value)) {
            coursesData = data.value as Course[];
          } else if (data.values && Array.isArray(data.values)) {
            coursesData = (data.values as Record<string, unknown>[]).map(
              (course: Record<string, unknown>) => ({
                ...course,
                "Course Code": (course["Subject Code"] ??
                  course["Course Code"] ??
                  "") as string,
                "Course ID": (course["Course ID"] ?? "") as string,
                ThresHold: Number(course.ThresHold ?? 0),
              }),
            ) as Course[];
          } else if (typeof data === "object") {
            const record = data as Record<string, unknown>;
            const arrayKey = Object.keys(record).find(
              (key) =>
                Array.isArray(record[key]) &&
                (record[key] as unknown[]).length > 0,
            );
            if (arrayKey) {
              coursesData = record[arrayKey] as Course[];
            }
          }
          setCourses(coursesData);
        } else {
          setCourses([]);
        }
      } catch (err) {
        console.error("fetchCourses error:", err);
        setCourses([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [
    formAcademicYear,
    formAcademicSession,
    selectedFacultyCode,
    selectedProgramCode,
    selectedSemester,
  ]);

  // Reset course ID when course code changes
  useEffect(() => {
    setSelectedCourseId("");
    setCourseOutcomes([]);
    setOutcomeValues({});
  }, [selectedCourseCode]);

  // Fetch course outcomes (GetCourseOutcome) when course ID, year, session are selected
  useEffect(() => {
    if (!selectedCourseId || !formAcademicYear || !formAcademicSession) {
      setCourseOutcomes([]);
      setOutcomeValues({});
      setLoadingOutcomes(false);
      return;
    }
    const fetchCourseOutcomes = async () => {
      setLoadingOutcomes(true);
      try {
        const response = await callApiViaProxy<CourseOutcomeResponse>(
          process.env.NEXT_PUBLIC_GET_COURSE_OUTCOME || URL_NOT_FOUND,
          {
            acadSess: formAcademicSession,
            acadYear: formAcademicYear,
            courseID: selectedCourseId,
          },
        );
        if (response.success && response.data) {
          const data = response.data as
            | Record<string, unknown>
            | CourseOutcome[];
          let outcomesData: CourseOutcome[] = [];
          if (Array.isArray(data)) {
            outcomesData = data as CourseOutcome[];
          } else if (
            data &&
            typeof data === "object" &&
            data["Course Outcome"] &&
            Array.isArray(data["Course Outcome"])
          ) {
            outcomesData = data["Course Outcome"] as CourseOutcome[];
          } else if (
            data &&
            typeof data === "object" &&
            data.value &&
            Array.isArray(data.value)
          ) {
            outcomesData = data.value as CourseOutcome[];
          } else if (data && typeof data === "object") {
            const record = data as Record<string, unknown>;
            const arrayKey = Object.keys(record).find(
              (key) =>
                Array.isArray(record[key]) &&
                (record[key] as unknown[]).length > 0,
            );
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
  }, [selectedCourseId, formAcademicYear, formAcademicSession]);

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
    const allOutcomesHaveValues = courseOutcomes.every(
      (_, index) => outcomeValues[index] !== undefined,
    );

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
          academicYear: formAcademicYear,
          academicSession: formAcademicSession,
          courseOutcomes: courseOutcomes,
          outcomeValues: Object.fromEntries(
            Object.entries(outcomeValues).map(([k, v]) => [
              k,
              Math.round(((Number(v) * 3) / 100) * 100) / 100,
            ]),
          ),
          threshold: threshold,
          batchYear: batchYear || undefined,
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
          console.log(
            `[Poll ${pollingDuration}ms] Checking status for jobId: ${jobId}`,
          );

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
              console.warn(
                `[Poll] Job not found (404) for jobId: ${jobId} after ${pollingDuration}ms. This might be a timing issue.`,
              );

              // If we've been polling for more than 10 seconds, something is wrong
              if (pollingDuration > 10000) {
                console.error(
                  "Job not found after 10 seconds. Stopping polling.",
                );
                stopPolling();
                setIsSubmitting(false);
                setCalculationProgress(0);
                alert(
                  "Job not found. The calculation may have failed. Please try submitting again.",
                );
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
          console.log(
            `Job status: ${statusData.status}, progress: ${statusData.progress}%`,
          );
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
            alert(
              "An error occurred while checking calculation status. Please try submitting again.",
            );
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
      alert(
        `An error occurred while submitting: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
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
      const cancelResponse = await fetch(
        `/api/calculate-co?jobId=${currentJobId}`,
        {
          method: "DELETE",
        },
      );

      if (cancelResponse.ok) {
        const cancelData = await cancelResponse.json();
        if (cancelData.success) {
          setIsCancelled(true);
          setIsSubmitting(false);
          setCurrentJobId(null);
          console.log("Calculation cancelled successfully");
        } else {
          console.error("Failed to cancel:", cancelData.error);
          alert(
            `Failed to cancel calculation: ${
              cancelData.error || "Unknown error"
            }`,
          );
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

    // Reset all form state including academic year and session
    setFormAcademicYear("");
    setFormAcademicSession("");
    setSelectedFacultyCode("");
    setSelectedProgramCode("");
    setSelectedSemester("");
    setFacultyCodesFromOBE([]);
    setProgrammeSemesterList([]);
    setSelectedCourseCode("");
    setSelectedCourseId("");
    setCourses([]);
    setCourseOutcomes([]);
    setOutcomeValues({});
    setThreshold(0);
    setCalculationResult(null);
    setCalculationProgress(0);
    setCurrentJobId(null);
    setIsCancelled(false);
    setIsSubmitting(false);
    setSessionsPerYear([]);

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

      {isSideNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={toggleSideNav}
        />
      )}

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
              <h2 className="text-xl font-semibold text-gray-800 mb-6">
                Calculate CO Form
              </h2>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  {/* Academic Year Dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Academic Year
                    </label>
                    <select
                      value={formAcademicYear}
                      onChange={(event) => {
                        setFormAcademicYear(event.target.value);
                        setFormAcademicSession("");
                        setSelectedProgramCode("");
                        setCourses([]);
                        setSelectedCourseCode("");
                        setSelectedCourseId("");
                        setBatchYear("");
                        setCourseOutcomes([]);
                        setOutcomeValues({});
                        resetCalculationState();
                      }}
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                    >
                      <option value="">Select Academic Year</option>
                      {academicYearsList?.map((year) => (
                        <option key={year.Code} value={year.Code}>
                          {year.Description}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Academic Session Dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Academic Session
                    </label>
                    <select
                      value={formAcademicSession}
                      onChange={(event) => {
                        setFormAcademicSession(event.target.value);
                        setSelectedProgramCode("");
                        setCourses([]);
                        setSelectedCourseCode("");
                        setSelectedCourseId("");
                        setCourseOutcomes([]);
                        setOutcomeValues({});
                        resetCalculationState();
                      }}
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                      disabled={
                        !formAcademicYear || sessionsPerYear.length === 0
                      }
                    >
                      <option value="">
                        {!formAcademicYear
                          ? "Please select Academic Year first"
                          : sessionsPerYear.length === 0
                            ? "No sessions available"
                            : "Select Academic Session"}
                      </option>
                      {sessionsPerYear?.map((session) => (
                        <option key={session} value={session}>
                          {session}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Faculty Dropdown (GetCourseListOBE with facultyCode: "") */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Faculty
                    </label>
                    <select
                      value={selectedFacultyCode}
                      onChange={(e) => {
                        setSelectedFacultyCode(e.target.value);
                        setCourses([]);
                        setSelectedCourseCode("");
                        setSelectedCourseId("");
                        setCourseOutcomes([]);
                        setOutcomeValues({});
                        resetCalculationState();
                      }}
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                      disabled={
                        !formAcademicYear ||
                        !formAcademicSession ||
                        loadingFacultiesOBE
                      }
                    >
                      <option value="">
                        {!formAcademicYear || !formAcademicSession
                          ? "Select Academic Year & Session first"
                          : loadingFacultiesOBE
                            ? "Loading faculties..."
                            : facultyCodesFromOBE.length === 0
                              ? "No faculties"
                              : "Select Faculty"}
                      </option>
                      {facultyCodesFromOBE.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Program Code Dropdown (GetCourseListOBE with facultyCode) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Programme Code
                    </label>
                    <select
                      value={selectedProgramCode}
                      onChange={(e) => {
                        setSelectedProgramCode(e.target.value);
                        setSelectedSemester("");
                        setCourses([]);
                        setSelectedCourseCode("");
                        setSelectedCourseId("");
                        setCourseOutcomes([]);
                        setOutcomeValues({});
                        resetCalculationState();
                      }}
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                      disabled={
                        !formAcademicYear ||
                        !formAcademicSession ||
                        !selectedFacultyCode ||
                        loadingProgrammeOBE
                      }
                    >
                      <option value="">
                        {!selectedFacultyCode
                          ? "Select Faculty first"
                          : loadingProgrammeOBE
                            ? "Loading..."
                            : "Select Programme Code"}
                      </option>
                      {Array.from(
                        new Set(
                          programmeSemesterList.map((p) => p["Programme Code"]),
                        ),
                      )
                        .sort()
                        .map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Semester Dropdown (from same GetCourseListOBE response) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Semester
                    </label>
                    <select
                      value={selectedSemester}
                      onChange={(e) => {
                        setSelectedSemester(e.target.value);
                        setCourses([]);
                        setSelectedCourseCode("");
                        setSelectedCourseId("");
                        setCourseOutcomes([]);
                        setOutcomeValues({});
                        resetCalculationState();
                      }}
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                      disabled={!selectedProgramCode}
                    >
                      <option value="">
                        {!selectedProgramCode
                          ? "Select Programme Code first"
                          : "Select Semester"}
                      </option>
                      {Array.from(
                        new Set(
                          programmeSemesterList
                            .filter(
                              (p) =>
                                p["Programme Code"] === selectedProgramCode,
                            )
                            .map((p) => p.Semester),
                        ),
                      )
                        .sort()
                        .map((sem) => (
                          <option key={sem} value={sem}>
                            {sem}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Course Code Dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Course Code
                    </label>
                    <select
                      value={selectedCourseCode}
                      onChange={(e) => {
                        setSelectedCourseCode(e.target.value);
                        setSelectedCourseId("");
                        setCourseOutcomes([]);
                        setOutcomeValues({});
                        resetCalculationState();
                      }}
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                      disabled={loading || !selectedProgramCode}
                    >
                      <option value="" key="default-course-code">
                        {!selectedProgramCode
                          ? "Please select Program Code first"
                          : loading
                            ? "Loading courses..."
                            : "Select Course Code"}
                      </option>
                      {Array.from(new Set(courses.map((c) => c["Course Code"])))
                        .sort()
                        .map((code, index) => (
                          <option
                            key={`course-code-${code}-${index}`}
                            value={code}
                          >
                            {code}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Course ID Dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Course ID
                    </label>
                    <select
                      value={selectedCourseId}
                      onChange={(e) => {
                        setSelectedCourseId(e.target.value);
                        setCourseOutcomes([]);
                        setOutcomeValues({});
                        resetCalculationState();
                      }}
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                      disabled={loading || !selectedCourseCode}
                    >
                      <option value="" key="default-course-id">
                        {!selectedCourseCode
                          ? "Please select Course Code first"
                          : "Select Course ID"}
                      </option>
                      {courses
                        .filter((c) => c["Course Code"] === selectedCourseCode)
                        .map((c) => c["Course ID"])
                        .map((courseId, index) => (
                          <option
                            key={`course-id-${courseId}-${index}`}
                            value={courseId}
                          >
                            {courseId}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Batch Year Dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Batch Year
                    </label>
                    <select
                      value={batchYear}
                      onChange={(e) => {
                        setBatchYear(e.target.value);
                        resetCalculationState();
                      }}
                      className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                      disabled={!academicYearsList?.length}
                    >
                      <option value="">
                        {!academicYearsList?.length
                          ? "No academic years available"
                          : "Select Batch Year"}
                      </option>
                      {academicYearsList?.map((year) => (
                        <option key={year.Code} value={year.Code}>
                          {year.Description}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Threshold Input */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Threshold Value
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.01"
                    value={threshold}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (
                        (value >= 0 && value <= 10) ||
                        e.target.value === ""
                      ) {
                        setThreshold(value || 0);
                      }
                    }}
                    className="block w-full max-w-xs px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                    placeholder="Enter threshold (0-10)"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Threshold value for normalized marks (0-10 scale)
                  </p>
                </div>

                {/* Course Outcomes Table */}
                {selectedCourseId &&
                  formAcademicYear &&
                  formAcademicSession && (
                    <div className="mt-8">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        Course Feedback
                      </h3>
                      <div className="bg-white rounded-lg shadow-md p-2 border border-gray-200 w-full">
                        <table className="min-w-full text-sm text-gray-700">
                          <thead>
                            <tr className="bg-gray-100 text-left">
                              <th className="px-4 py-2">CO.No.</th>
                              <th className="px-4 py-2">Description</th>
                              <th className="px-4 py-2">Value (0-100)</th>
                            </tr>
                          </thead>
                          <tbody className="text-[13px]">
                            {loadingOutcomes ? (
                              <tr>
                                <td colSpan={3} className="text-center py-8">
                                  <div className="flex items-center justify-center space-x-2">
                                    <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-gray-600">
                                      Loading course outcomes...
                                    </span>
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
                                  <td className="px-4 py-2">
                                    {outcome["Sno Description"] || ""}
                                  </td>
                                  <td className="px-4 py-2">
                                    {outcome.Description || ""}
                                  </td>
                                  <td className="px-4 py-2">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.01"
                                      value={outcomeValues[index] ?? ""}
                                      onChange={(e) => {
                                        const value = parseFloat(
                                          e.target.value,
                                        );
                                        if (
                                          (value >= 0 && value <= 100) ||
                                          e.target.value === ""
                                        ) {
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
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      Calculating...
                    </h3>
                    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                        <div
                          className="bg-orange-500 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${calculationProgress}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-gray-600">
                          Progress: {calculationProgress}%
                        </p>
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
                      <p className="text-sm text-yellow-800">
                        Calculation has been cancelled.
                      </p>
                    </div>
                  </div>
                )}

                {/* Calculation Results (id used for print-only targeting) */}
                {calculationResult && !isSubmitting && (
                  <div id="calculation-results-print" className="mt-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      Calculation Results
                    </h3>
                    <div className="bg-white rounded-lg p-6 border border-gray-200">
                      {(() => {
                        const calculatedData =
                          calculationResult?.calculatedData;
                        if (!calculatedData) return null;

                        // Calculate total unique students across all exam methods
                        const allStudentNumbers = new Set<string>();
                        if (calculatedData.studentData) {
                          Object.values(calculatedData.studentData).forEach(
                            (students: any) => {
                              if (Array.isArray(students)) {
                                students.forEach((student: any) => {
                                  if (student.studentNo) {
                                    allStudentNumbers.add(student.studentNo);
                                  }
                                });
                              }
                            },
                          );
                        }
                        const totalStudents = allStudentNumbers.size;

                        // Get all COs from courseOutcomes (all 5 COs)
                        // Use courseOutcomes from the component state to get all COs
                        const allCOsFromOutcomes = courseOutcomes.map(
                          (outcome) => outcome["Sno Description"],
                        );

                        // Helper function to convert decimal to percentage
                        const toPercentage = (
                          value: number | undefined,
                          showDash: boolean = false,
                        ): string => {
                          if (value === undefined || value === null) {
                            return showDash ? "-" : "0.00";
                          }
                          return (value * 100).toFixed(2);
                        };

                        // Helper function to format coAttainmentLevel (levels: 1, 2, or 3)
                        const formatAttainmentLevel = (
                          value: number | undefined,
                        ): string => {
                          if (
                            value === undefined ||
                            value === null ||
                            value === 0
                          )
                            return "0";
                          return Math.round(value).toString();
                        };

                        // Helper function to check if a CO has calculated values
                        const hasCalculatedValues = (co: string): boolean => {
                          return (
                            calculatedData.internalAttainment?.[co] !==
                              undefined ||
                            calculatedData.externalAttainment?.[co] !==
                              undefined ||
                            calculatedData.exactAttainment?.[co] !== undefined
                          );
                        };

                        const sortedCOs = allCOsFromOutcomes.sort();

                        // All POs sorted by name (left to right); prefer full list from API, else fallback to mapped POs
                        const poListFromApi = (calculatedData.POs ||
                          []) as POItem[];
                        const mappedPOIds = Object.keys(
                          calculatedData.poSumPerPO || {},
                        );
                        const allPOIdsSorted = (
                          poListFromApi.length > 0
                            ? poListFromApi.map((p) => p.id)
                            : mappedPOIds
                        ).sort((a, b) =>
                          a.localeCompare(b, undefined, { numeric: true }),
                        );

                        return (
                          <div className="space-y-6">
                            {/* Program code, Course code, Academic session, Batch year, Total students — one gray section */}
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-0">
                              <div className="flex items-center justify-between py-2 first:pt-0">
                                <span className="text-sm font-medium text-gray-700">
                                  Program code:
                                </span>
                                <span className="text-lg font-bold text-gray-900">
                                  {selectedProgramCode || "—"}
                                </span>
                              </div>
                              <div className="border-t border-gray-200" />
                              <div className="flex items-center justify-between py-2">
                                <span className="text-sm font-medium text-gray-700">
                                  Course code:
                                </span>
                                <span className="text-lg font-bold text-gray-900">
                                  {selectedCourseCode || "—"}
                                </span>
                              </div>
                              <div className="border-t border-gray-200" />
                              <div className="flex items-center justify-between py-2">
                                <span className="text-sm font-medium text-gray-700">
                                  Academic session:
                                </span>
                                <span className="text-lg font-bold text-gray-900">
                                  {formAcademicSession || "—"}
                                </span>
                              </div>
                              <div className="border-t border-gray-200" />
                              <div className="flex items-center justify-between py-2">
                                <span className="text-sm font-medium text-gray-700">
                                  Batch year:
                                </span>
                                <span className="text-lg font-bold text-gray-900">
                                  {batchYear || "—"}
                                </span>
                              </div>
                              <div className="border-t border-gray-200" />
                              <div className="flex items-center justify-between py-2 last:pb-0">
                                <span className="text-sm font-medium text-gray-700">
                                  Total Students:
                                </span>
                                <span className="text-lg font-bold text-gray-900">
                                  {totalStudents}
                                </span>
                              </div>
                            </div>

                            {/* CO Attainment Table (same style as PO tables: green header/first column, orange data cells) */}
                            <div className="bg-white rounded-lg p-2 border border-gray-200 w-full overflow-x-auto">
                              <table className="min-w-full text-sm text-gray-800 border-collapse">
                                <thead>
                                  <tr className="bg-green-200 border border-green-300">
                                    <th className="px-3 py-2 text-left font-semibold border border-green-300 min-w-16">
                                      CO.No.
                                    </th>
                                    <th className="px-3 py-2 text-center font-semibold border border-green-300">
                                      Internal Attainment (%)
                                    </th>
                                    <th className="px-3 py-2 text-center font-semibold border border-green-300">
                                      External Attainment (%)
                                    </th>
                                    <th className="px-3 py-2 text-center font-semibold border border-green-300">
                                      Exact Attainment (%)
                                    </th>
                                    <th className="px-3 py-2 text-center font-semibold border border-green-300">
                                      CO Attainment Level
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="text-[13px]">
                                  {sortedCOs.length === 0 ? (
                                    <tr>
                                      <td
                                        colSpan={5}
                                        className="text-center py-8 text-gray-500 border border-orange-200 bg-orange-50"
                                      >
                                        No course outcomes available
                                      </td>
                                    </tr>
                                  ) : (
                                    sortedCOs.map((co) => {
                                      const hasValues = hasCalculatedValues(co);
                                      const internal =
                                        calculatedData.internalAttainment?.[co];
                                      const external =
                                        calculatedData.externalAttainment?.[co];
                                      const exact =
                                        calculatedData.exactAttainment?.[co];
                                      const attainmentLevel =
                                        calculatedData.coAttainmentLevel?.[co];

                                      return (
                                        <tr key={co}>
                                          <td className="px-3 py-2 font-medium bg-green-200 border border-green-300">
                                            {co}
                                          </td>
                                          <td className="px-3 py-2 text-center border border-orange-200 bg-orange-50">
                                            {hasValues
                                              ? `${toPercentage(internal)}%`
                                              : "-"}
                                          </td>
                                          <td className="px-3 py-2 text-center border border-orange-200 bg-orange-50">
                                            {hasValues
                                              ? `${toPercentage(external)}%`
                                              : "-"}
                                          </td>
                                          <td className="px-3 py-2 text-center border border-orange-200 bg-orange-50">
                                            {hasValues
                                              ? `${toPercentage(exact)}%`
                                              : "-"}
                                          </td>
                                          <td className="px-3 py-2 text-center border border-orange-200 bg-orange-50">
                                            {hasValues
                                              ? formatAttainmentLevel(
                                                  attainmentLevel,
                                                )
                                              : "-"}
                                          </td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                            </div>

                            {/* PO to CO Map Table (green header, orange data cells - Excel style); all POs sorted by name */}
                            {calculatedData.poToCoMap &&
                              Object.keys(calculatedData.poToCoMap).length >
                                0 &&
                              allPOIdsSorted.length > 0 && (
                                <div className="bg-white rounded-lg p-2 border border-gray-200 w-full overflow-x-auto">
                                  <table className="min-w-full text-sm text-gray-800 border-collapse">
                                    <thead>
                                      <tr className="bg-green-200 border border-green-300">
                                        <th className="px-3 py-2 text-left font-semibold border border-green-300 min-w-16">
                                          CO
                                        </th>
                                        {allPOIdsSorted.map((poId) => (
                                          <th
                                            key={poId}
                                            className="px-3 py-2 text-center font-semibold border border-green-300 whitespace-nowrap"
                                          >
                                            {poId}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="text-[13px]">
                                      {Object.entries(
                                        calculatedData.poToCoMap,
                                      ).map(([coId, row]) => {
                                        const poRow = row as Record<
                                          string,
                                          number | "--"
                                        >;
                                        return (
                                          <tr key={coId}>
                                            <td className="px-3 py-2 font-medium bg-green-200 border border-green-300">
                                              {coId}
                                            </td>
                                            {allPOIdsSorted.map((poId) => {
                                              const val = poRow[poId];
                                              return (
                                                <td
                                                  key={poId}
                                                  className="px-3 py-2 text-center border border-orange-200 bg-orange-50"
                                                >
                                                  {typeof val === "number"
                                                    ? val.toFixed(2)
                                                    : val === "--"
                                                      ? "--"
                                                      : "—"}
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
                                      <th className="px-4 py-2 font-semibold text-left border border-green-300 w-24">
                                        {" "}
                                      </th>
                                      {allPOIdsSorted.map((poId) => (
                                        <th
                                          key={poId}
                                          className="px-2 py-2 text-center font-semibold border border-green-300"
                                        >
                                          {poId}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="text-[13px]">
                                    <tr className="bg-gray-50 border border-gray-200">
                                      <td className="px-4 py-2 font-medium text-gray-700 border border-gray-200">
                                        PO Sum
                                      </td>
                                      {allPOIdsSorted.map((poId) => {
                                        const sum = (
                                          calculatedData.poSumPerPO as
                                            | Record<string, number>
                                            | undefined
                                        )?.[poId];
                                        return (
                                          <td
                                            key={poId}
                                            className="px-4 py-2 text-center font-medium text-gray-900 border border-gray-200"
                                          >
                                            {typeof sum === "number"
                                              ? sum.toFixed(2)
                                              : "—"}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                    <tr className="bg-gray-100 border border-gray-200">
                                      <td className="px-4 py-2 font-medium text-gray-700 border border-gray-200">
                                        Average
                                      </td>
                                      <td
                                        colSpan={allPOIdsSorted.length}
                                        className="px-4 py-2 text-center font-medium text-gray-900 border border-gray-200"
                                      >
                                        {typeof calculatedData.poAverageValue ===
                                        "number"
                                          ? calculatedData.poAverageValue.toFixed(
                                              2,
                                            )
                                          : "—"}
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
                          !formAcademicYear ||
                          !formAcademicSession ||
                          isSubmitting ||
                          courseOutcomes.length === 0 ||
                          !courseOutcomes.every(
                            (_, index) =>
                              outcomeValues[index] !== undefined,
                          ) ||
                          threshold <= 0
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
