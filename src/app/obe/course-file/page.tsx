"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { format } from "date-fns";
import SideNav from "@/components/SideNav";
import Header from "@/components/Header";
import useSideNavState from "@/hooks/useSideNavState";
import { Menu, GripVertical, Eye, Trash2, ChevronUp, ChevronDown, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useSelector } from "react-redux";
import { RootState } from "@/app/store";
import { CoAttainmentResultView } from "@/components/CoAttainmentResultView";
import { callApiViaProxy } from "@/utils/proxyApiIntercepter";
import { base64Utf8ToJson, COPO_BLOB_GET_URL_TEST, extractBase64FromCOPOApiResponse } from "@/utils/coPoAttainmentBlobApi";
import { buildCourseExitFeedbackGetUrl } from "@/utils/courseExitFeedbackApi";
import { OBE_GET_COURSE_COORDINATOR_PATH, OBE_GET_EMPLOYEE_DETAILS_PATH, URL_NOT_FOUND } from "@/constants";
import { CourseCoordinatorRow, GetCourseCoordinatorResponse } from "@/types";

type SectionState = { loading: boolean; error: string | null; data: unknown };

export type UploadedFileItem = { id: string; file: File; name: string };

function isAllowedCourseFileUpload(file: File): boolean {
  const name = file.name.toLowerCase();
  const mime = (file.type || "").toLowerCase();
  return mime === "application/pdf" || name.endsWith(".pdf");
}

function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const mime = (file.type || "").toLowerCase();
  return mime === "application/pdf" || name.endsWith(".pdf");
}

const FETCH_SECTIONS: { section: number; label: string }[] = [
  { section: 1, label: "Vision & Mission" },
  { section: 25, label: "Course exit survey" },
  { section: 27, label: "Attainment summary" },
  { section: 28, label: "Closure report" },
];

const UNIVERSITY_VISION_MISSION_URL = process.env.NEXT_PUBLIC_COURSE_FILE_UNIVERSITY_VISION_MISSION || URL_NOT_FOUND;
const DEPARTMENT_VISION_MISSION_URL = process.env.NEXT_PUBLIC_COURSE_FILE_DEPARTMENT_VISION_MISSION || URL_NOT_FOUND;

function getEnvUrl(section: number): string {
  const envMap: Record<number, string> = {
    1: process.env.NEXT_PUBLIC_COURSE_FILE_VISION_MISSION || URL_NOT_FOUND,
    18: process.env.NEXT_PUBLIC_COURSE_FILE_ATTENDANCE || URL_NOT_FOUND,
    25: URL_NOT_FOUND,
    27: URL_NOT_FOUND,
    28: process.env.NEXT_PUBLIC_COURSE_FILE_CLOSURE_REPORT || URL_NOT_FOUND,
  };
  return envMap[section] ?? URL_NOT_FOUND;
}

const SECTION_LABELS: Record<number, string> = {
  1: "Vision & Mission (University and Department)",
  2: "Faculty Profile",
  3: "Timetable of teaching faculty",
  4: "Course handout (including course closure report of previous A.Y. – if available)",
  5: "Name list of students (section wise)",
  6: "Mid Term Exam. (MTE) question paper (with CO Mapping)",
  7: "Mid Term Exam. (MTE) question paper with solution/scheme",
  8: "MTE marks containing class average (section wise)",
  9: "SoP for identification of Slow and Advance learners",
  10: "Slow learners and Advance learners (section wise)",
  11: "Record of remedial classes for slow learners",
  12: "Record of activities/assignments given to advance learners",
  13: "Assignment(s) and quiz question paper(s) with solution",
  14: "Record of MOOC (NPTEL/Coursera) completed – if any",
  15: "Re-sessional question paper (if applicable) and solution",
  16: "Re-sessional marks (section wise) with average",
  17: "CWS/Internal assessment marks (with internal bifurcation section wise)",
  18: "Attendance report and detainees (section wise)",
  19: "End semester question paper (Final and moderated copy)",
  20: "End semester question paper with solution/scheme",
  21: "End semester marks/ EA Report (section wise)",
  22: "Result analysis (section wise) – Pass %, Average GPA, % of different grades",
  23: "Feedback by students on course curriculum",
  24: "Feedback by students on teaching-learning activities",
  25: "Course exit survey (by students for indirect attainment)",
  26: "Minutes of course coordination meetings",
  27: "Course attainment summary report (last page of OBE sheet)",
  28: "Course closure report/remarks and improvement scope for next session",
};
const COURSE_FILE_SECTION_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28] as const;

const FETCHED_SECTIONS = new Set([1, 4, 28]);
const UPLOADED_SECTIONS = new Set([2, 6, 7, 9, 10, 11, 12, 13, 15, 19, 20, 23, 24, 26]);

function toFileSafePart(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

function toFileSafePartKeepingSpaces(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9. _-]/g, "");
}

function formatSessionForSection4FileName(academicSession: string, academicYear: string): string {
  const monthMap: Record<string, string> = {
    JAN: "Jan",
    FEB: "Feb",
    MAR: "Mar",
    APR: "Apr",
    MAY: "May",
    JUN: "Jun",
    JUL: "July",
    AUG: "Aug",
    SEP: "Sep",
    OCT: "Oct",
    NOV: "Nov",
    DEC: "Dec",
  };
  const normalized = academicSession.trim().toUpperCase();
  const match = normalized.match(/^([A-Z]{3})-([A-Z]{3})\s+(\d{4})$/);
  if (match) {
    const from = monthMap[match[1]] || match[1];
    const to = monthMap[match[2]] || match[2];
    const yy = match[3].slice(-2);
    return `${from} ${to} ${yy}`;
  }
  const yyFromYear = academicYear.trim().match(/^(\d{2})/);
  const yy = yyFromYear ? yyFromYear[1] : "";
  const safe = academicSession
    .trim()
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ");
  return yy ? `${safe} ${yy}` : safe;
}

function generateSection4CourseHandoutFileName(args: { courseId: string; courseCode: string; academicYear: string; academicSession: string }): string {
  const courseCode = toFileSafePart(args.courseCode || args.courseId || "course");
  const sessionLabel = toFileSafePartKeepingSpaces(formatSessionForSection4FileName(args.academicSession || "", args.academicYear || ""));
  return `04. ${courseCode}_Course Handout_${sessionLabel}.pdf`;
}

function getFacultyTimetableUrl(): string {
  return process.env.NEXT_PUBLIC_COURSE_FILE_FACULTY_WISE_TIMETABLE || URL_NOT_FOUND;
}

function getCourseWiseMultiFacultyUrl(): string {
  return process.env.NEXT_PUBLIC_COURSE_FILE_MULTI_FACULTY || URL_NOT_FOUND;
}

function getStudentListSectionWiseUrl(): string {
  return process.env.NEXT_PUBLIC_COURSE_FILE_STUDENT_LIST_SECTION_WISE || URL_NOT_FOUND;
}

function getCourseOutcomeUrl(): string {
  return process.env.NEXT_PUBLIC_GET_COURSE_OUTCOME || URL_NOT_FOUND;
}

const EXAM_MARKS_COURSE_FILE_SECTIONS = [8, 16, 17, 21] as const;
type ExamMarksCourseFileSection = (typeof EXAM_MARKS_COURSE_FILE_SECTIONS)[number];

const EXAM_MARKS_SECTION_UI: Record<ExamMarksCourseFileSection, { examMethod: string; rowTitlePrefix: string; description: string; viewerShortTitle: string }> =
  {
    8: {
      examMethod: "MTE -1",
      rowTitlePrefix: "MTE-1 marks — Section",
      description:
        "MTE-1 marks per section (GetAllExmMethodStudListWmarks). Open a section with the eye icon; rows are filtered by student numbers from the section student list.",
      viewerShortTitle: "MTE-1 marks",
    },
    16: {
      examMethod: "RE-SESSION",
      rowTitlePrefix: "Re-sessional marks — Section",
      description: "Re-sessional marks (exam method RE-SESSION) per section, same API as MTE. Filtered by student numbers from the section student list.",
      viewerShortTitle: "Re-sessional marks",
    },
    17: {
      examMethod: "CWS",
      rowTitlePrefix: "CWS marks — Section",
      description: "CWS / internal marks (exam method CWS) per section, same API as MTE. Filtered by student numbers from the section student list.",
      viewerShortTitle: "CWS marks",
    },
    21: {
      examMethod: "ETE",
      rowTitlePrefix: "End-semester marks — Section",
      description: "End-semester marks (exam method ETE) per section, same API as MTE. Filtered by student numbers from the section student list.",
      viewerShortTitle: "End-semester (ETE) marks",
    },
  };

function isExamMarksCourseFileSection(n: number): n is ExamMarksCourseFileSection {
  return (EXAM_MARKS_COURSE_FILE_SECTIONS as readonly number[]).includes(n);
}

function getExamMethodMarksUrl(): string {
  return process.env.NEXT_PUBLIC_COURSE_FILE_MTE_MARKS || process.env.NEXT_PUBLIC_GET_EXAM_METHOD_STUDENT_LIST || URL_NOT_FOUND;
}

type MteMarkEntry = { questionCode?: string; markObtained?: string; maximumMark?: string };
type MteStudentMarksRow = {
  studentNo?: string;
  marks?: MteMarkEntry[];
  total?: number | string;
  revGrade?: string;
  studentName?: string;
  registrationNo?: string;
  /** MTE-1 only: student also has re-sessional marks — show Absent in MTE, not 0/30 */
  mteAbsentForResessional?: boolean;
};

type CourseOutcomeRow = {
  Sno?: number;
  "Sno Description"?: string;
  Description?: string;
};

type CourseExitFeedbackRow = {
  coNo?: number | string;
  feedbackValue?: number;
};

type CourseExitFeedbackUiRow = {
  coNoLabel: string;
  description: string;
  feedbackValue: string;
};

type UniversityVisionMission = { vision: string; mission: string[] };
type DepartmentVisionMission = { departmentCode: string; vision: string[]; mission: string[] };

function normalizeMultiLineText(value: unknown): string[] {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function extractUniversityVisionMission(data: unknown): UniversityVisionMission {
  const values = (data as { values?: Array<{ Vision?: unknown; Mission?: unknown }> } | null | undefined)?.values ?? [];
  const first = values[0] ?? {};
  return {
    vision: String(first.Vision ?? "").trim(),
    mission: normalizeMultiLineText(first.Mission),
  };
}

function extractDepartmentVisionMission(data: unknown): DepartmentVisionMission {
  const rows = (data as { values?: Array<{ [key: string]: unknown }> } | null | undefined)?.values ?? [];
  const departmentCode = String(rows.find((r) => String(r["Department Code"] ?? "").trim())?.["Department Code"] ?? "").trim();
  const vision = rows
    .filter((r) => String(r.Type ?? "").trim().toLowerCase() === "vision")
    .map((r) => String(r.Description ?? "").trim())
    .filter(Boolean);
  const mission = rows
    .filter((r) => String(r.Type ?? "").trim().toLowerCase() === "mission")
    .map((r) => String(r.Description ?? "").trim())
    .filter(Boolean);
  return { departmentCode, vision, mission };
}

function extractCourseOutcomeRows(data: unknown): CourseOutcomeRow[] {
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data)) return data as CourseOutcomeRow[];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d["Course Outcome"])) return d["Course Outcome"] as CourseOutcomeRow[];
  if (Array.isArray(d.value)) return d.value as CourseOutcomeRow[];
  return [];
}

function extractCourseExitFeedbackRows(data: unknown): CourseExitFeedbackRow[] {
  if (Array.isArray(data)) return data as CourseExitFeedbackRow[];
  if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).value)) {
    return (data as Record<string, unknown>).value as CourseExitFeedbackRow[];
  }
  return [];
}

function buildCourseExitFeedbackUiRows(courseOutcomes: CourseOutcomeRow[], feedbackRows: CourseExitFeedbackRow[]): CourseExitFeedbackUiRow[] {
  const normalizeCoLabel = (v: unknown): string =>
    String(v ?? "")
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase();
  const coOrderFromLabel = (label: unknown): number => {
    const s = String(label ?? "").trim();
    const m = s.match(/(\d+)\s*$/);
    return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
  };

  const byCoNo = new Map<number, CourseOutcomeRow>();
  const byCoLabel = new Map<string, CourseOutcomeRow>();
  courseOutcomes.forEach((co) => {
    const n = Number(co.Sno);
    if (!Number.isNaN(n)) byCoNo.set(n, co);
    const label = String(co["Sno Description"] ?? "").trim();
    if (label) byCoLabel.set(normalizeCoLabel(label), co);
  });

  return feedbackRows
    .filter((r) => String(r.coNo ?? "").trim().length > 0)
    .sort((a, b) => coOrderFromLabel(a.coNo) - coOrderFromLabel(b.coNo))
    .map((r) => {
      const coNoRaw = String(r.coNo ?? "").trim();
      const coNoNumeric = Number(coNoRaw);
      const co =
        byCoLabel.get(normalizeCoLabel(coNoRaw)) ||
        (!Number.isNaN(coNoNumeric) ? byCoNo.get(coNoNumeric) : undefined) ||
        (() => {
          const ord = coOrderFromLabel(coNoRaw);
          return Number.isFinite(ord) ? byCoNo.get(ord) : undefined;
        })();
      const feedbackValue = Number(r.feedbackValue);
      return {
        coNoLabel: String(co?.["Sno Description"] ?? (coNoRaw || "—")),
        description: String(co?.Description ?? "").trim(),
        feedbackValue: Number.isFinite(feedbackValue) ? String(feedbackValue) : "0",
      };
    });
}

function parseMteMarksPage(data: unknown): { values: MteStudentMarksRow[]; totalPages: number } {
  if (!data || typeof data !== "object") return { values: [], totalPages: 1 };
  const o = data as Record<string, unknown>;
  const values = Array.isArray(o.values) ? (o.values as MteStudentMarksRow[]) : [];
  const tp = o.totalPages;
  const totalPages = typeof tp === "number" && !Number.isNaN(tp) ? tp : Number(tp) || 1;
  return { values, totalPages: Math.max(1, totalPages) };
}

async function fetchAllMteExamMarks(
  url: string,
  body: { acadSes: string; acadYear: string; courseID: string; examMethod: string; limit: number }
): Promise<{ rows: MteStudentMarksRow[]; error: string | null }> {
  const limit = body.limit;
  const aggregated: MteStudentMarksRow[] = [];
  let totalPages = 1;
  let pageNum = 0;
  let offset = 0;

  do {
    pageNum++;
    const res = await callApiViaProxy<unknown>(url, {
      acadSes: body.acadSes,
      acadYear: body.acadYear,
      courseID: body.courseID,
      examMethod: body.examMethod,
      limit,
      offset,
    });
    if (!res.success) {
      return {
        rows: aggregated.length ? aggregated : [],
        error: res.error || "Failed to load exam marks.",
      };
    }
    const { values, totalPages: tp } = parseMteMarksPage(res.data);
    totalPages = tp;
    aggregated.push(...values);
    if (values.length === 0) break;
    const raw = res.data as Record<string, unknown>;
    const step = typeof raw.pageSize === "number" && !Number.isNaN(raw.pageSize) ? raw.pageSize : values.length;
    offset += step;
  } while (pageNum < totalPages);

  return { rows: aggregated, error: null };
}

function normalizeStudentNoKey(s: string): string {
  return s.trim().replace(/\s+/g, "").toLowerCase();
}

function studentNosFromSectionListRows(rows: Record<string, unknown>[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of rows) {
    const raw = String(r["Student No."] ?? r["studentNo"] ?? "").trim();
    if (!raw) continue;
    map.set(normalizeStudentNoKey(raw), raw);
  }
  return map;
}

function registrationStatusFromStudent(s: Record<string, unknown>): string {
  const keys = ["Registration Status", "registrationStatus", "RegistrationStatus", "status"];
  for (const k of keys) {
    const t = String(s[k] ?? "").trim();
    if (t) return t;
  }
  return "";
}

function studentDetailsFromSectionListRows(
  rows: Record<string, unknown>[]
): Map<string, { studentName: string; registrationNo: string; registrationStatus: string }> {
  const map = new Map<string, { studentName: string; registrationNo: string; registrationStatus: string }>();
  for (const r of rows) {
    const raw = String(r["Student No."] ?? r["studentNo"] ?? "").trim();
    if (!raw) continue;
    map.set(normalizeStudentNoKey(raw), {
      studentName: String(r["Student Name"] ?? r["studentName"] ?? "").trim(),
      registrationNo: registrationNoFromAttendanceStudent(r),
      registrationStatus: registrationStatusFromStudent(r),
    });
  }
  return map;
}

function mergeStudentDetails(rows: MteStudentMarksRow[], details: Map<string, { studentName: string; registrationNo: string }>): MteStudentMarksRow[] {
  return rows.map((r) => {
    const key = normalizeStudentNoKey(String(r.studentNo ?? ""));
    const d = details.get(key);
    if (!d) return r;
    return {
      ...r,
      studentName: d.studentName || r.studentName || "",
      registrationNo: d.registrationNo || r.registrationNo || "",
    };
  });
}

function filterMteRowsByStudentNos(rows: MteStudentMarksRow[], allowed: Map<string, string>): MteStudentMarksRow[] {
  return rows.filter((r) => {
    const sn = String(r.studentNo ?? "").trim();
    if (!sn) return false;
    return allowed.has(normalizeStudentNoKey(sn));
  });
}

function collectQuestionCodes(rows: MteStudentMarksRow[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const r of rows) {
    for (const m of r.marks ?? []) {
      const q = String(m.questionCode ?? "").trim();
      if (q && !seen.has(q)) {
        seen.add(q);
        order.push(q);
      }
    }
  }
  return order;
}

/** First non-empty maximumMark for this question across rows (same for all students in practice). */
function mteMaxMarkForQuestion(rows: MteStudentMarksRow[], questionCode: string): string | null {
  for (const r of rows) {
    const m = (r.marks ?? []).find((x) => String(x.questionCode ?? "").trim() === questionCode);
    if (!m) continue;
    const mx = String(m.maximumMark ?? "").trim();
    if (mx) return mx;
  }
  return null;
}

