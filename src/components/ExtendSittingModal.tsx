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
  maxEndDateOccupant?: Occupant; // Store the full occupant details for API call
}

export default function ExtendSittingModal({ onClose }: ExtendSittingModalProps) {
  const academicYear = useSelector((state: RootState) => state.dataState.selectedAcademicYear);
  const acadSession = useSelector((state: RootState) => state.dataState.selectedAcademicSession);
  const academicSessionStartDate = useSelector((state: RootState) => state.dataState.selectedAcademicSessionStartDate);
  const academicSessionEndDate = useSelector((state: RootState) => state.dataState.selectedAcademicSessionEndDate);

  const [loading, setLoading] = useState(true);
  const [sittingEntries, setSittingEntries] = useState<SittingEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "checked" | "unchecked">("all");
  const [newEndDate, setNewEndDate] = useState<string>(() => moment().add(1, "month").format("YYYY-MM-DD"));

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
                          isChecked: occupantWithMaxEndDate?.isSittingActive === true, // Only checked if occupant's isSittingActive is true
                          hasActiveOccupant,
                          occupantName: occupantWithMaxEndDate?.occupantName,
                          occupantId: occupantWithMaxEndDate?.occupantId,
                          maxEndDate: occupantWithMaxEndDate?.scheduledEndDate,
                          maxEndDateOccupant: occupantWithMaxEndDate || undefined,
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
                      isChecked: occupantWithMaxEndDate?.isSittingActive === true, // Only checked if occupant's isSittingActive is true
                      hasActiveOccupant,
                      occupantName: occupantWithMaxEndDate?.occupantName,
                      occupantId: occupantWithMaxEndDate?.occupantId,
                      maxEndDate: occupantWithMaxEndDate?.scheduledEndDate,
                      maxEndDateOccupant: occupantWithMaxEndDate || undefined,
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

  const handleSelectAll = useCallback(() => {
    setSittingEntries((prev) => prev.map((entry) => ({ ...entry, isChecked: true })));
  }, []);

  const handleUnselectAll = useCallback(() => {
    setSittingEntries((prev) => prev.map((entry) => ({ ...entry, isChecked: false })));
  }, []);

  const checkedEntriesCount = useMemo(() => {
    return sittingEntries.filter((e) => e.isChecked).length;
  }, [sittingEntries]);

  // Filter and search logic
  const filteredEntries = useMemo(() => {
    let filtered = sittingEntries;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((entry) => {
        const roomIdMatch = entry.roomId.toLowerCase().includes(searchLower);
        const occupantNameMatch = entry.occupantName?.toLowerCase().includes(searchLower) || false;
        const occupantIdMatch = entry.occupantId?.toLowerCase().includes(searchLower) || false;
        const buildingNameMatch = entry.buildingName.toLowerCase().includes(searchLower);
        const roomNameMatch = entry.roomName.toLowerCase().includes(searchLower);

        return roomIdMatch || occupantNameMatch || occupantIdMatch || buildingNameMatch || roomNameMatch;
      });
    }

    // Apply status filter
    if (filterStatus === "checked") {
      filtered = filtered.filter((entry) => entry.isChecked);
    } else if (filterStatus === "unchecked") {
      filtered = filtered.filter((entry) => !entry.isChecked);
    }

    return filtered;
  }, [sittingEntries, searchTerm, filterStatus]);

  const handleSubmit = async () => {
    // Validate the new end date
    if (!newEndDate) {
      alert("Please select a new end date.");
      return;
    }

    const selectedDate = moment(newEndDate);
    const today = moment();

    if (selectedDate.isBefore(today, "day")) {
      alert("End date cannot be before today's date.");
      return;
    }

    setSubmitting(true);
    try {
      // Get all checked entries
      const checkedEntries = sittingEntries.filter((entry) => entry.isChecked && entry.maxEndDateOccupant);
      console.log("Checked entries:", checkedEntries);

      if (checkedEntries.length === 0) {
        alert("No rooms selected to extend.");
        setSubmitting(false);
        return;
      }

      let successCount = 0;
      let failureCount = 0;
      const errors: string[] = [];

      // Update each occupant's end date
      for (const entry of checkedEntries) {
        const occupant = entry.maxEndDateOccupant!;

        try {
          const response = await callApi(process.env.NEXT_PUBLIC_UPDATE_SPACE_ALLOCATION_ENTRY || URL_NOT_FOUND, {
            allocationEntNo: occupant.Id,
            isAllocationActive: true,
            roomID: entry.roomId,
            subRoomID: entry.subroomId || "",
            startTime: occupant.startTime ? moment(occupant.startTime, "HH:mm").format("HH:mm:ss") : "",
            endTime: occupant.endTime ? moment(occupant.endTime, "HH:mm").format("HH:mm:ss") : "",
            remarks: "",
            isSittingActive: true,
            scheduledDate: occupant.scheduledDate ? moment(occupant.scheduledDate).format("YYYY-MM-DD") : "",
            allocatedEndDate: newEndDate,
          });

          if (response.success) {
            successCount++;
            console.log(`Successfully updated occupant for room ${entry.roomId}`);
          } else {
            failureCount++;
            errors.push(`Room ${entry.roomId}: ${response.error || "Update failed"}`);
            console.error("Failed to update occupant:", occupant.Id, response);
          }
        } catch (error) {
          failureCount++;
          errors.push(`Room ${entry.roomId}: ${error instanceof Error ? error.message : "Unknown error"}`);
          console.error("Error updating occupant:", error);
        }
      }

      // Show results
      if (successCount > 0 && failureCount === 0) {
        alert(`Successfully extended sitting for ${successCount} room(s) until ${moment(newEndDate).format("DD/MM/YYYY")}`);
        onClose();
      } else if (successCount > 0 && failureCount > 0) {
        alert(
          `Extended sitting for ${successCount} room(s), but ${failureCount} failed.\n\nErrors:\n${errors.slice(0, 5).join("\n")}${
            errors.length > 5 ? `\n... and ${errors.length - 5} more` : ""
          }`
        );
        onClose();
      } else {
        alert(
          `Failed to extend sitting for all rooms.\n\nErrors:\n${errors.slice(0, 5).join("\n")}${
            errors.length > 5 ? `\n... and ${errors.length - 5} more` : ""
          }`
        );
      }
    } catch (error) {
      console.error("Error extending sitting:", error);
      alert("Failed to extend sitting. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="fixed inset-0 z-50 h-screen w-screen bg-[#00000070] flex items-center justify-center text-gray-600">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl px-4 py-3 max-h-[85vh] flex flex-col">
        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Close" disabled={submitting}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Title */}
        <h2 className="font-semibold text-gray-700 mb-3">Extend Sitting</h2>

        {/* Date Selection */}
        <div className="mb-3 bg-orange-50 border border-orange-200 rounded-lg p-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">New End Date *</label>
          <input
            type="date"
            value={newEndDate}
            min={moment().format("YYYY-MM-DD")}
            onChange={(e) => setNewEndDate(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            disabled={loading || submitting}
          />
          <p className="text-xs text-gray-600 mt-1">All selected rooms will have their sitting extended until this date.</p>
        </div>

        {/* Search and Filter Controls */}
        <div className="mb-3 space-y-2">
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
            {/* Search Bar */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search rooms, faculty, or buildings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-[#EBEDF2] bg-[#F5F6F8] py-1.5 pl-8 pr-3 text-sm text-gray-700 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  disabled={loading || submitting}
                />
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Filter and Select All Controls */}
            <div className="flex flex-col sm:flex-row gap-1 items-start sm:items-center">
              {/* Filter Dropdown */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as "all" | "checked" | "unchecked")}
                className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                disabled={loading || submitting}
              >
                <option value="all">All Rooms</option>
                <option value="checked">Checked Only</option>
                <option value="unchecked">Unchecked Only</option>
              </select>

              {/* Select All / Unselect All Buttons */}
              <div className="flex gap-1">
                <button
                  onClick={handleSelectAll}
                  className="px-2 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading || submitting}
                >
                  Select All
                </button>
                <button
                  onClick={handleUnselectAll}
                  className="px-2 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading || submitting}
                >
                  Unselect All
                </button>
              </div>
            </div>
          </div>

          {/* Results Summary */}
          {!loading && sittingEntries.length > 0 && (
            <div className="text-xs text-gray-600">
              Showing {filteredEntries.length} of {sittingEntries.length} rooms
              {searchTerm.trim() && ` (filtered by "${searchTerm}")`}
              {filterStatus !== "all" && ` (${filterStatus} only)`}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
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
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No rooms match your search or filter criteria.</p>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilterStatus("all");
                }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredEntries.map((entry, index) => {
                // Find the original index in sittingEntries for proper toggle handling
                const originalIndex = sittingEntries.findIndex(
                  (originalEntry) => originalEntry.roomId === entry.roomId && originalEntry.subroomId === entry.subroomId
                );
                return (
                  <label
                    key={`${entry.roomId}-${entry.subroomId || "main"}`}
                    className="flex items-center p-2 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow duration-200 cursor-pointer bg-white"
                  >
                    <input
                      type="checkbox"
                      checked={entry.isChecked}
                      onChange={() => handleToggle(originalIndex)}
                      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                      disabled={submitting}
                    />
                    <div className="ml-3 flex-1">
                      <div className="font-medium text-gray-800 text-sm">
                        {entry.roomId} • Faculty: {entry.occupantName || "N/A"} ({entry.occupantId || "N/A"})
                      </div>
                      <div className="text-xs text-gray-500">{entry.buildingName}</div>
                    </div>
                    {entry.hasActiveOccupant && <span className="ml-2 px-1.5 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded">Active</span>}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg shadow-md transition duration-300 bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-50 text-sm"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-3 py-1.5 rounded-lg shadow-md transition duration-300 bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            disabled={loading || submitting || checkedEntriesCount === 0}
          >
            {submitting ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block mr-2"></div>
                Extending...
              </>
            ) : (
              `Extend Sitting (${checkedEntriesCount})`
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
