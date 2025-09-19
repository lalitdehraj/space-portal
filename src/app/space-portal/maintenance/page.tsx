"use client";

import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Building, RoomInfo, Occupant } from "@/types";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import moment from "moment";
import MaintenanceModal from "@/components/MaintenanceModal";

interface MaintenanceRecord {
  id: string;
  roomName: string;
  buildingName: string;
  maintenanceType: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  description: string;
  status: string;
  createdBy: string;
  createdAt: string;
}

const MaintenancePage = () => {
  const userRole = useSelector((state: any) => state.dataState.userRole);
  const academicYear = useSelector((state: any) => state.dataState.selectedAcademicYear);
  const academicSession = useSelector((state: any) => state.dataState.selectedAcademicSession);
  const academicSessionStartDate = useSelector((state: any) => state.dataState.selectedAcademicSessionStartDate);
  const academicSessionEndDate = useSelector((state: any) => state.dataState.selectedAcademicSessionEndDate);

  const [isMaintenanceModalVisible, setIsMaintenanceModalVisible] = useState(false);
  const [allBuildingsData, setAllBuildingsData] = useState<Building[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch all buildings
  useEffect(() => {
    const fetchBuildings = async () => {
      if (!academicSession && !academicYear) return;
      try {
        const reqBody = {
          acadSession: `${academicSession}`,
          acadYear: `${academicYear}`,
        };
        const response = await callApi<Building[]>(process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND, reqBody);
        if (response.success) setAllBuildingsData(response.data || []);
      } catch (error) {
        console.error("Error fetching buildings:", error);
      }
    };
    fetchBuildings();
  }, [academicSession, academicYear]);

  // Fetch maintenance records
  const fetchMaintenanceRecords = async () => {
    setIsLoading(true);
    try {
      // This would be a new API endpoint for fetching maintenance records
      // For now, we'll simulate with empty data
      setMaintenanceRecords([]);
    } catch (error) {
      console.error("Error fetching maintenance records:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (academicYear && academicSession) {
      fetchMaintenanceRecords();
    }
  }, [academicYear, academicSession]);

  // Filter maintenance records based on search query
  const filteredRecords = maintenanceRecords.filter(record =>
    record.roomName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record.buildingName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record.maintenanceType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleMaintenanceSuccess = () => {
    fetchMaintenanceRecords();
  };

  return (
    <>
      <div>
        <div className="flex flex-col md:flex-row justify-between">
          <h2 className="text-base font-semibold text-gray-800 md:ml-2">
            Room Maintenance
          </h2>
          <div className="flex items-center space-x-4">
            <input
              type="text"
              placeholder="Search maintenance records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-gray-300 rounded-md py-1 px-2 text-sm focus:outline-none text-gray-700 focus:ring-1 focus:ring-orange-500"
            />
            <button
              className="flex h-fit items-center rounded-md bg-[#F26722] px-4 py-2 text-xs text-white shadow-md transition-all hover:bg-[#a5705a]"
              onClick={() => setIsMaintenanceModalVisible(true)}
            >
              🔧 Schedule Maintenance
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-2 border border-gray-200 w-full mt-2">
          <div className="min-w-2xl w-[100vw] max-w-6xl p-2 overflow-x-scroll bg-white">
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                <span className="ml-2 text-gray-600">Loading maintenance records...</span>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500 mb-4">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No maintenance records found</h3>
                <p className="text-gray-500 mb-4">
                  {searchQuery ? "No records match your search criteria." : "No maintenance has been scheduled yet."}
                </p>
                {!searchQuery && (
                  <button
                    className="flex h-fit items-center rounded-md bg-[#F26722] px-4 py-2 text-xs text-white shadow-md transition-all hover:bg-[#a5705a] mx-auto"
                    onClick={() => setIsMaintenanceModalVisible(true)}
                  >
                    🔧 Schedule First Maintenance
                  </button>
                )}
              </div>
            ) : (
              <table className="divide-y divide-gray-200 w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Room
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Building
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Scheduled Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {record.roomName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.buildingName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {record.maintenanceType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {moment(record.scheduledDate).format('MMM DD, YYYY')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.startTime} - {record.endTime}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          record.status === 'scheduled' ? 'bg-green-100 text-green-800' :
                          record.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                          record.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.createdBy}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <button className="text-orange-600 hover:text-orange-900 text-xs">
                            View Details
                          </button>
                          {record.status === 'scheduled' && (
                            <button className="text-red-600 hover:text-red-900 text-xs">
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {isMaintenanceModalVisible && (
        <MaintenanceModal
          allBuildingsData={allBuildingsData}
          onClose={() => setIsMaintenanceModalVisible(false)}
          onSuccess={handleMaintenanceSuccess}
          startDate={academicSessionStartDate || ""}
          endDate={academicSessionEndDate || ""}
        />
      )}
    </>
  );
};

export default MaintenancePage;
