import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "./jobStore";
import { randomUUID } from "crypto";
import { credentials } from "@/constants";

// Type definitions matching the frontend
export type CalculateCORequest = {
  courseCode: string;
  courseId: string;
  academicYear: string;
  academicSession: string;
  semester: string;
  courseOutcomes: Array<{
    Sno: number;
    "Sno Description": string;
    Description: string;
  }>;
  outcomeValues: Record<number, number>; // index -> value mapping
  /** Programme code for PO mapping and threshold (e.g. "BTECH-007"). When provided, GetProgramOutcomeAndMappingValue is called first to get threshold. */
  programCode?: string;
};

// PO mapping API response types
type POItem = { id: string; description: string; Type: string };
type POMappingItem = {
  pOMapNo: string;
  outComeNo: string;
  coRelationValue: string;
};
type GetProgramOutcomeAndMappingResponse = {
  threesHold?: string; // API returns threshold (typo in API)
  POs?: POItem[];
  POMappingList?: POMappingItem[];
};

export type CalculateCOResponse = {
  success: boolean;
  jobId?: string;
  message?: string;
  error?: string;
};

export async function DELETE(req: NextRequest) {
  try {
    const jobId = req.nextUrl.searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: "Job ID is required" },
        { status: 400 },
      );
    }

    const cancelled = jobStore.cancel(jobId);

    if (!cancelled) {
      return NextResponse.json(
        {
          success: false,
          error: "Job not found or cannot be cancelled",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Job cancelled successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Cancel CO API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: CalculateCORequest = await req.json();

    // Validate required fields
    if (!body.courseCode) {
      return NextResponse.json(
        { success: false, error: "Course Code is required" },
        { status: 400 },
      );
    }

    if (!body.courseId) {
      return NextResponse.json(
        { success: false, error: "Course ID is required" },
        { status: 400 },
      );
    }

    if (!body.academicYear) {
      return NextResponse.json(
        { success: false, error: "Academic Year is required" },
        { status: 400 },
      );
    }

    if (!body.academicSession) {
      return NextResponse.json(
        { success: false, error: "Academic Session is required" },
        { status: 400 },
      );
    }

    if (!body.semester) {
      return NextResponse.json(
        { success: false, error: "Semester is required" },
        { status: 400 },
      );
    }

    if (!body.courseOutcomes || !Array.isArray(body.courseOutcomes)) {
      return NextResponse.json(
        { success: false, error: "Course Outcomes array is required" },
        { status: 400 },
      );
    }

    if (!body.outcomeValues || typeof body.outcomeValues !== "object") {
      return NextResponse.json(
        { success: false, error: "Outcome Values object is required" },
        { status: 400 },
      );
    }

    // Log received data for debugging
    console.log("Calculate CO Request received:", {
      courseCode: body.courseCode,
      courseId: body.courseId,
      academicYear: body.academicYear,
      academicSession: body.academicSession,
      semester: body.semester,
      outcomesCount: body.courseOutcomes.length,
      valuesCount: Object.keys(body.outcomeValues).length,
    });

    // Generate unique job ID
    const jobId = randomUUID();
    console.log(`[POST /api/calculate-co] Creating job with ID: "${jobId}"`);
    console.log(
      `[POST /api/calculate-co] JobId type: ${typeof jobId}, length: ${
        jobId.length
      }`,
    );

    // Create job in store
    jobStore.create(jobId);

    // Verify job was created immediately
    const createdJob = jobStore.get(jobId);
    if (!createdJob) {
      console.error(
        `[POST /api/calculate-co] Failed to create job: "${jobId}"`,
      );
      const allJobs = jobStore.getAll();
      console.error(
        `[POST /api/calculate-co] Available jobs: ${
          allJobs.map((j) => `"${j.id}"`).join(", ") || "none"
        }`,
      );
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create job",
        },
        { status: 500 },
      );
    }
    console.log(
      `[POST /api/calculate-co] Job created successfully: "${jobId}", status: ${createdJob.status}`,
    );

    // Start background processing (don't await - fire and forget)
    // Use setImmediate to ensure job is fully created before processing starts
    setImmediate(() => {
      processCalculation(jobId, body).catch((error) => {
        console.error(
          `[POST /api/calculate-co] Calculation error for job ${jobId}:`,
          error,
        );
        jobStore.update(jobId, {
          status: "failed",
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
      });
    });

    // Verify job exists one more time before returning
    const finalJobCheck = jobStore.get(jobId);
    if (!finalJobCheck) {
      console.error(
        `[POST /api/calculate-co] Job ${jobId} not found after creation`,
      );
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create job",
        },
        { status: 500 },
      );
    }

    console.log(
      `[POST /api/calculate-co] Returning jobId: ${jobId}, current status: ${finalJobCheck.status}`,
    );

    // Return immediately with jobId
    return NextResponse.json(
      {
        success: true,
        jobId: jobId,
        message: "Calculation started. Please poll the status endpoint.",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Calculate CO API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      },
      { status: 500 },
    );
  }
}

