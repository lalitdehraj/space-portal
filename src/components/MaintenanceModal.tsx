"use client";

import React, { useState, useEffect } from "react";
import { RoomInfo, Occupant, Building, Room } from "@/types";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import moment from "moment";
import { checkSlotConflicts, Slot } from "@/utils/slotsHelper";
import { useSelector } from "react-redux";
import { X, Eye } from "lucide-react";

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
  conflictType: 'time' | 'full';
}

const MaintenanceModal: React.FC<MaintenanceModalProps> = ({
  allBuildingsData,
  onClose,
  onSuccess,
  startDate,
  endDate,
}) => {
  // Redux selectors for academic year and session
  const academicYear = useSelector((state: any) => state.dataState.selectedAcademicYear);
  const academicSession = useSelector((state: any) => state.dataState.selectedAcademicSession);
  
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedRoomInfo, setSelectedRoomInfo] = useState<RoomInfo | null>(null);
  const [maintenanceDate, setMaintenanceDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [maintenanceType, setMaintenanceType] = useState("routine");
  const [description, setDescription] = useState("");
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const [selectedConflicts, setSelectedConflicts] = useState<string[]>([]);
  const [newRoomId, setNewRoomId] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRoomInfo, setIsLoadingRoomInfo] = useState(false);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [newRoomInfo, setNewRoomInfo] = useState<RoomInfo | null>(null);
  const [isLoadingNewRoomInfo, setIsLoadingNewRoomInfo] = useState(false);
  const [showNewRoomSchedule, setShowNewRoomSchedule] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [newRoomConflictStatus, setNewRoomConflictStatus] = useState<boolean>(false);

  // Fetch all rooms from all buildings and floors
  const fetchAllRooms = async () => {
    if (!allBuildingsData.length) return;
    
    setIsLoadingRooms(true);
    try {
      const rooms: Room[] = [];
      const currentTime = moment().format("HH:mm");
      
      // Fetch rooms for each building and floor
      for (const building of allBuildingsData) {
        if (!building.floors || building.floors.length === 0) continue;
        
        const floorPromises = building.floors.map(async (floor) => {
          try {
            const response = await callApi<Room[]>(
              process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND,
              {
                buildingNo: building.id,
                floorID: floor.id,
                curreentTime: currentTime,
              }
            );
            if (response.success && response.data) {
              return response.data;
            }
            return [];
          } catch (error) {
            console.error(`Error fetching rooms for building ${building.id}, floor ${floor.id}:`, error);
            return [];
          }
        });
        
        const floorResults = await Promise.all(floorPromises);
        rooms.push(...floorResults.flat());
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

  // Fetch room info when room is selected
  const fetchRoomInfo = async (roomId: string) => {
    if (!roomId || !academicYear || !academicSession || !startDate || !endDate) return;
    
    setIsLoadingRoomInfo(true);
    try {
      const requestbody = {
        roomID: roomId,
        subroomID: 0,
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

  // Fetch new room info for conflict checking
  const fetchNewRoomInfo = async (roomId: string) => {
    if (!roomId || !academicYear || !academicSession || !startDate || !endDate) return;
    
    setIsLoadingNewRoomInfo(true);
    try {
      const requestbody = {
        roomID: roomId,
        subroomID: 0,
        academicYr: academicYear,
        acadSess: academicSession,
        startDate: startDate,
        endDate: endDate,
      };
      
      const res = await callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, requestbody);
      if (res.success && res.data) {
        setNewRoomInfo(res.data);
        // Calculate available slots for the new date if it's set
        if (newDate) {
          calculateAvailableSlots(res.data, newDate);
        }
      }
    } catch (error) {
      console.error("Error fetching new room info:", error);
    } finally {
      setIsLoadingNewRoomInfo(false);
    }
  };

  // Calculate available slots for a given room and date
  const calculateAvailableSlots = (roomInfo: RoomInfo, date: string) => {
    const today = new Date().toISOString().split("T")[0];
    const currentTime = new Date();
    if (new Date(date) < new Date(today)) {
      setAvailableSlots([]);
      return;
    }

    const workingStart = 9 * 60; // 9:00 AM in minutes
    const workingEnd = 18 * 60; // 6:00 PM in minutes

    const occupiedIntervals = (roomInfo.occupants || [])
      .filter((occupant) => {
        const occupantDate = moment(occupant.scheduledDate).format('YYYY-MM-DD');
        return occupantDate === date;
      })
      .map((occupant) => ({
        start: parseInt(occupant.startTime.split(":")[0]) * 60 + parseInt(occupant.startTime.split(":")[1]),
        end: parseInt(occupant.endTime.split(":")[0]) * 60 + parseInt(occupant.endTime.split(":")[1]),
      }))
      .sort((a, b) => a.start - b.start);

    let freeIntervals: { start: number; end: number }[] = [];
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

    setAvailableSlots(slots);
  };

  // Handle available slot selection
  const handleAvailableSlotClick = (timeString: string) => {
    const [start, end] = timeString.split(" → ");
    setNewStartTime(start);
    setNewEndTime(end);
  };

  // Handle room selection
  const handleRoomSelection = (roomId: string) => {
    setSelectedRoomId(roomId);
    setConflicts([]);
    setSelectedConflicts([]);
    setMaintenanceDate("");
    setStartTime("09:00");
    setEndTime("10:00");
    if (roomId) {
      fetchRoomInfo(roomId);
    } else {
      setSelectedRoomInfo(null);
    }
  };

  // Check for conflicts when maintenance details change
  useEffect(() => {
    if (maintenanceDate && startTime && endTime && selectedRoomInfo) {
      checkConflicts();
    } else {
      // Clear conflicts if not all required fields are present
      setConflicts([]);
    }
  }, [maintenanceDate, startTime, endTime, selectedRoomInfo]);

  // Fetch new room info when new room is selected
  useEffect(() => {
    if (newRoomId) {
      fetchNewRoomInfo(newRoomId);
    } else {
      setNewRoomInfo(null);
      setAvailableSlots([]);
      setNewRoomConflictStatus(false);
    }
  }, [newRoomId]);

  // Calculate available slots when new date changes
  useEffect(() => {
    if (newRoomInfo && newDate) {
      calculateAvailableSlots(newRoomInfo, newDate);
    } else {
      setAvailableSlots([]);
    }
    // Reset conflict status when date changes
    setNewRoomConflictStatus(false);
  }, [newDate, newRoomInfo]);

  // Check for conflicts when new room details change
  useEffect(() => {
    const checkConflicts = async () => {
      if (newRoomInfo && newDate && newStartTime && newEndTime) {
        const hasConflicts = await checkNewRoomConflicts(newRoomId, newDate, newStartTime, newEndTime);
        setNewRoomConflictStatus(hasConflicts);
      } else {
        setNewRoomConflictStatus(false);
      }
    };
    
    checkConflicts();
  }, [newRoomInfo, newDate, newStartTime, newEndTime, newRoomId]);

  const checkConflicts = async () => {
    if (!selectedRoomInfo || !maintenanceDate || !startTime || !endTime) return;
    
    setIsCheckingConflicts(true);
    try {
      // Convert maintenance details to Slot format
      const maintenanceSlot: Slot = {
        id: `${maintenanceDate},${startTime},${endTime}`,
        date: maintenanceDate,
        start: startTime,
        end: endTime
      };

      // Convert occupants to Slot format
      const existingSlots: Slot[] = selectedRoomInfo.occupants?.map((occupant) => {
        const occupantDate = moment(occupant.scheduledDate).format('YYYY-MM-DD');
        return {
          id: `${occupantDate},${occupant.startTime},${occupant.endTime}`,
          date: occupantDate,
          start: occupant.startTime,
          end: occupant.endTime
        };
      }) || [];


      // Use the proven conflict detection function from slotsHelper
      const conflictingSlots = checkSlotConflicts([maintenanceSlot], existingSlots);
      

      // Find the actual occupants that conflict with the maintenance slot
      // Since checkSlotConflicts returns the NEW slots that conflict, we need to find
      // which existing occupants overlap with our maintenance slot
      const conflictingOccupants = selectedRoomInfo.occupants?.filter((occupant) => {
        const occupantDate = moment(occupant.scheduledDate).format('YYYY-MM-DD');
        
        // Only check occupants on the same date
        if (occupantDate !== maintenanceDate) return false;
        
        // Check for time overlap using the same logic as checkSlotConflicts
        const maintenanceStart = moment(`${maintenanceDate} ${startTime}`, "YYYY-MM-DD HH:mm");
        const maintenanceEnd = moment(`${maintenanceDate} ${endTime}`, "YYYY-MM-DD HH:mm");
        const occupantStart = moment(`${occupantDate} ${occupant.startTime}`, "YYYY-MM-DD HH:mm");
        const occupantEnd = moment(`${occupantDate} ${occupant.endTime}`, "YYYY-MM-DD HH:mm");
        
        const overlaps = maintenanceStart.isBefore(occupantEnd) && maintenanceEnd.isAfter(occupantStart);
        
        
        return overlaps;
      }) || [];


      const conflictInfo: ConflictInfo[] = conflictingOccupants.map((occupant) => {
        const occupantDate = moment(occupant.scheduledDate).format('YYYY-MM-DD');
        const maintenanceStart = moment(`${maintenanceDate} ${startTime}`, "YYYY-MM-DD HH:mm");
        const maintenanceEnd = moment(`${maintenanceDate} ${endTime}`, "YYYY-MM-DD HH:mm");
        const occupantStart = moment(`${occupantDate} ${occupant.startTime}`, "YYYY-MM-DD HH:mm");
        const occupantEnd = moment(`${occupantDate} ${occupant.endTime}`, "YYYY-MM-DD HH:mm");
        
        // Determine conflict type
        const isFullConflict = maintenanceStart.isSameOrBefore(occupantStart) && 
                              maintenanceEnd.isSameOrAfter(occupantEnd);
        
        return {
          occupant,
          isEditable: occupant.isEditable === "true",
          conflictType: isFullConflict ? 'full' : 'time'
        };
      });

      setConflicts(conflictInfo);
    } catch (error) {
      console.error("Error checking conflicts:", error);
    } finally {
      setIsCheckingConflicts(false);
    }
  };

  const handleConflictSelection = (occupantId: string) => {
    setSelectedConflicts(prev => {
      const isCurrentlySelected = prev.includes(occupantId);
      const newSelection = prev.includes(occupantId) 
        ? prev.filter(id => id !== occupantId)
        : [...prev, occupantId];
      
      // If checking the checkbox (adding to selection), auto-fill the details
      if (!isCurrentlySelected) {
        const selectedConflict = conflicts.find(c => c.occupant.Id === occupantId);
        if (selectedConflict) {
          const occupant = selectedConflict.occupant;
          const occupantDate = moment(occupant.scheduledDate).format('YYYY-MM-DD');
          
          // Auto-fill the new room allocation details with the occupant's details
          setNewDate(occupantDate);
          setNewStartTime(occupant.startTime);
          setNewEndTime(occupant.endTime);
          
        }
      }
      
      return newSelection;
    });
  };

  const checkNewRoomConflicts = async (roomId: string, date: string, startTime: string, endTime: string) => {
    if (!newRoomInfo || !date || !startTime || !endTime) return false;
    
    try {
      const newSlotStart = moment(`${date} ${startTime}`);
      const newSlotEnd = moment(`${date} ${endTime}`);
      
      const conflictingOccupants = (newRoomInfo.occupants || []).filter((occupant: Occupant) => {
        const occupantDate = moment(occupant.scheduledDate);
        const occupantStart = moment(`${occupantDate.format('YYYY-MM-DD')} ${occupant.startTime}`);
        const occupantEnd = moment(`${occupantDate.format('YYYY-MM-DD')} ${occupant.endTime}`);
        
        // Check if dates match
        if (!occupantDate.isSame(date, 'day')) return false;
        
        // Check for time overlap
        return newSlotStart.isBefore(occupantEnd) && newSlotEnd.isAfter(occupantStart);
      });
      
      return conflictingOccupants.length > 0;
    } catch (error) {
      console.error("Error checking new room conflicts:", error);
      return false;
    }
  };

  const handleMoveOccupant = async (occupantId: string) => {
    if (!newRoomId || !newDate || !newStartTime || !newEndTime) {
      alert("Please fill in all new slot details");
      return;
    }

    // Check for conflicts in the new room
    const hasConflicts = await checkNewRoomConflicts(newRoomId, newDate, newStartTime, newEndTime);
    if (hasConflicts) {
      alert("The selected time slot conflicts with existing occupants in the new room. Please choose a different time or room.");
      return;
    }

    try {
      // First, deactivate the current allocation
      const occupant = conflicts.find(c => c.occupant.Id === occupantId)?.occupant;
      if (!occupant) return;

      await callApi(
        process.env.NEXT_PUBLIC_UPDATE_SPACE_ALLOCATION_ENTRY || URL_NOT_FOUND,
        {
          allocationEntNo: occupantId,
          isAllocationActive: false,
          startTime: moment(occupant.startTime, "HH:mm").format("HH:mm:ss"),
          endTime: moment(occupant.endTime, "HH:mm").format("HH:mm:ss"),
          remarks: "Moved for maintenance",
          scheduledDate: moment(occupant.scheduledDate).format("YYYY-MM-DD"),
        }
      );

      // Create new allocation in the new room
      const newAllocation = {
        allocationDate: newDate,
        startTime: newStartTime,
        endTime: newEndTime,
        purpose: occupant.type || "Class",
        type: occupant.type || "Class",
        allocatedRoomID: newRoomId,
        buildingId: allBuildingsData.find(b => b.floors.some(f => f.id === selectedRoomInfo?.floor))?.id,
        subRoom: "0",
        academicSession: academicSession,
        academicYear: academicYear,
        allocatedTo: occupant.occupantName || "",
        isAllocationActive: true,
        keyAssigned: "",
        remarks: `Moved from ${selectedRoomInfo?.roomName || selectedRoomInfo?.id} for maintenance`,
        allocatedfrom: occupant.occupantName || "",
        allocatedBy: "System", // You might want to get this from user context
        allocatedOnDate: moment().format("YYYY-MM-DD"),
      };

      await callApi(
        process.env.NEXT_PUBLIC_INSERT_SPACE_ALLOCATION_ENTRY || URL_NOT_FOUND,
        newAllocation
      );

      // Remove from conflicts list
      setConflicts(prev => prev.filter(c => c.occupant.Id !== occupantId));
      setSelectedConflicts(prev => prev.filter(id => id !== occupantId));
      
      alert("Occupant moved successfully");
    } catch (error) {
      console.error("Error moving occupant:", error);
      alert("Failed to move occupant");
    }
  };

  const handleCancelOccupant = async (occupantId: string) => {
    try {
      const occupant = conflicts.find(c => c.occupant.Id === occupantId)?.occupant;
      if (!occupant) return;

      await callApi(
        process.env.NEXT_PUBLIC_UPDATE_SPACE_ALLOCATION_ENTRY || URL_NOT_FOUND,
        {
          allocationEntNo: occupantId,
          isAllocationActive: false,
          startTime: moment(occupant.startTime, "HH:mm").format("HH:mm:ss"),
          endTime: moment(occupant.endTime, "HH:mm").format("HH:mm:ss"),
          remarks: "Cancelled for maintenance",
          scheduledDate: moment(occupant.scheduledDate).format("YYYY-MM-DD"),
        }
      );

      // Remove from conflicts list
      setConflicts(prev => prev.filter(c => c.occupant.Id !== occupantId));
      setSelectedConflicts(prev => prev.filter(id => id !== occupantId));
      
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

    // Check if there are unresolved conflicts
    const unresolvedConflicts = conflicts.filter(c => !selectedConflicts.includes(c.occupant.Id));
    if (unresolvedConflicts.length > 0) {
      alert("Please resolve all conflicts before scheduling maintenance");
      return;
    }

    setIsSubmitting(true);
    try {
      // Create maintenance allocation
      const maintenanceAllocation = {
        allocationDate: maintenanceDate,
        startTime: startTime,
        endTime: endTime,
        purpose: `Maintenance - ${maintenanceType}`,
        type: "Maintenance",
        allocatedRoomID: selectedRoomInfo.id,
        buildingId: selectedRoomInfo.building,
        subRoom: selectedRoomInfo.parentId || "0",
        academicSession: academicSession,
        academicYear: academicYear,
        allocatedTo: "Maintenance Team",
        isAllocationActive: true,
        keyAssigned: "",
        remarks: description,
        allocatedfrom: "System",
        allocatedBy: "System",
        allocatedOnDate: moment().format("YYYY-MM-DD"),
      };

      const response = await callApi(
        process.env.NEXT_PUBLIC_INSERT_SPACE_ALLOCATION_ENTRY || URL_NOT_FOUND,
        maintenanceAllocation
      );

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

  const canScheduleMaintenance = selectedRoomInfo && (conflicts.length === 0 || conflicts.every(c => selectedConflicts.includes(c.occupant.Id)));

  return (
    <div className="fixed inset-0 bg-[#00000070] flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            Schedule Room Maintenance
          </h2>
          <X
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[80%]">
          {/* Maintenance Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-700">Maintenance Details</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Room *
              </label>
              <select
                value={selectedRoomId}
                onChange={(e) => handleRoomSelection(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
                disabled={isLoadingRooms}
              >
                <option value="">
                  {isLoadingRooms ? "Loading rooms..." : "Select a room..."}
                </option>
                {allRooms.map(room => {
                  const building = allBuildingsData.find(b => b.id === room.buildingId);
                  const floor = building?.floors.find(f => f.id === room.floorId);
                  return (
                    <option key={room.roomId} value={room.roomId}>
                      {building?.name} - {floor?.name} - {room.roomName} ({room.roomType})
                    </option>
                  );
                })}
              </select>
              {isLoadingRoomInfo && (
                <div className="text-sm text-gray-500 mt-1">
                  Loading room information...
                </div>
              )}
              {selectedRoomInfo && (
                <div className="text-sm text-gray-600 mt-1">
                  Selected: {selectedRoomInfo.roomName || selectedRoomInfo.id} 
                  {selectedRoomInfo.capacity && ` (Capacity: ${selectedRoomInfo.capacity})`}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={maintenanceDate}
                onChange={(e) => setMaintenanceDate(e.target.value)}
                min={moment().format('YYYY-MM-DD')}
                max={endDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time *
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maintenance Type *
              </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
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
                <p className="text-gray-700 text-sm mt-1">
                  Please select a room to check for conflicts and schedule maintenance.
                </p>
              </div>
            )}

            {conflicts.length === 0 && !isCheckingConflicts && maintenanceDate && selectedRoomInfo && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex items-center">
                  <div className="text-green-500 mr-2">✓</div>
                  <p className="text-green-800 font-medium">No conflicts found</p>
                </div>
                <p className="text-green-700 text-sm mt-1">
                  The room is available for maintenance at the selected time.
                </p>
              </div>
            )}

            {conflicts.length > 0 && (
              <div className="space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="flex items-center">
                    <div className="text-yellow-500 mr-2">⚠</div>
                    <p className="text-yellow-800 font-medium">
                      {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} found
                    </p>
                  </div>
                  <p className="text-yellow-700 text-sm mt-1">
                    Please resolve conflicts before scheduling maintenance.
                  </p>
                </div>

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
                          <h4 className="font-medium text-gray-800">
                            {conflict.occupant.occupantName}
                          </h4>
                          <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                            conflict.conflictType === 'full' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {conflict.conflictType === 'full' ? 'Full Conflict' : 'Partial Conflict'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {conflict.occupant.type} • {conflict.occupant.startTime} - {conflict.occupant.endTime}
                        </p>
                        <p className="text-xs text-gray-500">
                          Editable: {conflict.isEditable ? 'Yes' : 'No'}
                        </p>
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
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                value={newRoomId}
                                onChange={(e) => setNewRoomId(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                                disabled={isLoadingRooms}
                              >
                                <option value="">
                                  {isLoadingRooms ? "Loading rooms..." : "Select Room"}
                                </option>
                                {allRooms.map(room => {
                                  const building = allBuildingsData.find(b => b.id === room.buildingId);
                                  const floor = building?.floors.find(f => f.id === room.floorId);
                                  return (
                                    <option key={room.roomId} value={room.roomId}>
                                      {building?.name} - {floor?.name} - {room.roomName}
                                    </option>
                                  );
                                })}
                              </select>
                              <input
                                type="date"
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                                placeholder="New Date"
                                min={moment().format('YYYY-MM-DD')}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <div className="relative">
                                <input
                                  type="time"
                                  value={newStartTime}
                                  onChange={(e) => setNewStartTime(e.target.value)}
                                  className={`px-3 py-2 border rounded-md text-sm w-full ${
                                    newRoomId && newDate && newStartTime && newEndTime && !newRoomConflictStatus
                                      ? 'border-green-300 bg-green-50'
                                      : newRoomConflictStatus
                                      ? 'border-red-300 bg-red-50'
                                      : 'border-gray-300'
                                  }`}
                                  placeholder="Start Time"
                                />
                                {newRoomId && newDate && newStartTime && newEndTime && (
                                  <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                                    newRoomConflictStatus ? 'bg-red-500' : 'bg-green-500'
                                  }`}></div>
                                )}
                              </div>
                              <div className="relative">
                                <input
                                  type="time"
                                  value={newEndTime}
                                  onChange={(e) => setNewEndTime(e.target.value)}
                                  className={`px-3 py-2 border rounded-md text-sm w-full ${
                                    newRoomId && newDate && newStartTime && newEndTime && !newRoomConflictStatus
                                      ? 'border-green-300 bg-green-50'
                                      : newRoomConflictStatus
                                      ? 'border-red-300 bg-red-50'
                                      : 'border-gray-300'
                                  }`}
                                  placeholder="End Time"
                                />
                                {newRoomId && newDate && newStartTime && newEndTime && (
                                  <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                                    newRoomConflictStatus ? 'bg-red-500' : 'bg-green-500'
                                  }`}></div>
                                )}
                              </div>
                            </div>
                            
                            {/* Conflict Status Message */}
                            {newRoomId && newDate && newStartTime && newEndTime && (
                              <div className={`text-xs mt-1 px-2 py-1 rounded ${
                                newRoomConflictStatus 
                                  ? 'bg-red-100 text-red-700 border border-red-300' 
                                  : 'bg-green-100 text-green-700 border border-green-300'
                              }`}>
                                {newRoomConflictStatus 
                                  ? '⚠️ This time slot conflicts with existing occupants' 
                                  : '✅ Time slot is available'
                                }
                              </div>
                            )}
                            
                            {/* View Schedule Button */}
                            {newRoomId && newDate && (
                              <button
                                onClick={() => setShowNewRoomSchedule(!showNewRoomSchedule)}
                                className="mt-2 flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200"
                                disabled={isLoadingNewRoomInfo}
                              >
                                <Eye className="w-4 h-4" />
                                {isLoadingNewRoomInfo ? 'Loading...' : (showNewRoomSchedule ? 'Hide' : 'View') + ' Schedule'}
                              </button>
                            )}

                            {/* Available Slots Display */}
                            {showNewRoomSchedule && newDate && (
                              <div className="mt-3 p-3 bg-gray-50 rounded-md border">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Available Time Slots:</h4>
                                {isLoadingNewRoomInfo ? (
                                  <div className="text-center py-2">
                                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                    <p className="text-xs text-gray-600 mt-1">Loading room schedule...</p>
                                  </div>
                                ) : availableSlots.length > 0 ? (
                                  <div className="space-y-1">
                                    {availableSlots.map((slot, index) => (
                                      <button
                                        key={index}
                                        onClick={() => handleAvailableSlotClick(slot)}
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
                                {newRoomInfo && newRoomInfo.occupants && newRoomInfo.occupants.length > 0 && (
                                  <div className="mt-3">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">Existing Occupants:</h4>
                                    <div className="space-y-1">
                                      {newRoomInfo.occupants
                                        .filter(occupant => moment(occupant.scheduledDate).format('YYYY-MM-DD') === newDate)
                                        .map((occupant, index) => (
                                          <div key={index} className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded border border-red-300">
                                            {occupant.occupantName} - {occupant.startTime} → {occupant.endTime}
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            <button
                              onClick={() => handleMoveOccupant(conflict.occupant.Id)}
                              className="mt-2 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                              disabled={!newRoomId || !newDate || !newStartTime || !newEndTime}
                            >
                              Move Occupant
                            </button>
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
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-gray-600">
                            This slot cannot be modified. It will be listed as a conflict.
                          </p>
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
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canScheduleMaintenance || isSubmitting}
            className={`px-4 py-2 rounded-md transition-colors ${
              canScheduleMaintenance && !isSubmitting
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? 'Scheduling...' : 'Schedule Maintenance'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceModal;
