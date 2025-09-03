"use client";
import { URL_NOT_FOUND } from "@/constants";
import { Room, Allocation, Course, Building } from "@/types";
import { callApi } from "@/utils/apiIntercepter";
import moment from "moment";
import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";

function AllocationPage() {
  const selectedAcademicYear = useSelector(
    (state: any) => state.dataState.selectedAcademicYear
  );
  const selectedAcademicSession = useSelector(
    (state: any) => state.dataState.selectedAcademicSession
  );

  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editAllocation, setEditAllocation] = useState<Allocation | null>(null);

  // Form state
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedFloorId, setSelectedFloorId] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const acadmeicYear = useSelector(
    (state: any) => state.dataState.selectedAcademicYear
  );
  const acadmeicSession = useSelector(
    (state: any) => state.dataState.selectedAcademicSession
  );
  // Fetch allocations for selected session/year
  useEffect(() => {
    const fetchAllocations = async () => {
      const res = await callApi<Allocation[]>(
        process.env.NEXT_PUBLIC_GET_ROOM_ALLOCATIONS || URL_NOT_FOUND,
        {
          acadSession: selectedAcademicSession,
          acadYear: selectedAcademicYear,
        }
      );
      if (res.success) setAllocations(res.data || []);
    };
    if (selectedAcademicSession && selectedAcademicYear) fetchAllocations();
  }, [selectedAcademicSession, selectedAcademicYear]);

  //fetch building and course
  useEffect(() => {
    const fetchBuildings = async () => {
      const res = await callApi<Building[]>(
        process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND,
        {
          acadSession: `${acadmeicSession}`,
          acadYear: `${acadmeicYear}`,
        }
      );
      console.log(res.data);
      if (res.success) setBuildings(res.data || []);
    };

    const fetchCourses = async () => {
      const res = await callApi<any>(
        process.env.NEXT_PUBLIC_GET_PROGRAM || URL_NOT_FOUND
      );
      if (res.success) setCourses(res?.data?.programCode || []);
    };
    if (acadmeicSession && acadmeicYear) fetchBuildings();
    fetchCourses();
  }, [acadmeicSession, acadmeicYear]);
  //Fetch rooms upon changing building and floor
  useEffect(() => {
    if (!selectedBuildingId && !selectedFloorId) return;
    const fetchRooms = async () => {
      const res = await callApi<Room[]>(
        process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND,
        {
          buildingNo: selectedBuildingId,
          floorID: selectedFloorId,
          curreentTime: moment().format("HH:MM"),
        }
      );
      if (res.success) setRooms(res.data || []);
    };
    fetchRooms();
  }, [selectedBuildingId, selectedFloorId]);

  // Handle add/edit allocation
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      eventId:"",
      roomId: selectedRoomId,
      programCode: selectedCourseId,
      acadSession: selectedAcademicSession,
      acadYear: selectedAcademicYear,
    };
    let apiUrl = process.env.NEXT_PUBLIC_INSERT_ROOM_ALLOCATION || URL_NOT_FOUND;
    if (editAllocation) {
      apiUrl = process.env.NEXT_PUBLIC_UPDATE_ROOM_ALLOCATION || URL_NOT_FOUND;
      payload["eventId"] = editAllocation.id!;
    }
    const res = await callApi(apiUrl, payload);
    console.log(res);
    if (res.success) {
      setShowForm(false);
      setEditAllocation(null);
      const refresh = await callApi<Allocation[]>(
        process.env.NEXT_PUBLIC_GET_ROOM_ALLOCATIONS || URL_NOT_FOUND,
        {
          acadSession: selectedAcademicSession,
          acadYear: selectedAcademicYear,
        }
      );
      if (refresh.success) setAllocations(refresh.data || []);
    }
  };

  // Open form for add or edit
  const openForm = (allocation?: Allocation) => {
    setShowForm(true);
    if (allocation) {
      setEditAllocation(allocation);
      setSelectedBuildingId(allocation.buildingId);
      setSelectedFloorId(allocation.floorId);
      setSelectedRoomId(allocation.roomId);
      setSelectedCourseId(allocation.programCode);
    } else {
      setEditAllocation(null);
      setSelectedBuildingId("");
      setSelectedFloorId("");
      setSelectedRoomId("");
      setSelectedCourseId("");
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800 md:ml-2">
          Room Allocations
        </h2>
        <button
          className="px-3 py-2 rounded-lg shadow-md transition duration-300 bg-orange-500 text-white hover:bg-orange-600"
          onClick={() => openForm()}
        >
          Add Allocation
        </button>
      </div>

      {/* Allocations Table */}
      <div className="bg-white rounded-lg shadow-md p-2 border border-gray-200 w-full mt-4">
        <table className="min-w-full text-sm text-gray-700">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2">Department</th>
              <th className="px-4 py-2">Room Name</th>
              <th className="px-4 py-2">Room ID</th>
              <th className="px-4 py-2">Session</th>
              <th className="px-4 py-2">Year</th>
              <th className="px-4 py-2">Edit</th>
            </tr>
          </thead>
          <tbody>
            {allocations?.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-4">
                  No allocations found.
                </td>
              </tr>
            ) : (
              allocations.map((alloc) => (
                <tr key={alloc.id}>
                  <td className="px-4 py-2">{alloc.courseName}</td>
                  <td className="px-4 py-2">{alloc.roomName}</td>
                  <td className="px-4 py-2">{alloc.roomId}</td>
                  <td className="px-4 py-2">{alloc.acadSession}</td>
                  <td className="px-4 py-2">{alloc.acadYear}</td>
                  <td className="px-4 py-2">
                    <button
                      className="px-2 py-1 rounded bg-orange-500 text-white hover:bg-orange-600"
                      onClick={() => openForm(alloc)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Allocation Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 h-screen w-screen bg-[#00000070] flex items-center justify-center text-gray-500">
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-8">
            <form onSubmit={handleFormSubmit}>
              <h3 className="text-lg font-semibold mb-4">
                {editAllocation ? "Edit Allocation" : "Add Allocation"}
              </h3>
              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-1">
                  Building
                </label>
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
                <label className="block text-sm text-gray-700 mb-1">
                  Floor
                </label>
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
                      <option key={f.floorId} value={f.floorId}>
                        {f.floorName}
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
                <label className="block text-sm text-gray-700 mb-1">
                  Department
                </label>
                <select
                  className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  required
                >
                  <option value="">Select department</option>
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
                <button
                  type="submit"
                  className="px-3 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600"
                >
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
