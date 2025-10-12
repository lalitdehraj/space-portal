"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Building, Room, RoomInfo, Occupant } from "@/types";
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
  occupantName?: string;
  occupantId?: string;
  maxEndDate?: Date;
}

export default function ExtendSittingModal({ onClose }: ExtendSittingModalProps) {
  const academicYear = useSelector((state: RootState) => state.dataState.selectedAcademicYear);
  const acadSession = useSelector((state: RootState) => state.dataState.selectedAcademicSession);
  const academicSessionStartDate = useSelector((state: RootState) => state.dataState.selectedAcademicSessionStartDate);
  const academicSessionEndDate = useSelector((state: RootState) => state.dataState.selectedAcademicSessionEndDate);

  const [loading, setLoading] = useState(true);
  const [sittingEntries, setSittingEntries] = useState<SittingEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Helper function to find occupant with maximum scheduledEndDate
  const findOccupantWithMaxEndDate = useCallback((occupants: Occupant[]) => {
    if (!occupants || occupants.length === 0) return null;

    return occupants.reduce((maxOccupant, currentOccupant) => {
      const maxDate = new Date(maxOccupant.scheduledEndDate);
      const currentDate = new Date(currentOccupant.scheduledEndDate);
      return currentDate > maxDate ? currentOccupant : maxOccupant;
    });
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    fetchAllSittingRooms(abortController);

    // Cleanup function: abort all pending requests when component unmounts
    return () => {
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear, acadSession, academicSessionStartDate, academicSessionEndDate]);

  // Helper function to process promises in batches to avoid overwhelming the server
  const processBatch = useCallback(
    async <T,>(items: T[], batchSize: number, processor: (item: T) => Promise<any>, abortSignal?: AbortSignal): Promise<any[]> => {
      const results: any[] = [];
      for (let i = 0; i < items.length; i += batchSize) {
        // Check if requests should be cancelled
        if (abortSignal?.aborted) {
          console.log(`Batch processing cancelled at batch ${i / batchSize + 1}`);
          break;
        }

        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(processor));
        results.push(...batchResults);

        // Yield control back to the browser to prevent frame skipping
        if (i + batchSize < items.length) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      return results;
    },
    []
  );

  const fetchAllSittingRooms = async (abortController: AbortController) => {
    console.log("fetchAllSittingRooms called with:", { academicYear, acadSession, academicSessionStartDate, academicSessionEndDate });

    if (!academicYear || !acadSession || !academicSessionStartDate || !academicSessionEndDate) {
      console.log("Missing required values, keeping loading state true");
      // Keep loading true while waiting for Redux values to be available
      return;
    }

    console.log("Starting to fetch sitting rooms...");
    setLoading(true);
    const abortSignal = abortController.signal;

    try {
      // Step 1: Fetch all buildings
      const buildingsResponse = await callApi<Building[]>(
        process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND,
        {
          acadSession: `${acadSession}`,
          acadYear: `${academicYear}`,
        },
        undefined,
        abortSignal
      );

      // Check if cancelled after first request
      if (abortSignal.aborted) {
        console.log("Request cancelled: buildings fetch completed but component unmounted");
        return;
      }

      if (!buildingsResponse.success || !buildingsResponse.data) {
        // Don't set loading false here - let it stay loading or handle in finally block
        return;
      }

      const buildings = buildingsResponse.data || [];

      // Step 2: Fetch rooms for buildings in batches to avoid overwhelming the server
      const buildingsWithRooms = (
        await processBatch(
          buildings,
          5,
          async (building) => {
            try {
              const roomsResponse = await callApi<Room[]>(
                process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND,
                {
                  buildingNo: building.id,
                  floorID: "",
                  curreentTime: moment().format("HH:mm"),
                },
                undefined,
                abortSignal
              );

              if (!roomsResponse.success || !roomsResponse.data) return null;

              return {
                building,
                rooms: roomsResponse.data || [],
              };
            } catch (error) {
              console.error(`Error fetching rooms for building ${building.id}:`, error);
              return null;
            }
          },
          abortSignal
        )
      ).filter((item) => item !== null);

      // Check if cancelled after fetching rooms
      if (abortSignal.aborted) {
        console.log("Request cancelled: rooms fetch completed but component unmounted");
        return;
      }

      // Step 3: Collect all room processing tasks
      const allRoomTasks = buildingsWithRooms.flatMap(({ building, rooms }) => rooms.map((room: Room) => ({ building, room })));

      // Step 4: Process rooms in batches
      const allRoomInfoResults = await processBatch(
        allRoomTasks,
        8,
        async ({ building, room }) => {
          try {
            // Check if room has subrooms
            if (room.hasSubroom) {
              // Fetch subrooms
              const subroomsResponse = await callApi<Room[]>(
                process.env.NEXT_PUBLIC_GET_SUBROOMS_LIST || URL_NOT_FOUND,
                {
                  roomID: room.roomId,
                  buildingNo: building.id,
                  acadSess: acadSession,
                  acadYr: academicYear,
                },
                undefined,
                abortSignal
              );

              if (!subroomsResponse.success || !subroomsResponse.data) return [];

              const subrooms = subroomsResponse.data || [];

              // Fetch room info for subrooms in batches
              const subroomResults = await processBatch(
                subrooms,
                5,
                async (subroom) => {
                  try {
                    const roomInfoResponse = await callApi<RoomInfo>(
                      process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND,
                      {
                        roomID: room.roomId,
                        subroomID: subroom.roomId,
                        academicYr: academicYear,
                        acadSess: acadSession,
                        startDate: academicSessionStartDate,
                        endDate: academicSessionEndDate,
                      },
                      undefined,
                      abortSignal
                    );

                    if (roomInfoResponse.success && roomInfoResponse.data) {
                      const roomInfo = roomInfoResponse.data;

                      // Only return if this is a sitting room with occupants
                      if (roomInfo.isSitting && roomInfo.occupants && roomInfo.occupants.length > 0) {
                        const hasActiveOccupant = roomInfo.occupants?.some((occupant) => occupant.isExtendable === true) || false;
                        const occupantWithMaxEndDate = findOccupantWithMaxEndDate(roomInfo.occupants);

                        return {
                          roomId: room.roomId,
                          subroomId: subroom.roomId,
                          roomName: `${room.roomName} - ${subroom.roomName}`,
                          buildingId: building.id,
                          buildingName: building.name,
                          isChecked: roomInfo.isSittingActive === true, // Only checked if isSittingActive is true
                          hasActiveOccupant,
                          occupantName: occupantWithMaxEndDate?.occupantName,
                          occupantId: occupantWithMaxEndDate?.occupantId,
                          maxEndDate: occupantWithMaxEndDate?.scheduledEndDate,
                        };
                      }
                    }
                    return null;
                  } catch (error) {
                    console.error(`Error fetching room info for ${room.roomId}-${subroom.roomId}:`, error);
                    return null;
                  }
                },
                abortSignal
              );

              return subroomResults.filter((entry) => entry !== null);
            } else {
              // Regular room without subrooms - fetch room info to check if it's a sitting room
              const roomInfoResponse = await callApi<RoomInfo>(
                process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND,
                {
                  roomID: room.roomId,
                  subroomID: "",
                  academicYr: academicYear,
                  acadSess: acadSession,
                  startDate: academicSessionStartDate,
                  endDate: academicSessionEndDate,
                },
                undefined,
                abortSignal
              );

              if (roomInfoResponse.success && roomInfoResponse.data) {
                const roomInfo = roomInfoResponse.data;

                // Only return if this is a sitting room with occupants
                if (roomInfo.isSitting && roomInfo.occupants && roomInfo.occupants.length > 0) {
                  const hasActiveOccupant = roomInfo.occupants?.some((occupant) => occupant.isExtendable === true) || false;
                  const occupantWithMaxEndDate = findOccupantWithMaxEndDate(roomInfo.occupants);

                  return [
                    {
                      roomId: room.roomId,
                      roomName: room.roomName,
                      buildingId: building.id,
                      buildingName: building.name,
                      isChecked: roomInfo.isSittingActive === true, // Only checked if isSittingActive is true
                      hasActiveOccupant,
                      occupantName: occupantWithMaxEndDate?.occupantName,
                      occupantId: occupantWithMaxEndDate?.occupantId,
                      maxEndDate: occupantWithMaxEndDate?.scheduledEndDate,
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
        },
        abortSignal
      );

      // Check if cancelled after fetching room info
      if (abortSignal.aborted) {
        console.log("Request cancelled: room info fetch completed but component unmounted");
        return;
      }

      const entries = allRoomInfoResults.flat().filter((entry) => entry !== null) as SittingEntry[];

      console.log(`Fetched ${entries.length} sitting room entries`);
      setSittingEntries(entries);
      setLoading(false);
    } catch (error) {
      // Don't show error if it's an abort error
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Requests cancelled due to component unmount");
        return;
      }
      console.error("Error fetching sitting rooms:", error);
      setLoading(false);
    }
  };

  const handleToggle = useCallback((index: number) => {
    setSittingEntries((prev) => prev.map((entry, i) => (i === index ? { ...entry, isChecked: !entry.isChecked } : entry)));
  }, []);

  const checkedEntriesCount = useMemo(() => {
    return sittingEntries.filter((e) => e.isChecked).length;
  }, [sittingEntries]);

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
                <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-600">Loading sitting rooms...</p>
              </div>
            </div>
          ) : sittingEntries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No sitting rooms found with occupants.</p>
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
                    <div className="font-medium text-gray-800">
                      {entry.roomId} • Faculty: {entry.occupantName || "N/A"} ({entry.occupantId || "N/A"})
                    </div>
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
            disabled={loading || submitting || checkedEntriesCount === 0}
          >
            {submitting ? "Extending..." : "Extend Sitting"}
          </button>
        </div>
      </div>
    </div>
  );
}
