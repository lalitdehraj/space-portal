"use client";

import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Building, RoomInfo, Occupant, Maintenance } from "@/types";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND, GET_MAINTENANCE_DATA_API, CANCEL_MAINTENANCE_API, credentials } from "@/constants";
import { useBuildingsData } from "@/hooks/useBuildingsData";
import moment from "moment";
import MaintenanceModal from "@/components/MaintenanceModal";

interface MaintenanceRecord extends Maintenance {
  roomName?: string;
  buildingName?: string;
  status?: string;
  createdBy?: string;
  createdAt?: string;
}

const MaintenancePage = () => {
  const userRole = useSelector((state: any) => state.dataState.userRole);
  const academicYear = useSelector((state: any) => state.dataState.selectedAcademicYear);
  const academicSession = useSelector((state: any) => state.dataState.selectedAcademicSession);
  const academicSessionStartDate = useSelector((state: any) => state.dataState.selectedAcademicSessionStartDate);
  const academicSessionEndDate = useSelector((state: any) => state.dataState.selectedAcademicSessionEndDate);

  const [isMaintenanceModalVisible, setIsMaintenanceModalVisible] = useState(false);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);

  // Use custom hook for buildings data
  const { buildings: allBuildingsData } = useBuildingsData();
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [maintenanceToCancel, setMaintenanceToCancel] = useState<MaintenanceRecord | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Fetch maintenance records
  const fetchMaintenanceRecords = async () => {
    setIsLoading(true);
    try {
      const response = await callApi<Maintenance[]>(process.env.NEXT_PUBLIC_GET_MAINTENANCE_DATA || URL_NOT_FOUND);
      if (response.success && response.data) {
        // Transform the data to include room and building names
        const enrichedRecords: MaintenanceRecord[] = response.data.map((record) => {
          const building = allBuildingsData.find((b) => b.id === record.buildingId);

          // Determine status based on maintenance active state and scheduled time
          let status = "cancelled"; // Default to cancelled if not active

          if (record.isMainteneceActive) {
            const maintenanceDate = moment(record.maintanceDate);
            const currentDate = moment();

            if (maintenanceDate.isAfter(currentDate)) {
              status = "active"; // Future maintenance
            } else {
              status = "completed"; // Past maintenance that was active
            }
          }

          return {
            ...record,
            roomName: record.roomid, // Use room ID as room name for now
            buildingName: building?.name || record.buildingId,
            status: status,
            createdBy: "System", // Default value since not provided by API
            createdAt: record.maintanceDate, // Use maintenance date as created date
          };
        });
        setMaintenanceRecords(enrichedRecords);
      } else {
        setMaintenanceRecords([]);
      }
    } catch (error) {
      console.error("Error fetching maintenance records:", error);
      setMaintenanceRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (academicYear && academicSession && allBuildingsData.length > 0) {
      fetchMaintenanceRecords();
    }
  }, [academicYear, academicSession, allBuildingsData]);

  // Filter maintenance records based on search query
  const filteredRecords = maintenanceRecords.filter(
    (record) =>
      (record.roomName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (record.buildingName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (record.maintainenceType || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (record.description || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleMaintenanceSuccess = () => {
    fetchMaintenanceRecords();
  };

  // Cancel maintenance function
  const cancelMaintenance = async (maintenanceId: string) => {
    setIsCancelling(true);
    try {
      const response = await fetch(CANCEL_MAINTENANCE_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${credentials}`,
        },
        body: JSON.stringify({
          id: maintenanceId,
          isMainteneceActive: "false",
        }),
      });

      if (response.ok) {
        // Refresh the maintenance records after successful cancellation
        await fetchMaintenanceRecords();
        setShowCancelDialog(false);
        setMaintenanceToCancel(null);
        // You could add a success toast notification here
        alert("Maintenance cancelled successfully!");
      } else {
        console.error("Failed to cancel maintenance:", response.statusText);
        alert("Failed to cancel maintenance. Please try again.");
      }
    } catch (error) {
      console.error("Error cancelling maintenance:", error);
      alert("An error occurred while cancelling maintenance. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCancelClick = (record: MaintenanceRecord) => {
    setMaintenanceToCancel(record);
    setShowCancelDialog(true);
  };

  const handleConfirmCancel = () => {
    if (maintenanceToCancel) {
      cancelMaintenance(maintenanceToCancel.id.toString());
    }
  };

  return (
    <>
      <div>
        <div className="flex flex-col md:flex-row justify-between">
          <h2 className="text-base font-semibold text-gray-800 md:ml-2">Room Maintenance</h2>
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No maintenance records found</h3>
                <p className="text-gray-500 mb-4">{searchQuery ? "No records match your search criteria." : "No maintenance has been scheduled yet."}</p>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Building</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scheduled Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{record.roomName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.buildingName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {record.maintainenceType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{moment(record.maintanceDate).format("MMM DD, YYYY")}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.startTime.split("T")[1]?.split(":").slice(0, 2).join(":") || record.startTime} -{" "}
                        {record.endTime.split("T")[1]?.split(":").slice(0, 2).join(":") || record.endTime}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            record.status === "active"
                              ? "bg-green-100 text-green-800"
                              : record.status === "completed"
                              ? "bg-blue-100 text-blue-800"
                              : record.status === "cancelled"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {record.status === "active" && "Active"}
                          {record.status === "completed" && "Completed"}
                          {record.status === "cancelled" && "Cancelled"}
                          {!["active", "completed", "cancelled"].includes(record.status || "") && "Unknown"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.createdBy}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          {record.status === "active" && (
                            <button onClick={() => handleCancelClick(record)} className="text-red-600 hover:text-red-900 text-xs font-medium transition-colors">
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

      {/* Cancel Confirmation Dialog */}
      {showCancelDialog && maintenanceToCancel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Cancel Maintenance</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-gray-700">
                Are you sure you want to cancel the maintenance for <strong>{maintenanceToCancel.roomName}</strong> in{" "}
                <strong>{maintenanceToCancel.buildingName}</strong>?
              </p>
              <div className="mt-3 text-sm text-gray-600">
                <p>
                  <strong>Type:</strong> {maintenanceToCancel.maintainenceType}
                </p>
                <p>
                  <strong>Date:</strong> {moment(maintenanceToCancel.maintanceDate).format("MMM DD, YYYY")}
                </p>
                <p>
                  <strong>Time:</strong> {maintenanceToCancel.startTime.split("T")[1]?.split(":").slice(0, 2).join(":") || maintenanceToCancel.startTime} -{" "}
                  {maintenanceToCancel.endTime.split("T")[1]?.split(":").slice(0, 2).join(":") || maintenanceToCancel.endTime}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCancelDialog(false);
                  setMaintenanceToCancel(null);
                }}
                disabled={isCancelling}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
              >
                Keep Maintenance
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 flex items-center"
              >
                {isCancelling ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Cancelling...
                  </>
                ) : (
                  "Cancel Maintenance"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MaintenancePage;