function computeMteSectionAverages(rows: MteStudentMarksRow[]): {
  n: number;
  nWithMarks: number;
  avgObt: number | null;
  avgMax: number | null;
  avgPct: number | null;
} {
  if (!rows.length) return { n: 0, nWithMarks: 0, avgObt: null, avgMax: null, avgPct: null };
  const totals: { o: number; m: number }[] = [];
  for (const r of rows) {
    if (r.mteAbsentForResessional) continue;
    const marks = Array.isArray(r.marks) ? r.marks : [];
    let o = 0;
    let m = 0;
    for (const q of marks) {
      o += parseFloat(String(q.markObtained ?? "")) || 0;
      m += parseFloat(String(q.maximumMark ?? "")) || 0;
    }
    if (m > 0) totals.push({ o, m });
  }
  if (!totals.length) return { n: rows.length, nWithMarks: 0, avgObt: null, avgMax: null, avgPct: null };
  const sumO = totals.reduce((a, b) => a + b.o, 0);
  const sumM = totals.reduce((a, b) => a + b.m, 0);
  const nTot = totals.length;
  return {
    n: rows.length,
    nWithMarks: nTot,
    avgObt: sumO / nTot,
    avgMax: sumM / nTot,
    avgPct: sumM > 0 ? (sumO / sumM) * 100 : null,
  };
}

type ResultAnalysisRow = {
  sectionCode: string;
  totalStudents: number;
  passCount: number;
  failCount: number;
  grades: Record<string, number>;
};

const RESULT_GRADE_ORDER = ["A+", "A", "B", "C", "D", "E", "F", "I"] as const;

function calculateStudentTotal(row: MteStudentMarksRow): { obtained: number; maximum: number } {
  let obtained = 0;
  let maximum = 0;
  for (const m of row.marks ?? []) {
    obtained += parseFloat(String(m.markObtained ?? "")) || 0;
    maximum += parseFloat(String(m.maximumMark ?? "")) || 0;
  }
  return { obtained, maximum };
}

function gradeFromPercentage(pct: number): (typeof RESULT_GRADE_ORDER)[number] {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  if (pct >= 40) return "E";
  return "F";
}

function normalizeRevGrade(value: unknown): (typeof RESULT_GRADE_ORDER)[number] | null {
  const g = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (g === "A+" || g === "A" || g === "B" || g === "C" || g === "D" || g === "E" || g === "F" || g === "I") return g;
  return null;
}

function buildResultAnalysis(sectionCode: string, rows: MteStudentMarksRow[]): ResultAnalysisRow {
  const grades: Record<string, number> = {
    "A+": 0,
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
    F: 0,
  };
  let passCount = 0;
  let failCount = 0;

  for (const row of rows) {
    const gradeFromApi = normalizeRevGrade(row.revGrade);
    const grade = (() => {
      if (gradeFromApi) return gradeFromApi;
      const totalNum = Number(row.total);
      if (Number.isFinite(totalNum)) return gradeFromPercentage(totalNum);
      const total = calculateStudentTotal(row);
      const pct = total.maximum > 0 ? (total.obtained / total.maximum) * 100 : 0;
      return gradeFromPercentage(pct);
    })();
    grades[grade] += 1;
    if (grade === "F" || grade === "I") failCount += 1;
    else passCount += 1;
  }

  return {
    sectionCode,
    totalStudents: rows.length,
    passCount,
    failCount,
    grades,
  };
}

type CourseFacultyRow = {
  id: string;
  facultyCode: string;
  facultyName: string;
  facultyEmail?: string;
};

type CourseWiseSectionFacultyRow = {
  facultyCode: string;
  facultyName: string;
  sectionCode: string;
};

type TimetableViewerState = {
  facultyName: string;
  facultyCode: string;
  rows: Record<string, unknown>[];
  loading: boolean;
  error: string | null;
};

const DAY_ORDER = [1, 2, 3, 4, 5] as const;
const TIMELINE_START_HOUR = 9;
const TIMELINE_END_HOUR = 18;
const TIME_BANDS = [
  { key: "09", label: "09 AM - 10 AM", startHour: 9, endHour: 10 },
  { key: "10", label: "10 AM - 11 AM", startHour: 10, endHour: 11 },
  { key: "11", label: "11 AM - 12 PM", startHour: 11, endHour: 12 },
  { key: "12", label: "12 PM - 01 PM", startHour: 12, endHour: 13 },
  { key: "13", label: "01 PM - 02 PM", startHour: 13, endHour: 14 },
  { key: "14", label: "02 PM - 03 PM", startHour: 14, endHour: 15 },
  { key: "15", label: "03 PM - 04 PM", startHour: 15, endHour: 16 },
  { key: "16", label: "04 PM - 05 PM", startHour: 16, endHour: 17 },
  { key: "17", label: "05 PM - 06 PM", startHour: 17, endHour: 18 },
] as const;

const API_DAY_LABEL: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

function labelForApiDay(day: unknown): string {
  const n = typeof day === "number" ? day : Number(day);
  if (!Number.isFinite(n)) return "—";
  return API_DAY_LABEL[n] ?? `Day ${n}`;
}