// Server-side API call helper
async function serverCallApi<T>(
  endpoint: string,
  requestBody?: unknown,
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const baseURL = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseURL) {
      return { success: false, error: "Base URL not configured" };
    }

    const url = `${baseURL}${endpoint}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify(requestBody || {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `API call failed: ${response.status} - ${errorText}`,
      };
    }

    const responseData = await response.json();

    // Handle different response structures
    let data: T;
    if (typeof responseData === "string") {
      // If response is a JSON string, parse it
      data = JSON.parse(responseData);
    } else if (responseData.value && typeof responseData.value === "string") {
      // If response has a value property that's a JSON string
      data = JSON.parse(responseData.value);
    } else {
      // Direct object response
      data = responseData as T;
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// Type definitions for API responses
type ExamMethod = {
  "Exam Method"?: string;
  "Exam Method Code"?: string;
  [key: string]: unknown;
};

type ExamMethodResponse =
  | ExamMethod[]
  | { value?: ExamMethod[]; [key: string]: unknown };

type StudentListMark = {
  questionCode: string;
  "Question Code"?: string;
  markObtained: string;
  "Mark Obtained"?: string;
  maximumMark: string;
  "Maximum Mark"?: string;
};

type StudentListStudent = {
  studentNo: string;
  "Student No"?: string;
  marks: StudentListMark[];
};

type StudentListResponse = {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  values: StudentListStudent[];
};

// Helper function to check if job is cancelled
function checkCancelled(jobId: string): boolean {
  return jobStore.isCancelled(jobId);
}

// Background processing function
async function processCalculation(
  jobId: string,
  data: CalculateCORequest,
): Promise<void> {
  try {
    // Update status to processing
    jobStore.update(jobId, { status: "processing", progress: 0 });

    // Check if cancelled before starting
    if (checkCancelled(jobId)) {
      console.log(`[Job ${jobId}] Calculation cancelled before processing`);
      return;
    }

    // Step 1: Initial setup and validation
    jobStore.update(jobId, { progress: 5 });
    console.log(`[Job ${jobId}] Starting calculation...`);

    // Check cancellation after initial setup
    if (checkCancelled(jobId)) {
      console.log(`[Job ${jobId}] Calculation cancelled after initial setup`);
      return;
    }

    // Step 1.5: Fetch threshold (and PO mapping) from GetProgramOutcomeAndMappingValue so we have threshold before student/threshold calculations
    let thresholdValue = 0;
    let poList: POItem[] = [];
    let poMappingList: POMappingItem[] = [];
    if (data.programCode) {
      jobStore.update(jobId, { progress: 6 });
      console.log(
        `[Job ${jobId}] Fetching threshold and PO mapping (programCode: ${data.programCode})...`,
      );
      const poMappingEndpoint =
        process.env.NEXT_PUBLIC_GET_PROGRAM_OUTCOME_AND_MAPPING_VALUE ||
        "/MUJOBE/MUJAPIOBE/v2.0/companies(480ceadc-3108-f011-8e30-7c1e520f486f)/MUJOBE(00000000-0000-0000-0000-000000000000)/Microsoft.NAV.GetProgramOutcomeAndMappingValue";
      const poMappingResponse =
        await serverCallApi<GetProgramOutcomeAndMappingResponse>(
          poMappingEndpoint,
          {
            acadSess: data.academicSession,
            acadYear: data.academicYear,
            courseID: data.courseId,
            programCode: data.programCode,
            semester: data.semester,
          },
        );
      if (checkCancelled(jobId)) return;
      if (poMappingResponse.success && poMappingResponse.data) {
        const raw = poMappingResponse.data as GetProgramOutcomeAndMappingResponse & {
          value?: GetProgramOutcomeAndMappingResponse;
        };
        const unwrapped: GetProgramOutcomeAndMappingResponse = raw.POs
          ? raw
          : raw.value ?? { POs: [], POMappingList: [] };
        const threshStr = (raw.threesHold ?? unwrapped.threesHold ?? "0").toString().trim();
        thresholdValue = Math.max(0, Math.min(10, parseFloat(threshStr) || 0));
        poList = Array.isArray(unwrapped.POs) ? unwrapped.POs : [];
        poMappingList = Array.isArray(unwrapped.POMappingList)
          ? unwrapped.POMappingList
          : [];
        console.log(
          `[Job ${jobId}] Threshold from API: ${thresholdValue}, POs: ${poList.length}, POMappingList: ${poMappingList.length}`,
        );
      } else {
        console.warn(
          `[Job ${jobId}] GetProgramOutcomeAndMappingValue failed or empty, using threshold 0:`,
          poMappingResponse.error,
        );
      }
    } else {
      console.log(
        `[Job ${jobId}] No programCode provided, using default threshold 0`,
      );
    }

    // Step 2: Fetch Exam Methods
    jobStore.update(jobId, { progress: 10 });
    console.log(`[Job ${jobId}] Fetching exam methods...`);

    const examMethodsEndpoint =
      process.env.NEXT_PUBLIC_GET_EXAM_METHODS ||
      "/MUJOBE/MUJAPIOBE/v2.0/companies(480ceadc-3108-f011-8e30-7c1e520f486f)/MUJOBE(00000000-0000-0000-0000-000000000000)/Microsoft.NAV.ExamMethods";

    const examMethodsResponse = await serverCallApi<ExamMethodResponse>(
      examMethodsEndpoint,
      {
        acadSess: data.academicSession,
        acadYear: data.academicYear,
        courseCode: data.courseCode,
        courseID: data.courseId,
      },
    );

    if (!examMethodsResponse.success || !examMethodsResponse.data) {
      throw new Error(
        examMethodsResponse.error || "Failed to fetch exam methods",
      );
    }

    // Extract exam methods from response
    let examMethodsData: ExamMethod[] = [];
    const responseData = examMethodsResponse.data;

    if (Array.isArray(responseData)) {
      examMethodsData = responseData;
    } else if (responseData.value && Array.isArray(responseData.value)) {
      examMethodsData = responseData.value;
    } else if (typeof responseData === "object") {
      // Try to find any array property
      const arrayKey = Object.keys(responseData).find(
        (key) =>
          Array.isArray((responseData as Record<string, unknown>)[key]) &&
          ((responseData as Record<string, unknown>)[key] as unknown[]).length > 0,
      );
      if (arrayKey) {
        examMethodsData = (responseData as Record<string, unknown>)[arrayKey] as ExamMethod[];
      }
    }

    // Extract unique exam methods
    const uniqueExamMethods = new Set<string>();
    examMethodsData.forEach((method) => {
      const examMethod =
        method["Exam Method"] ||
        method["Exam Method Code"] ||
        method["examMethod"] ||
        method["examMethodCode"];
      if (examMethod && typeof examMethod === "string") {
        uniqueExamMethods.add(examMethod);
      }
    });

    const examMethodsList = Array.from(uniqueExamMethods);
    console.log(
      `[Job ${jobId}] Found ${examMethodsList.length} unique exam methods:`,
      examMethodsList,
    );

    jobStore.update(jobId, { progress: 20 });

    // Check cancellation after fetching exam methods
    if (checkCancelled(jobId)) {
      console.log(
        `[Job ${jobId}] Calculation cancelled after fetching exam methods`,
      );
      return;
    }

    // Step 3: Fetch student lists for each exam method
    const studentListEndpoint =
      process.env.NEXT_PUBLIC_GET_EXAM_METHOD_STUDENT_LIST ||
      "/MUJOBE/MUJAPIOBE/v2.0/companies(480ceadc-3108-f011-8e30-7c1e520f486f)/MUJOBE(00000000-0000-0000-0000-000000000000)/Microsoft.NAV.GetAllExmMethodStudListWmarks";

    const allStudentData: Record<string, StudentListStudent[]> = {};
    const totalExamMethods = examMethodsList.length;
    const progressPerExamMethod = 60 / totalExamMethods; // 20% to 80% for this step

    for (let i = 0; i < examMethodsList.length; i++) {
      const examMethod = examMethodsList[i];
      console.log(
        `[Job ${jobId}] Fetching student list for exam method: ${examMethod}`,
      );

      const studentsForMethod: StudentListStudent[] = [];
      const limit = 50;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const studentListResponse = await serverCallApi<StudentListResponse>(
          studentListEndpoint,
          {
            acadSes: data.academicSession,
            acadYear: data.academicYear,
            courseID: data.courseId,
            examMethod: examMethod,
            limit: limit,
            offset: offset,
          },
        );

        if (!studentListResponse.success) {
          console.error(
            `[Job ${jobId}] Failed to fetch students for ${examMethod}:`,
            studentListResponse.error,
          );
          break;
        }

        const studentData: StudentListResponse | undefined =
          studentListResponse.data;
        const students: StudentListStudent[] = studentData?.values ?? [];

        if (students.length > 0) {
          studentsForMethod.push(...students);
        }

        const pageSize = studentData?.pageSize ?? limit;
        const currentPage = studentData?.currentPage ?? 1;

        if (students.length === 0 || students.length < pageSize) {
          hasMore = false;
        } else {
          offset = currentPage; 
        }
      }

      allStudentData[examMethod] = studentsForMethod;
      console.log(
        `[Job ${jobId}] Fetched ${studentsForMethod.length} students for ${examMethod}`,
      );

      // Update progress
      const currentProgress = 20 + (i + 1) * progressPerExamMethod;
      jobStore.update(jobId, { progress: Math.min(currentProgress, 80) });

      // Check cancellation after each exam method
      if (checkCancelled(jobId)) {
        console.log(
          `[Job ${jobId}] Calculation cancelled during student list fetching`,
        );
        return;
      }
    }

    // Replace MTE-1 marks with RE-SESSION marks for students who appear in both.
    // Keep unique students from MTE-1 only; for each, use RE-SESSION marks if present, else MTE-1 marks.
    const reSessionStudents = allStudentData["RE-SESSION"] || [];
    const reSessionByStudentNo = new Map<string, StudentListStudent>();
    for (const s of reSessionStudents) {
      const no = (s.studentNo || s["Student No"] || "").toString().trim();
      if (no) reSessionByStudentNo.set(no, s);
    }
    for (const mte1Key of ["MTE-1", "MTE -1"]) {
      const mte1Students = allStudentData[mte1Key];
      if (!mte1Students || reSessionByStudentNo.size === 0) {
        continue;
      }
      const replaced: StudentListStudent[] = mte1Students.map(
        (s: StudentListStudent) => {
          const no = (s.studentNo || s["Student No"] || "").toString().trim();
          const reSessionRecord = no ? reSessionByStudentNo.get(no) : undefined;
          return reSessionRecord ?? s;
        },
      );
      const replaceCount = replaced.filter(
        (s, i) => s !== mte1Students[i],
      ).length;
      allStudentData[mte1Key] = replaced;
      console.log(
        `[Job ${jobId}] Replaced MTE-1 with RE-SESSION for ${mte1Key}: ${replaceCount} students' marks updated, ${replaced.length} total students`,
      );
    }

    // Filter non-ETE exam methods to only include students present in ETE
    const eteStudents = allStudentData["ETE"] || [];
    const eteStudentNos = new Set(
      eteStudents.map((s) =>
        (s.studentNo || s["Student No"] || "").toString().trim()
      )
    );
    eteStudentNos.delete("");
    for (const examMethod of Object.keys(allStudentData)) {
      if (examMethod === "ETE") continue;
      const before = allStudentData[examMethod].length;
      allStudentData[examMethod] = allStudentData[examMethod].filter((s) => {
        const no = (s.studentNo || s["Student No"] || "").toString().trim();
        return no && eteStudentNos.has(no);
      });
      const after = allStudentData[examMethod].length;
      if (before !== after) {
        console.log(
          `[Job ${jobId}] Filtered ${examMethod}: only students in ETE kept: ${before} → ${after}`
        );
      }
    }

    // Check cancellation before fetching CO mapping
    if (checkCancelled(jobId)) {
      console.log(
        `[Job ${jobId}] Calculation cancelled before fetching CO mapping`,
      );
      return;
    }

    // Step 4: Fetch CO to Question mapping
    jobStore.update(jobId, { progress: 80 });
    console.log(`[Job ${jobId}] Fetching CO to Question mapping...`);

    const coMappingEndpoint =
      process.env.NEXT_PUBLIC_GET_COURSE_WISE_MULTI_QUESTION ||
      "/MUJOBE/MUJAPIOBE/v2.0/companies(480ceadc-3108-f011-8e30-7c1e520f486f)/MUJOBE(00000000-0000-0000-0000-000000000000)/Microsoft.NAV.GetCourseWiseMultiQuestion";

    const coMappingResponse = await serverCallApi<Record<string, unknown>>(coMappingEndpoint, {
      acadSess: data.academicSession,
      acadYear: data.academicYear,
      courseCode: data.courseCode,
      courseID: data.courseId,
    });

    if (!coMappingResponse.success || !coMappingResponse.data) {
      throw new Error(
        coMappingResponse.error || "Failed to fetch CO to Question mapping",
      );
    }

    // Parse the CO mapping response (it's a JSON string inside value property)
    // Response format: { "@odata.context": "...", "value": "{\"value\": [...]}" }
    let coMappingData: unknown[] = [];
    const mappingResponseData = coMappingResponse.data;

    console.log(
      `[Job ${jobId}] CO mapping response type:`,
      typeof mappingResponseData,
      "has value:",
      !!(mappingResponseData as Record<string, unknown>)?.value,
    );

    if (typeof mappingResponseData === "string") {
      // Direct JSON string
      const parsed = JSON.parse(mappingResponseData);
      coMappingData = parsed.value || parsed || [];
    } else if (mappingResponseData && typeof mappingResponseData === "object") {
      // Check for value property
      const mappingData = mappingResponseData as Record<string, unknown>;
      if (mappingData.value) {
        const valueData = mappingData.value;
        if (typeof valueData === "string") {
          // Nested JSON string (as shown in user's example)
          const parsed = JSON.parse(valueData);
          coMappingData = parsed.value || parsed || [];
        } else if (Array.isArray(valueData)) {
          coMappingData = valueData;
        }
      } else if (Array.isArray(mappingResponseData)) {
        coMappingData = mappingResponseData;
      }
    }

    console.log(
      `[Job ${jobId}] Parsed CO mapping data:`,
      JSON.stringify(coMappingData, null, 2),
    );

    // Create question-to-CO mapping matrix
    // New API: { value: [ { "MTE -1": [ { questionCode, COs: [ { cO } ] } ] } ] }
    // Structure: { examMethod: { questionCode: string[] } } (one question can map to multiple COs)
    const questionToCOMatrix: Record<string, Record<string, string[]>> = {};

    for (const item of coMappingData) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      for (const [examMethod, questions] of Object.entries(item as Record<string, unknown>)) {
        if (!questionToCOMatrix[examMethod]) {
          questionToCOMatrix[examMethod] = {};
        }
        if (Array.isArray(questions)) {
          for (const question of questions) {
            const questionCode =
              question.questionCode || question["Question Code"] || "";
            if (!questionCode) continue;
            // New format: COs array of { cO: "..." }
            const cosArray = question.COs || question["COs"];
            let cos: string[] = [];
            if (Array.isArray(cosArray)) {
              cos = cosArray
                .map((x: { cO?: string; CO?: string }) => x?.cO ?? x?.CO ?? "")
                .filter(Boolean);
            }
            // Fallback: single cO / CO (old format)
            if (cos.length === 0) {
              const single = question.cO || question["CO"] || "";
              if (single) cos = [single];
            }
            if (cos.length > 0) {
              questionToCOMatrix[examMethod][questionCode] = cos;
            }
          }
        }
      }
    }

    console.log(
      `[Job ${jobId}] CO mapping matrix created:`,
      JSON.stringify(questionToCOMatrix, null, 2),
    );

    // Check cancellation before calculations
    if (checkCancelled(jobId)) {
      console.log(`[Job ${jobId}] Calculation cancelled before calculations`);
      return;
    }

    // Step 5: Calculate normalized marks and threshold crossings
    jobStore.update(jobId, { progress: 85 });
    console.log(
      `[Job ${jobId}] Calculating normalized marks and threshold crossings...`,
    );

    // Calculate normalized marks and threshold crossings for each exam method
    const thresholdAnalysis: Record<string, unknown> = {};

    for (const examMethod of examMethodsList) {
      const students = allStudentData[examMethod] || [];
      const questionAnalysis: Record<
        string,
        {
          questionCode: string;
          maximumMark: number;
          studentsCrossedThreshold: number;
          totalStudents: number;
          normalizedMarks: Array<{
            studentNo: string;
            normalizedMark: number;
            crossedThreshold: boolean;
          }>;
        }
      > = {};

      // Process each student
      for (const student of students) {
        const studentNo = student.studentNo || student["Student No"] || "";
        const marks = student.marks || [];

        // Process each question/mark for this student
        for (const mark of marks) {
          const questionCode = mark.questionCode || mark["Question Code"] || "";
          const markObtained = parseFloat(
            mark.markObtained || mark["Mark Obtained"] || "0",
          );
          const maximumMark = parseFloat(
            mark.maximumMark || mark["Maximum Mark"] || "1",
          );

          if (!questionCode || maximumMark === 0) continue;

          // Calculate normalized mark: ROUND(10 * MarksObtained / MaxMarksOfThatQuestion, 0)
          const normalizedMark = Math.round((10 * markObtained) / maximumMark);

          // Check if crossed threshold (threshold from GetProgramOutcomeAndMappingValue API)
          const crossedThreshold = normalizedMark >= thresholdValue;

          // Initialize question analysis if not exists
          if (!questionAnalysis[questionCode]) {
            questionAnalysis[questionCode] = {
              questionCode: questionCode,
              maximumMark: maximumMark,
              studentsCrossedThreshold: 0,
              totalStudents: 0,
              normalizedMarks: [],
            };
          }

          // Add normalized mark for this student (only once per student per question)
          // Check if this student already has an entry for this question
          const existingEntry = questionAnalysis[
            questionCode
          ].normalizedMarks.find((entry) => entry.studentNo === studentNo);

          if (!existingEntry) {
            // Add normalized mark for this student
            questionAnalysis[questionCode].normalizedMarks.push({
              studentNo: studentNo,
              normalizedMark: normalizedMark,
              crossedThreshold: crossedThreshold,
            });

            // Count total students for this question
            questionAnalysis[questionCode].totalStudents++;

            // Count if crossed threshold
            if (crossedThreshold) {
              questionAnalysis[questionCode].studentsCrossedThreshold++;
            }
          } else {
            // Update existing entry if needed (in case of duplicate marks)
            existingEntry.normalizedMark = normalizedMark;
            existingEntry.crossedThreshold = crossedThreshold;
          }
        }
      }

      // Convert questionAnalysis to array format
      const questionAnalysisArray = Object.values(questionAnalysis).map(
        (q) => ({
          ...q,
          percentageCrossedThreshold:
            q.totalStudents > 0
              ? ((q.studentsCrossedThreshold / q.totalStudents) * 100).toFixed(
                  2,
                )
              : "0.00",
        }),
      );

      thresholdAnalysis[examMethod] = {
        examMethod: examMethod,
        totalStudents: students.length,
        questions: questionAnalysisArray,
        summary: {
          totalQuestions: questionAnalysisArray.length,
          averagePercentageCrossed:
            questionAnalysisArray.length > 0
              ? (
                  questionAnalysisArray.reduce(
                    (sum, q) => sum + parseFloat(q.percentageCrossedThreshold),
                    0,
                  ) / questionAnalysisArray.length
                ).toFixed(2)
              : "0.00",
        },
      };
    }

    // Step 6: Calculate CO-wise student counts (students who crossed threshold per CO)
    jobStore.update(jobId, { progress: 90 });
    console.log(`[Job ${jobId}] Calculating CO-wise student counts...`);

    const coAnalysis: Record<string, unknown> = {};

    const getQuestionAnalysis = (examMethod: string) => {
      const entry = thresholdAnalysis[examMethod] as {
        questions?: Array<{
          questionCode: string;
          studentsCrossedThreshold: number;
          totalStudents: number;
          normalizedMarks: Array<{ studentNo: string; crossedThreshold: boolean }>;
        }>;
      } | undefined;
      return entry?.questions || [];
    };

    for (const examMethod of examMethodsList) {
      const questionToCO = questionToCOMatrix[examMethod] || {};
      const students = allStudentData[examMethod] || [];
      const questionAnalysis = getQuestionAnalysis(examMethod);

      // Create CO-wise tracking
      // Structure: { co: { studentsCrossed: Set<studentNo>, totalStudents: Set<studentNo>, questions: [] } }
      const coTracking: Record<
        string,
        {
          co: string;
          studentsCrossedThreshold: Set<string>;
          totalStudents: Set<string>;
          questions: Array<{
            questionCode: string;
            studentsCrossed: number;
            totalStudents: number;
          }>;
        }
      > = {};

      // Process each question and map to CO(s) - one question can map to multiple COs
      for (const question of questionAnalysis) {
        const questionCode = question.questionCode;
        const cos = questionToCO[questionCode] || [];

        if (cos.length === 0) continue;

        for (const co of cos) {
          if (!co || co.trim() === "") continue;

          if (!coTracking[co]) {
            coTracking[co] = {
              co: co,
              studentsCrossedThreshold: new Set(),
              totalStudents: new Set(),
              questions: [],
            };
          }

          for (const normalizedMark of question.normalizedMarks) {
            coTracking[co].totalStudents.add(normalizedMark.studentNo);
            if (normalizedMark.crossedThreshold) {
              coTracking[co].studentsCrossedThreshold.add(
                normalizedMark.studentNo,
              );
            }
          }

          coTracking[co].questions.push({
            questionCode: questionCode,
            studentsCrossed: question.studentsCrossedThreshold,
            totalStudents: question.totalStudents,
          });
        }
      }

      // Convert to final format
      const coAnalysisArray = Object.values(coTracking).map((coData) => {
        // Calculate attainment value: (sum of students crossed threshold for all questions) / (number of questions * total students)
        const totalStudentsForCO = coData.totalStudents.size;
        const numberOfQuestions = coData.questions.length;
        const sumOfStudentsCrossed = coData.questions.reduce(
          (sum, q) => sum + q.studentsCrossed,
          0,
        );

        // Attainment Value = (Sum of students crossed threshold) / (Number of questions × Total students)
        const attainmentValue =
          numberOfQuestions > 0 && totalStudentsForCO > 0
            ? (
                sumOfStudentsCrossed /
                (numberOfQuestions * totalStudentsForCO)
              ).toFixed(4)
            : "0.0000";

        return {
          co: coData.co,
          studentsCrossedThreshold: coData.studentsCrossedThreshold.size,
          totalStudents: coData.totalStudents.size,
          percentageCrossedThreshold:
            coData.totalStudents.size > 0
              ? (
                  (coData.studentsCrossedThreshold.size /
                    coData.totalStudents.size) *
                  100
                ).toFixed(2)
              : "0.00",
          attainmentValue: attainmentValue,
          numberOfQuestions: numberOfQuestions,
          sumOfStudentsCrossed: sumOfStudentsCrossed,
          questions: coData.questions,
        };
      });

      coAnalysis[examMethod] = {
        examMethod: examMethod,
        totalStudents: students.length,
        coBreakdown: coAnalysisArray,
        summary: {
          totalCOs: coAnalysisArray.length,
          averagePercentageCrossed:
            coAnalysisArray.length > 0
              ? (
                  coAnalysisArray.reduce(
                    (sum, co) =>
                      sum + parseFloat(co.percentageCrossedThreshold),
                    0,
                  ) / coAnalysisArray.length
                ).toFixed(2)
              : "0.00",
        },
      };
    }

    // Step 7: Create mapping from CO to Course Attainment Level
    jobStore.update(jobId, { progress: 92 });
    console.log(`[Job ${jobId}] Creating CO to attainment level mapping...`);

    // Map CO ("Sno Description") to attainment level from outcomeValues
    const coAttainmentLevel: Record<string, number> = {};
    data.courseOutcomes.forEach((outcome, index) => {
      const co = outcome["Sno Description"];
      const feedbackValue = data.outcomeValues[index];
      if (co && feedbackValue !== undefined) {
        coAttainmentLevel[co] = feedbackValue;
      }
    });

    // Step 8: Aggregate Internal Exams (all except ETE) per CO
    jobStore.update(jobId, { progress: 93 });
    console.log(`[Job ${jobId}] Aggregating internal exams per CO...`);

    // Internal: only CWS and MTE-1 (and "MTE -1" if API uses space)
    const internalMethodNames = ["CWS", "MTE-1", "MTE -1"];
    const internalExams = examMethodsList.filter((method) =>
      internalMethodNames.includes((method || "").trim()),
    );
    const externalExam = "ETE";

    // Structure to aggregate internal exams per CO
    const aggregatedInternalCO: Record<
      string,
      {
        co: string;
        totalStudentsCrossed: number; // Sum across all internal exam questions
        totalQuestions: number; // Sum of questions across all internal exams
        totalStudents: Set<string>; // Unique students across all internal exams
        sumOfStudentsCrossed: number; // Sum of students crossed for all questions
      }
    > = {};

    // Aggregate data from all internal exams
    // We need to reconstruct student sets from question data
    for (const examMethod of internalExams) {
      const questionToCO = questionToCOMatrix[examMethod] || {};
      const questionAnalysis = getQuestionAnalysis(examMethod);

      // Process each question to aggregate per CO (one question can map to multiple COs)
      for (const question of questionAnalysis) {
        const questionCode = question.questionCode;
        const cos = questionToCO[questionCode] || [];

        if (cos.length === 0) continue;

        for (const co of cos) {
          if (!co || co.trim() === "") continue;

          if (!aggregatedInternalCO[co]) {
            aggregatedInternalCO[co] = {
              co: co,
              totalStudentsCrossed: 0,
              totalQuestions: 0,
              totalStudents: new Set(),
              sumOfStudentsCrossed: 0,
            };
          }

          aggregatedInternalCO[co].totalQuestions += 1;
          aggregatedInternalCO[co].sumOfStudentsCrossed +=
            question.studentsCrossedThreshold;

          for (const normalizedMark of question.normalizedMarks) {
            aggregatedInternalCO[co].totalStudents.add(
              normalizedMark.studentNo,
            );
          }
        }
      }
    }

    // Calculate internal attainment value for each CO
    // Excel logic: (sum of question-wise students crossed for this CO) / (total questions mapping to this CO × total students)
    const internalAttainment: Record<string, number> = {};
    for (const [co, coData] of Object.entries(aggregatedInternalCO)) {
      const totalStudentsCount = coData.totalStudents.size;
      const internalAttainmentValue =
        coData.totalQuestions > 0 && totalStudentsCount > 0
          ? coData.sumOfStudentsCrossed /
            (coData.totalQuestions * totalStudentsCount)
          : 0;
      internalAttainment[co] = internalAttainmentValue;
    }

    // Step 9: Get External (ETE) Attainment per CO
    jobStore.update(jobId, { progress: 94 });
    console.log(`[Job ${jobId}] Getting external (ETE) attainment per CO...`);

    const externalAttainment: Record<string, number> = {};
    const eteEntry = coAnalysis[externalExam] as { coBreakdown?: Array<{ co: string; attainmentValue: string }> } | undefined;
    const eteCoBreakdown = eteEntry?.coBreakdown || [];

    for (const coData of eteCoBreakdown) {
      externalAttainment[coData.co] = parseFloat(coData.attainmentValue);
    }

    // Step 10: Calculate Direct Attainment per CO (60% Internal + 40% External)
    jobStore.update(jobId, { progress: 95 });
    console.log(`[Job ${jobId}] Calculating direct attainment per CO...`);

    const directAttainment: Record<string, number> = {};
    const allCOs = new Set([
      ...Object.keys(internalAttainment),
      ...Object.keys(externalAttainment),
    ]);

    for (const co of allCOs) {
      const internal = internalAttainment[co] || 0;
      const external = externalAttainment[co] || 0;
      // Direct = 60% Internal + 40% External
      directAttainment[co] = 0.6 * internal + 0.4 * external;
    }

    // Step 11: Calculate Indirect Attainment and Exact Attainment per CO
    jobStore.update(jobId, { progress: 96 });
    console.log(
      `[Job ${jobId}] Calculating indirect and exact attainment per CO...`,
    );

    const indirectAttainment: Record<string, number> = {};
    const exactAttainment: Record<string, number> = {};
    const exactAttainmentDetails: Record<
      string,
      {
        co: string;
        directAttainment: number;
        courseFeedback: number;
        indirectAttainment: number;
        exactAttainment: number;
        exactAttainmentPercentage: number;
        level: number;
      }
    > = {};
    const coAttainmentLevels: Record<string, number> = {}; // This will store levels (1, 2, or 3)

    for (const co of allCOs) {
      const direct = directAttainment[co] || 0;
      const feedback = coAttainmentLevel[co] || 0; // Raw courseFeedback value (0-3 scale)

      // Calculate Indirect Attainment: 20% of normalized courseFeedback
      // Normalize feedback from 0-3 scale to 0-1 scale (divide by 3)
      const normalizedFeedback = feedback / 3;
      const indirect = 0.2 * normalizedFeedback;
      indirectAttainment[co] = indirect;

      // Calculate Exact Attainment: 80% Direct + Indirect (which is 20% of normalized feedback)
      const exact = 0.8 * direct + indirect;
      exactAttainment[co] = exact;

      // Convert to percentage
      const exactPercentage = exact * 100;

      // Step 12: Map to Levels based on Exact Attainment Percentage
      let level = 0;
      if (exactPercentage >= 60 && exactPercentage < 70) {
        level = 1;
      } else if (exactPercentage >= 70 && exactPercentage < 80) {
        level = 2;
      } else if (exactPercentage >= 80) {
        level = 3;
      }

      // Store the level in coAttainmentLevels (this replaces the old coAttainmentLevel)
      coAttainmentLevels[co] = level;

      exactAttainmentDetails[co] = {
        co: co,
        directAttainment: direct,
        courseFeedback: feedback,
        indirectAttainment: indirect,
        exactAttainment: exact,
        exactAttainmentPercentage: exactPercentage,
        level: level,
      };
    }

    // Step 13: PO mapping list already fetched in Step 1.5 (poList, poMappingList). Proceed to PO to CO map calculation.

    // Step 14: PO to CO map calculation (coRelationValue * valueOfCOAttainmentLevel / SumOfTheCorealtionsOfThatPO)
    // Keys are string IDs (e.g. "CCE2101.1" for CO, "PO-1" for PO)
    type POCoMapCell = number | "--";
    const poToCoMap: Record<string, Record<string, POCoMapCell>> = {};
    const poSumPerPO: Record<string, number> = {};
    let poAverageValue: number = 0;

    if (poMappingList.length > 0) {
      const coKeysOrdered = data.courseOutcomes
        .map((o) => o["Sno Description"])
        .filter((k): k is string => !!k);
      const seenOutCome = new Set<string>();
      const uniqueOutComeNos = poMappingList
        .filter((m) => {
          if (seenOutCome.has(m.outComeNo)) return false;
          seenOutCome.add(m.outComeNo);
          return true;
        })
        .map((m) => m.outComeNo);
      const outComeNoToCoKey: Record<string, string> = {};
      for (
        let i = 0;
        i < Math.min(uniqueOutComeNos.length, coKeysOrdered.length);
        i++
      ) {
        outComeNoToCoKey[uniqueOutComeNos[i]] = coKeysOrdered[i];
      }

      // Build coRelationValue matrix: coKey -> poKey -> number (last value wins for duplicate (outComeNo, pOMapNo))
      const coRelationMatrix: Record<string, Record<string, number>> = {};
      for (const item of poMappingList) {
        const coKey = outComeNoToCoKey[item.outComeNo];
        if (!coKey) continue;
        const poKey = item.pOMapNo;
        const val = parseInt(item.coRelationValue, 10) || 0;
        if (!coRelationMatrix[coKey]) coRelationMatrix[coKey] = {};
        coRelationMatrix[coKey][poKey] = val;
      }

      // Sum of correlations per PO (SumOfTheCorealtionsOfThatPO)
      const sumOfCorrelationsForPO: Record<string, number> = {};
      for (const coKey of Object.keys(coRelationMatrix)) {
        for (const [poKey, val] of Object.entries(coRelationMatrix[coKey])) {
          sumOfCorrelationsForPO[poKey] =
            (sumOfCorrelationsForPO[poKey] || 0) + val;
        }
      }

      const allPOKeys = Object.keys(sumOfCorrelationsForPO);

      // valueOfCOAttainmentLevel = coAttainmentLevels (level 1, 2, or 3); include all COs as rows
      for (const coKey of coKeysOrdered) {
        poToCoMap[coKey] = {};
        const coLevel = coAttainmentLevels[coKey] ?? 0;
        const coRels = coRelationMatrix[coKey];
        for (const poKey of allPOKeys) {
          const coRel = coRels?.[poKey] ?? 0;
          const sumForPO = sumOfCorrelationsForPO[poKey] || 1;
          if (coRel > 0 && sumForPO > 0) {
            const cellValue = (coRel * coLevel) / sumForPO;
            poToCoMap[coKey][poKey] = Math.round(cellValue * 100) / 100;
          } else {
            poToCoMap[coKey][poKey] = "--";
          }
        }
      }

      // Sum up each PO (sum of column for that PO)
      for (const poKey of Object.keys(sumOfCorrelationsForPO)) {
        let sum = 0;
        for (const coKey of Object.keys(poToCoMap)) {
          const v = poToCoMap[coKey][poKey];
          if (typeof v === "number") sum += v;
        }
        poSumPerPO[poKey] = Math.round(sum * 100) / 100;
      }

      // Average value of PO (average of the PO sums)
      const poSums = Object.values(poSumPerPO);
      poAverageValue =
        poSums.length > 0
          ? Math.round(
              (poSums.reduce((a, b) => a + b, 0) / poSums.length) * 100,
            ) / 100
          : 0;

      console.log(
        `[Job ${jobId}] PO to CO map: ${Object.keys(poToCoMap).length} COs, ${Object.keys(poSumPerPO).length} POs, PO average = ${poAverageValue}`,
      );
    }

    // Step 15: Prepare final results
    jobStore.update(jobId, { progress: 97 });
    console.log(`[Job ${jobId}] Preparing final results...`);

    const result = {
      message: "Calculation completed successfully",
      calculatedData: {
        courseCode: data.courseCode,
        courseId: data.courseId,
        academicYear: data.academicYear,
        academicSession: data.academicSession,
        semester: data.semester,
        threshold: thresholdValue,
        programCode: data.programCode,
        examMethods: examMethodsList,
        examMethodsCount: examMethodsList.length,
        studentData: allStudentData,
        totalStudentsByMethod: Object.fromEntries(
          Object.entries(allStudentData).map(([method, students]) => [
            method,
            students.length,
          ]),
        ),
        questionToCOMatrix: questionToCOMatrix,
        thresholdAnalysis: thresholdAnalysis,
        coAnalysis: coAnalysis,
        // New aggregated calculations
        aggregatedInternalCO: Object.fromEntries(
          Object.entries(aggregatedInternalCO).map(([co, coData]) => [
            co,
            {
              ...coData,
              totalStudents: coData.totalStudents.size,
              internalAttainmentValue: internalAttainment[co] || 0,
            },
          ]),
        ),
        internalAttainment: internalAttainment,
        externalAttainment: externalAttainment,
        directAttainment: directAttainment,
        indirectAttainment: indirectAttainment,
        exactAttainment: exactAttainment,
        exactAttainmentDetails: exactAttainmentDetails,
        courseFeedbackValues: coAttainmentLevel, // Original course feedback values (0-3 scale)
        coAttainmentLevel: coAttainmentLevels, // Levels (1, 2, or 3) based on exactAttainment
        outcomesProcessed: data.courseOutcomes.length,
        valuesProcessed: Object.keys(data.outcomeValues).length,
        // PO mapping list for PO calculations
        POs: poList,
        POMappingList: poMappingList,
        // PO to CO map (cell = coRelationValue * valueOfCOAttainmentLevel / SumOfTheCorealtionsOfThatPO); keys are string IDs
        poToCoMap: poToCoMap,
        // Sum of calculated values for each PO (sum up each PO column)
        poSumPerPO: poSumPerPO,
        // Average of PO sums
        poAverageValue: poAverageValue,
      },
    };

    jobStore.update(jobId, {
      status: "completed",
      progress: 100,
      result: result,
    });

    console.log(`[Job ${jobId}] Calculation completed successfully`);
  } catch (error) {
    console.error(`[Job ${jobId}] Calculation failed:`, error);
    jobStore.update(jobId, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
    throw error;
  }
}

