"use client";

import React, { useEffect, useState } from "react";
import { Building, Room, RoomInfo } from "@/types";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import moment from "moment";
import { useSelector } from "react-redux";
import { RootState } from "@/app/store";

interface ExtendSittingModalProps {
  onClose: () => void;
}

interface SittingEntry {
  roomId: string;
  subroomId?: string;
  roomName: string;
  buildingId: string;
  buildingName: string;
  isChecked: boolean;
  hasActiveOccupant: boolean;
}

export default function ExtendSittingModal({ onClose }: ExtendSittingModalProps) {
  const academicYear = useSelector((state: RootState) => state.dataState.selectedAcademicYear);
  const acadSession = useSelector((state: RootState) => state.dataState.selectedAcademicSession);
  const academicSessionStartDate = useSelector((state: RootState) => state.dataState.selectedAcademicSessionStartDate);
  const academicSessionEndDate = useSelector((state: RootState) => state.dataState.selectedAcademicSessionEndDate);

  const [loading, setLoading] = useState(true);
  const [sittingEntries, setSittingEntries] = useState<SittingEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAllSittingRooms();
  }, []);

  // Helper function to process promises in batches to avoid overwhelming the server
  const processBatch = async <T,>(items: T[], batchSize: number, processor: (item: T) => Promise<any>): Promise<any[]> => {
    const results: any[] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(processor));
      results.push(...batchResults);
    }
    return results;
  };

  const fetchAllSittingRooms = async () => {
    if (!academicYear || !acadSession || !academicSessionStartDate || !academicSessionEndDate) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Step 1: Fetch all buildings
      const buildingsResponse = await callApi<Building[]>(process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND, {
        acadSession: `${acadSession}`,
        acadYear: `${academicYear}`,
      });

      if (!buildingsResponse.success || !buildingsResponse.data) {
        setLoading(false);
        return;
      }

      const buildings = buildingsResponse.data || [];

      // Step 2: Fetch rooms for buildings in batches to avoid overwhelming the server
      const buildingsWithRooms = (
        await processBatch(buildings, 5, async (building) => {
          try {
            const roomsResponse = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, {
              buildingNo: building.id,
              floorID: "",
              curreentTime: moment().format("HH:mm"),
            });

            if (!roomsResponse.success || !roomsResponse.data) return null;

            return {
              building,
              rooms: roomsResponse.data || [],
            };
          } catch (error) {
            console.error(`Error fetching rooms for building ${building.id}:`, error);
            return null;
          }
        })
      ).filter((item) => item !== null);

      // Step 3: Collect all room processing tasks
      const allRoomTasks = buildingsWithRooms.flatMap(({ building, rooms }) => rooms.map((room: Room) => ({ building, room })));

      // Step 4: Process rooms in batches
      const allRoomInfoResults = await processBatch(allRoomTasks, 8, async ({ building, room }) => {
        try {
          // Check if room has subrooms
          if (room.hasSubroom) {
            // Fetch subrooms
            const subroomsResponse = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_SUBROOMS_LIST || URL_NOT_FOUND, {
              roomID: room.roomId,
              buildingNo: building.id,
              acadSess: acadSession,
              acadYr: academicYear,
            });

            if (!subroomsResponse.success || !subroomsResponse.data) return [];

            const subrooms = subroomsResponse.data || [];

            // Fetch room info for subrooms in batches
            const subroomResults = await processBatch(subrooms, 5, async (subroom) => {
              try {
                const roomInfoResponse = await callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, {
                  roomID: room.roomId,
                  subroomID: subroom.roomId,
                  academicYr: academicYear,
                  acadSess: acadSession,
                  startDate: academicSessionStartDate,
                  endDate: academicSessionEndDate,
                });

                if (roomInfoResponse.success && roomInfoResponse.data) {
                  const roomInfo = roomInfoResponse.data;

                  // Only return if this is a sitting room
                  if (roomInfo.isSitting) {
                    const hasActiveOccupant = roomInfo.occupants?.some((occupant) => occupant.isExtendable === true) || false;

                    return {
                      roomId: room.roomId,
                      subroomId: subroom.roomId,
                      roomName: `${room.roomName} - ${subroom.roomName}`,
                      buildingId: building.id,
                      buildingName: building.name,
                      isChecked: hasActiveOccupant,
                      hasActiveOccupant,
                    };
                  }
                }
                return null;
              } catch (error) {
                console.error(`Error fetching room info for ${room.roomId}-${subroom.roomId}:`, error);
                return null;
              }
            });

            return subroomResults.filter((entry) => entry !== null);
          } else {
            // Regular room without subrooms - fetch room info to check if it's a sitting room
            const roomInfoResponse = await callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, {
              roomID: room.roomId,
              subroomID: "",
              academicYr: academicYear,
              acadSess: acadSession,
              startDate: academicSessionStartDate,
              endDate: academicSessionEndDate,
            });

            if (roomInfoResponse.success && roomInfoResponse.data) {
              const roomInfo = roomInfoResponse.data;

              // Only return if this is a sitting room
              if (roomInfo.isSitting) {
                const hasActiveOccupant = roomInfo.occupants?.some((occupant) => occupant.isExtendable === true) || false;

                return [
                  {
                    roomId: room.roomId,
                    roomName: room.roomName,
                    buildingId: building.id,
                    buildingName: building.name,
                    isChecked: hasActiveOccupant,
                    hasActiveOccupant,
                  },
                ];
              }
            }
            return [];
          }
        } catch (error) {
          console.error(`Error fetching room info for ${room.roomId}:`, error);
          return [];
        }
      });

      const entries = allRoomInfoResults.flat().filter((entry) => entry !== null) as SittingEntry[];

      setSittingEntries(entries);
    } catch (error) {
      console.error("Error fetching sitting rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (index: number) => {
    setSittingEntries((prev) => prev.map((entry, i) => (i === index ? { ...entry, isChecked: !entry.isChecked } : entry)));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Get all checked entries
      const checkedEntries = sittingEntries.filter((entry) => entry.isChecked);

      // Here you would implement the API call to extend sitting for these entries
      // For now, just log them
      console.log("Extending sitting for:", checkedEntries);

      // Show success message
      alert(`Extended sitting for ${checkedEntries.length} room(s)`);
      onClose();
    } catch (error) {
      console.error("Error extending sitting:", error);
      alert("Failed to extend sitting. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#00000070] bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Extend Sitting</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" disabled={submitting}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <p className="mt-4 text-gray-600">Loading sitting rooms...</p>
              </div>
            </div>
          ) : sittingEntries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No sitting rooms found with active occupants.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sittingEntries.map((entry, index) => (
                <label
                  key={`${entry.roomId}-${entry.subroomId || "main"}`}
                  className="flex items-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={entry.isChecked}
                    onChange={() => handleToggle(index)}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    disabled={submitting}
                  />
                  <div className="ml-4 flex-1">
                    <div className="font-medium text-gray-800">{entry.roomName}</div>
                    <div className="text-sm text-gray-500">{entry.buildingName}</div>
                  </div>
                  {entry.hasActiveOccupant && <span className="ml-2 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded">Active</span>}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-4 p-6 border-t">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors" disabled={submitting}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            disabled={loading || submitting || sittingEntries.filter((e) => e.isChecked).length === 0}
          >
            {submitting ? "Extending..." : "Extend Sitting"}
          </button>
        </div>
      </div>
    </div>
  );
}
