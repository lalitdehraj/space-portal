"use client";
import { URL_NOT_FOUND } from "@/constants";
import { Building, Room, UserProfile, Faculty, Department } from "@/types";
import { callApi } from "@/utils/apiIntercepter";
import { useSession } from "next-auth/react";
import React, { useState, useEffect } from "react";

function AllocationPage() {
  const { data } = useSession();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  useEffect(() => {
    const fetchBuilding = async () => {
      const res = await callApi<Building[]>(
        process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND,
        {
          acadSession: userProfile?.activeSession,
          acadYear: userProfile?.activeYear,
        }
      );
      if (res.success) {
        setBuildings(res.data || []);
        console.log(res.data);
      }
    };
    const fetchUsers = async () => {
      const res = await callApi<UserProfile[]>(
        process.env.NEXT_PUBLIC_GET_USER || URL_NOT_FOUND
      );
      if (res.success) {
        const user = res.data?.filter(
          (user) =>
            user.userEmail.toLowerCase().trim() ===
            data?.user?.email?.toLowerCase().trim()
        );
        setUserProfile(user?.[0] ?? null);
      }
    };
    const fetchFaculties = async () => {
      const res = await callApi<Faculty[]>(
        process.env.NEXT_PUBLIC_GET_FACULTY_OR_DEPARTMENT || URL_NOT_FOUND,
        { filterValue: "FACULTY" }
      );
      if (res.success) {
        setFaculties(res?.data || []);
      }
    };
    const fetchDepartments = async () => {
      const res = await callApi<Department[]>(
        process.env.NEXT_PUBLIC_GET_FACULTY_OR_DEPARTMENT || URL_NOT_FOUND,
        { filterValue: "DEPARTMENT" }
      );
      if (res.success) {
        setDepartments(res?.data || []);
      }
    };
    fetchBuilding();
    fetchUsers();
    fetchFaculties();
    fetchDepartments();
  }, []);
  useEffect(() => {
    const fetchRooms = async () => {
      const reqBody = {
        buildingNo: `${selectedBuildingId}`,
        floorID: "",
      };
      const res = await callApi<Room[]>(
        process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND,
        reqBody
      );
      if (res.success) {
        setRooms(res.data || []);
      }
    };
    fetchRooms();
  }, [selectedBuildingId]);
  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between">
        <h2 className="text-base font-semibold text-gray-800 md:ml-2">
          Add Allocation
        </h2>
      </div>

      <div className="bg-white rounded-lg shadow-md p-2 border border-gray-200 w-full mt-4">
        <div className="min-w-2xl p-2 bg-white text-gray-600">
          <label className="text-base font-bold text-gray-600 ">
            Allocate a room
          </label>
          <div className="mt-6 space-y-4">
            <div className="flex flex-row space-x-4">
              <div className="w-full">
                <label className="block text-sm text-gray-700 mb-1">
                  Building
                </label>
                <select
                  className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  value={selectedBuildingId}
                  onChange={(e) => setSelectedBuildingId(e.target.value)}
                >
                  <option value="">Select building</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full mt-4 md:mt-0">
                <label className="block text-sm text-gray-700 mb-1">Room</label>
                <select
                  className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  disabled={!selectedBuildingId}
                >
                  <option value="">Select room</option>
                  {rooms.map((r) => (
                    <option key={r.roomId} value={r.roomId}>
                      {r.roomName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-row space-x-4">
              <div className="w-full">
                <label className="block text-sm text-gray-700 mb-1">
                  Faculty
                </label>
                <select
                  className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  value={selectedFacultyId}
                  onChange={(e) => setSelectedFacultyId(e.target.value)}
                >
                  <option value="">Select faculty</option>
                  {faculties.map((f) => (
                    <option key={f.facultyId} value={f.facultyId}>
                      {f.facultyName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full mt-4 md:mt-0">
                <label className="block text-sm text-gray-700 mb-1">
                  Department
                </label>
                <select
                  className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-orange-500"
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                >
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.departmentId} value={d.departmentName}>
                      {d.departmentName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-center flex-row space-x-4 pt-12">
              <button className="px-3 py-2 rounded-lg shadow-md transition duration-300 bg-orange-500 text-white hover:bg-orange-600">
                Allocate
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AllocationPage;
