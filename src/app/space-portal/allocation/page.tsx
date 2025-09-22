"use client";
import { URL_NOT_FOUND } from "@/constants";
import { Room, Allocation, Program, Building } from "@/types";
import { callApi } from "@/utils/apiIntercepter";
import { useBuildingsData } from "@/hooks/useBuildingsData";
import moment from "moment";
import React, { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";

function AllocationPage() {
  const selectedAcademicYear = useSelector((state: any) => state.dataState.selectedAcademicYear);
  const selectedAcademicSession = useSelector((state: any) => state.dataState.selectedAcademicSession);

  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

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

  const acadmeicYear = useSelector((state: any) => state.dataState.selectedAcademicYear);
  const acadmeicSession = useSelector((state: any) => state.dataState.selectedAcademicSession);
  const isActiveSession = useSelector((state: any) => state.dataState.isActiveSession);

  const [searchQuery, setSearchQuery] = useState("");

  // Fetch allocations for selected session/year
  useEffect(() => {
    const fetchAllocations = async () => {
      const res = await callApi<Allocation[]>(process.env.NEXT_PUBLIC_GET_ROOM_ALLOCATIONS || URL_NOT_FOUND, {
        acadSession: selectedAcademicSession,
        acadYear: selectedAcademicYear,
      });
      if (res.success) setAllocations(res.data || []);
    };
    if (selectedAcademicSession && selectedAcademicYear) fetchAllocations();
  }, [selectedAcademicSession, selectedAcademicYear]);

  // Fetch courses
  useEffect(() => {
    const fetchCourses = async () => {
      const res = await callApi<any>(process.env.NEXT_PUBLIC_GET_PROGRAM || URL_NOT_FOUND);
      if (res.success) setCourses(res?.data?.programCode || []);
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
    let payload: any = {
      buildingId: selectedBuildingId,
      roomId: selectedRoomId,
      programCode: selectedCourseId,
      acadSession: selectedAcademicSession,
      acadYear: selectedAcademicYear,
    };
    let apiUrl = process.env.NEXT_PUBLIC_INSERT_ROOM_ALLOCATION || URL_NOT_FOUND;

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
        {isActiveSession && (
          <div className="flex items-center space-x-4">
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-gray-300 rounded-md py-1 px-2 text-sm focus:outline-none text-gray-700 focus:ring-1 focus:ring-orange-500"
            />
            <button className="px-3 py-2 rounded-lg shadow-md transition duration-300 bg-orange-500 text-white hover:bg-orange-600" onClick={() => openForm()}>
              Add Allocation
            </button>
          </div>
        )}
      </div>

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
              {isActiveSession && <th className="px-4 py-2">Edit</th>}
            </tr>
          </thead>
          <tbody className="text-[13px]">
            {filteredAllocations.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-4">
                  No allocations found.
                </td>
              </tr>
            ) : (
              filteredAllocations.map((alloc) => (
                <tr key={alloc.systemId}>
                  <td className="px-4 py-2">
                    {`${courses.find((c) => c.code === alloc.program)?.description} ( ${courses.find((c) => c.code === alloc.program)?.code} )`}
                  </td>
                  <td className="px-4 py-2">{alloc.roomName}</td>
                  <td className="px-4 py-2">{alloc.roomNo}</td>
                  <td className="px-4 py-2">{alloc.session}</td>
                  <td className="px-4 py-2">{alloc.academicYear}</td>
                  {isActiveSession && (
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
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
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
                    ?.floors.map((f) => (
                      <option key={f.id} value={f.id}>
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
                  {rooms.map((r) => (
                    <option key={r.roomId} value={r.roomId}>
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
                  {courses.map((d) => (
                    <option key={d.code} value={d.code}>
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
