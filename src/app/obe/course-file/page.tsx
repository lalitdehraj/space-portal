"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import SideNav from "@/components/SideNav";
import Header from "@/components/Header";
import useSideNavState from "@/hooks/useSideNavState";
import { Menu, GripVertical, Eye, Trash2, ChevronUp, ChevronDown, X } from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "@/app/store";
import { callApiViaProxy } from "@/utils/proxyApiIntercepter";
import { URL_NOT_FOUND } from "@/constants";

type SectionState = { loading: boolean; error: string | null; data: unknown };

export type UploadedFileItem = { id: string; file: File; name: string };

const FETCH_SECTIONS: { section: number; label: string }[] = [
  { section: 1, label: "Vision & Mission" },
  { section: 3, label: "Timetable" },
  { section: 4, label: "Course handout" },
  { section: 5, label: "Student list" },
  { section: 8, label: "MTE marks" },
  { section: 15, label: "Re-sessional QP" },
  { section: 16, label: "Re-sessional marks" },
  { section: 17, label: "CWS/Internal marks" },
  { section: 18, label: "Attendance" },
  { section: 19, label: "End sem QP" },
  { section: 20, label: "End sem QP solution" },
  { section: 21, label: "End sem marks" },
  { section: 22, label: "Result analysis" },
  { section: 23, label: "Feedback (curriculum)" },
  { section: 24, label: "Feedback (teaching-learning)" },
  { section: 25, label: "Course exit survey" },
  { section: 26, label: "Minutes" },
  { section: 27, label: "Attainment summary" },
  { section: 28, label: "Closure report" },
];

