"use client";

import React from "react";

type POItem = { id: string; description?: string; Type?: string };

export type CoAttainmentResultViewProps = {
  result: { calculatedData?: Record<string, unknown>; message?: string } | null;
  programCode: string;
  courseCode: string;
  academicSession: string;
  semester: string;
};

function coKeysFromCalculatedData(cd: Record<string, unknown>): string[] {
  const keys = new Set<string>();
  const add = (o: unknown) => {
    if (o && typeof o === "object") Object.keys(o as object).forEach((k) => keys.add(k));
  };
  add(cd.internalAttainment);
  add(cd.externalAttainment);
  add(cd.exactAttainment);
  add(cd.coAttainmentLevel);
  return Array.from(keys).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function CoAttainmentResultView({ result, programCode, courseCode, academicSession, semester }: CoAttainmentResultViewProps) {
  const calculatedData = result?.calculatedData;
  if (!calculatedData) return <p className="text-sm text-gray-600">No calculation data.</p>;

  const allStudentNumbers = new Set<string>();
  const studentData = calculatedData.studentData as Record<string, unknown> | undefined;
  if (studentData) {
    Object.values(studentData).forEach((students: unknown) => {
      if (Array.isArray(students)) {
        students.forEach((student: { studentNo?: string }) => {
          if (student.studentNo) allStudentNumbers.add(student.studentNo);
        });
      }
    });
  }
  const totalStudents = allStudentNumbers.size;

  const toPercentage = (value: number | undefined, showDash: boolean = false): string => {
    if (value === undefined || value === null) return showDash ? "-" : "0.00";
    return (value * 100).toFixed(2);
  };

  const formatAttainmentLevel = (value: number | undefined): string => {
    if (value === undefined || value === null || value === 0) return "0";
    return Math.round(value).toString();
  };

  const internalAttainment = calculatedData.internalAttainment as Record<string, number> | undefined;
  const externalAttainment = calculatedData.externalAttainment as Record<string, number> | undefined;
  const exactAttainment = calculatedData.exactAttainment as Record<string, number> | undefined;
  const coAttainmentLevel = calculatedData.coAttainmentLevel as Record<string, number> | undefined;

  const hasCalculatedValues = (co: string): boolean =>
    internalAttainment?.[co] !== undefined ||
    externalAttainment?.[co] !== undefined ||
    exactAttainment?.[co] !== undefined;

  const sortedCOs = coKeysFromCalculatedData(calculatedData);

  const poListFromApi = (calculatedData.POs || []) as POItem[];
  const poSumPerPO = calculatedData.poSumPerPO as Record<string, number> | undefined;
  const mappedPOIds = Object.keys(poSumPerPO || {});
  const allPOIdsSorted = (poListFromApi.length > 0 ? poListFromApi.map((p) => p.id) : mappedPOIds).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  const poToCoMap = calculatedData.poToCoMap as Record<string, Record<string, number | "--">> | undefined;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-0">
        <div className="flex items-center justify-between py-2 first:pt-0">
          <span className="text-sm font-medium text-gray-700">Program code:</span>
          <span className="text-lg font-bold text-gray-900">{programCode || "—"}</span>
        </div>
        <div className="border-t border-gray-200" />
        <div className="flex items-center justify-between py-2">
          <span className="text-sm font-medium text-gray-700">Course code:</span>
          <span className="text-lg font-bold text-gray-900">{courseCode || "—"}</span>
        </div>
        <div className="border-t border-gray-200" />
        <div className="flex items-center justify-between py-2">
          <span className="text-sm font-medium text-gray-700">Academic session:</span>
          <span className="text-lg font-bold text-gray-900">{academicSession || "—"}</span>
        </div>
        <div className="border-t border-gray-200" />
        <div className="flex items-center justify-between py-2">
          <span className="text-sm font-medium text-gray-700">Semester:</span>
          <span className="text-lg font-bold text-gray-900">{semester || "—"}</span>
        </div>
        <div className="border-t border-gray-200" />
        <div className="flex items-center justify-between py-2 last:pb-0">
          <span className="text-sm font-medium text-gray-700">Total Students:</span>
          <span className="text-lg font-bold text-gray-900">{totalStudents}</span>
        </div>
      </div>

      <div className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-white p-2">
        <table className="min-w-full border-collapse text-sm text-gray-800">
          <thead>
            <tr className="border border-green-300 bg-green-200">
              <th className="min-w-16 border border-green-300 px-3 py-2 text-left font-semibold">CO.No.</th>
              <th className="border border-green-300 px-3 py-2 text-center font-semibold">Internal Attainment (%)</th>
              <th className="border border-green-300 px-3 py-2 text-center font-semibold">External Attainment (%)</th>
              <th className="border border-green-300 px-3 py-2 text-center font-semibold">Exact Attainment (%)</th>
              <th className="border border-green-300 px-3 py-2 text-center font-semibold">CO Attainment Level</th>
            </tr>
          </thead>
          <tbody className="text-[13px]">
            {sortedCOs.length === 0 ? (
              <tr>
                <td colSpan={5} className="border border-orange-200 bg-orange-50 py-8 text-center text-gray-500">
                  No course outcomes available
                </td>
              </tr>
            ) : (
              sortedCOs.map((co) => {
                const hasValues = hasCalculatedValues(co);
                const internal = internalAttainment?.[co];
                const external = externalAttainment?.[co];
                const exact = exactAttainment?.[co];
                const attainmentLevel = coAttainmentLevel?.[co];
                return (
                  <tr key={co}>
                    <td className="border border-green-300 bg-green-200 px-3 py-2 font-medium">{co}</td>
                    <td className="border border-orange-200 bg-orange-50 px-3 py-2 text-center">{hasValues ? `${toPercentage(internal)}%` : "-"}</td>
                    <td className="border border-orange-200 bg-orange-50 px-3 py-2 text-center">{hasValues ? `${toPercentage(external)}%` : "-"}</td>
                    <td className="border border-orange-200 bg-orange-50 px-3 py-2 text-center">{hasValues ? `${toPercentage(exact)}%` : "-"}</td>
                    <td className="border border-orange-200 bg-orange-50 px-3 py-2 text-center">{hasValues ? formatAttainmentLevel(attainmentLevel) : "-"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {poToCoMap && Object.keys(poToCoMap).length > 0 && allPOIdsSorted.length > 0 && (
        <div className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-white p-2">
          <table className="min-w-full border-collapse text-sm text-gray-800">
            <thead>
              <tr className="border border-green-300 bg-green-200">
                <th className="min-w-16 border border-green-300 px-3 py-2 text-left font-semibold">CO</th>
                {allPOIdsSorted.map((poId) => (
                  <th key={poId} className="whitespace-nowrap border border-green-300 px-3 py-2 text-center font-semibold">
                    {poId}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {Object.entries(poToCoMap).map(([coId, row]) => {
                const poRow = row as Record<string, number | "--">;
                return (
                  <tr key={coId}>
                    <td className="border border-green-300 bg-green-200 px-3 py-2 font-medium">{coId}</td>
                    {allPOIdsSorted.map((poId) => {
                      const val = poRow[poId];
                      return (
                        <td key={poId} className="border border-orange-200 bg-orange-50 px-3 py-2 text-center">
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

      {allPOIdsSorted.length > 0 && (
        <div className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-white p-2">
          <table className="min-w-full border-collapse text-sm text-gray-700">
            <thead>
              <tr className="border border-green-300 bg-green-200">
                <th className="w-24 border border-green-300 px-4 py-2 text-left font-semibold"> </th>
                {allPOIdsSorted.map((poId) => (
                  <th key={poId} className="border border-green-300 px-2 py-2 text-center font-semibold">
                    {poId}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-[13px]">
              <tr className="border border-gray-200 bg-gray-50">
                <td className="border border-gray-200 px-4 py-2 font-medium text-gray-700">PO Sum</td>
                {allPOIdsSorted.map((poId) => {
                  const sum = poSumPerPO?.[poId];
                  return (
                    <td key={poId} className="border border-gray-200 px-4 py-2 text-center font-medium text-gray-900">
                      {typeof sum === "number" ? sum.toFixed(2) : "—"}
                    </td>
                  );
                })}
              </tr>
              <tr className="border border-gray-200 bg-gray-100">
                <td className="border border-gray-200 px-4 py-2 font-medium text-gray-700">Average</td>
                <td colSpan={allPOIdsSorted.length} className="border border-gray-200 px-4 py-2 text-center font-medium text-gray-900">
                  {typeof calculatedData.poAverageValue === "number" ? calculatedData.poAverageValue.toFixed(2) : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
