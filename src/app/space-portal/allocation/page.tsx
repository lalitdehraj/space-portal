"use client";
import { URL_NOT_FOUND } from "@/constants";
import { Room, Allocation, Program } from "@/types";
import { callApi } from "@/utils/apiIntercepter";
import { useBuildingsData } from "@/hooks/useBuildingsData";
import moment from "moment";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/app/store";

function AllocationPage() {
  const selectedAcademicYear = useSelector((state: RootState) => state.dataState.selectedAcademicYear);
  const selectedAcademicSession = useSelector((state: RootState) => state.dataState.selectedAcademicSession);

  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);

  // Use custom hook for buildings data
  const { buildings } = useBuildingsData();
  const [courses, setCourses] = useState<Program[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editAllocation, setEditAllocation] = useState<Allocation | null>(null);

  // Form state
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedFloorId, setSelectedFloorId] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const userRole = useSelector((state: RootState) => state.dataState.userRole);
  const [isManagedByUser, setIsManagedByUser] = useState(false);

  // Bulk upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ processed: 0, total: 0, errors: [] as string[] });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    console.log("userRole", userRole);
    if (!userRole) return;
    userRole.split("|").forEach((role: string) => {
      const trimmedRole = role.trim();
      if (trimmedRole === "ADMIN") {
        setIsManagedByUser(true);
      }
      if (trimmedRole === "ACADEMICS") {
        setIsManagedByUser(true);
      }
    });
  }, [userRole]);

  // Fetch allocations for selected session/year
  useEffect(() => {
    const fetchAllocations = async () => {
      setLoading(true);
      const res = await callApi<Allocation[]>(process.env.NEXT_PUBLIC_GET_ROOM_ALLOCATIONS || URL_NOT_FOUND, {
        acadSession: selectedAcademicSession,
        acadYear: selectedAcademicYear,
      });
      if (res.success) setAllocations(res.data || []);
      setLoading(false);
    };
    if (selectedAcademicSession && selectedAcademicYear) fetchAllocations();
  }, [selectedAcademicSession, selectedAcademicYear]);

  // Fetch courses
  useEffect(() => {
    const fetchCourses = async () => {
      const res = await callApi<{ programCode: Program[] }>(process.env.NEXT_PUBLIC_GET_PROGRAM || URL_NOT_FOUND);
      if (res.success) {
        const programCodes = res?.data?.programCode || [];
        setCourses(programCodes);
      }
    };

    fetchCourses();
  }, []);

  // Fetch rooms upon changing building and floor
  useEffect(() => {
    if (!selectedBuildingId || !selectedFloorId) return;
    const fetchRooms = async () => {
      const res = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, {
        buildingNo: selectedBuildingId,
        floorID: selectedFloorId,
        curreentTime: moment().format("HH:MM"),
      });
      if (res.success) setRooms(res.data || []);
    };
    fetchRooms();
  }, [selectedBuildingId, selectedFloorId]);

  // Handle add/edit allocation
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      buildingId: selectedBuildingId,
      roomId: selectedRoomId,
      programCode: selectedCourseId,
      acadSession: selectedAcademicSession,
      acadYear: selectedAcademicYear,
    };
    const apiUrl = process.env.NEXT_PUBLIC_INSERT_ROOM_ALLOCATION || URL_NOT_FOUND;

    const res = await callApi(apiUrl, payload);

    const updateUI = async () => {
      setShowForm(false);
      setEditAllocation(null);
      const refresh = await callApi<Allocation[]>(process.env.NEXT_PUBLIC_GET_ROOM_ALLOCATIONS || URL_NOT_FOUND, {
        acadSession: selectedAcademicSession,
        acadYear: selectedAcademicYear,
      });
      if (refresh.success) setAllocations(refresh.data || []);
    };

    if (res.success) {
      if (res.data === true) {
        if (editAllocation) {
          await callApi(process.env.NEXT_PUBLIC_DELETE_ROOM_ALLOCATION || URL_NOT_FOUND, {
            systemId: editAllocation.systemId,
          });
        }
        updateUI();
      } else {
        alert("Record Already Exist");
      }
    }
  };

  // Open form for add or edit
  const openForm = (allocation?: Allocation) => {
    setShowForm(true);
    if (allocation) {
      setEditAllocation(allocation);
      setSelectedBuildingId(allocation.blockNo);
      setSelectedFloorId(allocation.floor);
      setSelectedRoomId(allocation.roomNo);
      setSelectedCourseId(allocation.program);
    } else {
      setEditAllocation(null);
      setSelectedBuildingId("");
      setSelectedFloorId("");
      setSelectedRoomId("");
      setSelectedCourseId("");
    }
  };

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch("/api/allocation/download-template");
      if (!response.ok) throw new Error("Failed to download template");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "room_allocation_template.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading template:", error);
      alert("Failed to download template");
    }
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedAcademicSession || !selectedAcademicYear) {
      alert("Please select academic session and year first");
      return;
    }

    setIsUploading(true);
    setUploadProgress({ processed: 0, total: 0, errors: [] });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("acadSession", selectedAcademicSession);
      formData.append("acadYear", selectedAcademicYear);

      const response = await fetch("/api/allocation/upload-bulk", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to process file");
      }

      if (!result.success || !result.data) {
        throw new Error("Invalid response from server");
      }

      const rows = result.data as Array<{ buildingId: string; roomId: string; programCode: string }>;
      setUploadProgress({ processed: 0, total: rows.length, errors: [] });

      // Process each row
      const errors: string[] = [];
      let successCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const payload = {
          buildingId: row.buildingId,
          roomId: row.roomId,
          programCode: row.programCode,
          acadSession: selectedAcademicSession,
          acadYear: selectedAcademicYear,
        };

        const apiUrl = process.env.NEXT_PUBLIC_INSERT_ROOM_ALLOCATION || URL_NOT_FOUND;
        console.log(payload);
        const res = await callApi(apiUrl, payload);

        if (res.success && res.data === true) {
          successCount++;
        } else {
          errors.push(`Row ${i + 2}: ${res.error || "Record already exists or failed"}`);
        }

        setUploadProgress({
          processed: i + 1,
          total: rows.length,
          errors: [...errors],
        });
      }

      // Refresh allocations
      const refresh = await callApi<Allocation[]>(process.env.NEXT_PUBLIC_GET_ROOM_ALLOCATIONS || URL_NOT_FOUND, {
        acadSession: selectedAcademicSession,
        acadYear: selectedAcademicYear,
      });
      if (refresh.success) setAllocations(refresh.data || []);

      // Show results
      alert(
        `Upload completed!\nSuccess: ${successCount}\nFailed: ${errors.length}${
          errors.length > 0 ? `\n\nErrors:\n${errors.slice(0, 10).join("\n")}${errors.length > 10 ? `\n... and ${errors.length - 10} more` : ""}` : ""
        }`
      );

      setShowUploadModal(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      alert(`Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsUploading(false);
      setUploadProgress({ processed: 0, total: 0, errors: [] });
    }
  };

  // Filtered allocations based on search query
  const filteredAllocations = useMemo(() => {
    if (!searchQuery.trim()) return allocations;

    return allocations.filter((alloc) => {
      const courseDesc = courses.find((c) => c.code === alloc.program)?.description || "";
      const courseCode = courses.find((c) => c.code === alloc.program)?.code || "";
      const query = searchQuery.toLowerCase();

      return (
        courseDesc.toLowerCase().includes(query) ||
        courseCode.toLowerCase().includes(query) ||
        alloc.roomNo.toLowerCase().includes(query) ||
        alloc.session.toLowerCase().includes(query) ||
        alloc.academicYear.toLowerCase().includes(query)
      );
    });
  }, [allocations, courses, searchQuery]);

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800 md:ml-2">Room Allocations</h2>

        <div className="flex items-center space-x-4">
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border border-gray-300 rounded-md py-1 px-2 text-sm focus:outline-none text-gray-700 focus:ring-1 focus:ring-orange-500"
          />
          {isManagedByUser && (
            <>
              <button
                className="px-3 py-2 rounded-lg shadow-md transition duration-300 bg-orange-500 text-white hover:bg-orange-600 text-sm"
                onClick={handleDownloadTemplate}
              >
                Download Template
              </button>
              <button
                className="px-3 py-2 rounded-lg shadow-md transition duration-300 bg-orange-500 text-white hover:bg-orange-600 text-sm"
                onClick={() => {
                  setShowUploadModal(true);
                  fileInputRef.current?.click();
                }}
                disabled={!selectedAcademicSession || !selectedAcademicYear}
              >
                Upload Excel
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
              <button
                className="px-3 py-2 rounded-lg shadow-md transition duration-300 bg-orange-500 text-white hover:bg-orange-600"
                onClick={() => openForm()}
              >
                Add Allocation
              </button>
            </>
          )}
        </div>
      </div>

      {/* Upload Progress Modal */}
      {showUploadModal && isUploading && (
        <div className="fixed inset-0 z-50 h-screen w-screen bg-[#00000070] flex items-center justify-center">
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">Uploading Allocations</h3>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span>
                  Progress: {uploadProgress.processed} / {uploadProgress.total}
                </span>
                <span>{uploadProgress.total > 0 ? Math.round((uploadProgress.processed / uploadProgress.total) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-orange-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress.total > 0 ? (uploadProgress.processed / uploadProgress.total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
            {uploadProgress.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto text-sm text-red-600 mb-4">
                <p className="font-semibold mb-2">Errors:</p>
                {uploadProgress.errors.slice(0, 5).map((error, idx) => (
                  <p key={idx} className="text-xs">
                    {error}
                  </p>
                ))}
                {uploadProgress.errors.length > 5 && <p className="text-xs">... and {uploadProgress.errors.length - 5} more</p>}
              </div>
            )}
            <button
              className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              onClick={() => {
                setIsUploading(false);
                setShowUploadModal(false);
              }}
              disabled={isUploading}
            >
              {isUploading ? "Processing..." : "Close"}
            </button>
          </div>
        </div>
      )}

      {/* Allocations Table */}
      <div className="bg-white rounded-lg shadow-md p-2 border border-gray-200 w-full mt-4">
        <table className="min-w-full text-sm text-gray-700">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="px-4 py-2">Course</th>
              <th className="px-4 py-2">Room Name</th>
              <th className="px-4 py-2">Room ID</th>
              <th className="px-4 py-2">Session</th>
              <th className="px-4 py-2">Year</th>
              {isManagedByUser && <th className="px-4 py-2">Edit</th>}
            </tr>
          </thead>
          <tbody className="text-[13px]">
            {loading ? (
              <tr>
                <td colSpan={isManagedByUser ? 6 : 5} className="text-center py-8">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-gray-600">Loading allocations...</span>
                  </div>
                </td>
              </tr>
            ) : filteredAllocations.length === 0 ? (
              <tr>
                <td colSpan={isManagedByUser ? 6 : 5} className="text-center py-4">
                  No allocations found.
                </td>
              </tr>
            ) : (
              filteredAllocations.map((alloc, index) => (
                <tr key={alloc.systemId || `allocation-${index}`}>
                  <td className="px-4 py-2">
                    {`${courses.find((c) => c.code === alloc.program)?.description} ( ${courses.find((c) => c.code === alloc.program)?.code} )`}
                  </td>
                  <td className="px-4 py-2">{alloc.roomName}</td>
                  <td className="px-4 py-2">{alloc.roomNo}</td>
                  <td className="px-4 py-2">{alloc.session}</td>
                  <td className="px-4 py-2">{alloc.academicYear}</td>
                  {isManagedByUser && (
                    <td className="px-4 py-2">
                      <button className="px-2 py-1 rounded bg-orange-500 text-white hover:bg-orange-600" onClick={() => openForm(alloc)}>
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Allocation Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 h-screen w-screen bg-[#00000070] flex items-center justify-center text-gray-500">
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl p-8">
            <form onSubmit={handleFormSubmit}>
              <h3 className="text-lg font-semibold mb-4">{editAllocation ? "Edit Allocation" : "Add Allocation"}</h3>
              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-1">Building</label>
                <select
                  className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  value={selectedBuildingId}
                  onChange={(e) => setSelectedBuildingId(e.target.value)}
                  required
                >
                  <option value="">Select building</option>
                  {buildings.map((b, index) => (
                    <option key={b.id || `building-${index}`} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-1">Floor</label>
                <select
                  className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  value={selectedFloorId}
                  disabled={!selectedBuildingId}
                  onChange={(e) => setSelectedFloorId(e.target.value)}
                  required
                >
                  <option value="">Select floor</option>
                  {buildings
                    .find((b) => b.id === selectedBuildingId)
                    ?.floors.map((f, index) => (
                      <option key={f.id || `floor-${index}`} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-1">Room</label>
                <select
                  className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  value={selectedRoomId}
                  disabled={!selectedFloorId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  required
                >
                  <option value="">Select room</option>
                  {rooms.map((r, index) => (
                    <option key={r.roomId || `room-${index}`} value={r.roomId}>
                      {r.roomName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-1">Program Code</label>
                <select
                  className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  required
                >
                  <option value="">Select Course</option>
                  {courses.map((d, index) => (
                    <option key={`${d.code} course-${index}`} value={d.code}>
                      {d.description}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-gray-300 text-gray-700 hover:bg-gray-400"
                  onClick={() => {
                    setShowForm(false);
                    setEditAllocation(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="px-3 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600">
                  {editAllocation ? "Update" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AllocationPage;