function parseRowDate(row: Record<string, unknown>): Date | null {
  const raw = row["Attendance Date"];
  if (typeof raw !== "string" || !raw.trim()) return null;
  const s = raw.trim();
  const d = new Date(s.includes("T") ? s : `${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function slotDedupeKeyWithinWeek(row: Record<string, unknown>): string {
  const day = row["Day"];
  const start = row["Start Time"];
  const end = row["End Time"];
  return `${String(day)}|${String(start)}|${String(end)}`;
}

type TimetableGridCell = {
  startTime: string;
  endTime: string;
  subject: string;
  room: string;
  date: string;
  leftPct: number;
  widthPct: number;
};

type FacultyDetailRow = {
  courseCode: string;
  courseName: string;
  facultyCode: string;
  facultyName: string;
  emailId: string;
  section: string;
  roomNo: string;
};

function parseTimeToMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parts = value.trim().split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function isTruthyFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "1" || v === "yes";
  }
  return false;
}

function isExtraClassType(value: unknown): boolean {
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return value.trim() === "1";
  return false;
}

function buildSingleWeekTimetableGrid(rows: Record<string, unknown>[]) {
  const validRows = rows
    .map((row) => ({ row, date: parseRowDate(row) }))
    .filter((item) => item.date !== null)
    .sort((a, b) => a.date!.getTime() - b.date!.getTime());

  const grid: Record<string, TimetableGridCell[]> = {};
  const seenAcrossWeeks = new Set<string>();

  for (const day of DAY_ORDER) {
    grid[String(day)] = [];
  }

  for (const item of validRows) {
    const row = item.row;
    const dayNum = typeof row["Day"] === "number" ? row["Day"] : Number(row["Day"]);
    if (!Number.isFinite(dayNum) || !DAY_ORDER.includes(dayNum as (typeof DAY_ORDER)[number])) continue;
    if (isTruthyFlag(row["Cancelled"]) || isTruthyFlag(row["Suspended"])) continue;
    if (isExtraClassType(row["Type of Class"])) continue;

    const repeatKey = slotDedupeKeyWithinWeek(row);
    if (seenAcrossWeeks.has(repeatKey)) continue;
    seenAcrossWeeks.add(repeatKey);

    const startMinuteRaw = parseTimeToMinutes(row["Start Time"]);
    const endMinuteRaw = parseTimeToMinutes(row["End Time"]);
    if (startMinuteRaw === null || endMinuteRaw === null || endMinuteRaw <= startMinuteRaw) continue;

    const rangeStart = TIMELINE_START_HOUR * 60;
    const rangeEnd = TIMELINE_END_HOUR * 60;
    const startMinute = Math.max(startMinuteRaw, rangeStart);
    const endMinute = Math.min(endMinuteRaw, rangeEnd);
    if (endMinute <= startMinute) continue;

    const total = rangeEnd - rangeStart;
    const leftPct = ((startMinute - rangeStart) / total) * 100;
    const widthPct = Math.max(((endMinute - startMinute) / total) * 100, 1);

    grid[String(dayNum)].push({
      startTime: formatTimetableCell(row["Start Time"]),
      endTime: formatTimetableCell(row["End Time"]),
      subject: formatTimetableCell(row["Subject Code"]),
      room: formatTimetableCell(row["Room Allocation"]),
      date: format(item.date!, "yyyy-MM-dd"),
      leftPct,
      widthPct,
    });
  }

  for (const day of DAY_ORDER) {
    grid[String(day)].sort((a, b) => a.leftPct - b.leftPct);
  }

  return { grid };
}

function buildFacultyDetailsTableRows(rows: Record<string, unknown>[]): FacultyDetailRow[] {
  const seen = new Set<string>();
  const output: FacultyDetailRow[] = [];

  for (const row of rows) {
    if (isTruthyFlag(row["Cancelled"]) || isTruthyFlag(row["Suspended"])) continue;
    if (isExtraClassType(row["Type of Class"])) continue;

    const courseCode = formatTimetableCell(row["Subject Code"] ?? row["Course Code"]);
    const courseName = formatTimetableCell(row["Course Name"] ?? row["Subject Name"]);
    const facultyCode = formatTimetableCell(row["Faculty Code"]);
    const facultyName = formatTimetableCell(row["Faculty Name"]);
    const emailId = formatTimetableCell(row["Email ID"] ?? row["Faculty Email"] ?? row["facultyEmail"] ?? row["Email"]);
    const section = formatTimetableCell(row["Section Code"]);
    const roomNo = formatTimetableCell(row["Room Allocation"]);

    const uniqueKey = section;
    if (seen.has(uniqueKey)) continue;
    seen.add(uniqueKey);

    output.push({
      courseCode,
      courseName,
      facultyCode,
      facultyName,
      emailId,
      section,
      roomNo,
    });
  }

  output.sort((a, b) => {
    const byCourse = a.courseCode.localeCompare(b.courseCode);
    if (byCourse !== 0) return byCourse;
    const bySection = a.section.localeCompare(b.section);
    if (bySection !== 0) return bySection;
    return a.roomNo.localeCompare(b.roomNo);
  });

  return output;
}

function extractTimetableRows(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.values)) return d.values as Record<string, unknown>[];
  if (Array.isArray(d.value)) return d.value as Record<string, unknown>[];
  return [];
}

function formatTimetableCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

type TimetableViewerDialogProps = {
  state: TimetableViewerState;
  onClose: () => void;
};

function TimetableViewerDialog({ state, onClose }: TimetableViewerDialogProps) {
  const title = `Timetable — ${state.facultyName} (${state.facultyCode})`;

  const timetableGrid = useMemo(() => buildSingleWeekTimetableGrid(state.rows), [state.rows]);
  const facultyDetailsRows = useMemo(() => buildFacultyDetailsTableRows(state.rows), [state.rows]);
  const skippedNoDate = useMemo(() => {
    if (!state.rows.length) return 0;
    let n = 0;
    for (const row of state.rows) {
      if (!parseRowDate(row)) n += 1;
    }
    return n;
  }, [state.rows]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label="Timetable viewer">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-700 bg-gray-900 px-4 py-2">
        <span className="truncate text-sm font-medium text-white">{title}</span>
        <button type="button" onClick={onClose} className="rounded p-2 text-white hover:bg-gray-700" aria-label="Close">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        {state.loading && <p className="text-sm text-gray-700">Loading timetable…</p>}
        {state.error && <p className="text-sm text-red-700">{state.error}</p>}
        {!state.loading && !state.error && state.rows.length === 0 && <p className="text-sm text-gray-700">No timetable rows returned.</p>}
        {!state.loading && !state.error && state.rows.length > 0 && (
          <div className="space-y-3">
            {skippedNoDate > 0 && (
              <p className="text-xs text-amber-800">
                {skippedNoDate} row{skippedNoDate === 1 ? "" : "s"} omitted (missing or invalid attendance date).
              </p>
            )}
            <div className="overflow-x-auto rounded-lg border border-gray-300 bg-white shadow-sm">
              <div className="min-w-[1100px] text-xs text-gray-900 md:text-sm">
                <div className="grid border-b border-gray-400 bg-gray-100" style={{ gridTemplateColumns: "110px 1fr" }}>
                  <div className="border-r border-gray-400 px-3 py-2 text-center font-semibold">Day / Time</div>
                  <div className="grid" style={{ gridTemplateColumns: `repeat(${TIME_BANDS.length}, minmax(0, 1fr))` }}>
                    {TIME_BANDS.map((band) => (
                      <div key={band.key} className="border-r border-gray-400 px-3 py-2 text-center font-semibold last:border-r-0">
                        {band.label}
                      </div>
                    ))}
                  </div>
                </div>

                {DAY_ORDER.map((day) => (
                  <div key={day} className="grid border-b border-gray-400 last:border-b-0" style={{ gridTemplateColumns: "110px 1fr" }}>
                    <div className="border-r border-gray-400 px-3 py-4 font-medium">{labelForApiDay(day)}</div>
                    <div className="relative h-24">
                      {timetableGrid.grid[String(day)].map((cell, idx) => (
                        <div
                          key={`${day}-${idx}-${cell.startTime}-${cell.endTime}`}
                          className="absolute top-1 bottom-1 overflow-hidden rounded bg-blue-50 p-2 leading-4 ring-1 ring-blue-100"
                          style={{ left: `${cell.leftPct}%`, width: `${cell.widthPct}%` }}
                        >
                          <div className="font-medium">
                            {cell.startTime} - {cell.endTime}
                          </div>
                          <div>{cell.subject}</div>
                          <div>{cell.room}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-300 bg-white shadow-sm">
              <table className="min-w-[1100px] border-collapse text-xs text-gray-900 md:text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-400 px-3 py-2 text-center font-semibold">Course Code</th>
                    <th className="border border-gray-400 px-3 py-2 text-center font-semibold">Course Name</th>
                    <th className="border border-gray-400 px-3 py-2 text-center font-semibold">Faculty Code</th>
                    <th className="border border-gray-400 px-3 py-2 text-center font-semibold">Faculty Name</th>
                    <th className="border border-gray-400 px-3 py-2 text-center font-semibold">Email ID</th>
                    <th className="border border-gray-400 px-3 py-2 text-center font-semibold">Section</th>
                    <th className="border border-gray-400 px-3 py-2 text-center font-semibold">Room No</th>
                  </tr>
                </thead>
                <tbody>
                  {facultyDetailsRows.map((row, idx) => (
                    <tr key={`${row.courseCode}-${row.section}-${idx}`} className="bg-white">
                      <td className="border border-gray-400 px-3 py-2 text-center">{row.courseCode}</td>
                      <td className="border border-gray-400 px-3 py-2">{row.courseName}</td>
                      <td className="border border-gray-400 px-3 py-2 text-center">{row.facultyCode}</td>
                      <td className="border border-gray-400 px-3 py-2">{row.facultyName}</td>
                      <td className="border border-gray-400 px-3 py-2 break-all">{row.emailId}</td>
                      <td className="border border-gray-400 px-3 py-2 text-center">{row.section}</td>
                      <td className="border border-gray-400 px-3 py-2 text-center">{row.roomNo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type FacultyTimetableListProps = {
  facultyRows: CourseFacultyRow[];
  sectionFacultyRows: CourseWiseSectionFacultyRow[];
  onReorder: (index: number, direction: "up" | "down") => void;
  onView: (faculty: CourseFacultyRow) => void;
};

function FacultyTimetableList({ facultyRows, sectionFacultyRows, onReorder, onView }: FacultyTimetableListProps) {
  if (facultyRows.length === 0) {
    return <p className="text-sm text-gray-500">No faculty in list. Faculty will appear here once loaded for this course.</p>;
  }

  return (
    <>
      <p className="mb-3 text-sm text-gray-600">Timetable per faculty. Use the eye icon to view slots and reorder rows as needed.</p>
      <p className="mb-3 text-xs text-gray-500">
        Loaded {facultyRows.length} facult{facultyRows.length === 1 ? "y" : "ies"} and {sectionFacultyRows.length} section-wise mappings.
      </p>
      <ul className="space-y-2">
        {facultyRows.map((faculty, index) => {
          const label = `${faculty.facultyName} (${faculty.facultyCode})`;
          return (
            <li key={faculty.id} className="flex items-center gap-2 rounded-md border border-gray-200 bg-white py-2 pl-2 pr-3 shadow-sm">
              <GripVertical size={18} className="shrink-0 text-gray-400" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm text-gray-800" title={label}>
                {label}
              </span>
              <button
                type="button"
                onClick={() => onView(faculty)}
                className="shrink-0 rounded p-1.5 text-gray-600 hover:bg-gray-100 hover:text-orange-600"
                title="View"
              >
                <Eye size={18} />
              </button>
              <button
                type="button"
                onClick={() => onReorder(index, "up")}
                disabled={index === 0}
                className="shrink-0 rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                title="Move up"
              >
                <ChevronUp size={18} />
              </button>
              <button
                type="button"
                onClick={() => onReorder(index, "down")}
                disabled={index === facultyRows.length - 1}
                className="shrink-0 rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                title="Move down"
              >
                <ChevronDown size={18} />
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

type CourseStudentSectionRow = {
  id: string;
  sectionCode: string;
};

type StudentListViewerState = {
  sectionCode: string;
  rows: Record<string, unknown>[];
  loading: boolean;
  error: string | null;
};

type StudentSectionListProps = {
  sectionRows: CourseStudentSectionRow[];
  onReorder: (index: number, direction: "up" | "down") => void;
  onView: (sectionCode: string) => void;
  description?: string;
  rowTitlePrefix?: string;
};

function StudentSectionList({
  sectionRows,
  onReorder,
  onView,
  description = "Student list per section. Use the eye icon to open the list in a full-screen viewer (same pattern as timetable).",
  rowTitlePrefix = "Student list — Section",
}: StudentSectionListProps) {
  if (sectionRows.length === 0) {
    return <p className="text-sm text-gray-500">No sections yet. Sections appear here from course faculty data once loaded for this course.</p>;
  }

  return (
    <>
      <p className="mb-3 text-sm text-gray-600">{description}</p>
      <ul className="space-y-2">
        {sectionRows.map((row, index) => {
          const label = `${rowTitlePrefix} ${row.sectionCode}`;
          return (
            <li key={row.id} className="flex items-center gap-2 rounded-md border border-gray-200 bg-white py-2 pl-2 pr-3 shadow-sm">
              <GripVertical size={18} className="shrink-0 text-gray-400" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm text-gray-800" title={label}>
                {label}
              </span>
              <button
                type="button"
                onClick={() => onView(row.sectionCode)}
                className="shrink-0 rounded p-1.5 text-gray-600 hover:bg-gray-100 hover:text-orange-600"
                title="View"
              >
                <Eye size={18} />
              </button>
              <button
                type="button"
                onClick={() => onReorder(index, "up")}
                disabled={index === 0}
                className="shrink-0 rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                title="Move up"
              >
                <ChevronUp size={18} />
              </button>
              <button
                type="button"
                onClick={() => onReorder(index, "down")}
                disabled={index === sectionRows.length - 1}
                className="shrink-0 rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                title="Move down"
              >
                <ChevronDown size={18} />
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

type StudentListViewerDialogProps = {
  state: StudentListViewerState;
  onClose: () => void;
};

function StudentListViewerDialog({ state, onClose }: StudentListViewerDialogProps) {
  const title = `Student list — Section ${state.sectionCode}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label="Student list viewer">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-700 bg-gray-900 px-4 py-2">
        <span className="truncate text-sm font-medium text-white">{title}</span>
        <button type="button" onClick={onClose} className="rounded p-2 text-white hover:bg-gray-700" aria-label="Close">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        {state.loading && <p className="text-sm text-gray-700">Loading student list…</p>}
        {state.error && <p className="text-sm text-red-700">{state.error}</p>}
        {!state.loading && !state.error && state.rows.length === 0 && <p className="text-sm text-gray-700">No students returned for this section.</p>}
        {!state.loading && !state.error && state.rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-300 bg-white shadow-sm">
            <table className="min-w-full border-collapse text-left text-xs text-gray-900 md:text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-3 py-2 font-semibold">Student No.</th>
                  <th className="border border-gray-400 px-3 py-2 font-semibold">Student Name</th>
                  <th className="border border-gray-400 px-3 py-2 font-semibold">Registration No.</th>
                </tr>
              </thead>
              <tbody>
                {state.rows.map((row, idx) => (
                  <tr key={idx} className="bg-white">
                    <td className="border border-gray-400 px-3 py-2">{formatTimetableCell(row["Student No."])}</td>
                    <td className="border border-gray-400 px-3 py-2">{formatTimetableCell(row["Student Name"])}</td>
                    <td className="border border-gray-400 px-3 py-2">{formatTimetableCell(row["Registration No."])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function attendanceRowsWithRegistrationNo(rows: AttendanceStudentRow[]): AttendanceStudentRow[] {
  return rows.filter((r) => Boolean(r.registrationNo?.trim()));
}

function AttendanceViewerDialog({ state, onClose }: { state: AttendanceViewerState; onClose: () => void }) {
  const title = `Attendance report — Section ${state.sectionCode}`;
  const rowsWithReg = useMemo(() => attendanceRowsWithRegistrationNo(state.rows), [state.rows]);
  const detainees = useMemo(
    () => rowsWithReg.filter((r) => String(r.registrationStatus || "").trim().toLowerCase() === "detained"),
    [rowsWithReg]
  );
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label="Attendance viewer">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-700 bg-gray-900 px-4 py-2">
        <span className="truncate text-sm font-medium text-white">{title}</span>
        <button type="button" onClick={onClose} className="rounded p-2 text-white hover:bg-gray-700" aria-label="Close">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        {state.loading && <p className="text-sm text-gray-700">Loading attendance…</p>}
        {state.error && <p className="text-sm text-red-700">{state.error}</p>}
        {!state.loading && !state.error && state.rows.length === 0 && <p className="text-sm text-gray-700">No attendance records returned for this section.</p>}
        {!state.loading && !state.error && state.rows.length > 0 && rowsWithReg.length === 0 && (
          <p className="text-sm text-gray-700">
            No students with a registration number for this section (registration not found in attendance or student list).
          </p>
        )}
        {!state.loading && !state.error && rowsWithReg.length > 0 && (
          <>
            <p className="mb-2 text-sm font-medium text-gray-800">
              Detainees: <span className={detainees.length > 0 ? "text-red-700" : "text-green-700"}>{detainees.length}</span>
            </p>
            {detainees.length > 0 && (
              <p className="mb-3 text-xs text-gray-700">
                {detainees.map((d) => `${d.studentNo}${d.studentName ? ` (${d.studentName})` : ""}`).join(", ")}
              </p>
            )}
            <div className="overflow-x-auto rounded-lg border border-gray-300 bg-white shadow-sm">
              <table className="min-w-full border-collapse text-left text-xs text-gray-900 md:text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-400 px-3 py-2 font-semibold">Student No.</th>
                    <th className="border border-gray-400 px-3 py-2 font-semibold">Student Name</th>
                    <th className="border border-gray-400 px-3 py-2 font-semibold">Registration No.</th>
                    <th className="border border-gray-400 px-3 py-2 font-semibold">Registration Status</th>
                    <th className="border border-gray-400 px-3 py-2 font-semibold whitespace-nowrap">Present / Total</th>
                    <th className="border border-gray-400 px-3 py-2 font-semibold whitespace-nowrap">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsWithReg.map((row, idx) => {
                    const pctCell = attendancePercentageCell(row.statuses);
                    const isDetained = String(row.registrationStatus || "").trim().toLowerCase() === "detained";
                    return (
                      <tr key={`${row.studentNo}-${idx}`} className="bg-white">
                        <td className="border border-gray-400 px-3 py-2">{row.studentNo}</td>
                        <td className="border border-gray-400 px-3 py-2">{row.studentName || "—"}</td>
                        <td className="border border-gray-400 px-3 py-2">{row.registrationNo?.trim() ? row.registrationNo : "—"}</td>
                        <td className={`border border-gray-400 px-3 py-2 ${isDetained ? "font-medium text-red-700" : ""}`}>
                          {row.registrationStatus || "—"}
                        </td>
                        <td className="border border-gray-400 px-3 py-2 tabular-nums">{formatAttendancePresentTotal(row.statuses)}</td>
                        <td
                          className={`border border-gray-400 px-3 py-2 tabular-nums ${
                            pctCell.isBelow75 ? "font-medium text-red-600" : ""
                          }`}
                        >
                          {pctCell.text}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type Section4LocalFileSectionProps = {
  loading: boolean;
  error: string | null;
  generatedFileName: string;
  exists: boolean;
};

function Section4LocalFileSection({ loading, error, generatedFileName, exists }: Section4LocalFileSectionProps) {
  const openUrl = `/api/course-file/local-file?name=${encodeURIComponent(generatedFileName)}`;
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Course handout file from local temp path (env). Use eye icon to open.</p>
      <ul className="space-y-2">
        <li className="flex items-center gap-2 rounded-md border border-gray-200 bg-white py-2 pl-2 pr-3 shadow-sm">
          <GripVertical size={18} className="shrink-0 text-gray-400" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm text-gray-800" title={generatedFileName}>
            {generatedFileName}
          </span>
          <a
            href={exists && !loading && !error ? openUrl : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!exists || loading || Boolean(error)}
            className={`shrink-0 rounded p-1.5 ${
              exists && !loading && !error ? "text-gray-600 hover:bg-gray-100 hover:text-orange-600" : "cursor-not-allowed text-gray-300"
            }`}
            title={exists ? "View" : "File not available"}
          >
            <Eye size={18} />
          </a>
        </li>
      </ul>
      {loading && <p className="text-sm text-gray-500">Checking local file…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && !exists && <p className="text-sm text-amber-700">No file found at temp path for this generated name yet.</p>}
    </div>
  );
}

type Section25CourseFeedbackProps = {
  loading: boolean;
  error: string | null;
  hasRows: boolean;
  onView: () => void;
};

function Section25CourseFeedback({ loading, error, hasRows, onView }: Section25CourseFeedbackProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Course exit feedback mapped against Course Outcomes.</p>
      <ul className="space-y-2">
        <li className="flex items-center gap-2 rounded-md border border-gray-200 bg-white py-2 pl-2 pr-3 shadow-sm">
          <GripVertical size={18} className="shrink-0 text-gray-400" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm text-gray-800" title="Course Feedback">
            Course Feedback
          </span>
          <button
            type="button"
            onClick={onView}
            disabled={loading || Boolean(error) || !hasRows}
            className={`shrink-0 rounded p-1.5 ${
              !loading && !error && hasRows ? "text-gray-600 hover:bg-gray-100 hover:text-orange-600" : "cursor-not-allowed text-gray-300"
            }`}
            title={hasRows ? "View" : "No feedback rows available"}
          >
            <Eye size={18} />
          </button>
        </li>
      </ul>
      {loading && <p className="text-sm text-gray-500">Loading course feedback…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && !hasRows && <p className="text-sm text-gray-700">No course feedback rows available.</p>}
    </div>
  );
}

type Section27CourseAttainmentProps = {
  loading: boolean;
  error: string | null;
  hasData: boolean;
  onView: () => void;
};

function Section27CourseAttainmentSummary({ loading, error, hasData, onView }: Section27CourseAttainmentProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Course attainment summary (CO / PO) from saved calculation result.</p>
      <ul className="space-y-2">
        <li className="flex items-center gap-2 rounded-md border border-gray-200 bg-white py-2 pl-2 pr-3 shadow-sm">
          <GripVertical size={18} className="shrink-0 text-gray-400" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm text-gray-800" title="Course attainment summary">
            Course attainment summary
          </span>
          <button
            type="button"
            onClick={onView}
            disabled={loading || Boolean(error) || !hasData}
            className={`shrink-0 rounded p-1.5 ${
              !loading && !error && hasData ? "text-gray-600 hover:bg-gray-100 hover:text-orange-600" : "cursor-not-allowed text-gray-300"
            }`}
            title={hasData ? "View" : "No saved attainment data"}
          >
            <Eye size={18} />
          </button>
        </li>
      </ul>
      {loading && <p className="text-sm text-gray-500">Loading attainment summary…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && !hasData && <p className="text-sm text-gray-700">No saved attainment summary for this course yet.</p>}
    </div>
  );
}

function Section27AttainmentViewerDialog({
  result,
  onClose,
  programCode,
  courseCode,
  academicSession,
}: {
  result: { calculatedData?: Record<string, unknown>; message?: string } | null;
  onClose: () => void;
  programCode: string;
  courseCode: string;
  academicSession: string;
}) {
  const cd = result?.calculatedData as Record<string, unknown> | undefined;
  const semester = String(cd?.semester ?? "");
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label="Course attainment summary viewer">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-700 bg-gray-900 px-4 py-2">
        <span className="truncate text-sm font-medium text-white">Course attainment summary</span>
        <button type="button" onClick={onClose} className="rounded p-2 text-white hover:bg-gray-700" aria-label="Close">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        <CoAttainmentResultView
          result={result}
          programCode={programCode}
          courseCode={courseCode}
          academicSession={academicSession}
          semester={semester}
        />
      </div>
    </div>
  );
}

function Section28ClosureInputs({
  pdfCaptureMode,
  isLoadingConsolidation,
  totalStudents,
  passCount,
  failCount,
  detainedCount,
  passPercentage,
  averageGpa,
  studentFeedback,
  onChangeStudentFeedback,
  syllabusCoverage,
  onChangeSyllabusCoverage,
  contentDelivery,
  onChangeContentDelivery,
  courseCurriculumFeedback,
  anyOtherFeedback,
  onChangeAnyOtherFeedback,
  points,
  onChangePoint,
  onAddPoint,
  onRemovePoint,
}: {
  pdfCaptureMode: boolean;
  isLoadingConsolidation: boolean;
  totalStudents: number | null;
  passCount: number | null;
  failCount: number | null;
  detainedCount: number | null;
  passPercentage: number | null;
  averageGpa: number | null;
  studentFeedback: string;
  onChangeStudentFeedback: (value: string) => void;
  syllabusCoverage: string;
  onChangeSyllabusCoverage: (value: string) => void;
  contentDelivery: string;
  onChangeContentDelivery: (value: string) => void;
  courseCurriculumFeedback: string;
  anyOtherFeedback: string;
  onChangeAnyOtherFeedback: (value: string) => void;
  points: string[];
  onChangePoint: (index: number, value: string) => void;
  onAddPoint: () => void;
  onRemovePoint: (index: number) => void;
}) {
  const pointLabel = (index: number) => `Point ${String.fromCharCode("A".charCodeAt(0) + index)}`;
  const valueOrDash = (value: number | null, digits: number = 0) => (value == null || Number.isNaN(value) ? "—" : value.toFixed(digits));
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mx-auto max-w-3xl space-y-6 text-gray-900">
        <div className="space-y-2 text-center">
          <p className="text-xl font-medium text-slate-700">Format for Course Closure Report</p>
          <h4 className="text-2xl font-semibold">Course Closure Report</h4>
        </div>

        <div className="space-y-2 text-sm leading-6">
          <p>i) Total number of students: {isLoadingConsolidation ? "Loading..." : valueOrDash(totalStudents)}</p>
          <p>ii) Result analysis - consolidated (All sections)</p>
          {isLoadingConsolidation && <p className="text-xs text-amber-700">Collecting all section data before final consolidation.</p>}
        </div>

        <div className="overflow-x-auto rounded-md border border-gray-300">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-3 py-2 font-medium">Number of Students</th>
                <th className="border border-gray-300 px-3 py-2 font-medium">Pass</th>
                <th className="border border-gray-300 px-3 py-2 font-medium">Fail</th>
                <th className="border border-gray-300 px-3 py-2 font-medium">Detained</th>
                <th className="border border-gray-300 px-3 py-2 font-medium">Pass %</th>
                <th className="border border-gray-300 px-3 py-2 font-medium">Avg. GPA</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                <td className="border border-gray-300 px-3 py-2">{valueOrDash(totalStudents)}</td>
                <td className="border border-gray-300 px-3 py-2">{valueOrDash(passCount)}</td>
                <td className="border border-gray-300 px-3 py-2">{valueOrDash(failCount)}</td>
                <td className="border border-gray-300 px-3 py-2">{valueOrDash(detainedCount)}</td>
                <td className="border border-gray-300 px-3 py-2">{passPercentage == null ? "—" : `${passPercentage.toFixed(2)}%`}</td>
                <td className="border border-gray-300 px-3 py-2">{valueOrDash(averageGpa, 2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="space-y-2 text-sm leading-6">
          <p>iii) Analysis of Stakeholders&apos; feedback for the course:</p>
          <div className="pl-5">
            <label className="mb-1 block text-xs text-gray-600">a. Overall student feedback</label>
            <input
              value={studentFeedback}
              onChange={(e) => onChangeStudentFeedback(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
          <div className="pl-5">
            <label className="mb-1 block text-xs text-gray-600">b. Syllabus coverage</label>
            <input
              value={syllabusCoverage}
              onChange={(e) => onChangeSyllabusCoverage(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
          <div className="pl-5">
            <label className="mb-1 block text-xs text-gray-600">c. Content delivery and coverage as per lecture plan</label>
            <input
              value={contentDelivery}
              onChange={(e) => onChangeContentDelivery(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
          <p className="pl-5">d. Feedback on course curriculum: {courseCurriculumFeedback || "—"}</p>
          <div className="pl-5">
            <label className="mb-1 block text-xs text-gray-600">e. Any other feedback</label>
            <input
              value={anyOtherFeedback}
              onChange={(e) => onChangeAnyOtherFeedback(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm leading-6">iv) Identification of Gaps and Improvement scope for next session:</p>
          <div className="space-y-3">
            {points.map((point, idx) => (
              <div key={idx} className={`rounded-md p-2 ${pdfCaptureMode ? "" : "border border-gray-200 bg-gray-50"}`}>
                {!pdfCaptureMode && <label className="mb-1 block text-xs font-medium text-gray-700">{pointLabel(idx)}</label>}
                <textarea
                  value={point}
                  onChange={(e) => onChangePoint(idx, e.target.value)}
                  rows={1}
                  className={`w-full rounded-md px-2 py-1 text-xs text-gray-800 focus:border-gray-400 focus:outline-none ${
                    pdfCaptureMode ? "border-0 bg-transparent" : "border border-gray-300 bg-white"
                  }`}
                  placeholder={`Enter ${pointLabel(idx)}...`}
                />
                {!pdfCaptureMode && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onRemovePoint(idx)}
                      disabled={points.length <= 1}
                      className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {!pdfCaptureMode && (
            <div className="flex justify-start">
              <button
                type="button"
                onClick={onAddPoint}
                className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Add Point
              </button>
            </div>
          )}
        </div>

        <div className="space-y-8 pt-4 text-sm">
          <p className="font-semibold">Name and Signature</p>
          <p>Course Coordinator: ____________________</p>
          <p>Course instructor(s): ____________________</p>
          <p>Head of Department: ____________________</p>
        </div>
      </div>
    </div>
  );
}

function extractNumericFromUnknown(input: unknown, keyMatcher: (key: string) => boolean): number | null {
  const walk = (node: unknown): number | null => {
    if (node == null) return null;
    if (typeof node === "number") return Number.isFinite(node) ? node : null;
    if (typeof node === "string") {
      const n = Number(node);
      return Number.isFinite(n) ? n : null;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = walk(item);
        if (found != null) return found;
      }
      return null;
    }
    if (typeof node === "object") {
      const rec = node as Record<string, unknown>;
      const keys = Object.keys(rec);
      for (const key of keys) {
        if (!keyMatcher(key)) continue;
        const found = walk(rec[key]);
        if (found != null) return found;
      }
      for (const key of keys) {
        const found = walk(rec[key]);
        if (found != null) return found;
      }
    }
    return null;
  };
  return walk(input);
}

function Section1VisionMission({
  loading,
  error,
  hasData,
  onView,
}: {
  loading: boolean;
  error: string | null;
  hasData: boolean;
  onView: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Vision and Mission details (University and Department).</p>
      <ul className="space-y-2">
        <li className="flex items-center gap-2 rounded-md border border-gray-200 bg-white py-2 pl-2 pr-3 shadow-sm">
          <GripVertical size={18} className="shrink-0 text-gray-400" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm text-gray-800" title="Vision & Mission">
            Vision & Mission
          </span>
          <button
            type="button"
            onClick={onView}
            disabled={loading || Boolean(error) || !hasData}
            className={`shrink-0 rounded p-1.5 ${
              !loading && !error && hasData ? "text-gray-600 hover:bg-gray-100 hover:text-orange-600" : "cursor-not-allowed text-gray-300"
            }`}
            title={hasData ? "View" : "No vision/mission data available"}
          >
            <Eye size={18} />
          </button>
        </li>
      </ul>
      {loading && <p className="text-sm text-gray-500">Loading vision & mission…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && !hasData && <p className="text-sm text-gray-700">No vision/mission data available for selected inputs.</p>}
    </div>
  );
}

function Section1VisionMissionViewerDialog({
  data,
  fallbackDepartmentCode,
  onClose,
}: {
  data: unknown;
  fallbackDepartmentCode: string;
  onClose: () => void;
}) {
  const university = extractUniversityVisionMission((data as { university?: unknown } | null)?.university);
  const department = extractDepartmentVisionMission((data as { department?: unknown } | null)?.department);
  const deptCode = department.departmentCode || fallbackDepartmentCode || "—";
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label="Vision and mission viewer">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-700 bg-gray-900 px-4 py-2">
        <span className="truncate text-sm font-medium text-white">Vision & Mission</span>
        <button type="button" onClick={onClose} className="rounded p-2 text-white hover:bg-gray-700" aria-label="Close">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-slate-100 p-5">
        <div className="mx-auto max-w-6xl overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-6 py-5 text-center">
            <h3 className="text-2xl font-bold text-slate-800">Vision and Mission</h3>
            <p className="mt-1 text-sm text-slate-600">University and Department details</p>
          </div>

          <div className="space-y-4 border-b border-slate-200 px-6 py-5">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="mb-2 text-base font-semibold text-slate-900">Vision of University</p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{university.vision || "—"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="mb-2 text-base font-semibold text-slate-900">Mission of University</p>
              {university.mission.length > 0 ? (
                <ol className="list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-800">
                  {university.mission.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-700">—</p>
              )}
            </div>
          </div>

          <table className="min-w-full border-collapse text-left text-sm text-slate-900">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-4 py-2 font-semibold whitespace-nowrap">S. No.</th>
                <th className="border border-slate-300 px-4 py-2 font-semibold whitespace-nowrap">Title</th>
                <th className="border border-slate-300 px-4 py-2 font-semibold">Content</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                <td className="border border-slate-300 px-4 py-2">1</td>
                <td className="border border-slate-300 px-4 py-2 font-semibold">Name of Department</td>
                <td className="border border-slate-300 px-4 py-2">{deptCode}</td>
              </tr>
              <tr className="bg-white">
                <td className="border border-slate-300 px-4 py-2">2</td>
                <td className="border border-slate-300 px-4 py-2 font-semibold">Department Vision</td>
                <td className="border border-slate-300 px-4 py-2 leading-6">
                  {department.vision.length > 0 ? (
                    <div className="space-y-1">
                      {department.vision.map((line, idx) => (
                        <p key={idx}>{line}</p>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
              <tr className="bg-white">
                <td className="border border-slate-300 px-4 py-2">3</td>
                <td className="border border-slate-300 px-4 py-2 font-semibold">Department Mission</td>
                <td className="border border-slate-300 px-4 py-2 leading-6">
                  {department.mission.length > 0 ? (
                    <div className="space-y-1">
                      {department.mission.map((line, idx) => (
                        <p key={idx}>{line}</p>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Section25FeedbackViewerDialog({ rows, onClose }: { rows: CourseExitFeedbackUiRow[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label="Course feedback viewer">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-700 bg-gray-900 px-4 py-2">
        <span className="truncate text-sm font-medium text-white">Course Feedback</span>
        <button type="button" onClick={onClose} className="rounded p-2 text-white hover:bg-gray-700" aria-label="Close">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-left text-xs text-gray-900 md:text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-4 py-2 font-semibold">CO.No.</th>
                <th className="border border-gray-200 px-4 py-2 font-semibold">Description</th>
                <th className="border border-gray-200 px-4 py-2 font-semibold">Average Feedback</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`${row.coNoLabel}-${idx}`}>
                  <td className="border border-gray-200 px-4 py-2">{row.coNoLabel || "—"}</td>
                  <td className="border border-gray-200 px-4 py-2">{row.description || "—"}</td>
                  <td className="border border-gray-200 px-4 py-2">{row.feedbackValue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MissingUploadsDialog({ sections, onClose }: { sections: string[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label="Missing uploads">
      <div className="mx-auto mt-16 w-[92%] max-w-2xl rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
          <span className="text-sm font-semibold text-white">Missing Required Uploads</span>
          <button type="button" onClick={onClose} className="rounded p-2 text-white hover:bg-gray-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 px-4 py-4">
          <p className="text-sm text-gray-200">Please upload at least one file in each required section before generating PDF.</p>
          <div className="max-h-[50vh] overflow-auto rounded border border-gray-700 bg-gray-950 p-3">
            <ul className="space-y-1 text-sm text-red-300">
              {sections.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type ResultAnalysisViewerState = {
  sectionCode: string;
  loading: boolean;
  error: string | null;
  row: ResultAnalysisRow | null;
};

type SectionStudentListData = { rows: Record<string, unknown>[]; error: string | null };
type SectionExamMarksData = { rows: MteStudentMarksRow[]; error: string | null; metaNote?: string | null };
type AttendanceStudentRow = { studentNo: string; studentName: string; registrationNo: string; registrationStatus: string; statuses: string[] };
type AttendanceViewerState = {
  sectionCode: string;
  slots: string[];
  rows: AttendanceStudentRow[];
  loading: boolean;
  error: string | null;
};
type SectionAttendanceData = { slots: string[]; rows: AttendanceStudentRow[]; error: string | null };

function formatAttendanceStatus(status: unknown): string {
  const s = String(status ?? "")
    .trim()
    .toUpperCase();
  if (!s) return "—";
  if (s === "P") return "Present";
  if (s === "A") return "Absent";
  return s;
}

function attendancePresentTotalCount(statuses: string[]): { present: number; total: number } {
  let present = 0;
  let absent = 0;
  for (const cell of statuses) {
    const u = String(cell).trim().toUpperCase();
    if (u === "PRESENT") present += 1;
    else if (u === "ABSENT") absent += 1;
  }
  const total = present + absent;
  return { present, total };
}

function formatAttendancePresentTotal(statuses: string[]): string {
  const { present, total } = attendancePresentTotalCount(statuses);
  return `${present}/${total}`;
}

function attendancePercentageCell(statuses: string[]): { text: string; isBelow75: boolean } {
  const { present, total } = attendancePresentTotalCount(statuses);
  if (total === 0) return { text: "—", isBelow75: false };
  const pct = (present / total) * 100;
  return { text: `${pct.toFixed(2)}%`, isBelow75: pct < 75 };
}

/** Registration / roll no. from a student-shaped API object (attendance row, student list row, etc.). */
function registrationNoFromAttendanceStudent(s: Record<string, unknown>): string {
  const keys = ["Registration No.", "registrationNo", "RegistrationNo", "regNo", "RegNo", "studRegNo", "studRegistrationNo", "regdNo"];
  for (const k of keys) {
    const t = String(s[k] ?? "").trim();
    if (t) return t;
  }
  return "";
}

function formatAttendanceSlot(dateValue: unknown, startValue: unknown, endValue: unknown): string {
  const rawDate = String(dateValue ?? "").trim();
  const start = String(startValue ?? "")
    .trim()
    .slice(0, 5);
  const end = String(endValue ?? "")
    .trim()
    .slice(0, 5);
  const d = rawDate ? new Date(rawDate) : null;
  const dateLabel = d && !Number.isNaN(d.getTime()) ? format(d, "dd MMM yyyy") : rawDate || "Date";
  if (start && end) return `${dateLabel} (${start}-${end})`;
  return dateLabel;
}

function buildAttendanceMatrix(data: unknown): { slots: string[]; rows: AttendanceStudentRow[] } {
  let root = (data ?? {}) as Record<string, unknown>;
  if (!Array.isArray(root.timetableDetails) && typeof root.value === "string") {
    try {
      const parsed = JSON.parse(root.value) as Record<string, unknown>;
      root = parsed;
    } catch {
      // Keep original root when value is not parseable JSON.
    }
  }
  const rawDetails = Array.isArray(root.timetableDetails) ? (root.timetableDetails as Array<Record<string, unknown>>) : [];
  const details = rawDetails
    .map((d, index) => {
      const dateRaw = String(d.attendanceDate ?? "").trim();
      const startRaw = String(d.startTime ?? "").trim();
      const endRaw = String(d.endTime ?? "").trim();
      const dateTimeCandidate = dateRaw ? `${dateRaw}T${startRaw || "00:00:00"}` : "";
      const parsedTs = Date.parse(dateTimeCandidate);
      return {
        d,
        index,
        dateRaw,
        startRaw,
        endRaw,
        parsedTs: Number.isNaN(parsedTs) ? null : parsedTs,
      };
    })
    .sort((a, b) => {
      if (a.parsedTs !== null && b.parsedTs !== null && a.parsedTs !== b.parsedTs) return a.parsedTs - b.parsedTs;
      if (a.parsedTs !== null && b.parsedTs === null) return -1;
      if (a.parsedTs === null && b.parsedTs !== null) return 1;
      if (a.dateRaw !== b.dateRaw) return a.dateRaw.localeCompare(b.dateRaw);
      if (a.startRaw !== b.startRaw) return a.startRaw.localeCompare(b.startRaw);
      if (a.endRaw !== b.endRaw) return a.endRaw.localeCompare(b.endRaw);
      return a.index - b.index;
    })
    .map((x) => x.d);
  const slots: string[] = [];
  const slotLabelCount = new Map<string, number>();
  details.forEach((d) => {
    const baseLabel = formatAttendanceSlot(d.attendanceDate, d.startTime, d.endTime);
    const prevCount = slotLabelCount.get(baseLabel) ?? 0;
    const nextCount = prevCount + 1;
    slotLabelCount.set(baseLabel, nextCount);
    slots.push(nextCount === 1 ? baseLabel : `${baseLabel} (${nextCount})`);
  });
  const map = new Map<string, AttendanceStudentRow>();

  details.forEach((d, idx) => {
    const students = Array.isArray(d.StudAttendDetails) ? (d.StudAttendDetails as Array<Record<string, unknown>>) : [];
    students.forEach((s) => {
      const studentNo = String(s.studNo ?? "").trim();
      const studentName = String(s.studName ?? "").trim();
      if (!studentNo) return;
      if (!map.has(studentNo)) {
        map.set(studentNo, {
          studentNo,
          studentName,
          registrationNo: "",
          registrationStatus: "",
          statuses: Array(slots.length).fill("—"),
        });
      }
      const row = map.get(studentNo)!;
      if (!row.studentName && studentName) row.studentName = studentName;
      const reg = registrationNoFromAttendanceStudent(s);
      if (reg && !row.registrationNo) row.registrationNo = reg;
      const regStatus = registrationStatusFromStudent(s);
      if (regStatus && !row.registrationStatus) row.registrationStatus = regStatus;
      row.statuses[idx] = formatAttendanceStatus(s.attendanceStatus);
    });
  });

  const rows = Array.from(map.values()).sort((a, b) => a.studentNo.localeCompare(b.studentNo));
  return { slots, rows };
}

function mergeAttendanceRegistrationFromStudentList(rows: AttendanceStudentRow[], sectionListRows: Record<string, unknown>[]): AttendanceStudentRow[] {
  const details = studentDetailsFromSectionListRows(sectionListRows);
  return rows.map((r) => {
    const fromList = details.get(normalizeStudentNoKey(r.studentNo));
    const regNo = fromList?.registrationNo?.trim() ?? "";
    const regStatus = fromList?.registrationStatus?.trim() ?? "";
    return {
      ...r,
      registrationNo: (r.registrationNo && r.registrationNo.trim()) || regNo,
      registrationStatus: (r.registrationStatus && r.registrationStatus.trim()) || regStatus,
    };
  });
}

function ResultAnalysisViewerDialog({
  state,
  onClose,
  courseCode,
  courseId,
}: {
  state: ResultAnalysisViewerState;
  onClose: () => void;
  courseCode: string;
  courseId: string;
}) {
  const title = `Result Analysis — Section ${state.sectionCode}`;
  const row = state.row;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label="Result analysis viewer">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-700 bg-gray-900 px-4 py-2">
        <span className="truncate text-sm font-medium text-white">{title}</span>
        <button type="button" onClick={onClose} className="rounded p-2 text-white hover:bg-gray-700" aria-label="Close">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        {state.loading && <p className="text-sm text-gray-700">Loading result analysis…</p>}
        {state.error && <p className="text-sm text-red-700">{state.error}</p>}
        {!state.loading && !state.error && !row && <p className="text-sm text-gray-700">No result analysis data available.</p>}
        {!state.loading && !state.error && row && (
          <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-sm">
            <h4 className="mb-3 text-center text-xl font-semibold text-gray-900">End Semester Result Analysis</h4>
            <div className="mb-4 grid gap-1 text-base font-semibold text-gray-900 md:grid-cols-2">
              <p>Course Code: {courseCode || courseId || "—"}</p>
              <p className="md:text-right">Section: {row.sectionCode}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[520px] border-collapse text-left text-sm text-gray-900">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-2 font-semibold">Grade</th>
                    <th className="border border-gray-300 px-3 py-2 font-semibold">Count of Student</th>
                    <th className="border border-gray-300 px-3 py-2 font-semibold">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {RESULT_GRADE_ORDER.map((grade) => {
                    const rawCount = Number(row.grades?.[grade] ?? 0);
                    const count = Number.isFinite(rawCount) ? rawCount : 0;
                    const pct = row.totalStudents > 0 ? (count / row.totalStudents) * 100 : 0;
                    return (
                      <tr key={grade}>
                        <td className="border border-gray-300 px-3 py-2">{grade}</td>
                        <td className="border border-gray-300 px-3 py-2">{count}</td>
                        <td className="border border-gray-300 px-3 py-2">{pct.toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="border border-gray-300 px-3 py-2 font-semibold">Pass</td>
                    <td className="border border-gray-300 px-3 py-2">{row.passCount}</td>
                    <td className="border border-gray-300 px-3 py-2">
                      {row.totalStudents > 0 ? `${((row.passCount / row.totalStudents) * 100).toFixed(0)}%` : "0%"}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2 font-semibold">Fail</td>
                    <td className="border border-gray-300 px-3 py-2">{row.failCount}</td>
                    <td className="border border-gray-300 px-3 py-2">
                      {row.totalStudents > 0 ? `${((row.failCount / row.totalStudents) * 100).toFixed(0)}%` : "0%"}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2 font-semibold">Total Student</td>
                    <td className="border border-gray-300 px-3 py-2">{row.totalStudents}</td>
                    <td className="border border-gray-300 px-3 py-2" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type ExamMarksViewerState = {
  viewerShortTitle: string;
  sectionCode: string;
  rows: MteStudentMarksRow[];
  loading: boolean;
  error: string | null;
  metaNote?: string | null;
};

function mteMarkCell(row: MteStudentMarksRow, questionCode: string): string {
  if (row.mteAbsentForResessional) return "Absent";
  const m = (row.marks ?? []).find((x) => String(x.questionCode ?? "").trim() === questionCode);
  if (!m) return "—";
  const o = String(m.markObtained ?? "").trim();
  return o || "—";
}

function ExamMarksViewerDialog({ state, onClose }: { state: ExamMarksViewerState; onClose: () => void }) {
  const title = `${state.viewerShortTitle} — Section ${state.sectionCode}`;
  const questionCodes = useMemo(() => collectQuestionCodes(state.rows), [state.rows]);
  const maxByQuestion = useMemo(() => {
    const map = new Map<string, string>();
    for (const qc of questionCodes) {
      const mx = mteMaxMarkForQuestion(state.rows, qc);
      if (mx) map.set(qc, mx);
    }
    return map;
  }, [state.rows, questionCodes]);
  const averages = useMemo(() => computeMteSectionAverages(state.rows), [state.rows]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label="Exam marks viewer">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-700 bg-gray-900 px-4 py-2">
        <span className="truncate text-sm font-medium text-white">{title}</span>
        <button type="button" onClick={onClose} className="rounded p-2 text-white hover:bg-gray-700" aria-label="Close">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        {state.loading && <p className="text-sm text-gray-700">Loading {state.viewerShortTitle.toLowerCase()}…</p>}
        {state.error && <p className="text-sm text-red-700">{state.error}</p>}
        {!state.loading && !state.error && state.rows.length === 0 && (
          <p className={`text-sm ${state.metaNote ? "text-amber-800" : "text-gray-700"}`}>{state.metaNote || "No marks to show for this section."}</p>
        )}
        {!state.loading && !state.error && state.rows.length > 0 && (
          <>
            {state.metaNote && <p className="mb-2 text-xs text-amber-800">{state.metaNote}</p>}
            <div className="overflow-x-auto rounded-lg border border-gray-300 bg-white shadow-sm">
              <table className="min-w-full border-collapse text-left text-xs text-gray-900 md:text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-400 px-3 py-2 font-semibold">Student No.</th>
                    <th className="border border-gray-400 px-3 py-2 font-semibold">Registration No.</th>
                    <th className="border border-gray-400 px-3 py-2 font-semibold">Student Name</th>
                    {questionCodes.map((qc) => {
                      const maxStr = maxByQuestion.get(qc);
                      const singleAggregateColumn = questionCodes.length === 1;
                      const headerText = singleAggregateColumn
                        ? maxStr
                          ? `Marks Obtained ( MaxMarks ${maxStr})`
                          : "Marks Obtained"
                        : maxStr
                          ? `${qc} — Marks Obtained ( MaxMarks ${maxStr})`
                          : qc;
                      return (
                        <th key={qc} className="border border-gray-400 px-3 py-2 font-semibold">
                          {headerText}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {state.rows.map((row, idx) => (
                    <tr key={`${String(row.studentNo ?? idx)}-${idx}`} className="bg-white">
                      <td className="border border-gray-400 px-3 py-2">{formatTimetableCell(row.studentNo)}</td>
                      <td className="border border-gray-400 px-3 py-2">{formatTimetableCell(row.registrationNo)}</td>
                      <td className="border border-gray-400 px-3 py-2">{formatTimetableCell(row.studentName)}</td>
                      {questionCodes.map((qc) => (
                        <td key={qc} className="border border-gray-400 px-3 py-2">
                          {mteMarkCell(row, qc)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {averages.nWithMarks > 0 && averages.avgObt != null && averages.avgMax != null && (
              <p className="mt-4 text-sm font-semibold text-gray-900">
                Section average ({state.viewerShortTitle})
                {averages.nWithMarks < averages.n ? ` — ${averages.nWithMarks} of ${averages.n} students with marks` : ` — ${averages.n} students`}:{" "}
                {averages.avgObt.toFixed(2)} / {averages.avgMax.toFixed(2)}
                {averages.avgPct != null ? ` (${averages.avgPct.toFixed(1)}% of max)` : ""}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function generateFileId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

type PdfViewerDialogProps = {
  blobUrl: string;
  fileName: string;
  onClose: () => void;
};

function PdfViewerDialog({ blobUrl, fileName, onClose }: PdfViewerDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label="PDF viewer">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-700 bg-gray-900 px-4 py-2">
        <span className="truncate text-sm font-medium text-white">{fileName}</span>
        <button type="button" onClick={onClose} className="rounded p-2 text-white hover:bg-gray-700" aria-label="Close">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <iframe title={fileName} src={blobUrl} className="h-[80vh] min-h-[500px] w-full border-0 bg-white" />
      </div>
    </div>
  );
}

type PdfUploadSectionProps = {
  sectionNum: number;
  files: UploadedFileItem[];
  onFilesChange: (sectionNum: number, files: UploadedFileItem[]) => void;
  onViewPdf: (file: File, name: string) => void;
};

function PdfUploadSection({ sectionNum, files, onFilesChange, onViewPdf }: PdfUploadSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles?.length) return;
    const docs = Array.from(newFiles).filter((f) => isAllowedCourseFileUpload(f));
    if (docs.length === 0) {
      alert("Please select PDF files only (.pdf).");
      return;
    }
    const items: UploadedFileItem[] = docs.map((f) => ({ id: generateFileId(), file: f, name: f.name }));
    onFilesChange(sectionNum, [...files, ...items]);
  };

  const remove = (id: string) => {
    onFilesChange(
      sectionNum,
      files.filter((f) => f.id !== id)
    );
  };

  const move = (index: number, direction: "up" | "down") => {
    const next = [...files];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onFilesChange(sectionNum, next);
  };

  return (
    <>
      <p className="mb-3 text-sm text-gray-600">Upload PDF(s). View, reorder, and remove documents here.</p>
      <div
        className="mb-4 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center transition-colors hover:border-orange-400 hover:bg-gray-100"
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add("border-orange-500", "bg-orange-50");
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("border-orange-500", "bg-orange-50");
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("border-orange-500", "bg-orange-50");
          addFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-md border border-gray-400 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Choose PDF files or drag and drop here
        </button>
      </div>
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((item, index) => (
            <li key={item.id} className="flex items-center gap-2 rounded-md border border-gray-200 bg-white py-2 pl-2 pr-3 shadow-sm">
              <GripVertical size={18} className="shrink-0 text-gray-400" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm text-gray-800" title={item.name}>
                {item.name}
              </span>
              <button
                type="button"
                onClick={() => onViewPdf(item.file, item.name)}
                className={`shrink-0 rounded p-1.5 ${isPdfFile(item.file) ? "text-gray-600 hover:bg-gray-100 hover:text-orange-600" : "cursor-not-allowed text-gray-300"}`}
                title={isPdfFile(item.file) ? "View" : "Preview available for PDF only"}
                disabled={!isPdfFile(item.file)}
              >
                <Eye size={18} />
              </button>
              <button
                type="button"
                onClick={() => move(index, "up")}
                disabled={index === 0}
                className="shrink-0 rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                title="Move up"
              >
                <ChevronUp size={18} />
              </button>
              <button
                type="button"
                onClick={() => move(index, "down")}
                disabled={index === files.length - 1}
                className="shrink-0 rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                title="Move down"
              >
                <ChevronDown size={18} />
              </button>
              <button type="button" onClick={() => remove(item.id)} className="shrink-0 rounded p-1.5 text-red-600 hover:bg-red-50" title="Remove">
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function CourseFilePage() {
  const { data: session } = useSession();
  const { isSideNavOpen, toggleSideNav } = useSideNavState();

  const headerAcademicYear = useSelector((state: RootState) => state.dataState.selectedAcademicYear);
  const headerAcademicSession = useSelector((state: RootState) => state.dataState.selectedAcademicSession);

  const [sectionData, setSectionData] = useState<Record<number, SectionState>>({});
  const [uploadedFilesBySection, setUploadedFilesBySection] = useState<Record<number, UploadedFileItem[]>>({});
  const [viewerPdf, setViewerPdf] = useState<{ url: string; fileName: string } | null>(null);
  const [timetableViewer, setTimetableViewer] = useState<TimetableViewerState | null>(null);
  const [facultyTimetableRowsByCode, setFacultyTimetableRowsByCode] = useState<Record<string, Record<string, unknown>[]>>({});
  const [coordinatorList, setCoordinatorList] = useState<CourseCoordinatorRow[]>([]);
  const [loadingCoordinator, setLoadingCoordinator] = useState(false);
  const [selectedProgramCode, setSelectedProgramCode] = useState("");
  const [selectedCourseCode, setSelectedCourseCode] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [facultyList, setFacultyList] = useState<CourseFacultyRow[]>([]);
  const [sectionWiseFacultyList, setSectionWiseFacultyList] = useState<CourseWiseSectionFacultyRow[]>([]);

  const selectorsReady = Boolean(selectedProgramCode && selectedCourseCode && selectedSemester && selectedCourseId);

  const programCodesList = useMemo(() => Array.from(new Set(coordinatorList.map((r) => r["Program Code"]).filter(Boolean))).sort(), [coordinatorList]);
  const courseCodesForProgram = useMemo(
    () =>
      !selectedProgramCode
        ? []
        : Array.from(
            new Set(
              coordinatorList
                .filter((r) => r["Program Code"] === selectedProgramCode)
                .map((r) => r["Course Code"])
                .filter(Boolean)
            )
          ).sort(),
    [coordinatorList, selectedProgramCode]
  );
  const semesterCodesForProgramCourse = useMemo(
    () =>
      !selectedProgramCode || !selectedCourseCode
        ? []
        : Array.from(
            new Set(
              coordinatorList
                .filter((r) => r["Program Code"] === selectedProgramCode && r["Course Code"] === selectedCourseCode)
                .map((r) => r["Semester Code"])
                .filter(Boolean)
            )
          ).sort(),
    [coordinatorList, selectedProgramCode, selectedCourseCode]
  );

  const uniqueStudentListSections = useMemo(
    () => Array.from(new Set(sectionWiseFacultyList.map((r) => r.sectionCode).filter(Boolean))).sort(),
    [sectionWiseFacultyList]
  );
  const section4GeneratedFileName = useMemo(
    () =>
      generateSection4CourseHandoutFileName({
        courseId: selectedCourseId,
        courseCode: selectedCourseCode,
        academicYear: headerAcademicYear || "",
        academicSession: headerAcademicSession || "",
      }),
    [selectedCourseCode, selectedCourseId, headerAcademicYear, headerAcademicSession]
  );

  const [studentSectionRows, setStudentSectionRows] = useState<CourseStudentSectionRow[]>([]);
  const [studentListViewer, setStudentListViewer] = useState<StudentListViewerState | null>(null);
  const [attendanceSectionRows, setAttendanceSectionRows] = useState<CourseStudentSectionRow[]>([]);
  const [attendanceViewer, setAttendanceViewer] = useState<AttendanceViewerState | null>(null);
  const [examMarksSectionRowsByNum, setExamMarksSectionRowsByNum] = useState<Partial<Record<ExamMarksCourseFileSection, CourseStudentSectionRow[]>>>({});
  const [examMarksViewer, setExamMarksViewer] = useState<ExamMarksViewerState | null>(null);
  const [resultAnalysisSectionRows, setResultAnalysisSectionRows] = useState<CourseStudentSectionRow[]>([]);
  const [resultAnalysisViewer, setResultAnalysisViewer] = useState<ResultAnalysisViewerState | null>(null);
  const [studentListCacheBySection, setStudentListCacheBySection] = useState<Record<string, SectionStudentListData>>({});
  const [attendanceCacheBySection, setAttendanceCacheBySection] = useState<Record<string, SectionAttendanceData>>({});
  const [examMarksCacheByKey, setExamMarksCacheByKey] = useState<Record<string, SectionExamMarksData>>({});
  const [resultAnalysisCacheBySection, setResultAnalysisCacheBySection] = useState<Record<string, { row: ResultAnalysisRow | null; error: string | null }>>({});
  const [section4FileExists, setSection4FileExists] = useState(false);
  const [section4FileLoading, setSection4FileLoading] = useState(false);
  const [section4FileError, setSection4FileError] = useState<string | null>(null);
  const [courseOutcomeRows, setCourseOutcomeRows] = useState<CourseOutcomeRow[]>([]);
  const [section25FeedbackViewerOpen, setSection25FeedbackViewerOpen] = useState(false);
  const [section1VisionMissionViewerOpen, setSection1VisionMissionViewerOpen] = useState(false);
  const [section27AttainmentViewerOpen, setSection27AttainmentViewerOpen] = useState(false);
  const [section28ImprovementPoints, setSection28ImprovementPoints] = useState<string[]>([""]);
  const [section28StudentFeedback, setSection28StudentFeedback] = useState("");
  const [section28SyllabusCoverage, setSection28SyllabusCoverage] = useState("");
  const [section28ContentDelivery, setSection28ContentDelivery] = useState("");
  const [section28AnyOtherFeedback, setSection28AnyOtherFeedback] = useState("");
  const [section28ConsolidationLoading, setSection28ConsolidationLoading] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [missingUploadSectionsDialog, setMissingUploadSectionsDialog] = useState<string[] | null>(null);
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const studentListCacheRef = useRef<Record<string, SectionStudentListData>>({});
  const attendanceCacheRef = useRef<Record<string, SectionAttendanceData>>({});
  const examMarksCacheRef = useRef<Record<string, SectionExamMarksData>>({});
  const studentListInFlightRef = useRef<Partial<Record<string, Promise<SectionStudentListData>>>>({});
  const attendanceInFlightRef = useRef<Partial<Record<string, Promise<SectionAttendanceData>>>>({});
  const examMarksInFlightRef = useRef<Partial<Record<string, Promise<SectionExamMarksData>>>>({});

  const handleUploadedFilesChange = useCallback((sectionNum: number, files: UploadedFileItem[]) => {
    setUploadedFilesBySection((prev) => ({ ...prev, [sectionNum]: files }));
  }, []);

  const handleViewPdf = useCallback((file: File, name: string) => {
    const url = URL.createObjectURL(file);
    setViewerPdf({ url, fileName: name });
  }, []);

  const handleCloseViewer = useCallback(() => {
    if (viewerPdf?.url) URL.revokeObjectURL(viewerPdf.url);
    setViewerPdf(null);
  }, [viewerPdf?.url]);

  useEffect(() => {
    const email = session?.user?.email;
    if (!email || !headerAcademicYear || !headerAcademicSession) {
      setCoordinatorList([]);
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
          email: "kusumlata.jain@jaipur.manipal.edu", // Ignore this because it is being used for testi
          // email: "aditi.priya@jaipur.manipal.edu", // Ignore this because it is being used for testi
        });
        if (cancelled || !empRes.success || !empRes.data?.values?.length) {
          if (!cancelled) setCoordinatorList([]);
          return;
        }
        const employeeNo = empRes.data.values[0]?.employeeNo;
        if (!employeeNo) {
          if (!cancelled) setCoordinatorList([]);
          return;
        }

        const coordRes = await callApiViaProxy<GetCourseCoordinatorResponse>(OBE_GET_COURSE_COORDINATOR_PATH, {
          acadYear: headerAcademicYear,
          acadSess: headerAcademicSession,
          facultyCode: employeeNo,
        });

        if (!cancelled && coordRes.success && coordRes.data?.values?.length) {
          setCoordinatorList(coordRes.data.values);
        } else if (!cancelled) {
          setCoordinatorList([]);
        }
      } catch {
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

  useEffect(() => {
    if (!selectorsReady || !headerAcademicSession) {
      setFacultyList([]);
      setSectionWiseFacultyList([]);
      return;
    }

    const url = getCourseWiseMultiFacultyUrl();
    if (url === URL_NOT_FOUND) {
      setFacultyList([]);
      setSectionWiseFacultyList([]);
      return;
    }

    let cancelled = false;

    const loadCourseWiseMultiFaculty = async () => {
      const res = await callApiViaProxy<unknown>(url, {
        programCode: selectedProgramCode,
        acadSes: headerAcademicSession,
        courseId: selectedCourseId,
      });

      if (cancelled || !res.success) {
        if (!cancelled) {
          setFacultyList([]);
          setSectionWiseFacultyList([]);
        }
        return;
      }

      const rawRows = extractTimetableRows(res.data);
      const sectionRows: CourseWiseSectionFacultyRow[] = rawRows
        .map((row) => ({
          facultyCode: String(row["Faculty Code"] ?? "").trim(),
          facultyName: String(row["facultyName"] ?? row["Faculty Name"] ?? "").trim(),
          sectionCode: String(row["Section Code"] ?? "").trim(),
        }))
        .filter((r) => r.facultyCode && r.facultyName && r.sectionCode);

      const facultyMap = new Map<string, CourseFacultyRow>();
      sectionRows.forEach((r) => {
        if (!facultyMap.has(r.facultyCode)) {
          facultyMap.set(r.facultyCode, {
            id: `faculty-${r.facultyCode}`,
            facultyCode: r.facultyCode,
            facultyName: r.facultyName,
          });
        }
      });

      if (!cancelled) {
        setSectionWiseFacultyList(sectionRows);
        setFacultyList(Array.from(facultyMap.values()));
      }
    };

    loadCourseWiseMultiFaculty();
    return () => {
      cancelled = true;
    };
  }, [selectorsReady, headerAcademicSession, selectedProgramCode, selectedCourseId]);

  useEffect(() => {
    setStudentSectionRows(
      uniqueStudentListSections.map((sec) => ({
        id: `student-sec-${sec}-${selectedCourseId}`,
        sectionCode: sec,
      }))
    );
  }, [selectedCourseId, uniqueStudentListSections]);

  useEffect(() => {
    setAttendanceSectionRows(
      uniqueStudentListSections.map((sec) => ({
        id: `attendance-sec-${sec}-${selectedCourseId}`,
        sectionCode: sec,
      }))
    );
  }, [selectedCourseId, uniqueStudentListSections]);

  useEffect(() => {
    const next: Partial<Record<ExamMarksCourseFileSection, CourseStudentSectionRow[]>> = {};
    for (const num of EXAM_MARKS_COURSE_FILE_SECTIONS) {
      next[num] = uniqueStudentListSections.map((sec) => ({
        id: `exam-${num}-${sec}-${selectedCourseId}`,
        sectionCode: sec,
      }));
    }
    setExamMarksSectionRowsByNum(next);
  }, [selectedCourseId, uniqueStudentListSections]);

  useEffect(() => {
    setResultAnalysisSectionRows(
      uniqueStudentListSections.map((sec) => ({
        id: `result-analysis-${sec}-${selectedCourseId}`,
        sectionCode: sec,
      }))
    );
  }, [selectedCourseId, uniqueStudentListSections]);

  useEffect(() => {
    if (!selectorsReady || !headerAcademicYear || !headerAcademicSession || !section4GeneratedFileName) {
      setSection4FileExists(false);
      setSection4FileLoading(false);
      setSection4FileError(null);
      return;
    }
    let cancelled = false;
    setSection4FileLoading(true);
    setSection4FileError(null);
    fetch("/api/course-file/local-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: section4GeneratedFileName }),
    })
      .then(async (res) => {
        const payload = (await res.json().catch(() => ({}))) as { success?: boolean; exists?: boolean; error?: string };
        if (cancelled) return;
        if (!res.ok || !payload.success) {
          setSection4FileExists(false);
          setSection4FileError(payload.error || "Failed to check section 4 local file.");
          return;
        }
        setSection4FileExists(Boolean(payload.exists));
      })
      .catch((err) => {
        if (cancelled) return;
        setSection4FileExists(false);
        setSection4FileError((err as Error)?.message || "Failed to check section 4 local file.");
      })
      .finally(() => {
        if (cancelled) return;
        setSection4FileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectorsReady, headerAcademicYear, headerAcademicSession, section4GeneratedFileName]);

  useEffect(() => {
    if (!selectorsReady || !headerAcademicYear || !headerAcademicSession || !selectedCourseId) {
      setCourseOutcomeRows([]);
      return;
    }
    const coUrl = getCourseOutcomeUrl();
    if (coUrl === URL_NOT_FOUND) {
      setCourseOutcomeRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await callApiViaProxy<unknown>(coUrl, {
        acadSess: headerAcademicSession,
        acadYear: headerAcademicYear,
        courseID: selectedCourseId,
      });
      if (cancelled) return;
      if (!res.success) {
        setCourseOutcomeRows([]);
        return;
      }
      setCourseOutcomeRows(extractCourseOutcomeRows(res.data));
    })();
    return () => {
      cancelled = true;
    };
  }, [selectorsReady, headerAcademicYear, headerAcademicSession, selectedCourseId]);

  useEffect(() => {
    studentListCacheRef.current = studentListCacheBySection;
  }, [studentListCacheBySection]);

  useEffect(() => {
    attendanceCacheRef.current = attendanceCacheBySection;
  }, [attendanceCacheBySection]);

  useEffect(() => {
    examMarksCacheRef.current = examMarksCacheByKey;
  }, [examMarksCacheByKey]);

  useEffect(() => {
    setStudentListCacheBySection({});
    setAttendanceCacheBySection({});
    setExamMarksCacheByKey({});
    setResultAnalysisCacheBySection({});
    studentListCacheRef.current = {};
    attendanceCacheRef.current = {};
    examMarksCacheRef.current = {};
    studentListInFlightRef.current = {};
    attendanceInFlightRef.current = {};
    examMarksInFlightRef.current = {};
  }, [selectedCourseId, headerAcademicYear, headerAcademicSession]);

  useEffect(() => {
    if (!headerAcademicYear || !headerAcademicSession || !selectorsReady) {
      setSectionData({});
      return;
    }
    let cancelled = false;
    const body = { acadYear: headerAcademicYear, acadSess: headerAcademicSession, courseID: selectedCourseId };
    (async () => {
      for (const { section, label } of FETCH_SECTIONS) {
        if (cancelled) return;
        setSectionData((prev) => ({ ...prev, [section]: { ...prev[section], loading: true, error: null } }));
        try {
          const isSection1 = section === 1;
          const isSection25 = section === 25;
          const isSection27 = section === 27;
          const endpoint = isSection1
            ? UNIVERSITY_VISION_MISSION_URL
            : isSection25
            ? buildCourseExitFeedbackGetUrl({
                acadYear: headerAcademicYear,
                acadSession: headerAcademicSession,
                courseId: selectedCourseCode,
                programCode: selectedProgramCode,
              })
            : isSection27
              ? COPO_BLOB_GET_URL_TEST
              : getEnvUrl(section);
          const requestBody = isSection1
            ? undefined
            : isSection25
            ? undefined
            : isSection27
              ? {
                  academicYear: headerAcademicYear,
                  academicSession: headerAcademicSession,
                  courseId: selectedCourseId,
                  programCode: selectedProgramCode,
                }
              : body;
          const method: "GET" | "POST" = isSection25 ? "GET" : "POST";
          if (endpoint === URL_NOT_FOUND) {
            setSectionData((prev) => ({
              ...prev,
              [section]: {
                loading: false,
                error: `${label} API is not configured.`,
                data: null,
              },
            }));
            continue;
          }
          const res = await callApiViaProxy<unknown>(endpoint, requestBody, undefined, method);
          let finalData: unknown = res.success ? res.data : null;
          if (res.success && isSection1) {
            const deptRes = await callApiViaProxy<unknown>(
              DEPARTMENT_VISION_MISSION_URL,
              { programCode: selectedProgramCode, acadYear: headerAcademicYear },
              undefined,
              "POST"
            );
            if (!deptRes.success) {
              throw new Error(deptRes.error || "Failed to load department vision & mission");
            }
            finalData = {
              university: res.data,
              department: deptRes.data,
            };
          }
          if (cancelled) return;
          setSectionData((prev) => ({
            ...prev,
            [section]: {
              loading: false,
              error: res.success ? null : res.error || `Failed to load ${label}`,
              data: finalData,
            },
          }));
        } catch (err) {
          if (cancelled) return;
          setSectionData((prev) => ({
            ...prev,
            [section]: {
              loading: false,
              error: (err as Error)?.message || `Failed to load ${label}`,
              data: null,
            },
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [headerAcademicYear, headerAcademicSession, selectorsReady, selectedCourseCode, selectedCourseId, selectedProgramCode]);

  const handleFacultyTimetableReorder = useCallback((index: number, direction: "up" | "down") => {
    setFacultyList((prev) => {
      const next = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const fetchFacultyTimetableRows = useCallback(
    async (faculty: CourseFacultyRow): Promise<Record<string, unknown>[]> => {
      const url = getFacultyTimetableUrl();
      if (url === URL_NOT_FOUND || !headerAcademicSession || !selectedCourseId) return [];

      const res = await callApiViaProxy<unknown>(url, {
        acadSess: headerAcademicSession,
        facultyCode: faculty.facultyCode.trim(),
        courseID: selectedCourseId,
      });
      if (!res.success) return [];

      const rows = extractTimetableRows(res.data);
      const requestedFacultyCode = faculty.facultyCode.trim().toLowerCase();
      return rows.filter((row) => {
        const rowFacultyCode = String(row["Faculty Code"] ?? "")
          .trim()
          .toLowerCase();
        return rowFacultyCode === requestedFacultyCode;
      });
    },
    [headerAcademicSession, selectedCourseId]
  );

  useEffect(() => {
    if (!headerAcademicSession || !selectedCourseId || facultyList.length === 0) {
      setFacultyTimetableRowsByCode({});
      return;
    }

    let isCancelled = false;

    (async () => {
      const next: Record<string, Record<string, unknown>[]> = {};
      for (const faculty of facultyList) {
        if (isCancelled) return;
        const rows = await fetchFacultyTimetableRows(faculty);
        next[faculty.facultyCode.trim()] = rows;
      }
      if (isCancelled) return;
      setFacultyTimetableRowsByCode(next);
    })();

    return () => {
      isCancelled = true;
    };
  }, [facultyList, fetchFacultyTimetableRows, headerAcademicSession, selectedCourseId]);

  const handleViewFacultyTimetable = useCallback(
    async (faculty: CourseFacultyRow) => {
      const url = getFacultyTimetableUrl();
      const cacheKey = faculty.facultyCode.trim();
      const cachedRows = facultyTimetableRowsByCode[cacheKey];
      setTimetableViewer({
        facultyName: faculty.facultyName,
        facultyCode: faculty.facultyCode,
        rows: cachedRows ?? [],
        loading: !cachedRows,
        error: null,
      });

      if (cachedRows) return;

      if (url === URL_NOT_FOUND) {
        setTimetableViewer({
          facultyName: faculty.facultyName,
          facultyCode: faculty.facultyCode,
          rows: [],
          loading: false,
          error: "Faculty timetable API is not configured (NEXT_PUBLIC_COURSE_FILE_FACULTY_WISE_TIMETABLE).",
        });
        return;
      }

      if (!headerAcademicSession || !selectedCourseId) {
        setTimetableViewer({
          facultyName: faculty.facultyName,
          facultyCode: faculty.facultyCode,
          rows: [],
          loading: false,
          error: "Select Programme, Course Code and Semester to load timetable.",
        });
        return;
      }

      const filteredRows = await fetchFacultyTimetableRows(faculty);
      setFacultyTimetableRowsByCode((prev) => ({ ...prev, [cacheKey]: filteredRows }));
      setTimetableViewer({
        facultyName: faculty.facultyName,
        facultyCode: faculty.facultyCode,
        rows: filteredRows,
        loading: false,
        error: null,
      });
    },
    [facultyTimetableRowsByCode, fetchFacultyTimetableRows, headerAcademicSession, selectedCourseId]
  );

  const handleCloseTimetableViewer = useCallback(() => {
    setTimetableViewer(null);
  }, []);

  const getExamMarksCacheKey = useCallback((courseFileSectionNum: ExamMarksCourseFileSection, sectionCode: string) => {
    return `${courseFileSectionNum}::${sectionCode}`;
  }, []);

  const loadStudentListForSection = useCallback(
    async (sectionCode: string, forceRefresh: boolean = false): Promise<SectionStudentListData> => {
      const cached = studentListCacheRef.current[sectionCode];
      if (!forceRefresh && cached && !cached.error) return cached;
      if (!forceRefresh && studentListInFlightRef.current[sectionCode]) return studentListInFlightRef.current[sectionCode]!;
      const url = getStudentListSectionWiseUrl();
      if (url === URL_NOT_FOUND) {
        return { rows: [], error: "Student list API is not configured (NEXT_PUBLIC_COURSE_FILE_STUDENT_LIST_SECTION_WISE)." };
      }
      if (!headerAcademicSession || !selectedCourseId || !selectorsReady) {
        return { rows: [], error: "Select Programme, Course Code and Semester to load student list." };
      }
      const requestPromise = (async () => {
        const res = await callApiViaProxy<unknown>(url, {
          acadSess: headerAcademicSession,
          sec: sectionCode,
          courseId: selectedCourseId,
        });
        const payload: SectionStudentListData = res.success
          ? { rows: extractTimetableRows(res.data), error: null }
          : { rows: [], error: res.error || "Failed to load student list." };
        setStudentListCacheBySection((prev) => ({ ...prev, [sectionCode]: payload }));
        return payload;
      })();
      studentListInFlightRef.current[sectionCode] = requestPromise;
      try {
        return await requestPromise;
      } finally {
        delete studentListInFlightRef.current[sectionCode];
      }
    },
    [headerAcademicSession, selectedCourseId, selectorsReady]
  );

  const loadAttendanceForSection = useCallback(
    async (sectionCode: string, forceRefresh: boolean = false): Promise<SectionAttendanceData> => {
      const cached = attendanceCacheRef.current[sectionCode];
      if (!forceRefresh && cached && !cached.error) return cached;
      if (!forceRefresh && attendanceInFlightRef.current[sectionCode]) return attendanceInFlightRef.current[sectionCode]!;
      const url = getEnvUrl(18);
      if (url === URL_NOT_FOUND) {
        return {
          slots: [],
          rows: [],
          error: "Attendance API is not configured (set NEXT_PUBLIC_COURSE_FILE_ATTENDANCE).",
        };
      }
      if (!headerAcademicSession || !selectedCourseId || !selectorsReady) {
        return { slots: [], rows: [], error: "Select Programme, Course Code and Semester to load attendance." };
      }
      const requestPromise = (async () => {
        const res = await callApiViaProxy<unknown>(url, {
          acadSess: headerAcademicSession,
          sect: sectionCode,
          courseId: selectedCourseId,
        });
        if (!res.success) {
          const errPayload: SectionAttendanceData = { slots: [], rows: [], error: res.error || "Failed to load attendance." };
          setAttendanceCacheBySection((prev) => ({ ...prev, [sectionCode]: errPayload }));
          return errPayload;
        }
        const matrix = buildAttendanceMatrix(res.data);
        const listPayload = await loadStudentListForSection(sectionCode, forceRefresh);
        const rows = mergeAttendanceRegistrationFromStudentList(matrix.rows, listPayload.rows);
        const payload: SectionAttendanceData = { slots: matrix.slots, rows, error: null };
        setAttendanceCacheBySection((prev) => ({ ...prev, [sectionCode]: payload }));
        return payload;
      })();
      attendanceInFlightRef.current[sectionCode] = requestPromise;
      try {
        return await requestPromise;
      } finally {
        delete attendanceInFlightRef.current[sectionCode];
      }
    },
    [headerAcademicSession, loadStudentListForSection, selectedCourseId, selectorsReady]
  );

  const loadExamMarksForSection = useCallback(
    async (courseFileSectionNum: ExamMarksCourseFileSection, sectionCode: string, forceRefresh: boolean = false): Promise<SectionExamMarksData> => {
      const cacheKey = getExamMarksCacheKey(courseFileSectionNum, sectionCode);
      const cached = examMarksCacheRef.current[cacheKey];
      if (!forceRefresh && cached && !cached.error) return cached;
      if (!forceRefresh && examMarksInFlightRef.current[cacheKey]) return examMarksInFlightRef.current[cacheKey]!;

      const marksUrl = getExamMethodMarksUrl();
      if (marksUrl === URL_NOT_FOUND) {
        return {
          rows: [],
          error:
            "Exam marks API is not configured (set NEXT_PUBLIC_COURSE_FILE_MTE_MARKS or NEXT_PUBLIC_GET_EXAM_METHOD_STUDENT_LIST to GetAllExmMethodStudListWmarks).",
        };
      }
      if (!headerAcademicYear || !headerAcademicSession || !selectedCourseId || !selectorsReady) {
        return { rows: [], error: "Select Programme, Course Code and Semester, and set academic year and session in the header." };
      }

      const requestPromise = (async () => {
        const ui = EXAM_MARKS_SECTION_UI[courseFileSectionNum];
        const studentPayload = await loadStudentListForSection(sectionCode, forceRefresh);
        if (studentPayload.error) {
          return { rows: [], error: studentPayload.error };
        }

        const allMarksResult = await fetchAllMteExamMarks(marksUrl, {
          acadSes: headerAcademicSession,
          acadYear: headerAcademicYear,
          courseID: selectedCourseId,
          examMethod: ui.examMethod,
          limit: 1000,
        });
        if (allMarksResult.error) {
          return { rows: [], error: allMarksResult.error };
        }

        const listRows = studentPayload.rows;
        const allowed = studentNosFromSectionListRows(listRows);
        const studentDetails = studentDetailsFromSectionListRows(listRows);
        const allRows = allMarksResult.rows;
        let filtered = filterMteRowsByStudentNos(allRows, allowed);
        let metaNote: string | null = null;

        if (filtered.length === 0 && allRows.length > 0 && allowed.size > 0) {
          filtered = allRows;
          metaNote = "Student numbers from the marks API did not match this section’s student list; showing all students returned for the course.";
        }

        if (filtered.length === 0 && allowed.size === 0) {
          return {
            rows: [],
            error: null,
            metaNote:
              listRows.length === 0
                ? "No students found for this section in the student list."
                : "Could not match student numbers between the student list and marks data.",
          };
        }

        let withDetails = mergeStudentDetails(filtered, studentDetails);
        if (courseFileSectionNum === 8) {
          let resessionalNote: string | null = null;
          const resessionalMarksResult = await fetchAllMteExamMarks(marksUrl, {
            acadSes: headerAcademicSession,
            acadYear: headerAcademicYear,
            courseID: selectedCourseId,
            examMethod: EXAM_MARKS_SECTION_UI[16].examMethod,
            limit: 1000,
          });
          if (resessionalMarksResult.error) {
            resessionalNote = "Re-sessional marks could not be loaded; MTE absent flags were not applied.";
          } else {
            let resessionalFiltered = filterMteRowsByStudentNos(resessionalMarksResult.rows, allowed);
            if (resessionalFiltered.length === 0 && resessionalMarksResult.rows.length > 0 && allowed.size > 0) {
              resessionalFiltered = resessionalMarksResult.rows;
            }
            const resessionalKeys = new Set(resessionalFiltered.map((r) => normalizeStudentNoKey(String(r.studentNo ?? ""))).filter(Boolean));
            withDetails = withDetails.map((r) => {
              const key = normalizeStudentNoKey(String(r.studentNo ?? ""));
              return key && resessionalKeys.has(key) ? { ...r, mteAbsentForResessional: true } : r;
            });
          }
          if (resessionalNote) metaNote = metaNote ? `${metaNote} ${resessionalNote}` : resessionalNote;
        }

        const payload: SectionExamMarksData = { rows: withDetails, error: null, metaNote };
        setExamMarksCacheByKey((prev) => ({ ...prev, [cacheKey]: payload }));
        return payload;
      })();
      examMarksInFlightRef.current[cacheKey] = requestPromise;
      try {
        return await requestPromise;
      } finally {
        delete examMarksInFlightRef.current[cacheKey];
      }
    },
    [getExamMarksCacheKey, headerAcademicYear, headerAcademicSession, loadStudentListForSection, selectorsReady, selectedCourseId]
  );

  useEffect(() => {
    if (!selectorsReady || !headerAcademicYear || !headerAcademicSession || !selectedCourseId || uniqueStudentListSections.length === 0) {
      return;
    }
    let cancelled = false;
    (async () => {
      setSection28ConsolidationLoading(true);
      try {
        await Promise.all(
          uniqueStudentListSections.map(async (sectionCode) => {
            const studentPayload = await loadStudentListForSection(sectionCode);
            await loadAttendanceForSection(sectionCode);

            await Promise.all(EXAM_MARKS_COURSE_FILE_SECTIONS.map((examSectionNum) => loadExamMarksForSection(examSectionNum, sectionCode)));

            if (studentPayload.error) return;
            const examPayload = await loadExamMarksForSection(21, sectionCode);
            if (examPayload.error) return;
            const allowed = studentNosFromSectionListRows(studentPayload.rows);
            let filtered = filterMteRowsByStudentNos(examPayload.rows, allowed);
            if (filtered.length === 0 && allowed.size > 0 && examPayload.rows.length > 0) filtered = examPayload.rows;
            const row = buildResultAnalysis(sectionCode, filtered);
            if (!cancelled) {
              setResultAnalysisCacheBySection((prev) => ({ ...prev, [sectionCode]: { row, error: null } }));
            }
          })
        );
      } finally {
        if (!cancelled) setSection28ConsolidationLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    headerAcademicSession,
    headerAcademicYear,
    loadAttendanceForSection,
    loadExamMarksForSection,
    loadStudentListForSection,
    selectorsReady,
    selectedCourseId,
    uniqueStudentListSections,
  ]);

  const handleStudentSectionReorder = useCallback((index: number, direction: "up" | "down") => {
    setStudentSectionRows((prev) => {
      const next = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const handleViewStudentList = useCallback(
    async (sectionCode: string) => {
      setStudentListViewer({
        sectionCode,
        rows: [],
        loading: true,
        error: null,
      });

      const payload = await loadStudentListForSection(sectionCode);
      if (payload.error) {
        setStudentListViewer({
          sectionCode,
          rows: [],
          loading: false,
          error: payload.error,
        });
        return;
      }

      setStudentListViewer({
        sectionCode,
        rows: payload.rows,
        loading: false,
        error: null,
      });
    },
    [loadStudentListForSection]
  );

  const handleCloseStudentListViewer = useCallback(() => {
    setStudentListViewer(null);
  }, []);

  const handleAttendanceSectionReorder = useCallback((index: number, direction: "up" | "down") => {
    setAttendanceSectionRows((prev) => {
      const next = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const handleViewAttendance = useCallback(
    async (sectionCode: string) => {
      setAttendanceViewer({
        sectionCode,
        slots: [],
        rows: [],
        loading: true,
        error: null,
      });
      const payload = await loadAttendanceForSection(sectionCode);
      setAttendanceViewer({
        sectionCode,
        slots: payload.slots,
        rows: payload.rows,
        loading: false,
        error: payload.error,
      });
    },
    [loadAttendanceForSection]
  );

  const handleCloseAttendanceViewer = useCallback(() => {
    setAttendanceViewer(null);
  }, []);

  const handleExamMarksSectionReorder = useCallback((courseFileSectionNum: ExamMarksCourseFileSection, index: number, direction: "up" | "down") => {
    setExamMarksSectionRowsByNum((prev) => {
      const rows = prev[courseFileSectionNum];
      if (!rows) return prev;
      const next = [...rows];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, [courseFileSectionNum]: next };
    });
  }, []);

  const handleViewExamMarks = useCallback(
    async (courseFileSectionNum: ExamMarksCourseFileSection, sectionCode: string) => {
      const ui = EXAM_MARKS_SECTION_UI[courseFileSectionNum];
      const baseViewer = {
        viewerShortTitle: ui.viewerShortTitle,
        sectionCode,
        rows: [] as MteStudentMarksRow[],
        loading: true,
        error: null as string | null,
        metaNote: null as string | null,
      };
      setExamMarksViewer(baseViewer);

      const payload = await loadExamMarksForSection(courseFileSectionNum, sectionCode);
      setExamMarksViewer({
        ...baseViewer,
        rows: payload.rows,
        loading: false,
        error: payload.error,
        metaNote: payload.metaNote ?? null,
      });
    },
    [loadExamMarksForSection]
  );

  const handleCloseExamMarksViewer = useCallback(() => {
    setExamMarksViewer(null);
  }, []);

  const handleResultAnalysisSectionReorder = useCallback((index: number, direction: "up" | "down") => {
    setResultAnalysisSectionRows((prev) => {
      const next = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const handleViewResultAnalysis = useCallback(
    async (sectionCode: string) => {
      const baseViewer: ResultAnalysisViewerState = {
        sectionCode,
        loading: true,
        error: null,
        row: null,
      };
      setResultAnalysisViewer(baseViewer);

      const cached = resultAnalysisCacheBySection[sectionCode];
      if (cached && cached.row && !cached.error) {
        setResultAnalysisViewer({
          ...baseViewer,
          loading: false,
          error: cached.error,
          row: cached.row,
        });
        return;
      }

      const studentPayload = await loadStudentListForSection(sectionCode);
      if (studentPayload.error) {
        setResultAnalysisViewer({
          ...baseViewer,
          loading: false,
          error: studentPayload.error,
          row: null,
        });
        return;
      }

      const examPayload = await loadExamMarksForSection(21, sectionCode);
      if (examPayload.error) {
        setResultAnalysisViewer({
          ...baseViewer,
          loading: false,
          error: examPayload.error,
          row: null,
        });
        return;
      }

      const allowed = studentNosFromSectionListRows(studentPayload.rows);
      let filtered = filterMteRowsByStudentNos(examPayload.rows, allowed);
      if (filtered.length === 0 && allowed.size > 0 && examPayload.rows.length > 0) filtered = examPayload.rows;
      const row = buildResultAnalysis(sectionCode, filtered);
      setResultAnalysisCacheBySection((prev) => ({ ...prev, [sectionCode]: { row, error: null } }));
      setResultAnalysisViewer({
        ...baseViewer,
        loading: false,
        row,
      });
    },
    [loadExamMarksForSection, loadStudentListForSection, resultAnalysisCacheBySection]
  );

  const handleCloseResultAnalysisViewer = useCallback(() => {
    setResultAnalysisViewer(null);
  }, []);

  const renderFetchedOrDataSection = (sectionNum: number) => {
    const state = sectionData[sectionNum];
    const isFile = FETCHED_SECTIONS.has(sectionNum);
    const desc = isFile
      ? "File fetched. Please click on the view button to verify the file."
      : "Data fetched and document is generated. Please click on the view button to verify the document.";
    return (
      <>
        <p className="mb-3 text-sm text-gray-600">{desc}</p>
        {state?.loading && <p className="text-sm text-gray-500">Loading…</p>}
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state && !state.loading && !state.error && state.data !== null && (
          <div className="rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            {isFile
              ? "File received. Please click on the view button to verify the file."
              : "Data received and document is generated. Please click on the view button to verify the document."}
          </div>
        )}
        {(!headerAcademicYear || !headerAcademicSession) && <p className="text-sm text-amber-700">Select academic year and session in the header to load.</p>}
      </>
    );
  };

  const renderUploadSection = (sectionNum: number) => (
    <PdfUploadSection
      sectionNum={sectionNum}
      files={uploadedFilesBySection[sectionNum] ?? []}
      onFilesChange={handleUploadedFilesChange}
      onViewPdf={handleViewPdf}
    />
  );

  const section25FeedbackRows = useMemo(() => {
    const feedbackRows = extractCourseExitFeedbackRows(sectionData[25]?.data);
    return buildCourseExitFeedbackUiRows(courseOutcomeRows, feedbackRows);
  }, [courseOutcomeRows, sectionData]);
  const reloadSection1Data = useCallback(async () => {
    if (!headerAcademicYear || !headerAcademicSession || !selectedProgramCode || !selectedCourseCode) return;
    setSectionData((prev) => ({ ...prev, 1: { ...prev[1], loading: true, error: null } }));
    try {
      const uniRes = await callApiViaProxy<unknown>(UNIVERSITY_VISION_MISSION_URL, undefined, undefined, "POST");
      if (!uniRes.success) throw new Error(uniRes.error || "Failed to load Vision & Mission");
      const deptRes = await callApiViaProxy<unknown>(
        DEPARTMENT_VISION_MISSION_URL,
        { programCode: selectedProgramCode, acadYear: headerAcademicYear },
        undefined,
        "POST"
      );
      if (!deptRes.success) throw new Error(deptRes.error || "Failed to load department vision & mission");
      setSectionData((prev) => ({
        ...prev,
        1: {
          loading: false,
          error: null,
          data: { university: uniRes.data, department: deptRes.data },
        },
      }));
    } catch (err) {
      setSectionData((prev) => ({
        ...prev,
        1: {
          loading: false,
          error: (err as Error)?.message || "Failed to load Vision & Mission",
          data: null,
        },
      }));
    }
  }, [headerAcademicSession, headerAcademicYear, selectedCourseCode, selectedProgramCode]);
  const reloadSection25Data = useCallback(async () => {
    if (!headerAcademicYear || !headerAcademicSession || !selectedProgramCode || !selectedCourseCode) return;
    const endpoint = buildCourseExitFeedbackGetUrl({
      acadYear: headerAcademicYear,
      acadSession: headerAcademicSession,
      courseId: selectedCourseCode,
      programCode: selectedProgramCode,
    });
    setSectionData((prev) => ({ ...prev, 25: { ...prev[25], loading: true, error: null } }));
    const res = await callApiViaProxy<unknown>(endpoint, undefined, undefined, "GET");
    setSectionData((prev) => ({
      ...prev,
      25: {
        loading: false,
        error: res.success ? null : res.error || "Failed to load Course exit survey",
        data: res.success ? res.data : null,
      },
    }));
  }, [headerAcademicSession, headerAcademicYear, selectedCourseCode, selectedProgramCode]);
  const reloadSection27Data = useCallback(async () => {
    if (!headerAcademicYear || !headerAcademicSession || !selectedProgramCode || !selectedCourseId) return;
    setSectionData((prev) => ({ ...prev, 27: { ...prev[27], loading: true, error: null } }));
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
    setSectionData((prev) => ({
      ...prev,
      27: {
        loading: false,
        error: res.success ? null : res.error || "Failed to load Attainment summary",
        data: res.success ? res.data : null,
      },
    }));
  }, [headerAcademicSession, headerAcademicYear, selectedCourseId, selectedProgramCode]);
  const handleOpenSection1VisionMissionViewer = useCallback(() => {
    const s = sectionData[1];
    if (s?.error || s?.data == null) {
      void reloadSection1Data();
    }
    setSection1VisionMissionViewerOpen(true);
  }, [reloadSection1Data, sectionData]);
  const handleCloseSection1VisionMissionViewer = useCallback(() => {
    setSection1VisionMissionViewerOpen(false);
  }, []);
  const handleOpenSection25FeedbackViewer = useCallback(() => {
    const s = sectionData[25];
    if (s?.error || s?.data == null) {
      void reloadSection25Data();
    }
    setSection25FeedbackViewerOpen(true);
  }, [reloadSection25Data, sectionData]);
  const handleCloseSection25FeedbackViewer = useCallback(() => {
    setSection25FeedbackViewerOpen(false);
  }, []);

  const section27AttainmentResult = useMemo(() => {
    const raw = sectionData[27]?.data;
    if (raw == null) return null;
    const b64 = extractBase64FromCOPOApiResponse(raw);
    if (b64) {
      try {
        return base64Utf8ToJson<{ calculatedData?: Record<string, unknown>; message?: string }>(b64);
      } catch {
        return null;
      }
    }
    if (typeof raw === "object" && raw !== null && "calculatedData" in (raw as object)) {
      return raw as { calculatedData?: Record<string, unknown>; message?: string };
    }
    return null;
  }, [sectionData]);
  const section28Metrics = useMemo(() => {
    const resultSectionCodes = resultAnalysisSectionRows.map((r) => r.sectionCode).filter(Boolean);
    let totalStudents = 0;
    let passCount = 0;
    let failCount = 0;
    let detainedCount = 0;
    let weightedGpaSum = 0;
    let weightedGpaCount = 0;
    const gradePoints: Record<string, number> = { "A+": 10, A: 9, B: 8, C: 7, D: 6, E: 5, F: 0, I: 0 };

    // Total students + pass/fail and grade-based GPA are strictly from result analysis.
    for (const code of resultSectionCodes) {
      const ra = resultAnalysisCacheBySection[code]?.row;
      if (ra) {
        totalStudents += ra.totalStudents;
        passCount += ra.passCount;
        failCount += ra.failCount;
        const grades = ra.grades ?? {};
        for (const [grade, count] of Object.entries(grades)) {
          const c = Number(count) || 0;
          const gp = gradePoints[String(grade).toUpperCase()] ?? 0;
          weightedGpaSum += gp * c;
          weightedGpaCount += c;
        }
      }
      const attendanceRows = attendanceCacheBySection[code]?.rows ?? [];
      detainedCount += attendanceRows.filter((r) => String(r.registrationStatus || "").trim().toLowerCase() === "detained").length;
    }

    const denominator = passCount + failCount;
    const passPercentage = denominator > 0 ? (passCount / denominator) * 100 : null;
    const averageGpa = weightedGpaCount > 0 ? weightedGpaSum / weightedGpaCount : null;

    const curriculumAvgRaw = extractNumericFromUnknown(
      section27AttainmentResult?.calculatedData ?? section27AttainmentResult,
      (key) => {
        const k = key.toLowerCase();
        return (k.includes("course") || k.includes("co")) && (k.includes("curriculum") || k.includes("attain")) && (k.includes("avg") || k.includes("average"));
      }
    );
    const curriculumFeedback = curriculumAvgRaw == null ? "" : `${curriculumAvgRaw.toFixed(2)}%`;

    return { totalStudents, passCount, failCount, detainedCount, passPercentage, averageGpa, curriculumFeedback };
  }, [attendanceCacheBySection, resultAnalysisSectionRows, resultAnalysisCacheBySection, section27AttainmentResult]);

  const handleOpenSection27AttainmentViewer = useCallback(() => {
    const s = sectionData[27];
    if (s?.error || s?.data == null) {
      void reloadSection27Data();
    }
    setSection27AttainmentViewerOpen(true);
  }, [reloadSection27Data, sectionData]);
  const handleCloseSection27AttainmentViewer = useCallback(() => {
    setSection27AttainmentViewerOpen(false);
  }, []);
  const handleSection28PointChange = useCallback((index: number, value: string) => {
    setSection28ImprovementPoints((prev) => prev.map((p, i) => (i === index ? value : p)));
  }, []);
  const handleSection28AddPoint = useCallback(() => {
    setSection28ImprovementPoints((prev) => [...prev, ""]);
  }, []);
  const handleSection28RemovePoint = useCallback((index: number) => {
    setSection28ImprovementPoints((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);
  const handleSection28StudentFeedbackChange = useCallback((value: string) => setSection28StudentFeedback(value), []);
  const handleSection28SyllabusCoverageChange = useCallback((value: string) => setSection28SyllabusCoverage(value), []);
  const handleSection28ContentDeliveryChange = useCallback((value: string) => setSection28ContentDelivery(value), []);
  const handleSection28AnyOtherFeedbackChange = useCallback((value: string) => setSection28AnyOtherFeedback(value), []);

  const handleDownloadCourseFilePdf = useCallback(async () => {
    if (isDownloadingPdf) return;
    const missingUploadSections = Array.from(UPLOADED_SECTIONS)
      .filter((sectionNum) => (uploadedFilesBySection[sectionNum] ?? []).length === 0)
      .map((sectionNum) => `${sectionNum}. ${SECTION_LABELS[sectionNum] ?? `Section ${sectionNum}`}`);
    if (missingUploadSections.length > 0) {
      setMissingUploadSectionsDialog(missingUploadSections);
      return;
    }
    setIsDownloadingPdf(true);
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    try {
      const [{ toCanvas }, { PDFDocument, StandardFonts, rgb }] = await Promise.all([
        import("html-to-image"),
        import("pdf-lib"),
      ]);
      const pdf = await PDFDocument.create();
      const pageWidth = 595.28; // A4 width in points
      const pageHeight = 841.89; // A4 height in points
      const margin = 24;
      const usableWidth = pageWidth - margin * 2;
      /** Vertical space for styled title/header band */
      const TITLE_BAND_PT = 38;
      const bodyUsableHeight = pageHeight - margin * 2 - TITLE_BAND_PT;
      let hasAnyPage = false;
      const failedCaptures: string[] = [];
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const LOADING_MARKERS = ["loading", "generating", "fetching", "please wait"];
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

      const dataUrlToBytes = async (dataUrl: string): Promise<Uint8Array> => {
        const res = await fetch(dataUrl);
        return new Uint8Array(await res.arrayBuffer());
      };

      const trimCanvasWhitespace = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return canvas;
        const { width, height } = canvas;
        const imgData = ctx.getImageData(0, 0, width, height).data;
        let top = 0;
        let bottom = height - 1;
        let left = 0;
        let right = width - 1;

        const rowHasInk = (y: number): boolean => {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = imgData[idx] ?? 255;
            const g = imgData[idx + 1] ?? 255;
            const b = imgData[idx + 2] ?? 255;
            const a = imgData[idx + 3] ?? 255;
            if (a > 10 && (r < 248 || g < 248 || b < 248)) return true;
          }
          return false;
        };

        const colHasInk = (x: number): boolean => {
          for (let y = 0; y < height; y++) {
            const idx = (y * width + x) * 4;
            const r = imgData[idx] ?? 255;
            const g = imgData[idx + 1] ?? 255;
            const b = imgData[idx + 2] ?? 255;
            const a = imgData[idx + 3] ?? 255;
            if (a > 10 && (r < 248 || g < 248 || b < 248)) return true;
          }
          return false;
        };

        while (top < bottom && !rowHasInk(top)) top++;
        while (bottom > top && !rowHasInk(bottom)) bottom--;
        while (left < right && !colHasInk(left)) left++;
        while (right > left && !colHasInk(right)) right--;

        const trimmedWidth = Math.max(1, right - left + 1);
        const trimmedHeight = Math.max(1, bottom - top + 1);
        const out = document.createElement("canvas");
        out.width = trimmedWidth;
        out.height = trimmedHeight;
        const outCtx = out.getContext("2d");
        if (!outCtx) return canvas;
        outCtx.fillStyle = "#ffffff";
        outCtx.fillRect(0, 0, trimmedWidth, trimmedHeight);
        outCtx.drawImage(canvas, left, top, trimmedWidth, trimmedHeight, 0, 0, trimmedWidth, trimmedHeight);
        return out;
      };

      const appendCanvasToPdf = async (canvas: HTMLCanvasElement, title: string) => {
        const cleanedCanvas = trimCanvasWhitespace(canvas);
        const cw = cleanedCanvas.width;
        const ch = cleanedCanvas.height;
        const scaleW = usableWidth / cw;
        const fitsOnePageAtWidth = ch * scaleW <= bodyUsableHeight + 0.5;
        const pageTitle = (idx: number) => (idx > 0 ? `${title} (cont. ${idx + 1})` : title);

        const drawOneSlice = async (sliceCanvas: HTMLCanvasElement, slicePageIndex: number, scale: number) => {
          const pngBytes = await dataUrlToBytes(sliceCanvas.toDataURL("image/png"));
          const embedded = await pdf.embedPng(pngBytes);
          const drawW = sliceCanvas.width * scale;
          const drawH = sliceCanvas.height * scale;
          const x = margin + (usableWidth - drawW) / 2;

          const page = pdf.addPage([pageWidth, pageHeight]);
          page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(1, 1, 1) });
          const headerY = pageHeight - margin - TITLE_BAND_PT;
          page.drawRectangle({
            x: margin,
            y: headerY,
            width: usableWidth,
            height: TITLE_BAND_PT,
            color: rgb(0.96, 0.97, 0.99),
          });
          page.drawRectangle({
            x: margin,
            y: headerY,
            width: usableWidth,
            height: 1.2,
            color: rgb(0.78, 0.82, 0.9),
          });
          const heading = pageTitle(slicePageIndex);
          const headingSize = 13;
          const headingWidth = fontBold.widthOfTextAtSize(heading, headingSize);
          page.drawText(heading, {
            x: margin + Math.max(0, (usableWidth - headingWidth) / 2),
            y: headerY + (TITLE_BAND_PT - headingSize) / 2 + 2,
            size: headingSize,
            font: fontBold,
            color: rgb(0.12, 0.16, 0.26),
          });
          const yImg = Math.max(margin, margin + bodyUsableHeight - drawH);
          page.drawImage(embedded, {
            x,
            y: yImg,
            width: drawW,
            height: drawH,
          });
          hasAnyPage = true;
        };

        if (fitsOnePageAtWidth) {
          const scale = Math.min(scaleW, bodyUsableHeight / ch);
          await drawOneSlice(cleanedCanvas, 0, scale);
          return;
        }

        const findSmartSliceEnd = (startY: number, idealHeight: number): number => {
          const idealEnd = Math.min(cleanedCanvas.height, startY + idealHeight);
          const minEnd = Math.max(startY + Math.floor(idealHeight * 0.7), startY + 120);
          const ctx = cleanedCanvas.getContext("2d");
          if (!ctx) return idealEnd;
          for (let y = idealEnd; y >= minEnd; y--) {
            const row = ctx.getImageData(0, y - 1, cleanedCanvas.width, 1).data;
            let inkPixels = 0;
            for (let i = 0; i < row.length; i += 4) {
              const r = row[i] ?? 255;
              const g = row[i + 1] ?? 255;
              const b = row[i + 2] ?? 255;
              const a = row[i + 3] ?? 255;
              if (a > 10 && (r < 245 || g < 245 || b < 245)) inkPixels += 1;
            }
            // Prefer cutting at near-empty rows so we don't split text/table lines.
            if (inkPixels <= Math.max(2, Math.floor(cleanedCanvas.width * 0.005))) return y;
          }
          return idealEnd;
        };

        const scale = scaleW;
        const maxSlicePxHeight = Math.max(1, Math.floor(bodyUsableHeight / scale));
        let y = 0;
        let pageIndex = 0;
        while (y < cleanedCanvas.height) {
          const remaining = cleanedCanvas.height - y;
          const sliceHeight = remaining <= maxSlicePxHeight ? remaining : findSmartSliceEnd(y, maxSlicePxHeight) - y;
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = cleanedCanvas.width;
          sliceCanvas.height = sliceHeight;
          const ctx = sliceCanvas.getContext("2d");
          if (!ctx) throw new Error("Unable to create canvas context");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx.drawImage(cleanedCanvas, 0, y, cleanedCanvas.width, sliceHeight, 0, 0, cleanedCanvas.width, sliceHeight);

          await drawOneSlice(sliceCanvas, pageIndex, scale);
          y += sliceHeight;
          pageIndex += 1;
        }
      };

      const captureScrollableElementCanvases = async (el: HTMLElement): Promise<HTMLCanvasElement[]> => {
        const canvases: HTMLCanvasElement[] = [];
        const totalHeight = el.scrollHeight;
        const viewportHeight = Math.max(1, el.clientHeight);
        const isScrollable = totalHeight > viewportHeight + 8;
        const originalScrollTop = el.scrollTop;
        const originalOverflow = el.style.overflow;
        const originalHeight = el.style.height;
        const originalMaxHeight = el.style.maxHeight;

        try {
          if (!isScrollable) {
            const single = await toCanvas(el, {
              pixelRatio: 2,
              backgroundColor: "#ffffff",
              cacheBust: true,
              canvasWidth: Math.max(el.scrollWidth, el.clientWidth),
              canvasHeight: Math.max(el.scrollHeight, el.clientHeight),
            });
            canvases.push(single);
            return canvases;
          }

          // Prefer single full-height capture to ensure bottom summaries/averages are included.
          try {
            el.scrollTop = 0;
            el.style.overflow = "visible";
            el.style.maxHeight = "none";
            el.style.height = `${totalHeight}px`;
            await sleep(120);
            const full = await toCanvas(el, {
              pixelRatio: 2,
              backgroundColor: "#ffffff",
              cacheBust: true,
              canvasWidth: Math.max(el.scrollWidth, el.clientWidth),
              canvasHeight: Math.max(totalHeight, viewportHeight),
            });
            canvases.push(full);
            return canvases;
          } catch {
            // Fallback to segmented capture if full-height capture is too heavy.
            let offset = 0;
            let guard = 0;
            while (offset < totalHeight - 2 && guard < 200) {
              el.scrollTop = offset;
              // Wait a tick for browser to paint after scroll.
              await sleep(160);
              const shot = await toCanvas(el, {
                pixelRatio: 2,
                backgroundColor: "#ffffff",
                cacheBust: true,
                canvasWidth: Math.max(el.scrollWidth, el.clientWidth),
                canvasHeight: viewportHeight,
              });
              canvases.push(shot);
              offset += viewportHeight;
              guard += 1;
            }
            return canvases;
          }
        } finally {
          el.scrollTop = originalScrollTop;
          el.style.overflow = originalOverflow;
          el.style.height = originalHeight;
          el.style.maxHeight = originalMaxHeight;
        }
      };

      const waitForDialogReady = async (dialogBody: HTMLElement, timeoutMs: number = 15000) => {
        const startedAt = Date.now();
        let stableCount = 0;
        let previousHeight = -1;
        let previousTextLength = -1;

        while (Date.now() - startedAt < timeoutMs) {
          await sleep(180);
          const text = (dialogBody.textContent || "").trim().toLowerCase();
          const hasLoadingText = LOADING_MARKERS.some((marker) => text.includes(marker));
          const currentHeight = dialogBody.scrollHeight;
          const currentTextLength = text.length;
          const looksStable = currentHeight === previousHeight && currentTextLength === previousTextLength;
          stableCount = looksStable ? stableCount + 1 : 0;
          previousHeight = currentHeight;
          previousTextLength = currentTextLength;

          // Wait until loading text is gone and DOM size/text has stabilized for a few cycles.
          if (!hasLoadingText && stableCount >= 3) return;
        }
      };

      // Capture each "eye" detail view by opening it, capturing dialog content, then closing it.
      for (const sectionNum of COURSE_FILE_SECTION_ORDER) {
        const sectionNode = sectionRefs.current[sectionNum];
        if (!sectionNode) continue;
        // Uploaded-document sections are merged below as real PDFs.
        // Skipping eye-view capture here avoids blank iframe snapshot pages
        // appearing before actual uploaded PDF pages.
        if (UPLOADED_SECTIONS.has(sectionNum)) {
          const uploadedFiles = uploadedFilesBySection[sectionNum] ?? [];
          for (const uploaded of uploadedFiles) {
            const label = uploaded.name.replace(/\.pdf$/i, "").trim() || `Section ${sectionNum} uploaded document`;
            try {
              const bytes = new Uint8Array(await uploaded.file.arrayBuffer());
              const srcPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
              const indices = srcPdf.getPageIndices();
              const copied = await pdf.copyPages(srcPdf, indices);
              copied.forEach((p, idx) => {
                const page = pdf.addPage(p);
                page.drawText(`${label}${indices.length > 1 ? ` (page ${idx + 1})` : ""}`, {
                  x: margin,
                  y: page.getHeight() - margin + 4,
                  size: 10,
                  font,
                  color: rgb(0.25, 0.25, 0.25),
                });
                hasAnyPage = true;
              });
            } catch (err) {
              console.error(`Failed to merge uploaded PDF (${label}):`, err);
              failedCaptures.push(label);
            }
          }
          continue;
        }
        const eyeButtons = Array.from(sectionNode.querySelectorAll("button[title='View']")).filter(
          (btn) => !(btn as HTMLButtonElement).disabled
        ) as HTMLButtonElement[];
        if (sectionNum === 28) {
          try {
            const block = sectionNode.querySelector(".rounded-lg.border.border-gray-200.bg-white") as HTMLElement | null;
            const target = block ?? sectionNode;
            await sleep(80);
            const canvases = await captureScrollableElementCanvases(target);
            for (let cIdx = 0; cIdx < canvases.length; cIdx++) {
              await appendCanvasToPdf(
                canvases[cIdx]!,
                canvases.length > 1 ? `28. ${SECTION_LABELS[28]} (part ${cIdx + 1})` : `28. ${SECTION_LABELS[28]}`
              );
            }
          } catch (err) {
            console.error("Failed to capture Section 28 block:", err);
            failedCaptures.push("Section 28");
          }
          continue;
        }
        for (let i = 0; i < eyeButtons.length; i++) {
          const btn = eyeButtons[i];
          const listLabel =
            (btn.closest("li")?.querySelector("span") as HTMLSpanElement | null)?.textContent?.trim() ||
            SECTION_LABELS[sectionNum] ||
            `Section ${sectionNum}`;
          const captureLabel = listLabel;
          try {
            btn.click();
            let dialog: HTMLElement | null = null;
            for (let poll = 0; poll < 20; poll++) {
              await sleep(150);
              dialog = document.querySelector("[role='dialog'][aria-modal='true']") as HTMLElement | null;
              if (dialog) break;
            }
            if (!dialog) {
              failedCaptures.push(captureLabel);
              continue;
            }

            const dialogBody = (dialog.querySelector(".flex-1.overflow-auto") as HTMLElement | null) || dialog;
            await waitForDialogReady(dialogBody);
            const dialogTitle =
              (dialog.firstElementChild?.querySelector("span") as HTMLSpanElement | null)?.textContent?.trim() || captureLabel;
            const canvases = await captureScrollableElementCanvases(dialogBody);
            for (let cIdx = 0; cIdx < canvases.length; cIdx++) {
              await appendCanvasToPdf(
                canvases[cIdx]!,
                canvases.length > 1 ? `${dialogTitle} (part ${cIdx + 1})` : dialogTitle
              );
            }

            const closeButton = dialog.querySelector("button[aria-label='Close']") as HTMLButtonElement | null;
            closeButton?.click();
            await sleep(120);
          } catch (err) {
            console.error(`Failed to capture ${captureLabel}:`, err);
            failedCaptures.push(captureLabel);
            const openDialog = document.querySelector("[role='dialog'][aria-modal='true']") as HTMLElement | null;
            const closeButton = openDialog?.querySelector("button[aria-label='Close']") as HTMLButtonElement | null;
            closeButton?.click();
            await sleep(120);
          }
        }

      }

      if (!hasAnyPage) {
        throw new Error("No eye-view sections could be captured.");
      }

      const fileName = `course_file_${(selectedCourseCode || selectedCourseId || "report").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      const outBytes = await pdf.save();
      const pdfBytes = new Uint8Array(outBytes.length);
      pdfBytes.set(outBytes);
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const outUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = outUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(outUrl);
      if (failedCaptures.length > 0) {
        alert(`PDF downloaded, but some detail views failed: ${failedCaptures.join(", ")}`);
      }
    } catch (err) {
      console.error("Failed to generate course file PDF:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      setIsDownloadingPdf(false);
    }
  }, [isDownloadingPdf, selectedCourseCode, selectedCourseId, uploadedFilesBySection]);

  const renderSection = (num: number) => {
    const title = SECTION_LABELS[num] ?? `Document ${num}`;
    const isLast = num === 28;
    return (
      <div
        key={num}
        ref={(el) => {
          sectionRefs.current[num] = el;
        }}
        className={`border-b border-gray-200 pb-8 ${isLast ? "" : "mb-8"}`}
      >
        <h3 className="mb-3 text-lg font-medium text-gray-800">
          {num}. {title}
        </h3>
        {num === 1 ? (
          <Section1VisionMission
            loading={Boolean(sectionData[1]?.loading)}
            error={sectionData[1]?.error ?? null}
            hasData={Boolean(sectionData[1]?.data)}
            onView={handleOpenSection1VisionMissionViewer}
          />
        ) : num === 14 ? (
          <p className="text-sm text-gray-500">Not required (same as 29, 30).</p>
        ) : num === 3 ? (
          <FacultyTimetableList
            facultyRows={facultyList}
            sectionFacultyRows={sectionWiseFacultyList}
            onReorder={handleFacultyTimetableReorder}
            onView={handleViewFacultyTimetable}
          />
        ) : num === 4 ? (
          <Section4LocalFileSection
            loading={section4FileLoading}
            error={section4FileError}
            generatedFileName={section4GeneratedFileName}
            exists={section4FileExists}
          />
        ) : num === 5 ? (
          <StudentSectionList
            sectionRows={studentSectionRows}
            onReorder={handleStudentSectionReorder}
            onView={handleViewStudentList}
          />
        ) : num === 18 ? (
          <StudentSectionList
            sectionRows={attendanceSectionRows}
            onReorder={handleAttendanceSectionReorder}
            onView={handleViewAttendance}
            description="Attendance report per section. Open a section to view date/time-wise Present/Absent matrix."
            rowTitlePrefix="Attendance report — Section"
          />
        ) : isExamMarksCourseFileSection(num) ? (
          <StudentSectionList
            sectionRows={examMarksSectionRowsByNum[num] ?? []}
            onReorder={(i, d) => handleExamMarksSectionReorder(num, i, d)}
            onView={(code) => handleViewExamMarks(num, code)}
            description={EXAM_MARKS_SECTION_UI[num].description}
            rowTitlePrefix={EXAM_MARKS_SECTION_UI[num].rowTitlePrefix}
          />
        ) : num === 22 ? (
          <StudentSectionList
            sectionRows={resultAnalysisSectionRows}
            onReorder={handleResultAnalysisSectionReorder}
            onView={handleViewResultAnalysis}
            description="End-semester result analysis per section. Click the eye icon to open section details."
            rowTitlePrefix="Result analysis — Section"
          />
        ) : num === 25 ? (
          <Section25CourseFeedback
            loading={Boolean(sectionData[25]?.loading)}
            error={sectionData[25]?.error ?? null}
            hasRows={section25FeedbackRows.length > 0}
            onView={handleOpenSection25FeedbackViewer}
          />
        ) : num === 27 ? (
          <Section27CourseAttainmentSummary
            loading={Boolean(sectionData[27]?.loading)}
            error={sectionData[27]?.error ?? null}
            hasData={Boolean(section27AttainmentResult)}
            onView={handleOpenSection27AttainmentViewer}
          />
        ) : num === 28 ? (
          <Section28ClosureInputs
            pdfCaptureMode={isDownloadingPdf}
            isLoadingConsolidation={section28ConsolidationLoading}
            totalStudents={section28Metrics.totalStudents}
            passCount={section28Metrics.passCount}
            failCount={section28Metrics.failCount}
            detainedCount={section28Metrics.detainedCount}
            passPercentage={section28Metrics.passPercentage}
            averageGpa={section28Metrics.averageGpa}
            studentFeedback={section28StudentFeedback}
            onChangeStudentFeedback={handleSection28StudentFeedbackChange}
            syllabusCoverage={section28SyllabusCoverage}
            onChangeSyllabusCoverage={handleSection28SyllabusCoverageChange}
            contentDelivery={section28ContentDelivery}
            onChangeContentDelivery={handleSection28ContentDeliveryChange}
            courseCurriculumFeedback={section28Metrics.curriculumFeedback}
            anyOtherFeedback={section28AnyOtherFeedback}
            onChangeAnyOtherFeedback={handleSection28AnyOtherFeedbackChange}
            points={section28ImprovementPoints}
            onChangePoint={handleSection28PointChange}
            onAddPoint={handleSection28AddPoint}
            onRemovePoint={handleSection28RemovePoint}
          />
        ) : UPLOADED_SECTIONS.has(num) ? (
          renderUploadSection(num)
        ) : (
          renderFetchedOrDataSection(num)
        )}
      </div>
    );
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

      {isSideNavOpen && <div className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden" onClick={toggleSideNav} aria-hidden />}

      <div className="flex flex-1 flex-col bg-white">
        <div className="sticky top-0 z-30 flex w-full items-center justify-between border-b p-4 shadow-sm md:hidden bg-white">
          <button type="button" onClick={toggleSideNav} className="text-gray-900">
            <Menu size={24} />
          </button>
          <h1 className="text-xl font-bold text-gray-800">Course File</h1>
          <div className="w-6" />
        </div>

        <div className="hidden md:block">
          <Header />
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <section className="mb-8">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md">
              <h2 className="mb-6 text-xl font-semibold text-gray-800">Course File</h2>
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Programme Code</label>
                  <select
                    value={selectedProgramCode}
                    onChange={(e) => {
                      setSelectedProgramCode(e.target.value);
                      setSelectedCourseCode("");
                      setSelectedSemester("");
                      setSelectedCourseId("");
                    }}
                    disabled={loadingCoordinator || !coordinatorList.length}
                    className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  >
                    <option value="">{loadingCoordinator ? "Loading..." : !coordinatorList.length ? "No coordinator data" : "Select Programme Code"}</option>
                    {programCodesList.map((program) => (
                      <option key={program} value={program}>
                        {program}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Course Code</label>
                  <select
                    value={selectedCourseCode}
                    onChange={(e) => {
                      setSelectedCourseCode(e.target.value);
                      setSelectedSemester("");
                      setSelectedCourseId("");
                    }}
                    disabled={!selectedProgramCode}
                    className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  >
                    <option value="">{!selectedProgramCode ? "Select Programme Code first" : "Select Course Code"}</option>
                    {courseCodesForProgram.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Semester</label>
                  <select
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(e.target.value)}
                    disabled={!selectedCourseCode}
                    className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  >
                    <option value="">{!selectedCourseCode ? "Select Course Code first" : "Select Semester"}</option>
                    {semesterCodesForProgramCourse.map((sem) => (
                      <option key={sem} value={sem}>
                        {sem}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectorsReady && COURSE_FILE_SECTION_ORDER.map(renderSection)}
              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  onClick={handleDownloadCourseFilePdf}
                  disabled={!selectorsReady || isDownloadingPdf}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {isDownloadingPdf ? "Generating PDF..." : "Download PDF"}
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>

      {viewerPdf && <PdfViewerDialog blobUrl={viewerPdf.url} fileName={viewerPdf.fileName} onClose={handleCloseViewer} />}
      {timetableViewer && <TimetableViewerDialog state={timetableViewer} onClose={handleCloseTimetableViewer} />}
      {studentListViewer && <StudentListViewerDialog state={studentListViewer} onClose={handleCloseStudentListViewer} />}
      {attendanceViewer && <AttendanceViewerDialog state={attendanceViewer} onClose={handleCloseAttendanceViewer} />}
      {examMarksViewer && <ExamMarksViewerDialog state={examMarksViewer} onClose={handleCloseExamMarksViewer} />}
      {resultAnalysisViewer && (
        <ResultAnalysisViewerDialog
          state={resultAnalysisViewer}
          onClose={handleCloseResultAnalysisViewer}
          courseCode={selectedCourseCode}
          courseId={selectedCourseId}
        />
      )}
      {section1VisionMissionViewerOpen && Boolean(sectionData[1]?.data) && (
        <Section1VisionMissionViewerDialog
          data={sectionData[1]?.data}
          fallbackDepartmentCode={selectedProgramCode}
          onClose={handleCloseSection1VisionMissionViewer}
        />
      )}
      {section25FeedbackViewerOpen && (
        <Section25FeedbackViewerDialog rows={section25FeedbackRows} onClose={handleCloseSection25FeedbackViewer} />
      )}
      {section27AttainmentViewerOpen && section27AttainmentResult && (
        <Section27AttainmentViewerDialog
          result={section27AttainmentResult}
          onClose={handleCloseSection27AttainmentViewer}
          programCode={selectedProgramCode}
          courseCode={selectedCourseCode}
          academicSession={headerAcademicSession || ""}
        />
      )}
      {isDownloadingPdf && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70" role="status" aria-live="polite" aria-label="Generating PDF">
          <div className="rounded-xl bg-white px-6 py-5 text-center shadow-2xl">
            <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800" />
            <p className="text-sm font-medium text-gray-900">Generating PDF...</p>
            <p className="mt-1 text-xs text-gray-600">Preparing sections in background. Please wait.</p>
          </div>
        </div>
      )}
      {missingUploadSectionsDialog && (
        <MissingUploadsDialog sections={missingUploadSectionsDialog} onClose={() => setMissingUploadSectionsDialog(null)} />
      )}
    </div>
  );
}

export default CourseFilePage;
