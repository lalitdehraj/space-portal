"use client";

import React, { useState, useEffect } from "react";
import { RoomInfo, Occupant, Building, Room, Maintenance } from "@/types";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import moment from "moment";
import { checkSlotConflicts, Slot } from "@/utils/slotsHelper";
import { useSelector } from "react-redux";
import { X, Eye } from "lucide-react";
import { RootState } from "@/app/store";

interface MaintenanceModalProps {
  allBuildingsData: Building[];
  onClose: () => void;
  onSuccess: () => void;
  startDate: string;
  endDate: string;
}

interface ConflictInfo {
  occupant: Occupant;
  isEditable: boolean;
  conflictType: "time" | "full";
}

interface MaintenanceConflictInfo {
  maintenance: Maintenance;
  conflictType: "time" | "full";
}

const MaintenanceModal: React.FC<MaintenanceModalProps> = ({ allBuildingsData, onClose, onSuccess, startDate, endDate }) => {
  // Redux selectors for academic year and session
  const academicYear = useSelector((state: RootState) => state.dataState.selectedAcademicYear);
  const academicSession = useSelector((state: RootState) => state.dataState.selectedAcademicSession);

  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedRoomInfo, setSelectedRoomInfo] = useState<RoomInfo | null>(null);
  const [maintenanceDate, setMaintenanceDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [maintenanceType, setMaintenanceType] = useState("routine");
  const [description, setDescription] = useState("");
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [maintenanceConflicts, setMaintenanceConflicts] = useState<MaintenanceConflictInfo[]>([]);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const [selectedConflicts, setSelectedConflicts] = useState<string[]>([]);
  const [selectedMaintenanceConflicts, setSelectedMaintenanceConflicts] = useState<string[]>([]);
  const [conflictRoomSelections, setConflictRoomSelections] = useState<{ [key: string]: string }>({});
  const [conflictDates, setConflictDates] = useState<{ [key: string]: string }>({});
  const [conflictStartTimes, setConflictStartTimes] = useState<{ [key: string]: string }>({});
  const [conflictEndTimes, setConflictEndTimes] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRoomInfo, setIsLoadingRoomInfo] = useState(false);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [subroomsForConflictResolution, setSubroomsForConflictResolution] = useState<Record<string, Room[]>>({});
  const [isLoadingConflictResolutionRooms, setIsLoadingConflictResolutionRooms] = useState(false);
  const [conflictRoomInfos, setConflictRoomInfos] = useState<{ [key: string]: RoomInfo }>({});
  const [isLoadingConflictRoomInfo, setIsLoadingConflictRoomInfo] = useState<{ [key: string]: boolean }>({});
  const [showConflictRoomSchedule, setShowConflictRoomSchedule] = useState<{ [key: string]: boolean }>({});
  const [conflictAvailableSlots, setConflictAvailableSlots] = useState<{ [key: string]: string[] }>({});
  const [conflictRoomConflictStatus, setConflictRoomConflictStatus] = useState<{ [key: string]: boolean }>({});
  const [conflictRoomConflictType, setConflictRoomConflictType] = useState<{ [key: string]: string }>({});
  const [timeValidationErrors, setTimeValidationErrors] = useState<{ [key: string]: string }>({});
  const [existingMaintenanceRecords, setExistingMaintenanceRecords] = useState<Maintenance[]>([]);
  const [roomSearchInput, setRoomSearchInput] = useState("");
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);
  const [roomSearchError, setRoomSearchError] = useState("");
  const [conflictRoomSearchInputs, setConflictRoomSearchInputs] = useState<{ [key: string]: string }>({});
  const [showConflictRoomDropdowns, setShowConflictRoomDropdowns] = useState<{ [key: string]: boolean }>({});
  const [conflictRoomSearchErrors, setConflictRoomSearchErrors] = useState<{ [key: string]: string }>({});

  // Helper function to find a room (either parent room or subroom) by roomId
  const findRoomById = (roomId: string): Room | undefined => {
    // First check in allRooms (parent rooms)
    const parentRoom = allRooms.find((r) => r.roomId === roomId);
    if (parentRoom) return parentRoom;

    // Then check in subrooms
    for (const subrooms of Object.values(subroomsForConflictResolution)) {
      const subroom = subrooms.find((r) => r.roomId === roomId);
      if (subroom) return subroom;
    }

    return undefined;
  };

  // Helper function to format time for display (ensures HH:MM format)
  const formatTimeForDisplay = (time: string): string => {
    if (!time) return "";
    const trimmedTime = time.trim();
    const parts = trimmedTime.split(":");
    if (parts.length === 2) {
      const hours = parts[0].padStart(2, "0");
      const minutes = parts[1].padStart(2, "0");
      return `${hours}:${minutes}`;
    }
    return trimmedTime;
  };

  // Helper function to normalize time for HTML time inputs (handles leading spaces)
  const normalizeTimeForInput = (time: string): string => {
    if (!time) return "";
    const trimmedTime = time.trim();
    const parts = trimmedTime.split(":");
    if (parts.length === 2) {
      const hours = parts[0].padStart(2, "0");
      const minutes = parts[1].padStart(2, "0");
      return `${hours}:${minutes}`;
    }
    return trimmedTime;
  };

  // Validation functions for past time slots
  const validateTimeSlot = (date: string, startTime: string, endTime: string, fieldKey: string) => {
    const now = moment();
    const selectedDate = moment(date);
    const selectedStartTime = moment(`${date} ${startTime}`, "YYYY-MM-DD HH:mm");
    const selectedEndTime = moment(`${date} ${endTime}`, "YYYY-MM-DD HH:mm");

    // Check if date is in the past
    if (selectedDate.isBefore(now, "day")) {
      setTimeValidationErrors((prev) => ({ ...prev, [fieldKey]: "Cannot schedule in the past" }));
      return false;
    }

    // Check if time is in the past for today
    if (selectedDate.isSame(now, "day") && selectedStartTime.isBefore(now)) {
      setTimeValidationErrors((prev) => ({ ...prev, [fieldKey]: "Start time cannot be in the past" }));
      return false;
    }

    // Check if end time is before start time
    if (selectedEndTime.isBefore(selectedStartTime)) {
      setTimeValidationErrors((prev) => ({ ...prev, [fieldKey]: "End time must be after start time" }));
      return false;
    }

    // Clear any existing error
    setTimeValidationErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fieldKey];
      return newErrors;
    });

    return true;
  };

  // Fetch all rooms from all buildings and floors
  const fetchAllRooms = async () => {
    if (!allBuildingsData.length) return;

    setIsLoadingRooms(true);
    try {
      const rooms: Room[] = [];
      const currentTime = moment().format("HH:mm");

      // Fetch rooms for each building using empty floorID to get all rooms
      for (const building of allBuildingsData) {
        try {
          const response = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, {
            buildingNo: building.id,
            floorID: "",
            curreentTime: currentTime,
          });
          if (response.success && response.data) {
            rooms.push(...response.data);
          }
        } catch (error) {
          console.error(`Error fetching rooms for building ${building.id}:`, error);
        }
      }

      setAllRooms(rooms);
    } catch (error) {
      console.error("Error fetching all rooms:", error);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  // Fetch all rooms when component mounts or buildings data changes
  useEffect(() => {
    if (allBuildingsData.length > 0) {
      fetchAllRooms();
    }
  }, [allBuildingsData]);

  // Fetch subrooms for all buildings
  const fetchSubroomsForConflictResolution = async () => {
    if (!academicYear || !academicSession) return;

    setIsLoadingConflictResolutionRooms(true);
    try {
      const subroomsMap: Record<string, Room[]> = {};

      // Get unique buildings from allRooms
      const uniqueBuildings = [...new Set(allRooms.map((room) => room.buildingId))];

      // Fetch all subrooms for each building at once using blank roomID
      for (const buildingId of uniqueBuildings) {
        try {
          const response = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_SUBROOMS_LIST || URL_NOT_FOUND, {
            roomID: "", // Use blank roomID to get all subrooms for the building
            buildingNo: buildingId,
            acadSess: academicSession,
            acadYr: academicYear,
          });

          if (response.success && response.data) {
            // Group subrooms by their parent room ID
            response.data.forEach((subroom) => {
              if (subroom.parentId) {
                if (!subroomsMap[subroom.parentId]) {
                  subroomsMap[subroom.parentId] = [];
                }
                subroomsMap[subroom.parentId].push(subroom);
              }
            });
          }
        } catch (error) {
          console.error(`Error fetching subrooms for building ${buildingId}:`, error);
        }
      }

      setSubroomsForConflictResolution(subroomsMap);
    } catch (error) {
      console.error("Error fetching subrooms for conflict resolution:", error);
    } finally {
      setIsLoadingConflictResolutionRooms(false);
    }
  };

  // Fetch subrooms when allRooms are loaded
  useEffect(() => {
    if (allRooms.length > 0 && academicYear && academicSession) {
      fetchSubroomsForConflictResolution();
    }
  }, [allRooms, academicYear, academicSession]);

  // Fetch conflict resolution room data as soon as conflicts are detected
  useEffect(() => {
    if (conflicts.length > 0 && allRooms.length > 0 && academicYear && academicSession) {
      // Ensure subrooms are fetched for conflict resolution
      if (Object.keys(subroomsForConflictResolution).length === 0) {
        fetchSubroomsForConflictResolution();
      }
    }
  }, [conflicts, allRooms, academicYear, academicSession, subroomsForConflictResolution]);

  // Fetch existing maintenance records
  const fetchExistingMaintenanceRecords = async () => {
    try {
      const response = await callApi<Maintenance[]>(process.env.NEXT_PUBLIC_GET_MAINTENANCE_DATA || URL_NOT_FOUND);
      if (response.success && response.data) {
        setExistingMaintenanceRecords(response.data);
      }
    } catch (error) {
      console.error("Error fetching maintenance records:", error);
    }
  };

  useEffect(() => {
    fetchExistingMaintenanceRecords();
  }, []);

  // Fetch room info when room is selected
  const fetchRoomInfo = async (roomId: string) => {
    if (!roomId || !academicYear || !academicSession || !startDate || !endDate) return;

    setIsLoadingRoomInfo(true);
    try {
      // Find the room (either parent room or subroom) to determine if it's a subroom
      const room = findRoomById(roomId);

      const requestbody = {
        roomID: room?.parentId || roomId, // Use parentId if it exists (subroom), otherwise use roomId (regular room)
        subroomID: room?.parentId ? roomId : "", // If parentId exists, this is a subroom, so use roomId as subroomID
        academicYr: academicYear,
        acadSess: academicSession,
        startDate: startDate,
        endDate: endDate,
      };

      const res = await callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, requestbody);
      if (res.success && res.data) {
        setSelectedRoomInfo(res.data);
      }
    } catch (error) {
      console.error("Error fetching room info:", error);
    } finally {
      setIsLoadingRoomInfo(false);
    }
  };

  // Filter rooms based on search input
  const filteredRooms = allRooms.filter((room) => {
    const building = allBuildingsData.find((b) => b.id === room.buildingId);
    const floor = building?.floors.find((f) => f.id === room.floorId);
    const roomDisplayText = `${building?.name} ${floor?.name ? `- ${floor?.name}` : ""} - ${room.roomName} ${
      room?.roomType ? `(${room.roomType})` : ""
    }`.toLowerCase();
    return roomDisplayText.includes(roomSearchInput.toLowerCase());
  });

  // Filter conflict rooms based on search input
  const getFilteredConflictRooms = (conflictId: string) => {
    const searchInput = conflictRoomSearchInputs[conflictId] || "";

    // Get all available rooms (regular rooms + subrooms)
    const regularRooms = allRooms.filter((room) => !room.hasSubroom);
    const allSubrooms: Room[] = [];
    Object.values(subroomsForConflictResolution).forEach((subrooms) => {
      allSubrooms.push(...subrooms);
    });
    const allAvailableRooms = [...regularRooms, ...allSubrooms];

    return allAvailableRooms.filter((room) => {
      const building = allBuildingsData.find((b) => b.id === room.buildingId);
      const isSubroom = allSubrooms.includes(room);

      // Find parent room for subrooms
      let parentRoomId = "";
      if (isSubroom) {
        for (const [parentId, subrooms] of Object.entries(subroomsForConflictResolution)) {
          if (subrooms.some((subroom) => subroom.roomId === room.roomId)) {
            parentRoomId = parentId;
            break;
          }
        }
      }

      // Format the display text based on room type
      let roomDisplayText = "";
      const capacity = room.roomCapactiy && room.roomCapactiy > 0 ? room.roomCapactiy : null;

      if (isSubroom) {
        roomDisplayText = `${building?.name} - ${parentRoomId} - ${room.roomId}${capacity ? ` - ${capacity}` : ""}`;
      } else {
        roomDisplayText = `${building?.name} - ${room.roomId}${capacity ? ` - ${capacity}` : ""}`;
      }

      return roomDisplayText.toLowerCase().includes(searchInput.toLowerCase());
    });
  };

  // Handle room selection
  const handleRoomSelection = (roomId: string) => {
    setSelectedRoomId(roomId);
    setConflicts([]);
    setSelectedConflicts([]);
    setMaintenanceDate("");
    setStartTime("09:00");
    setEndTime("10:00");
    // Clear conflict-specific states
    setConflictRoomSelections({});
    setConflictDates({});
    setConflictStartTimes({});
    setConflictEndTimes({});
    setConflictRoomInfos({});
    setIsLoadingConflictRoomInfo({});
    setShowConflictRoomSchedule({});
    setConflictAvailableSlots({});
    setConflictRoomConflictStatus({});
    setConflictRoomConflictType({});

    // Set the selected room display text in the search input
    if (roomId) {
      const selectedRoom = allRooms.find((room) => room.roomId === roomId);
      if (selectedRoom) {
        const building = allBuildingsData.find((b) => b.id === selectedRoom.buildingId);
        const floor = building?.floors.find((f) => f.id === selectedRoom.floorId);
        const roomDisplayText = `${building?.name} ${floor?.name ? `- ${floor?.name}` : ""} - ${selectedRoom.roomName} ${
          selectedRoom?.roomType ? `(${selectedRoom.roomType})` : ""
        }`;
        setRoomSearchInput(roomDisplayText);
        // Clear any search errors when valid room is selected
        setRoomSearchError("");
      }
      // Fetch room info for the selected room only
      fetchRoomInfo(roomId);
    } else {
      setRoomSearchInput("");
      setSelectedRoomInfo(null);
      setRoomSearchError("");
    }
    setShowRoomDropdown(false);
  };

  // Handle search input change
  const handleRoomSearchChange = (value: string) => {
    setRoomSearchInput(value);
    setShowRoomDropdown(true); // Always show dropdown when typing

    // Clear any previous errors
    setRoomSearchError("");

    // If input is cleared, clear selection
    if (value === "") {
      setSelectedRoomId("");
      setSelectedRoomInfo(null);
    } else {
      // Check if the entered value matches any room
      const matchingRooms = allRooms.filter((room) => {
        const building = allBuildingsData.find((b) => b.id === room.buildingId);
        const floor = building?.floors.find((f) => f.id === room.floorId);
        const roomDisplayText = `${building?.name} ${floor?.name ? `- ${floor?.name}` : ""} - ${room.roomName} ${
          room?.roomType ? `(${room.roomType})` : ""
        }`.toLowerCase();
        return roomDisplayText.includes(value.toLowerCase());
      });

      // If no matching rooms found and user has typed something, show warning
      if (matchingRooms.length === 0 && value.trim().length > 0) {
        setRoomSearchError("No rooms found matching your search. Please select from the dropdown.");
      }
    }
  };

  // Handle conflict room search input change
  const handleConflictRoomSearchChange = (conflictId: string, value: string) => {
    setConflictRoomSearchInputs((prev) => ({ ...prev, [conflictId]: value }));
    setShowConflictRoomDropdowns((prev) => ({ ...prev, [conflictId]: true }));

    // Clear any previous errors
    setConflictRoomSearchErrors((prev) => ({ ...prev, [conflictId]: "" }));

    // If input is cleared, clear selection
    if (value === "") {
      setConflictRoomSelections((prev) => {
        const newSelections = { ...prev };
        delete newSelections[conflictId];
        return newSelections;
      });
    } else {
      // Check if the entered value matches any room
      const matchingRooms = getFilteredConflictRooms(conflictId);

      // If no matching rooms found and user has typed something, show warning
      if (matchingRooms.length === 0 && value.trim().length > 0) {
        setConflictRoomSearchErrors((prev) => ({ ...prev, [conflictId]: "No rooms found matching your search. Please select from the dropdown." }));
      }
    }
  };

  // Handle conflict room selection
  const handleConflictRoomSelection = (conflictId: string, roomId: string) => {
    setConflictRoomSelections((prev) => ({ ...prev, [conflictId]: roomId }));

    // Set the selected room display text in the search input
    if (roomId) {
      // Get all available rooms to find the selected room
      const regularRooms = allRooms.filter((room) => !room.hasSubroom);
      const allSubrooms: Room[] = [];
      Object.values(subroomsForConflictResolution).forEach((subrooms) => {
        allSubrooms.push(...subrooms);
      });
      const allAvailableRooms = [...regularRooms, ...allSubrooms];

      const selectedRoom = allAvailableRooms.find((room) => room.roomId === roomId);
      if (selectedRoom) {
        const building = allBuildingsData.find((b) => b.id === selectedRoom.buildingId);
        const isSubroom = allSubrooms.includes(selectedRoom);

        // Find parent room for subrooms
        let parentRoomId = "";
        if (isSubroom) {
          for (const [parentId, subrooms] of Object.entries(subroomsForConflictResolution)) {
            if (subrooms.some((subroom) => subroom.roomId === selectedRoom.roomId)) {
              parentRoomId = parentId;
              break;
            }
          }
        }

        // Format the display text based on room type
        let roomDisplayText = "";
        const capacity = selectedRoom.roomCapactiy && selectedRoom.roomCapactiy > 0 ? selectedRoom.roomCapactiy : null;

        if (isSubroom) {
          roomDisplayText = `${building?.name} - ${parentRoomId} - ${selectedRoom.roomId}${capacity ? ` - ${capacity}` : ""}`;
        } else {
          roomDisplayText = `${building?.name} - ${selectedRoom.roomId}${capacity ? ` - ${capacity}` : ""}`;
        }

        setConflictRoomSearchInputs((prev) => ({ ...prev, [conflictId]: roomDisplayText }));
        // Clear any search errors when valid room is selected
        setConflictRoomSearchErrors((prev) => ({ ...prev, [conflictId]: "" }));
      }

      // Fetch room info for the selected room
      fetchConflictRoomInfo(conflictId, roomId);
      // Clear conflict status when room changes
      setConflictRoomConflictStatus((prev) => ({ ...prev, [conflictId]: false }));
      setConflictRoomConflictType((prev) => ({ ...prev, [conflictId]: "" }));

      // Immediately check for conflicts if we have all required data
      const date = conflictDates[conflictId];
      const startTime = conflictStartTimes[conflictId];
      const endTime = conflictEndTimes[conflictId];
      if (date && startTime && endTime) {
        checkConflictRoomConflicts(conflictId, roomId, date, startTime, endTime);
      }
    } else {
      setConflictRoomSearchInputs((prev) => ({ ...prev, [conflictId]: "" }));
      setConflictRoomInfos((prev) => {
        const newInfos = { ...prev };
        delete newInfos[conflictId];
        return newInfos;
      });
      setConflictRoomSearchErrors((prev) => ({ ...prev, [conflictId]: "" }));
    }

    setShowConflictRoomDropdowns((prev) => ({ ...prev, [conflictId]: false }));
  };

  // Check for conflicts when maintenance details change
  useEffect(() => {
    if (maintenanceDate && startTime && endTime && selectedRoomInfo) {
      checkConflicts();
    } else {
      // Clear conflicts if not all required fields are present
      setConflicts([]);
      setMaintenanceConflicts([]);
    }
  }, [maintenanceDate, startTime, endTime, selectedRoomInfo]);

  // Check for conflicts immediately when room info is loaded (for initial room selection)
  useEffect(() => {
    if (selectedRoomInfo && !maintenanceDate && !startTime && !endTime) {
      // Show room info but don't check conflicts until maintenance details are provided
      setConflicts([]);
      setMaintenanceConflicts([]);
    }
  }, [selectedRoomInfo]);

  // Trigger conflict checks when conflict room info is loaded
  useEffect(() => {
    Object.keys(conflictRoomInfos).forEach((conflictId) => {
      const roomInfo = conflictRoomInfos[conflictId];
      const roomId = conflictRoomSelections[conflictId];
      const date = conflictDates[conflictId];
      const startTime = conflictStartTimes[conflictId];
      const endTime = conflictEndTimes[conflictId];

      if (roomInfo && roomId && date && startTime && endTime) {
        checkConflictRoomConflicts(conflictId, roomId, date, startTime, endTime);
      }
    });
  }, [conflictRoomInfos]);

  // Fetch conflict room info when room is selected for a specific conflict
  const fetchConflictRoomInfo = async (conflictId: string, roomId: string) => {
    if (!roomId || !academicYear || !academicSession || !startDate || !endDate) return;

    setIsLoadingConflictRoomInfo((prev) => ({ ...prev, [conflictId]: true }));
    try {
      // Find the room (either parent room or subroom) to determine if it's a subroom
      const room = findRoomById(roomId);

      const requestbody = {
        roomID: room?.parentId || roomId, // Use parentId if it exists (subroom), otherwise use roomId (regular room)
        subroomID: room?.parentId ? roomId : "", // If parentId exists, this is a subroom, so use roomId as subroomID
        academicYr: academicYear,
        acadSess: academicSession,
        startDate: startDate,
        endDate: endDate,
      };
      const res = await callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, requestbody);
      if (res.success && res.data) {
        setConflictRoomInfos((prev) => ({ ...prev, [conflictId]: res.data! }));
        // Calculate available slots for the conflict date if it's set
        const conflictDate = conflictDates[conflictId];
        if (conflictDate) {
          calculateConflictAvailableSlots(conflictId, res.data, conflictDate, roomId);
        }

        // Trigger conflict check after room info is loaded
        const date = conflictDates[conflictId];
        const startTime = conflictStartTimes[conflictId];
        const endTime = conflictEndTimes[conflictId];
        if (date && startTime && endTime) {
          checkConflictRoomConflicts(conflictId, roomId, date, startTime, endTime);
        }
      }
    } catch (error) {
      console.error("Error fetching conflict room info:", error);
    } finally {
      setIsLoadingConflictRoomInfo((prev) => ({ ...prev, [conflictId]: false }));
    }
  };

  // Calculate available slots for a given conflict room and date
  const calculateConflictAvailableSlots = (conflictId: string, roomInfo: RoomInfo, date: string, roomId?: string) => {
    const today = new Date().toISOString().split("T")[0];
    const currentTime = new Date();
    if (new Date(date) < new Date(today)) {
      setConflictAvailableSlots((prev) => ({ ...prev, [conflictId]: [] }));
      return;
    }

    const workingStart = 9 * 60; // 9:00 AM in minutes
    const workingEnd = 18 * 60; // 6:00 PM in minutes

    // Get occupants intervals
    const occupantIntervals = (roomInfo.occupants || [])
      .filter((occupant) => {
        const occupantDate = moment(occupant.scheduledDate).format("YYYY-MM-DD");
        return occupantDate === date;
      })
      .map((occupant) => ({
        start: parseInt(occupant.startTime.split(":")[0]) * 60 + parseInt(occupant.startTime.split(":")[1]),
        end: parseInt(occupant.endTime.split(":")[0]) * 60 + parseInt(occupant.endTime.split(":")[1]),
      }));

    // Get maintenance intervals for the same room and date
    const maintenanceIntervals = existingMaintenanceRecords
      .filter((maintenance) => {
        // Only consider active maintenance records
        if (!maintenance.isMainteneceActive) return false;

        // Check if maintenance is for the same room
        if (roomId && maintenance.roomid !== roomId) return false;

        // Check if maintenance is on the same date
        const maintenanceDate = moment(maintenance.maintanceDate).format("YYYY-MM-DD");
        return maintenanceDate === date;
      })
      .map((maintenance) => {
        // Parse maintenance times - handle both formats
        const startTime = maintenance.startTime.includes("T") ? maintenance.startTime.split("T")[1]?.split(":").slice(0, 2).join(":") : maintenance.startTime;
        const endTime = maintenance.endTime.includes("T") ? maintenance.endTime.split("T")[1]?.split(":").slice(0, 2).join(":") : maintenance.endTime;

        return {
          start: parseInt(startTime.split(":")[0]) * 60 + parseInt(startTime.split(":")[1]),
          end: parseInt(endTime.split(":")[0]) * 60 + parseInt(endTime.split(":")[1]),
        };
      });

    // Combine all occupied intervals (occupants + maintenance)
    const occupiedIntervals = [...occupantIntervals, ...maintenanceIntervals].sort((a, b) => a.start - b.start);

    const freeIntervals: { start: number; end: number }[] = [];
    let currentPosition = workingStart;

    // If it's today, start from current time
    if (date === today) {
      const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
      currentPosition = Math.max(currentPosition, currentMinutes);
    }

    occupiedIntervals.forEach((interval) => {
      if (currentPosition < interval.start) {
        freeIntervals.push({ start: currentPosition, end: interval.start });
      }
      currentPosition = Math.max(currentPosition, interval.end);
    });

    if (currentPosition < workingEnd) {
      freeIntervals.push({ start: currentPosition, end: workingEnd });
    }

    const slots = freeIntervals.map((interval) => {
      const startHour = String(Math.floor(interval.start / 60)).padStart(2, "0");
      const startMin = String(interval.start % 60).padStart(2, "0");
      const endHour = String(Math.floor(interval.end / 60)).padStart(2, "0");
      const endMin = String(interval.end % 60).padStart(2, "0");
      return `${startHour}:${startMin} → ${endHour}:${endMin}`;
    });

    setConflictAvailableSlots((prev) => ({ ...prev, [conflictId]: slots }));
  };

  // Handle available slot selection for conflicts
  const handleConflictAvailableSlotClick = (conflictId: string, timeString: string) => {
    const [start, end] = timeString.split(" → ");
    setConflictStartTimes((prev) => ({ ...prev, [conflictId]: start }));
    setConflictEndTimes((prev) => ({ ...prev, [conflictId]: end }));

    // Trigger conflict check after setting the times
    const roomId = conflictRoomSelections[conflictId];
    const date = conflictDates[conflictId];
    if (roomId && date && start && end) {
      checkConflictRoomConflicts(conflictId, roomId, date, start, end);
    }
  };

  const checkConflicts = async () => {
    if (!selectedRoomInfo || !maintenanceDate || !startTime || !endTime) return;

    setIsCheckingConflicts(true);
    try {
      // Convert maintenance details to Slot format
      const maintenanceSlot: Slot = {
        id: `${maintenanceDate},${startTime},${endTime}`,
        date: maintenanceDate,
        start: startTime,
        end: endTime,
      };

      // Convert occupants to Slot format
      const existingSlots: Slot[] =
        selectedRoomInfo.occupants?.map((occupant) => {
          const occupantDate = moment(occupant.scheduledDate).format("YYYY-MM-DD");
          return {
            id: `${occupantDate},${occupant.startTime},${occupant.endTime}`,
            date: occupantDate,
            start: occupant.startTime,
            end: occupant.endTime,
          };
        }) || [];

      // Use the proven conflict detection function from slotsHelper
      // const conflictingSlots = checkSlotConflicts([maintenanceSlot], existingSlots);

      // Find the actual occupants that conflict with the maintenance slot
      // Since checkSlotConflicts returns the NEW slots that conflict, we need to find
      // which existing occupants overlap with our maintenance slot
      const conflictingOccupants =
        selectedRoomInfo.occupants?.filter((occupant) => {
          const occupantStartDate = moment(occupant.scheduledDate).format("YYYY-MM-DD");
          const occupantEndDate = moment(occupant.scheduledEndDate).format("YYYY-MM-DD");

          // Check if the maintenance date falls within the occupant's date range
          const maintenanceDateMoment = moment(maintenanceDate);
          const occupantStartMoment = moment(occupantStartDate);
          const occupantEndMoment = moment(occupantEndDate);

          // Only check occupants whose date range includes the maintenance date
          if (!maintenanceDateMoment.isBetween(occupantStartMoment, occupantEndMoment, "day", "[]")) {
            return false;
          }

          // Check for time overlap using the same logic as checkSlotConflicts
          const maintenanceStart = moment(`${maintenanceDate} ${startTime}`, "YYYY-MM-DD HH:mm");
          const maintenanceEnd = moment(`${maintenanceDate} ${endTime}`, "YYYY-MM-DD HH:mm");
          const occupantStart = moment(`${maintenanceDate} ${occupant.startTime}`, "YYYY-MM-DD HH:mm");
          const occupantEnd = moment(`${maintenanceDate} ${occupant.endTime}`, "YYYY-MM-DD HH:mm");

          const overlaps = maintenanceStart.isBefore(occupantEnd) && maintenanceEnd.isAfter(occupantStart);

          return overlaps;
        }) || [];

      const conflictInfo: ConflictInfo[] = conflictingOccupants.map((occupant) => {
        const maintenanceStart = moment(`${maintenanceDate} ${startTime}`, "YYYY-MM-DD HH:mm");
        const maintenanceEnd = moment(`${maintenanceDate} ${endTime}`, "YYYY-MM-DD HH:mm");
        const occupantStart = moment(`${maintenanceDate} ${occupant.startTime}`, "YYYY-MM-DD HH:mm");
        const occupantEnd = moment(`${maintenanceDate} ${occupant.endTime}`, "YYYY-MM-DD HH:mm");

        // Determine conflict type
        const isFullConflict = maintenanceStart.isSameOrBefore(occupantStart) && maintenanceEnd.isSameOrAfter(occupantEnd);

        return {
          occupant,
          isEditable: occupant.isEditable === "true",
          conflictType: isFullConflict ? "full" : "time",
        };
      });

      setConflicts(conflictInfo);

      const conflictingMaintenanceRecords = existingMaintenanceRecords.filter((maintenance) => {
        // Only check maintenance records for the same room
        if (maintenance.roomid !== selectedRoomId) {
          return false;
        }

        // Only check active maintenance records
        if (!maintenance.isMainteneceActive) {
          return false;
        }

        const existingMaintenanceDate = moment(maintenance.maintanceDate).format("YYYY-MM-DD");

        // Only check maintenance on the same date
        if (existingMaintenanceDate !== maintenanceDate) {
          return false;
        }

        // Check for time overlap
        const newMaintenanceStart = moment(`${maintenanceDate} ${startTime}`, "YYYY-MM-DD HH:mm");
        const newMaintenanceEnd = moment(`${maintenanceDate} ${endTime}`, "YYYY-MM-DD HH:mm");

        // Parse existing maintenance times - handle both formats
        const existingStartTime = maintenance.startTime.includes("T")
          ? maintenance.startTime.split("T")[1]?.split(":").slice(0, 2).join(":")
          : maintenance.startTime;
        const existingEndTime = maintenance.endTime.includes("T") ? maintenance.endTime.split("T")[1]?.split(":").slice(0, 2).join(":") : maintenance.endTime;

        const existingMaintenanceStart = moment(`${maintenanceDate} ${existingStartTime}`, "YYYY-MM-DD HH:mm");
        const existingMaintenanceEnd = moment(`${maintenanceDate} ${existingEndTime}`, "YYYY-MM-DD HH:mm");

        const overlaps = newMaintenanceStart.isBefore(existingMaintenanceEnd) && newMaintenanceEnd.isAfter(existingMaintenanceStart);

        return overlaps;
      });

      const maintenanceConflictInfo: MaintenanceConflictInfo[] = conflictingMaintenanceRecords.map((maintenance) => {
        const existingMaintenanceDate = moment(maintenance.maintanceDate).format("YYYY-MM-DD");
        const newMaintenanceStart = moment(`${maintenanceDate} ${startTime}`, "YYYY-MM-DD HH:mm");
        const newMaintenanceEnd = moment(`${maintenanceDate} ${endTime}`, "YYYY-MM-DD HH:mm");

        // Parse existing maintenance times - handle both formats
        const existingStartTime = maintenance.startTime.includes("T")
          ? maintenance.startTime.split("T")[1]?.split(":").slice(0, 2).join(":")
          : maintenance.startTime;
        const existingEndTime = maintenance.endTime.includes("T") ? maintenance.endTime.split("T")[1]?.split(":").slice(0, 2).join(":") : maintenance.endTime;

        const existingMaintenanceStart = moment(`${existingMaintenanceDate} ${existingStartTime}`, "YYYY-MM-DD HH:mm");
        const existingMaintenanceEnd = moment(`${existingMaintenanceDate} ${existingEndTime}`, "YYYY-MM-DD HH:mm");

        // Determine conflict type
        const isFullConflict = newMaintenanceStart.isSameOrBefore(existingMaintenanceStart) && newMaintenanceEnd.isSameOrAfter(existingMaintenanceEnd);

        return {
          maintenance,
          conflictType: isFullConflict ? "full" : "time",
        };
      });

      setMaintenanceConflicts(maintenanceConflictInfo);
    } catch (error) {
      console.error("Error checking conflicts:", error);
    } finally {
      setIsCheckingConflicts(false);
    }
  };

  const handleMaintenanceConflictSelection = (maintenanceId: string) => {
    setSelectedMaintenanceConflicts((prev) => {
      return prev.includes(maintenanceId) ? prev.filter((id) => id !== maintenanceId) : [...prev, maintenanceId];
    });
  };

  const handleConflictSelection = (occupantId: string) => {
    setSelectedConflicts((prev) => {
      const isCurrentlySelected = prev.includes(occupantId);
      const newSelection = prev.includes(occupantId) ? prev.filter((id) => id !== occupantId) : [...prev, occupantId];

      // If checking the checkbox (adding to selection), auto-fill the details
      if (!isCurrentlySelected) {
        const selectedConflict = conflicts.find((c) => c.occupant.Id === occupantId);
        if (selectedConflict) {
          const occupant = selectedConflict.occupant;

          // Auto-fill the conflict-specific details using the maintenance date
          setConflictDates((prev) => ({ ...prev, [occupantId]: maintenanceDate }));
          setConflictStartTimes((prev) => ({ ...prev, [occupantId]: normalizeTimeForInput(occupant.startTime) }));
          setConflictEndTimes((prev) => ({ ...prev, [occupantId]: normalizeTimeForInput(occupant.endTime) }));
        }
      } else {
        // If unchecking, clear the conflict-specific details
        setConflictRoomSelections((prev) => {
          const newSelections = { ...prev };
          delete newSelections[occupantId];
          return newSelections;
        });
        setConflictDates((prev) => {
          const newDates = { ...prev };
          delete newDates[occupantId];
          return newDates;
        });
        setConflictStartTimes((prev) => {
          const newTimes = { ...prev };
          delete newTimes[occupantId];
          return newTimes;
        });
        setConflictEndTimes((prev) => {
          const newTimes = { ...prev };
          delete newTimes[occupantId];
          return newTimes;
        });
        setConflictRoomInfos((prev) => {
          const newInfos = { ...prev };
          delete newInfos[occupantId];
          return newInfos;
        });
        setConflictAvailableSlots((prev) => {
          const newSlots = { ...prev };
          delete newSlots[occupantId];
          return newSlots;
        });
        setConflictRoomConflictStatus((prev) => {
          const newStatus = { ...prev };
          delete newStatus[occupantId];
          return newStatus;
        });
        setConflictRoomConflictType((prev) => {
          const newType = { ...prev };
          delete newType[occupantId];
          return newType;
        });
        setShowConflictRoomSchedule((prev) => {
          const newSchedule = { ...prev };
          delete newSchedule[occupantId];
          return newSchedule;
        });
        // Clear search states
        setConflictRoomSearchInputs((prev) => {
          const newInputs = { ...prev };
          delete newInputs[occupantId];
          return newInputs;
        });
        setShowConflictRoomDropdowns((prev) => {
          const newDropdowns = { ...prev };
          delete newDropdowns[occupantId];
          return newDropdowns;
        });
        setConflictRoomSearchErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[occupantId];
          return newErrors;
        });
      }

      return newSelection;
    });
  };

  const checkConflictRoomConflicts = async (conflictId: string, roomId: string, date: string, newStartTime: string, newEndTime: string) => {
    const roomInfo = conflictRoomInfos[conflictId];
    if (!roomInfo || !date || !newStartTime || !newEndTime) {
      // Set conflict status to false when data is missing
      setConflictRoomConflictStatus((prev) => ({ ...prev, [conflictId]: false }));
      setConflictRoomConflictType((prev) => ({ ...prev, [conflictId]: "" }));
      return false;
    }

    try {
      const newSlotStart = moment(`${date} ${newStartTime}`, "YYYY-MM-DD HH:mm");
      const newSlotEnd = moment(`${date} ${newEndTime}`, "YYYY-MM-DD HH:mm");

      // Check if the new room is the same as the maintenance room and time overlaps
      if (roomId === selectedRoomId && date === maintenanceDate) {
        const maintenanceStart = moment(`${maintenanceDate} ${startTime}`, "YYYY-MM-DD HH:mm");
        const maintenanceEnd = moment(`${maintenanceDate} ${endTime}`, "YYYY-MM-DD HH:mm");

        // Check if the new slot overlaps with the maintenance time
        if (newSlotStart.isBefore(maintenanceEnd) && newSlotEnd.isAfter(maintenanceStart)) {
          setConflictRoomConflictStatus((prev) => ({ ...prev, [conflictId]: true }));
          setConflictRoomConflictType((prev) => ({ ...prev, [conflictId]: "maintenance" }));
          return true; // Conflict with maintenance time
        }
      }

      // NEW: Check if trying to resolve to a subroom of the same parent room during maintenance timeframe
      if (maintenanceDate && startTime && endTime) {
        const maintenanceStart = moment(`${maintenanceDate} ${startTime}`, "YYYY-MM-DD HH:mm");
        const maintenanceEnd = moment(`${maintenanceDate} ${endTime}`, "YYYY-MM-DD HH:mm");

        // Check if the new slot overlaps with maintenance time
        const timeOverlaps = newSlotStart.isBefore(maintenanceEnd) && newSlotEnd.isAfter(maintenanceStart);

        if (timeOverlaps && date === maintenanceDate) {
          // Find the new room to check if it's a subroom
          const newRoom = findRoomById(roomId);
          const selectedRoom = findRoomById(selectedRoomId);

          // Check if new room is a subroom of the same parent room as the maintenance room
          if (newRoom && selectedRoom && newRoom.parentId && selectedRoom.parentId) {
            // Both are subrooms of the same parent
            if (newRoom.parentId === selectedRoom.parentId) {
              setConflictRoomConflictStatus((prev) => ({ ...prev, [conflictId]: true }));
              setConflictRoomConflictType((prev) => ({ ...prev, [conflictId]: "subroom" }));
              return true;
            }
          } else if (newRoom && selectedRoom && newRoom.parentId && !selectedRoom.parentId) {
            // New room is subroom, selected room is parent
            if (newRoom.parentId === selectedRoomId) {
              setConflictRoomConflictStatus((prev) => ({ ...prev, [conflictId]: true }));
              setConflictRoomConflictType((prev) => ({ ...prev, [conflictId]: "subroom" }));
              return true;
            }
          } else if (newRoom && selectedRoom && !newRoom.parentId && selectedRoom.parentId) {
            // New room is parent, selected room is subroom
            if (roomId === selectedRoom.parentId) {
              setConflictRoomConflictStatus((prev) => ({ ...prev, [conflictId]: true }));
              setConflictRoomConflictType((prev) => ({ ...prev, [conflictId]: "subroom" }));
              return true;
            }
          }
        }
      }

      // Check for conflicts with existing occupants in the new room
      const conflictingOccupants = (roomInfo.occupants || []).filter((occupant: Occupant) => {
        const occupantDate = moment(occupant.scheduledDate);
        const occupantStart = moment(`${occupantDate.format("YYYY-MM-DD")} ${occupant.startTime}`, "YYYY-MM-DD HH:mm");
        const occupantEnd = moment(`${occupantDate.format("YYYY-MM-DD")} ${occupant.endTime}`, "YYYY-MM-DD HH:mm");

        // Check if dates match
        if (!occupantDate.isSame(date, "day")) return false;

        // Check for time overlap
        return newSlotStart.isBefore(occupantEnd) && newSlotEnd.isAfter(occupantStart);
      });

      // Check for conflicts with existing maintenance records in the new room
      const conflictingMaintenance = existingMaintenanceRecords.filter((maintenance) => {
        // Only consider active maintenance records
        if (!maintenance.isMainteneceActive) return false;

        // Check if maintenance is for the same room
        if (maintenance.roomid !== roomId) return false;

        // Check if maintenance is on the same date
        const maintenanceDate = moment(maintenance.maintanceDate).format("YYYY-MM-DD");
        if (maintenanceDate !== date) return false;

        // Parse maintenance times - handle both formats
        const startTime = maintenance.startTime.includes("T") ? maintenance.startTime.split("T")[1]?.split(":").slice(0, 2).join(":") : maintenance.startTime;
        const endTime = maintenance.endTime.includes("T") ? maintenance.endTime.split("T")[1]?.split(":").slice(0, 2).join(":") : maintenance.endTime;

        const maintenanceStart = moment(`${maintenanceDate} ${startTime}`, "YYYY-MM-DD HH:mm");
        const maintenanceEnd = moment(`${maintenanceDate} ${endTime}`, "YYYY-MM-DD HH:mm");

        // Check for time overlap
        return newSlotStart.isBefore(maintenanceEnd) && newSlotEnd.isAfter(maintenanceStart);
      });

      const hasConflicts = conflictingOccupants.length > 0 || conflictingMaintenance.length > 0;
      console.log(
        "Occupant conflicts found:",
        conflictingOccupants.length,
        "Maintenance conflicts found:",
        conflictingMaintenance.length,
        "Has conflicts:",
        hasConflicts
      );

      // Update the conflict status immediately
      setConflictRoomConflictStatus((prev) => ({ ...prev, [conflictId]: hasConflicts }));
      setConflictRoomConflictType((prev) => ({
        ...prev,
        [conflictId]: hasConflicts ? (conflictingMaintenance.length > 0 ? "existing_maintenance" : "occupant") : "",
      }));

      return hasConflicts;
    } catch (error) {
      console.error("Error checking conflict room conflicts:", error);
      // Set conflict status to false on error
      setConflictRoomConflictStatus((prev) => ({ ...prev, [conflictId]: false }));
      setConflictRoomConflictType((prev) => ({ ...prev, [conflictId]: "" }));
      return false;
    }
  };

  const handleCancelOccupant = async (occupantId: string) => {
    try {
      const occupant = conflicts.find((c) => c.occupant.Id === occupantId)?.occupant;
      if (!occupant) return;

      await callApi(process.env.NEXT_PUBLIC_UPDATE_SPACE_ALLOCATION_ENTRY || URL_NOT_FOUND, {
        allocationEntNo: occupantId,
        isAllocationActive: false,
        startTime: moment(occupant.startTime, "HH:mm").format("HH:mm:ss"),
        endTime: moment(occupant.endTime, "HH:mm").format("HH:mm:ss"),
        remarks: "Cancelled for maintenance",
        scheduledDate: moment(occupant.scheduledDate).format("YYYY-MM-DD"),
      });

      // Remove from conflicts list and clear conflict-specific data
      setConflicts((prev) => prev.filter((c) => c.occupant.Id !== occupantId));
      setSelectedConflicts((prev) => prev.filter((id) => id !== occupantId));

      // Clear conflict-specific data
      setConflictRoomSelections((prev) => {
        const newSelections = { ...prev };
        delete newSelections[occupantId];
        return newSelections;
      });
      setConflictDates((prev) => {
        const newDates = { ...prev };
        delete newDates[occupantId];
        return newDates;
      });
      setConflictStartTimes((prev) => {
        const newTimes = { ...prev };
        delete newTimes[occupantId];
        return newTimes;
      });
      setConflictEndTimes((prev) => {
        const newTimes = { ...prev };
        delete newTimes[occupantId];
        return newTimes;
      });
      setConflictRoomInfos((prev) => {
        const newInfos = { ...prev };
        delete newInfos[occupantId];
        return newInfos;
      });
      setConflictAvailableSlots((prev) => {
        const newSlots = { ...prev };
        delete newSlots[occupantId];
        return newSlots;
      });
      setConflictRoomConflictStatus((prev) => {
        const newStatus = { ...prev };
        delete newStatus[occupantId];
        return newStatus;
      });
      setConflictRoomConflictType((prev) => {
        const newType = { ...prev };
        delete newType[occupantId];
        return newType;
      });
      setShowConflictRoomSchedule((prev) => {
        const newSchedule = { ...prev };
        delete newSchedule[occupantId];
        return newSchedule;
      });
      // Clear search states
      setConflictRoomSearchInputs((prev) => {
        const newInputs = { ...prev };
        delete newInputs[occupantId];
        return newInputs;
      });
      setShowConflictRoomDropdowns((prev) => {
        const newDropdowns = { ...prev };
        delete newDropdowns[occupantId];
        return newDropdowns;
      });
      setConflictRoomSearchErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[occupantId];
        return newErrors;
      });

      alert("Occupant slot cancelled successfully");
    } catch (error) {
      console.error("Error cancelling occupant:", error);
      alert("Failed to cancel occupant slot");
    }
  };

  const handleSubmit = async () => {
    if (!selectedRoomInfo || !maintenanceDate || !startTime || !endTime || !maintenanceType) {
      alert("Please fill in all required fields and select a room");
      return;
    }

    // Check for time validation errors
    if (timeValidationErrors["maintenance"]) {
      alert("Please fix the time validation errors before scheduling maintenance");
      return;
    }

    // Check for conflict validation errors
    const hasConflictValidationErrors = Object.keys(timeValidationErrors).some((key) => key.startsWith("conflict-"));
    if (hasConflictValidationErrors) {
      alert("Please fix the time validation errors in conflict resolution before scheduling maintenance");
      return;
    }

    // Check if there are unresolved conflicts
    const unresolvedConflicts = conflicts.filter((c) => !selectedConflicts.includes(c.occupant.Id));
    if (unresolvedConflicts.length > 0) {
      alert("Please resolve all conflicts before scheduling maintenance");
      return;
    }

    // Check if there are unresolved maintenance conflicts
    const unresolvedMaintenanceConflicts = maintenanceConflicts.filter((c) => !selectedMaintenanceConflicts.includes(c.maintenance.id.toString()));
    if (unresolvedMaintenanceConflicts.length > 0) {
      alert("Please resolve all maintenance conflicts before scheduling maintenance");
      return;
    }

    setIsSubmitting(true);
    try {
      // Create maintenance data for the new API
      // Find the selected room (either parent room or subroom) to determine if it's a subroom
      const selectedRoom = findRoomById(selectedRoomId);

      const maintenanceData = {
        buildingId: selectedRoomInfo.building,
        roomid: selectedRoom?.parentId || selectedRoomInfo.id, // Use parentId if it's a subroom, otherwise use the room info id
        maintanceDate: maintenanceDate,
        startTime: `${startTime}:00`,
        endTime: `${endTime}:00`,
        maintainenceType: maintenanceType,
        description: description,
        isMainteneceActive: "true",
      };

      // Cancel selected maintenance conflicts first
      for (const maintenanceId of selectedMaintenanceConflicts) {
        try {
          const cancelResponse = await callApi(process.env.NEXT_PUBLIC_GET_CANCEL_MAINTENANCE || URL_NOT_FOUND, {
            id: maintenanceId,
            isMainteneceActive: "false",
          });

          if (!cancelResponse.success) {
            console.error(`Failed to cancel maintenance ${maintenanceId}:`, cancelResponse?.data);
          }
        } catch (error) {
          console.error(`Error cancelling maintenance ${maintenanceId}:`, error);
        }
      }

      // Update resolved conflicts with their new room, date, and time values
      for (const conflictId of selectedConflicts) {
        const conflict = conflicts.find((c) => c.occupant.Id === conflictId);
        if (conflict && conflict.isEditable) {
          const newRoomId = conflictRoomSelections[conflictId];
          const newDate = conflictDates[conflictId];
          const newStartTime = conflictStartTimes[conflictId];
          const newEndTime = conflictEndTimes[conflictId];

          if (newRoomId && newDate && newStartTime && newEndTime) {
            try {
              // Find the room object to determine if it's a subroom
              let roomObject: Room | undefined;
              let isSubroom = false;
              let parentRoomId: string | undefined;

              // First check in allRooms (parent rooms)
              roomObject = allRooms.find((r) => r.roomId === newRoomId);

              if (!roomObject) {
                // Then check in subrooms
                for (const [parentId, subrooms] of Object.entries(subroomsForConflictResolution)) {
                  roomObject = subrooms.find((r) => r.roomId === newRoomId);
                  if (roomObject) {
                    isSubroom = true;
                    parentRoomId = parentId;
                    break;
                  }
                }
              }

              if (!roomObject) {
                console.error(`Room not found for roomId: ${newRoomId}`);
                alert(`Room not found for roomId: ${newRoomId}. Please try again.`);
                return;
              }

              // Update the occupant slot with new values
              const updateData = {
                allocationEntNo: conflictId,
                isAllocationActive: true,
                allocatedEndDate: moment(newDate).format("YYYY-MM-DD"),
                isSittingActive: true,
                startTime: moment(newStartTime, "HH:mm").format("HH:mm:ss"),
                endTime: moment(newEndTime, "HH:mm").format("HH:mm:ss"),
                scheduledDate: moment(newDate).format("YYYY-MM-DD"),
                roomID: isSubroom ? parentRoomId : newRoomId, // Use parent room ID if it's a subroom
                subRoomID: isSubroom ? newRoomId : "", // Use subroom ID if it's a subroom
                remarks: "Updated for maintenance conflict resolution",
              };

              const updateResponse = await callApi(process.env.NEXT_PUBLIC_UPDATE_SPACE_ALLOCATION_ENTRY || URL_NOT_FOUND, updateData);

              if (!updateResponse.success) {
                console.error(`Failed to update occupant slot ${conflictId}:`, updateResponse?.data);
                alert(`Failed to update slot for ${conflict.occupant.occupantName}. Please try again.`);
                return;
              }
            } catch (error) {
              console.error(`Error updating occupant slot ${conflictId}:`, error);
              alert(`Failed to update slot for ${conflict.occupant.occupantName}. Please try again.`);
              return;
            }
          }
        }
      }

      const response = await callApi(process.env.NEXT_PUBLIC_GET_INSERT_MAINTENANCE_DATA || URL_NOT_FOUND, maintenanceData);

      if (response.success) {
        alert("Maintenance scheduled successfully");
        onSuccess();
        onClose();
      } else {
        alert("Failed to schedule maintenance");
      }
    } catch (error) {
      console.error("Error scheduling maintenance:", error);
      alert("Failed to schedule maintenance");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if there are any non-editable conflicts that haven't been resolved
  const hasNonEditableConflicts = conflicts.some((c) => !c.isEditable && !selectedConflicts.includes(c.occupant.Id));

  // Check for validation errors
  const hasMaintenanceValidationErrors = !!timeValidationErrors["maintenance"];
  const hasConflictValidationErrors = Object.keys(timeValidationErrors).some((key) => key.startsWith("conflict-"));

  // Check if all selected conflicts have valid room assignments with no conflicts
  const allSelectedConflictsResolved = conflicts
    .filter((c) => selectedConflicts.includes(c.occupant.Id) && c.isEditable)
    .every((c) => {
      const conflictId = c.occupant.Id;
      return (
        conflictRoomSelections[conflictId] &&
        conflictDates[conflictId] &&
        conflictStartTimes[conflictId] &&
        conflictEndTimes[conflictId] &&
        !conflictRoomConflictStatus[conflictId] &&
        !timeValidationErrors[`conflict-${conflictId}`]
      );
    });

  // Check if all maintenance conflicts are resolved (selected for cancellation)
  const allMaintenanceConflictsResolved =
    maintenanceConflicts.length === 0 || maintenanceConflicts.every((c) => selectedMaintenanceConflicts.includes(c.maintenance.id.toString()));

  const canScheduleMaintenance =
    selectedRoomInfo &&
    !hasMaintenanceValidationErrors &&
    !hasConflictValidationErrors &&
    !hasNonEditableConflicts &&
    !roomSearchError &&
    (conflicts.length === 0 || allSelectedConflictsResolved) &&
    allMaintenanceConflictsResolved;

  return (
    <div className="fixed inset-0 bg-[#00000070] flex items-center justify-center z-50 text-gray-500">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Schedule Room Maintenance</h2>
          <X onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[80%]">
          {/* Maintenance Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-700">Maintenance Details</h3>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Room *</label>
              <div className="relative">
                <input
                  type="text"
                  value={roomSearchInput}
                  onChange={(e) => handleRoomSearchChange(e.target.value)}
                  onFocus={() => setShowRoomDropdown(true)}
                  placeholder={isLoadingRooms ? "Loading rooms..." : "Search and select a room..."}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                    roomSearchError ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                  required
                  disabled={isLoadingRooms}
                />

                {/* Dropdown with filtered rooms */}
                {showRoomDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {(() => {
                      const roomsToShow = roomSearchInput.length > 0 ? filteredRooms : allRooms;
                      return roomsToShow.length > 0 ? (
                        roomsToShow.map((room) => {
                          const building = allBuildingsData.find((b) => b.id === room.buildingId);
                          const floor = building?.floors.find((f) => f.id === room.floorId);
                          const roomDisplayText = `${building?.name} ${floor?.name ? `- ${floor?.name}` : ""} - ${room.roomName} ${
                            room?.roomType ? `(${room.roomType})` : ""
                          }`;

                          return (
                            <div
                              key={`${room.roomId}-${room.buildingId}`}
                              onClick={() => handleRoomSelection(room.roomId)}
                              className="px-3 py-2 hover:bg-orange-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="text-sm text-gray-800">{roomDisplayText}</div>
                              {room.roomCapactiy && room.roomCapactiy > 0 && <div className="text-xs text-gray-500">Capacity: {room.roomCapactiy}</div>}
                            </div>
                          );
                        })
                      ) : (
                        <div className="px-3 py-2 text-sm text-gray-500 italic">No rooms found matching &quot;{roomSearchInput}&quot;</div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Click outside to close dropdown */}
              {showRoomDropdown && <div className="fixed inset-0 z-40" onClick={() => setShowRoomDropdown(false)} />}

              {isLoadingRoomInfo && <div className="text-sm text-gray-500 mt-1">Loading room information...</div>}
              {roomSearchError && <div className="text-sm text-red-600 mt-1">{roomSearchError}</div>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                value={maintenanceDate}
                onChange={(e) => {
                  setMaintenanceDate(e.target.value);
                  // Validate time slot when date changes
                  if (e.target.value && startTime && endTime) {
                    validateTimeSlot(e.target.value, startTime, endTime, "maintenance");
                  }
                }}
                min={moment().format("YYYY-MM-DD")}
                max={endDate}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                  timeValidationErrors["maintenance"] ? "border-red-300 bg-red-50" : "border-gray-300"
                }`}
                required
              />
              {timeValidationErrors["maintenance"] && <p className="text-red-600 text-sm mt-1">{timeValidationErrors["maintenance"]}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    // Validate time slot when start time changes
                    if (maintenanceDate && e.target.value && endTime) {
                      validateTimeSlot(maintenanceDate, e.target.value, endTime, "maintenance");
                    }
                  }}
                  min={maintenanceDate === moment().format("YYYY-MM-DD") ? moment().format("HH:mm") : undefined}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                    timeValidationErrors["maintenance"] ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    // Validate time slot when end time changes
                    if (maintenanceDate && startTime && e.target.value) {
                      validateTimeSlot(maintenanceDate, startTime, e.target.value, "maintenance");
                    }
                  }}
                  min={maintenanceDate === moment().format("YYYY-MM-DD") && startTime ? startTime : undefined}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                    timeValidationErrors["maintenance"] ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Maintenance Type *</label>
              <select
                value={maintenanceType}
                onChange={(e) => setMaintenanceType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              >
                <option value="routine">Routine Maintenance</option>
                <option value="repair">Repair</option>
                <option value="cleaning">Deep Cleaning</option>
                <option value="inspection">Inspection</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Describe the maintenance work..."
              />
            </div>
          </div>

          {/* Conflicts Section */}
          <div className="space-y-4 max-h-full overflow-y-scroll">
            <h3 className="text-lg font-medium text-gray-700">Conflicts & Resolutions</h3>

            {isCheckingConflicts && (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
                <p className="text-sm text-gray-600 mt-2">Checking for conflicts...</p>
              </div>
            )}

            {!selectedRoomInfo && (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                <div className="flex items-center">
                  <div className="text-gray-500 mr-2">ℹ</div>
                  <p className="text-gray-800 font-medium">Select a room first</p>
                </div>
                <p className="text-gray-700 text-sm mt-1">Please select a room to check for conflicts and schedule maintenance.</p>
              </div>
            )}

            {conflicts.length === 0 && maintenanceConflicts.length === 0 && !isCheckingConflicts && maintenanceDate && selectedRoomInfo && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex items-center">
                  <div className="text-green-500 mr-2">✓</div>
                  <p className="text-green-800 font-medium">No conflicts found</p>
                </div>
                <p className="text-green-700 text-sm mt-1">The room is available for maintenance at the selected time.</p>
              </div>
            )}

            {(conflicts.length > 0 || maintenanceConflicts.length > 0) && (
              <div className="space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="flex items-center">
                    <div className="text-yellow-500 mr-2">⚠</div>
                    <p className="text-yellow-800 font-medium">
                      {conflicts.length + maintenanceConflicts.length} conflict{conflicts.length + maintenanceConflicts.length > 1 ? "s" : ""} found
                    </p>
                  </div>
                  <p className="text-yellow-700 text-sm mt-1">Please resolve conflicts before scheduling maintenance.</p>
                </div>

                {/* Show warning for non-editable conflicts */}
                {hasNonEditableConflicts && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <div className="flex items-center">
                      <div className="text-red-500 mr-2">🚫</div>
                      <p className="text-red-800 font-medium">Non-editable conflicts detected</p>
                    </div>
                    <p className="text-red-700 text-sm mt-1">
                      Some conflicts cannot be resolved from this portal. Please contact the faculty to change their class schedule before proceeding with
                      maintenance.
                    </p>
                  </div>
                )}

                {conflicts.map((conflict) => (
                  <div key={conflict.occupant.Id} className="border border-gray-200 rounded-md p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <input
                            type="checkbox"
                            checked={selectedConflicts.includes(conflict.occupant.Id)}
                            onChange={() => handleConflictSelection(conflict.occupant.Id)}
                            className="mr-2"
                          />
                          <h4 className="font-medium text-gray-800">{conflict.occupant.occupantName}</h4>
                          <span
                            className={`ml-2 px-2 py-1 text-xs rounded-full ${
                              conflict.conflictType === "full" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {conflict.conflictType === "full" ? "Full Conflict" : "Partial Conflict"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {conflict.occupant.type} • {formatTimeForDisplay(conflict.occupant.startTime)} - {formatTimeForDisplay(conflict.occupant.endTime)}
                        </p>
                        <p className="text-xs text-gray-500">Editable: {conflict.isEditable ? "Yes" : "No"}</p>
                      </div>
                    </div>

                    {selectedConflicts.includes(conflict.occupant.Id) && conflict.isEditable && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <h5 className="font-medium text-gray-700 mb-2">Resolution Options:</h5>

                        <div className="space-y-3">
                          {/* Move to another room */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Move to Room
                              {isLoadingConflictResolutionRooms && <span className="ml-2 text-xs text-blue-600">(Loading room options...)</span>}
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="relative">
                                <input
                                  type="text"
                                  value={conflictRoomSearchInputs[conflict.occupant.Id] || ""}
                                  onChange={(e) => handleConflictRoomSearchChange(conflict.occupant.Id, e.target.value)}
                                  onFocus={() => setShowConflictRoomDropdowns((prev) => ({ ...prev, [conflict.occupant.Id]: true }))}
                                  placeholder={isLoadingRooms || isLoadingConflictResolutionRooms ? "Loading rooms..." : "Select a room..."}
                                  className={`px-3 min-w-35 max-w-44 py-2 border rounded-md text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                                    conflictRoomSearchErrors[conflict.occupant.Id]
                                      ? "border-red-300 bg-red-50"
                                      : conflictRoomSelections[conflict.occupant.Id]
                                      ? "border-green-300 bg-green-50"
                                      : "border-gray-300"
                                  }`}
                                  disabled={isLoadingRooms || isLoadingConflictResolutionRooms}
                                />

                                {/* Dropdown with filtered rooms */}
                                {showConflictRoomDropdowns[conflict.occupant.Id] && (
                                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    {(() => {
                                      const roomsToShow =
                                        conflictRoomSearchInputs[conflict.occupant.Id]?.length > 0
                                          ? getFilteredConflictRooms(conflict.occupant.Id)
                                          : (() => {
                                              const regularRooms = allRooms.filter((room) => !room.hasSubroom);
                                              const allSubrooms: Room[] = [];
                                              Object.values(subroomsForConflictResolution).forEach((subrooms) => {
                                                allSubrooms.push(...subrooms);
                                              });
                                              return [...regularRooms, ...allSubrooms];
                                            })();

                                      return roomsToShow.length > 0 ? (
                                        roomsToShow.map((room) => {
                                          const building = allBuildingsData.find((b) => b.id === room.buildingId);
                                          const isSubroom = Object.values(subroomsForConflictResolution).some((subrooms) =>
                                            subrooms.some((subroom) => subroom.roomId === room.roomId)
                                          );

                                          // Find parent room for subrooms
                                          let parentRoomId = "";
                                          if (isSubroom) {
                                            for (const [parentId, subrooms] of Object.entries(subroomsForConflictResolution)) {
                                              if (subrooms.some((subroom) => subroom.roomId === room.roomId)) {
                                                parentRoomId = parentId;
                                                break;
                                              }
                                            }
                                          }

                                          // Format the display text based on room type
                                          let roomDisplayText = "";
                                          const capacity = room.roomCapactiy && room.roomCapactiy > 0 ? room.roomCapactiy : null;

                                          if (isSubroom) {
                                            roomDisplayText = `${building?.name} - ${parentRoomId} - ${room.roomId}${capacity ? ` - ${capacity}` : ""}`;
                                          } else {
                                            roomDisplayText = `${building?.name} - ${room.roomId}${capacity ? ` - ${capacity}` : ""}`;
                                          }

                                          return (
                                            <div
                                              key={`${room.roomId}-${room.buildingId}`}
                                              onClick={() => handleConflictRoomSelection(conflict.occupant.Id, room.roomId)}
                                              className="px-3 py-2 hover:bg-orange-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                            >
                                              <div className="text-sm text-gray-800">{roomDisplayText}</div>
                                              {capacity && <div className="text-xs text-gray-500">Capacity: {capacity}</div>}
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <div className="px-3 py-2 text-sm text-gray-500 italic">
                                          No rooms found matching &quot;{conflictRoomSearchInputs[conflict.occupant.Id] || ""}&quot;
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}

                                {/* Click outside to close dropdown */}
                                {showConflictRoomDropdowns[conflict.occupant.Id] && (
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowConflictRoomDropdowns((prev) => ({ ...prev, [conflict.occupant.Id]: false }))}
                                  />
                                )}

                                {conflictRoomSearchErrors[conflict.occupant.Id] && (
                                  <div className="text-sm text-red-600 mt-1">{conflictRoomSearchErrors[conflict.occupant.Id]}</div>
                                )}
                              </div>
                              <input
                                type="date"
                                value={conflictDates[conflict.occupant.Id] || ""}
                                onChange={(e) => {
                                  const date = e.target.value;
                                  setConflictDates((prev) => ({ ...prev, [conflict.occupant.Id]: date }));
                                  const roomInfo = conflictRoomInfos[conflict.occupant.Id];
                                  const roomId = conflictRoomSelections[conflict.occupant.Id];
                                  if (roomInfo && date && roomId) {
                                    calculateConflictAvailableSlots(conflict.occupant.Id, roomInfo, date, roomId);
                                  }
                                  // Clear conflict status when date changes
                                  setConflictRoomConflictStatus((prev) => ({ ...prev, [conflict.occupant.Id]: false }));
                                  setConflictRoomConflictType((prev) => ({ ...prev, [conflict.occupant.Id]: "" }));
                                  // Validate time slot when date changes
                                  const startTime = conflictStartTimes[conflict.occupant.Id];
                                  const endTime = conflictEndTimes[conflict.occupant.Id];
                                  if (date && startTime && endTime) {
                                    validateTimeSlot(date, startTime, endTime, `conflict-${conflict.occupant.Id}`);
                                  }
                                  // Immediately check for conflicts if we have all required data
                                  if (roomId && startTime && endTime) {
                                    checkConflictRoomConflicts(conflict.occupant.Id, roomId, date, startTime, endTime);
                                  }
                                }}
                                className={`px-3 py-2 border rounded-md text-sm ${
                                  timeValidationErrors[`conflict-${conflict.occupant.Id}`]
                                    ? "border-red-300 bg-red-50"
                                    : conflictDates[conflict.occupant.Id]
                                    ? "border-green-300 bg-green-50"
                                    : "border-gray-300"
                                }`}
                                placeholder="New Date"
                                min={moment().format("YYYY-MM-DD")}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <div className="relative">
                                <input
                                  type="time"
                                  value={conflictStartTimes[conflict.occupant.Id] || ""}
                                  onChange={(e) => {
                                    const startTime = e.target.value;
                                    setConflictStartTimes((prev) => ({ ...prev, [conflict.occupant.Id]: startTime }));
                                    // Clear conflict status when time changes
                                    setConflictRoomConflictStatus((prev) => ({ ...prev, [conflict.occupant.Id]: false }));
                                    setConflictRoomConflictType((prev) => ({ ...prev, [conflict.occupant.Id]: "" }));
                                    // Validate time slot when start time changes
                                    const date = conflictDates[conflict.occupant.Id];
                                    const endTime = conflictEndTimes[conflict.occupant.Id];
                                    if (date && startTime && endTime) {
                                      validateTimeSlot(date, startTime, endTime, `conflict-${conflict.occupant.Id}`);
                                    }
                                    // Check for conflicts when time changes
                                    const conflictRoomId = conflictRoomSelections[conflict.occupant.Id];
                                    if (conflictRoomId && date && startTime && endTime) {
                                      checkConflictRoomConflicts(conflict.occupant.Id, conflictRoomId, date, startTime, endTime);
                                    }
                                  }}
                                  min={conflictDates[conflict.occupant.Id] === moment().format("YYYY-MM-DD") ? moment().format("HH:mm") : undefined}
                                  className={`px-3 py-2 border rounded-md text-sm w-full ${
                                    timeValidationErrors[`conflict-${conflict.occupant.Id}`]
                                      ? "border-red-300 bg-red-50"
                                      : conflictRoomSelections[conflict.occupant.Id] &&
                                        conflictDates[conflict.occupant.Id] &&
                                        conflictStartTimes[conflict.occupant.Id] &&
                                        conflictEndTimes[conflict.occupant.Id] &&
                                        !conflictRoomConflictStatus[conflict.occupant.Id]
                                      ? "border-green-300 bg-green-50"
                                      : conflictRoomConflictStatus[conflict.occupant.Id]
                                      ? "border-red-300 bg-red-50"
                                      : "border-gray-300"
                                  }`}
                                  placeholder="Start Time"
                                />
                                {conflictRoomSelections[conflict.occupant.Id] &&
                                  conflictDates[conflict.occupant.Id] &&
                                  conflictStartTimes[conflict.occupant.Id] &&
                                  conflictEndTimes[conflict.occupant.Id] && (
                                    <div
                                      className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                                        conflictRoomConflictStatus[conflict.occupant.Id] ? "bg-red-500" : "bg-green-500"
                                      }`}
                                    ></div>
                                  )}
                              </div>
                              <div className="relative">
                                <input
                                  type="time"
                                  value={conflictEndTimes[conflict.occupant.Id] || ""}
                                  onChange={(e) => {
                                    const endTime = e.target.value;
                                    setConflictEndTimes((prev) => ({ ...prev, [conflict.occupant.Id]: endTime }));
                                    // Clear conflict status when time changes
                                    setConflictRoomConflictStatus((prev) => ({ ...prev, [conflict.occupant.Id]: false }));
                                    setConflictRoomConflictType((prev) => ({ ...prev, [conflict.occupant.Id]: "" }));
                                    // Validate time slot when end time changes
                                    const date = conflictDates[conflict.occupant.Id];
                                    const startTime = conflictStartTimes[conflict.occupant.Id];
                                    if (date && startTime && endTime) {
                                      validateTimeSlot(date, startTime, endTime, `conflict-${conflict.occupant.Id}`);
                                    }
                                    // Check for conflicts when time changes
                                    const conflictRoomId = conflictRoomSelections[conflict.occupant.Id];
                                    if (conflictRoomId && date && startTime && endTime) {
                                      checkConflictRoomConflicts(conflict.occupant.Id, conflictRoomId, date, startTime, endTime);
                                    }
                                  }}
                                  min={
                                    conflictDates[conflict.occupant.Id] === moment().format("YYYY-MM-DD") && conflictStartTimes[conflict.occupant.Id]
                                      ? conflictStartTimes[conflict.occupant.Id]
                                      : undefined
                                  }
                                  className={`px-3 py-2 border rounded-md text-sm w-full ${
                                    timeValidationErrors[`conflict-${conflict.occupant.Id}`]
                                      ? "border-red-300 bg-red-50"
                                      : conflictRoomSelections[conflict.occupant.Id] &&
                                        conflictDates[conflict.occupant.Id] &&
                                        conflictStartTimes[conflict.occupant.Id] &&
                                        conflictEndTimes[conflict.occupant.Id] &&
                                        !conflictRoomConflictStatus[conflict.occupant.Id]
                                      ? "border-green-300 bg-green-50"
                                      : conflictRoomConflictStatus[conflict.occupant.Id]
                                      ? "border-red-300 bg-red-50"
                                      : "border-gray-300"
                                  }`}
                                  placeholder="End Time"
                                />
                                {conflictRoomSelections[conflict.occupant.Id] &&
                                  conflictDates[conflict.occupant.Id] &&
                                  conflictStartTimes[conflict.occupant.Id] &&
                                  conflictEndTimes[conflict.occupant.Id] && (
                                    <div
                                      className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                                        conflictRoomConflictStatus[conflict.occupant.Id] ? "bg-red-500" : "bg-green-500"
                                      }`}
                                    ></div>
                                  )}
                              </div>
                            </div>

                            {/* Time Validation Error Message */}
                            {timeValidationErrors[`conflict-${conflict.occupant.Id}`] && (
                              <div className="text-red-600 text-xs mt-1 px-2 py-1 bg-red-50 border border-red-300 rounded">
                                {timeValidationErrors[`conflict-${conflict.occupant.Id}`]}
                              </div>
                            )}

                            {/* Conflict Status Message */}
                            {conflictRoomSelections[conflict.occupant.Id] &&
                              conflictDates[conflict.occupant.Id] &&
                              conflictStartTimes[conflict.occupant.Id] &&
                              conflictEndTimes[conflict.occupant.Id] &&
                              !timeValidationErrors[`conflict-${conflict.occupant.Id}`] && (
                                <div
                                  className={`text-xs mt-1 px-2 py-1 rounded ${
                                    conflictRoomConflictStatus[conflict.occupant.Id]
                                      ? "bg-red-100 text-red-700 border border-red-300"
                                      : "bg-green-100 text-green-700 border border-green-300"
                                  }`}
                                >
                                  {conflictRoomConflictStatus[conflict.occupant.Id]
                                    ? conflictRoomConflictType[conflict.occupant.Id] === "maintenance"
                                      ? "⚠️ This time slot conflicts with scheduled maintenance"
                                      : conflictRoomConflictType[conflict.occupant.Id] === "existing_maintenance"
                                      ? "⚠️ This time slot conflicts with existing maintenance"
                                      : conflictRoomConflictType[conflict.occupant.Id] === "subroom"
                                      ? "⚠️ Cannot resolve because parent room during maintenance timeframe"
                                      : "⚠️ This time slot conflicts with existing occupants"
                                    : "✅ Time slot is available"}
                                </div>
                              )}

                            {/* View Schedule Button */}
                            {conflictRoomSelections[conflict.occupant.Id] && conflictDates[conflict.occupant.Id] && (
                              <button
                                onClick={() => setShowConflictRoomSchedule((prev) => ({ ...prev, [conflict.occupant.Id]: !prev[conflict.occupant.Id] }))}
                                className="mt-2 flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200"
                                disabled={isLoadingConflictRoomInfo[conflict.occupant.Id]}
                              >
                                <Eye className="w-4 h-4" />
                                {isLoadingConflictRoomInfo[conflict.occupant.Id]
                                  ? "Loading..."
                                  : (showConflictRoomSchedule[conflict.occupant.Id] ? "Hide" : "View") + " Schedule"}
                              </button>
                            )}

                            {/* Available Slots Display */}
                            {showConflictRoomSchedule[conflict.occupant.Id] && conflictDates[conflict.occupant.Id] && (
                              <div className="mt-3 p-3 bg-gray-50 rounded-md border">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Available Time Slots:</h4>
                                {isLoadingConflictRoomInfo[conflict.occupant.Id] ? (
                                  <div className="text-center py-2">
                                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                    <p className="text-xs text-gray-600 mt-1">Loading room schedule...</p>
                                  </div>
                                ) : (conflictAvailableSlots[conflict.occupant.Id] || []).length > 0 ? (
                                  <div className="space-y-1">
                                    {(conflictAvailableSlots[conflict.occupant.Id] || []).map((slot, index) => (
                                      <button
                                        key={index}
                                        onClick={() => handleConflictAvailableSlotClick(conflict.occupant.Id, slot)}
                                        className="block w-full text-left px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 border border-green-300"
                                      >
                                        {slot}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-500 italic">No available slots for this date.</p>
                                )}

                                {/* Existing Occupants */}
                                {conflictRoomInfos[conflict.occupant.Id] &&
                                  conflictRoomInfos[conflict.occupant.Id]?.occupants &&
                                  (conflictRoomInfos[conflict.occupant.Id]?.occupants?.length || 0) > 0 && (
                                    <div className="mt-3">
                                      <h4 className="text-sm font-medium text-gray-700 mb-2">Existing Occupants:</h4>
                                      <div className="space-y-1">
                                        {conflictRoomInfos[conflict.occupant.Id]?.occupants
                                          ?.filter((occupant) => moment(occupant.scheduledDate).format("YYYY-MM-DD") === conflictDates[conflict.occupant.Id])
                                          ?.map((occupant, index) => (
                                            <div key={index} className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded border border-red-300">
                                              {occupant.occupantName} {formatTimeForDisplay(occupant.startTime)} → {formatTimeForDisplay(occupant.endTime)}
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            )}
                          </div>

                          {/* Cancel slot */}
                          <div>
                            <button
                              onClick={() => handleCancelOccupant(conflict.occupant.Id)}
                              className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                            >
                              Cancel Slot
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedConflicts.includes(conflict.occupant.Id) && !conflict.isEditable && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="bg-red-50 border border-red-200 p-3 rounded">
                          <div className="flex items-center mb-2">
                            <div className="text-red-500 mr-2">🚫</div>
                            <p className="text-red-800 font-medium text-sm">Non-editable Conflict</p>
                          </div>
                          <p className="text-red-700 text-sm">
                            This is a class from the timetable that cannot be modified from this portal. Please contact the faculty (
                            {conflict.occupant.occupantName}) to change their class schedule before proceeding with maintenance.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Maintenance Conflicts */}
                {maintenanceConflicts.map((conflict) => (
                  <div key={`maintenance-${conflict.maintenance.id}`} className="border border-red-200 rounded-md p-4 bg-red-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <input
                            type="checkbox"
                            checked={selectedMaintenanceConflicts.includes(conflict.maintenance.id.toString())}
                            onChange={() => handleMaintenanceConflictSelection(conflict.maintenance.id.toString())}
                            className="mr-2"
                          />
                          <h4 className="font-medium text-gray-800">Maintenance Conflict</h4>
                          <span
                            className={`ml-2 px-2 py-1 text-xs rounded-full ${
                              conflict.conflictType === "full" ? "bg-red-100 text-red-800" : "bg-orange-100 text-orange-800"
                            }`}
                          >
                            {conflict.conflictType === "full" ? "Full Conflict" : "Partial Conflict"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {conflict.maintenance.maintainenceType} •{" "}
                          {conflict.maintenance.startTime.split("T")[1]?.split(":").slice(0, 2).join(":") || conflict.maintenance.startTime} -{" "}
                          {conflict.maintenance.endTime.split("T")[1]?.split(":").slice(0, 2).join(":") || conflict.maintenance.endTime}
                        </p>
                        <p className="text-xs text-gray-500 mb-2">Scheduled: {moment(conflict.maintenance.maintanceDate).format("MMM DD, YYYY")}</p>
                        {conflict.maintenance.description && <p className="text-xs text-gray-500 mb-2">Description: {conflict.maintenance.description}</p>}
                        <p className="text-xs text-red-600 font-medium">
                          ⚠️ This maintenance conflicts with your scheduled maintenance. You can only cancel this maintenance.
                        </p>
                      </div>
                    </div>

                    {selectedMaintenanceConflicts.includes(conflict.maintenance.id.toString()) && (
                      <div className="mt-3 pt-3 border-t border-red-200">
                        <h5 className="font-medium text-gray-700 mb-2">Resolution Options:</h5>
                        <div className="bg-red-100 border border-red-300 rounded-md p-3">
                          <p className="text-sm text-red-800 font-medium mb-2">🔧 Maintenance Conflict</p>
                          <p className="text-sm text-red-700 mb-3">
                            This maintenance conflicts with your scheduled maintenance. The only resolution is to cancel this existing maintenance.
                          </p>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-red-600">Action:</span>
                            <span className="px-2 py-1 bg-red-200 text-red-800 text-xs rounded-full font-medium">Cancel Maintenance</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canScheduleMaintenance || isSubmitting}
            className={`px-4 py-2 rounded-md transition-colors ${
              canScheduleMaintenance && !isSubmitting ? "bg-orange-600 text-white hover:bg-orange-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isSubmitting
              ? "Scheduling..."
              : roomSearchError
              ? "Cannot Schedule - Invalid Room Selection"
              : hasMaintenanceValidationErrors
              ? "Cannot Schedule - Fix Time Validation"
              : hasConflictValidationErrors
              ? "Cannot Schedule - Fix Conflict Time Validation"
              : hasNonEditableConflicts
              ? "Cannot Schedule - Non-editable Conflicts"
              : conflicts.length > 0 && !allSelectedConflictsResolved
              ? "Cannot Schedule - Resolve All Conflicts"
              : maintenanceConflicts.length > 0 && !allMaintenanceConflictsResolved
              ? "Cannot Schedule - Resolve Maintenance Conflicts"
              : "Schedule Maintenance"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceModal;