function getEnvUrl(section: number): string {
  const envMap: Record<number, string> = {
    1: process.env.NEXT_PUBLIC_COURSE_FILE_VISION_MISSION || URL_NOT_FOUND,
    3: process.env.NEXT_PUBLIC_COURSE_FILE_TIMETABLE || URL_NOT_FOUND,
    4: process.env.NEXT_PUBLIC_COURSE_FILE_COURSE_HANDOUT || URL_NOT_FOUND,
    5: process.env.NEXT_PUBLIC_COURSE_FILE_STUDENT_LIST || URL_NOT_FOUND,
    8: process.env.NEXT_PUBLIC_COURSE_FILE_MTE_MARKS || URL_NOT_FOUND,
    15: process.env.NEXT_PUBLIC_COURSE_FILE_RESESSIONAL_QP || URL_NOT_FOUND,
    16: process.env.NEXT_PUBLIC_COURSE_FILE_RESESSIONAL_MARKS || URL_NOT_FOUND,
    17: process.env.NEXT_PUBLIC_COURSE_FILE_CWS_MARKS || URL_NOT_FOUND,
    18: process.env.NEXT_PUBLIC_COURSE_FILE_ATTENDANCE || URL_NOT_FOUND,
    19: process.env.NEXT_PUBLIC_COURSE_FILE_END_SEM_QP || URL_NOT_FOUND,
    20: process.env.NEXT_PUBLIC_COURSE_FILE_END_SEM_QP_SOLUTION || URL_NOT_FOUND,
    21: process.env.NEXT_PUBLIC_COURSE_FILE_END_SEM_MARKS || URL_NOT_FOUND,
    22: process.env.NEXT_PUBLIC_COURSE_FILE_RESULT_ANALYSIS || URL_NOT_FOUND,
    23: process.env.NEXT_PUBLIC_COURSE_FILE_FEEDBACK_CURRICULUM || URL_NOT_FOUND,
    24: process.env.NEXT_PUBLIC_COURSE_FILE_FEEDBACK_TL || URL_NOT_FOUND,
    25: process.env.NEXT_PUBLIC_COURSE_FILE_EXIT_SURVEY || URL_NOT_FOUND,
    26: process.env.NEXT_PUBLIC_COURSE_FILE_MINUTES || URL_NOT_FOUND,
    27: process.env.NEXT_PUBLIC_COURSE_FILE_ATTAINMENT_SUMMARY || URL_NOT_FOUND,
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

const FETCHED_SECTIONS = new Set([1, 4, 15, 19, 20, 26, 28]);
const DATA_FETCHED_SECTIONS = new Set([3, 5, 8, 16, 17, 18, 21, 22, 23, 24, 25, 27]);
const UPLOADED_SECTIONS = new Set([2, 6, 7, 9, 10, 11, 12, 13]);

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
    const pdfs = Array.from(newFiles).filter((f) => f.type === "application/pdf");
    if (pdfs.length === 0) {
      alert("Please select PDF files only.");
      return;
    }
    const items: UploadedFileItem[] = pdfs.map((f) => ({ id: generateFileId(), file: f, name: f.name }));
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
                className="shrink-0 rounded p-1.5 text-gray-600 hover:bg-gray-100 hover:text-orange-600"
                title="View"
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
  const { isSideNavOpen, toggleSideNav } = useSideNavState();

  // const headerAcademicYear = useSelector((state: RootState) => state.dataState.selectedAcademicYear);
  const headerAcademicYear = "2025";
  // const headerAcademicSession = useSelector((state: RootState) => state.dataState.selectedAcademicSession);
  const headerAcademicSession = "JAN-MAY 2025";

  const [sectionData, setSectionData] = useState<Record<number, SectionState>>({});
  const [uploadedFilesBySection, setUploadedFilesBySection] = useState<Record<number, UploadedFileItem[]>>({});
  const [viewerPdf, setViewerPdf] = useState<{ url: string; fileName: string } | null>(null);

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
    if (!headerAcademicYear || !headerAcademicSession) {
      setSectionData({});
      return;
    }
    const body = { acadYear: headerAcademicYear, acadSess: headerAcademicSession };
    FETCH_SECTIONS.forEach(({ section, label }) => {
      setSectionData((prev) => ({ ...prev, [section]: { ...prev[section], loading: true, error: null } }));
      const url = getEnvUrl(section);
      callApiViaProxy<unknown>(url, body)
        .then((res) => {
          setSectionData((prev) => ({
            ...prev,
            [section]: {
              loading: false,
              error: res.success ? null : res.error || `Failed to load ${label}`,
              data: res.success ? res.data : null,
            },
          }));
        })
        .catch((err) => {
          setSectionData((prev) => ({
            ...prev,
            [section]: {
              loading: false,
              error: (err as Error)?.message || `Failed to load ${label}`,
              data: null,
            },
          }));
        });
    });
  }, [headerAcademicYear, headerAcademicSession]);

  const [facultyList, setFacultyList] = useState<any[]>([
    {
      facultyCode: "MUJ0928",
      facultyName: "John Doe",
      facultyEmail: "john.doe@example.com",
    },
  ]);
  const [facultyListLoading, setFacultyListLoading] = useState(false);
  const [facultyListError, setFacultyListError] = useState<string | null>(null);
  const selectedCourseId = "BTCCEVI21003";

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

  const renderSection = (num: number) => {
    const title = SECTION_LABELS[num] ?? `Document ${num}`;
    const isLast = num === 28;
    return (
      <div key={num} className={`border-b border-gray-200 pb-8 ${isLast ? "" : "mb-8"}`}>
        <h3 className="mb-3 text-lg font-medium text-gray-800">
          {num}. {title}
        </h3>
        {num === 14 ? (
          <p className="text-sm text-gray-500">Not required (same as 29, 30).</p>
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
              <p className="mb-6 text-sm text-gray-600">
                Select academic year and session from the header. Each section can be verified before generating the final PDF.
              </p>

              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28].map(renderSection)}
            </div>
          </section>
        </main>
      </div>

      {viewerPdf && <PdfViewerDialog blobUrl={viewerPdf.url} fileName={viewerPdf.fileName} onClose={handleCloseViewer} />}
    </div>
  );
}

export default CourseFilePage;