/*
{
  "message": "Calculation completed successfully",
  "calculatedData": {
    "courseCode": "CY2106",
    "courseId": "BSCCHEMIII20003",
    "academicYear": "22-23",
    "academicSession": "JUL-NOV 2022",
    "examMethods": [
      "CWS",
      "ETE",
      "MTE -1",
      "MTE -2"
    ],
    "examMethodsCount": 4,
    "studentData": {
      "CWS": [
        {
          "studentNo": "S/21-22/00567",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "9",
              "maximumMark": "10"
            },
            {
              "questionCode": "Q2",
              "markObtained": "6",
              "maximumMark": "10"
            }
          ]
        },
        {
          "studentNo": "S/21-22/00569",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "10",
              "maximumMark": "10"
            },
            {
              "questionCode": "Q2",
              "markObtained": "8",
              "maximumMark": "10"
            }
          ]
        },
        {
          "studentNo": "S/21-22/04140",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "9",
              "maximumMark": "10"
            },
            {
              "questionCode": "Q2",
              "markObtained": "6",
              "maximumMark": "10"
            }
          ]
        },
        {
          "studentNo": "S/21-22/04315",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "10",
              "maximumMark": "10"
            },
            {
              "questionCode": "Q2",
              "markObtained": "8",
              "maximumMark": "10"
            }
          ]
        },
        {
          "studentNo": "S/21-22/04370",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "10",
              "maximumMark": "10"
            },
            {
              "questionCode": "Q2",
              "markObtained": "9",
              "maximumMark": "10"
            }
          ]
        },
        {
          "studentNo": "S/21-22/04456",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "10",
              "maximumMark": "10"
            },
            {
              "questionCode": "Q2",
              "markObtained": "8",
              "maximumMark": "10"
            }
          ]
        }
      ],
      "ETE": [
        {
          "studentNo": "S/21-22/00567",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "4",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q2",
              "markObtained": "4",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q3",
              "markObtained": "2",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q4",
              "markObtained": "6",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q5",
              "markObtained": "3",
              "maximumMark": "8"
            }
          ]
        },
        {
          "studentNo": "S/21-22/00569",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "8",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q2",
              "markObtained": "8",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q3",
              "markObtained": "7",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q4",
              "markObtained": "6",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q5",
              "markObtained": "7",
              "maximumMark": "8"
            }
          ]
        },
        {
          "studentNo": "S/21-22/04140",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "2",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q2",
              "markObtained": "4",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q3",
              "markObtained": "1",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q4",
              "markObtained": "8",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q5",
              "markObtained": "0",
              "maximumMark": "8"
            }
          ]
        },
        {
          "studentNo": "S/21-22/04315",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "8",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q2",
              "markObtained": "4",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q3",
              "markObtained": "5",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q4",
              "markObtained": "7",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q5",
              "markObtained": "4",
              "maximumMark": "8"
            }
          ]
        },
        {
          "studentNo": "S/21-22/04370",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "7",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q2",
              "markObtained": "6",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q3",
              "markObtained": "6",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q4",
              "markObtained": "8",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q5",
              "markObtained": "7",
              "maximumMark": "8"
            }
          ]
        },
        {
          "studentNo": "S/21-22/04456",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "8",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q2",
              "markObtained": "5",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q3",
              "markObtained": "7",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q4",
              "markObtained": "7",
              "maximumMark": "8"
            },
            {
              "questionCode": "Q5",
              "markObtained": "7",
              "maximumMark": "8"
            }
          ]
        }
      ],
      "MTE -1": [
        {
          "studentNo": "S/21-22/00567",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "1.5",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q2",
              "markObtained": "3",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q3",
              "markObtained": "3.5",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q4",
              "markObtained": "1",
              "maximumMark": "5"
            }
          ]
        },
        {
          "studentNo": "S/21-22/00569",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "3",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q2",
              "markObtained": "4",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q3",
              "markObtained": "5",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q4",
              "markObtained": "3.5",
              "maximumMark": "5"
            }
          ]
        },
        {
          "studentNo": "S/21-22/04140",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "0",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q2",
              "markObtained": "0",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q3",
              "markObtained": "1",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q4",
              "markObtained": "1",
              "maximumMark": "5"
            }
          ]
        },
        {
          "studentNo": "S/21-22/04315",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "2.5",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q2",
              "markObtained": "4",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q3",
              "markObtained": "0.5",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q4",
              "markObtained": "1",
              "maximumMark": "5"
            }
          ]
        },
        {
          "studentNo": "S/21-22/04370",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "5",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q2",
              "markObtained": "4",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q3",
              "markObtained": "4",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q4",
              "markObtained": "3",
              "maximumMark": "5"
            }
          ]
        },
        {
          "studentNo": "S/21-22/04456",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "3.5",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q2",
              "markObtained": "4",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q3",
              "markObtained": "4",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q4",
              "markObtained": "3.5",
              "maximumMark": "5"
            }
          ]
        }
      ],
      "MTE -2": [
        {
          "studentNo": "S/21-22/00567",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "1",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q2",
              "markObtained": "1.5",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q3",
              "markObtained": "2.5",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q4",
              "markObtained": "2.5",
              "maximumMark": "5"
            }
          ]
        },
        {
          "studentNo": "S/21-22/00569",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "4",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q2",
              "markObtained": "4",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q3",
              "markObtained": "3.5",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q4",
              "markObtained": "4.5",
              "maximumMark": "5"
            }
          ]
        },
        {
          "studentNo": "S/21-22/04140",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "1",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q2",
              "markObtained": "0",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q3",
              "markObtained": "1.5",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q4",
              "markObtained": "3.5",
              "maximumMark": "5"
            }
          ]
        },
        {
          "studentNo": "S/21-22/04315",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "0",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q2",
              "markObtained": "3",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q3",
              "markObtained": "3.5",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q4",
              "markObtained": "4.5",
              "maximumMark": "5"
            }
          ]
        },
        {
          "studentNo": "S/21-22/04370",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "4",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q2",
              "markObtained": "5",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q3",
              "markObtained": "4.5",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q4",
              "markObtained": "4.5",
              "maximumMark": "5"
            }
          ]
        },
        {
          "studentNo": "S/21-22/04456",
          "marks": [
            {
              "questionCode": "Q1",
              "markObtained": "3",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q2",
              "markObtained": "3",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q3",
              "markObtained": "4.5",
              "maximumMark": "5"
            },
            {
              "questionCode": "Q4",
              "markObtained": "4.5",
              "maximumMark": "5"
            }
          ]
        }
      ]
    },
    "totalStudentsByMethod": {
      "CWS": 6,
      "ETE": 6,
      "MTE -1": 6,
      "MTE -2": 6
    },
    "outcomesProcessed": 5,
    "valuesProcessed": 5
  }
}
*/
