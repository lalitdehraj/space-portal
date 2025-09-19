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
  const [conflictRoomSelections, setConflictRoomSelections] = useState<{[key: string]: string}>({});
  const [conflictDates, setConflictDates] = useState<{[key: string]: string}>({});
  const [conflictStartTimes, setConflictStartTimes] = useState<{[key: string]: string}>({});
  const [conflictEndTimes, setConflictEndTimes] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRoomInfo, setIsLoadingRoomInfo] = useState(false);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [conflictRoomInfos, setConflictRoomInfos] = useState<{[key: string]: RoomInfo}>({});
  const [isLoadingConflictRoomInfo, setIsLoadingConflictRoomInfo] = useState<{[key: string]: boolean}>({});
  const [showConflictRoomSchedule, setShowConflictRoomSchedule] = useState<{[key: string]: boolean}>({});
  const [conflictAvailableSlots, setConflictAvailableSlots] = useState<{[key: string]: string[]}>({});
  const [conflictRoomConflictStatus, setConflictRoomConflictStatus] = useState<{[key: string]: boolean}>({});

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

  // Fetch conflict room info when room is selected for a specific conflict
  const fetchConflictRoomInfo = async (conflictId: string, roomId: string) => {
    if (!roomId || !academicYear || !academicSession || !startDate || !endDate) return;
    
    setIsLoadingConflictRoomInfo(prev => ({ ...prev, [conflictId]: true }));
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
        setConflictRoomInfos(prev => ({ ...prev, [conflictId]: res.data! }));
        // Calculate available slots for the conflict date if it's set
        const conflictDate = conflictDates[conflictId];
        if (conflictDate) {
          calculateConflictAvailableSlots(conflictId, res.data, conflictDate);
        }
      }
    } catch (error) {
      console.error("Error fetching conflict room info:", error);
    } finally {
      setIsLoadingConflictRoomInfo(prev => ({ ...prev, [conflictId]: false }));
    }
  };

  // Calculate available slots for a given conflict room and date
  const calculateConflictAvailableSlots = (conflictId: string, roomInfo: RoomInfo, date: string) => {
    const today = new Date().toISOString().split("T")[0];
    const currentTime = new Date();
    if (new Date(date) < new Date(today)) {
      setConflictAvailableSlots(prev => ({ ...prev, [conflictId]: [] }));
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

    setConflictAvailableSlots(prev => ({ ...prev, [conflictId]: slots }));
  };

  // Handle available slot selection for conflicts
  const handleConflictAvailableSlotClick = (conflictId: string, timeString: string) => {
    const [start, end] = timeString.split(" → ");
    setConflictStartTimes(prev => ({ ...prev, [conflictId]: start }));
    setConflictEndTimes(prev => ({ ...prev, [conflictId]: end }));
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
          
          // Auto-fill the conflict-specific details
          setConflictDates(prev => ({ ...prev, [occupantId]: occupantDate }));
          setConflictStartTimes(prev => ({ ...prev, [occupantId]: occupant.startTime }));
          setConflictEndTimes(prev => ({ ...prev, [occupantId]: occupant.endTime }));
        }
      } else {
        // If unchecking, clear the conflict-specific details
        setConflictRoomSelections(prev => {
          const newSelections = { ...prev };
          delete newSelections[occupantId];
          return newSelections;
        });
        setConflictDates(prev => {
          const newDates = { ...prev };
          delete newDates[occupantId];
          return newDates;
        });
        setConflictStartTimes(prev => {
          const newTimes = { ...prev };
          delete newTimes[occupantId];
          return newTimes;
        });
        setConflictEndTimes(prev => {
          const newTimes = { ...prev };
          delete newTimes[occupantId];
          return newTimes;
        });
        setConflictRoomInfos(prev => {
          const newInfos = { ...prev };
          delete newInfos[occupantId];
          return newInfos;
        });
        setConflictAvailableSlots(prev => {
          const newSlots = { ...prev };
          delete newSlots[occupantId];
          return newSlots;
        });
        setConflictRoomConflictStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[occupantId];
          return newStatus;
        });
        setShowConflictRoomSchedule(prev => {
          const newSchedule = { ...prev };
          delete newSchedule[occupantId];
          return newSchedule;
        });
      }
      
      return newSelection;
    });
  };

  const checkConflictRoomConflicts = async (conflictId: string, roomId: string, date: string, newStartTime: string, newEndTime: string) => {
    const roomInfo = conflictRoomInfos[conflictId];
    if (!roomInfo || !date || !newStartTime || !newEndTime) return false;
    
    try {
      const newSlotStart = moment(`${date} ${newStartTime}`);
      const newSlotEnd = moment(`${date} ${newEndTime}`);
      
      // Check if the new room is the same as the maintenance room and time overlaps
      if (roomId === selectedRoomId && date === maintenanceDate) {
        const maintenanceStart = moment(`${maintenanceDate} ${startTime}`);
        const maintenanceEnd = moment(`${maintenanceDate} ${endTime}`);
        
        console.log('Checking maintenance conflict:', {
          roomId,
          selectedRoomId,
          date,
          maintenanceDate,
          newSlotStart: newSlotStart.format('YYYY-MM-DD HH:mm'),
          newSlotEnd: newSlotEnd.format('YYYY-MM-DD HH:mm'),
          maintenanceStart: maintenanceStart.format('YYYY-MM-DD HH:mm'),
          maintenanceEnd: maintenanceEnd.format('YYYY-MM-DD HH:mm')
        });
        
        // Check if the new slot overlaps with the maintenance time
        if (newSlotStart.isBefore(maintenanceEnd) && newSlotEnd.isAfter(maintenanceStart)) {
          console.log('MAINTENANCE CONFLICT DETECTED!');
          return true; // Conflict with maintenance time
        }
      }
      
      // Check for conflicts with existing occupants in the new room
      const conflictingOccupants = (roomInfo.occupants || []).filter((occupant: Occupant) => {
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
      console.error("Error checking conflict room conflicts:", error);
      return false;
    }
  };

  const handleMoveOccupant = async (occupantId: string) => {
    const newRoomId = conflictRoomSelections[occupantId];
    const newDate = conflictDates[occupantId];
    const newStartTime = conflictStartTimes[occupantId];
    const newEndTime = conflictEndTimes[occupantId];

    if (!newRoomId || !newDate || !newStartTime || !newEndTime) {
      alert("Please fill in all new slot details for this conflict");
      return;
    }

    // Check for conflicts in the new room
    const hasConflicts = await checkConflictRoomConflicts(occupantId, newRoomId, newDate, newStartTime, newEndTime);
    if (hasConflicts) {
      if (newRoomId === selectedRoomId && newDate === maintenanceDate) {
        alert("The selected time slot conflicts with the scheduled maintenance time. Please choose a different time or room.");
      } else {
        alert("The selected time slot conflicts with existing occupants in the new room. Please choose a different time or room.");
      }
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

      // Remove from conflicts list and clear conflict-specific data
      setConflicts(prev => prev.filter(c => c.occupant.Id !== occupantId));
      setSelectedConflicts(prev => prev.filter(id => id !== occupantId));
      
      // Clear conflict-specific data
      setConflictRoomSelections(prev => {
        const newSelections = { ...prev };
        delete newSelections[occupantId];
        return newSelections;
      });
      setConflictDates(prev => {
        const newDates = { ...prev };
        delete newDates[occupantId];
        return newDates;
      });
      setConflictStartTimes(prev => {
        const newTimes = { ...prev };
        delete newTimes[occupantId];
        return newTimes;
      });
      setConflictEndTimes(prev => {
        const newTimes = { ...prev };
        delete newTimes[occupantId];
        return newTimes;
      });
      setConflictRoomInfos(prev => {
        const newInfos = { ...prev };
        delete newInfos[occupantId];
        return newInfos;
      });
      setConflictAvailableSlots(prev => {
        const newSlots = { ...prev };
        delete newSlots[occupantId];
        return newSlots;
      });
      setConflictRoomConflictStatus(prev => {
        const newStatus = { ...prev };
        delete newStatus[occupantId];
        return newStatus;
      });
      setShowConflictRoomSchedule(prev => {
        const newSchedule = { ...prev };
        delete newSchedule[occupantId];
        return newSchedule;
      });
      
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

      // Remove from conflicts list and clear conflict-specific data
      setConflicts(prev => prev.filter(c => c.occupant.Id !== occupantId));
      setSelectedConflicts(prev => prev.filter(id => id !== occupantId));
      
      // Clear conflict-specific data
      setConflictRoomSelections(prev => {
        const newSelections = { ...prev };
        delete newSelections[occupantId];
        return newSelections;
      });
      setConflictDates(prev => {
        const newDates = { ...prev };
        delete newDates[occupantId];
        return newDates;
      });
      setConflictStartTimes(prev => {
        const newTimes = { ...prev };
        delete newTimes[occupantId];
        return newTimes;
      });
      setConflictEndTimes(prev => {
        const newTimes = { ...prev };
        delete newTimes[occupantId];
        return newTimes;
      });
      setConflictRoomInfos(prev => {
        const newInfos = { ...prev };
        delete newInfos[occupantId];
        return newInfos;
      });
      setConflictAvailableSlots(prev => {
        const newSlots = { ...prev };
        delete newSlots[occupantId];
        return newSlots;
      });
      setConflictRoomConflictStatus(prev => {
        const newStatus = { ...prev };
        delete newStatus[occupantId];
        return newStatus;
      });
      setShowConflictRoomSchedule(prev => {
        const newSchedule = { ...prev };
        delete newSchedule[occupantId];
        return newSchedule;
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

  // Check if there are any non-editable conflicts that haven't been resolved
  const hasNonEditableConflicts = conflicts.some(c => !c.isEditable && !selectedConflicts.includes(c.occupant.Id));
  
  const canScheduleMaintenance = selectedRoomInfo && 
    conflicts.length === 0 || 
    (conflicts.every(c => selectedConflicts.includes(c.occupant.Id)) && !hasNonEditableConflicts);

  return (
    <div className="fixed inset-0 bg-[#00000070] flex items-center justify-center z-50 text-gray-500">
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

                {/* Show warning for non-editable conflicts */}
                {hasNonEditableConflicts && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <div className="flex items-center">
                      <div className="text-red-500 mr-2">🚫</div>
                      <p className="text-red-800 font-medium">
                        Non-editable conflicts detected
                      </p>
                    </div>
                    <p className="text-red-700 text-sm mt-1">
                      Some conflicts cannot be resolved from this portal. Please contact the faculty to change their class schedule before proceeding with maintenance.
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
                                value={conflictRoomSelections[conflict.occupant.Id] || ""}
                                onChange={(e) => {
                                  const roomId = e.target.value;
                                  setConflictRoomSelections(prev => ({ ...prev, [conflict.occupant.Id]: roomId }));
                                  if (roomId) {
                                    fetchConflictRoomInfo(conflict.occupant.Id, roomId);
                                    // Immediately check for conflicts if we have all required data
                                    const date = conflictDates[conflict.occupant.Id];
                                    const startTime = conflictStartTimes[conflict.occupant.Id];
                                    const endTime = conflictEndTimes[conflict.occupant.Id];
                                    if (date && startTime && endTime) {
                                      checkConflictRoomConflicts(conflict.occupant.Id, roomId, date, startTime, endTime)
                                        .then(hasConflicts => {
                                          setConflictRoomConflictStatus(prev => ({ ...prev, [conflict.occupant.Id]: hasConflicts }));
                                        });
                                    }
                                  } else {
                                    setConflictRoomInfos(prev => {
                                      const newInfos = { ...prev };
                                      delete newInfos[conflict.occupant.Id];
                                      return newInfos;
                                    });
                                    setConflictAvailableSlots(prev => {
                                      const newSlots = { ...prev };
                                      delete newSlots[conflict.occupant.Id];
                                      return newSlots;
                                    });
                                    setConflictRoomConflictStatus(prev => {
                                      const newStatus = { ...prev };
                                      delete newStatus[conflict.occupant.Id];
                                      return newStatus;
                                    });
                                  }
                                }}
                                className={`px-3 py-2 border rounded-md text-sm ${
                                  conflictRoomSelections[conflict.occupant.Id] 
                                    ? 'border-green-300 bg-green-50' 
                                    : 'border-gray-300'
                                }`}
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
                                value={conflictDates[conflict.occupant.Id] || ""}
                                onChange={(e) => {
                                  const date = e.target.value;
                                  setConflictDates(prev => ({ ...prev, [conflict.occupant.Id]: date }));
                                  const roomInfo = conflictRoomInfos[conflict.occupant.Id];
                                  if (roomInfo && date) {
                                    calculateConflictAvailableSlots(conflict.occupant.Id, roomInfo, date);
                                  }
                                  // Immediately check for conflicts if we have all required data
                                  const roomId = conflictRoomSelections[conflict.occupant.Id];
                                  const startTime = conflictStartTimes[conflict.occupant.Id];
                                  const endTime = conflictEndTimes[conflict.occupant.Id];
                                  if (roomId && startTime && endTime) {
                                    checkConflictRoomConflicts(conflict.occupant.Id, roomId, date, startTime, endTime)
                                      .then(hasConflicts => {
                                        setConflictRoomConflictStatus(prev => ({ ...prev, [conflict.occupant.Id]: hasConflicts }));
                                      });
                                  } else {
                                    setConflictRoomConflictStatus(prev => ({ ...prev, [conflict.occupant.Id]: false }));
                                  }
                                }}
                                className={`px-3 py-2 border rounded-md text-sm ${
                                  conflictDates[conflict.occupant.Id] 
                                    ? 'border-green-300 bg-green-50' 
                                    : 'border-gray-300'
                                }`}
                                placeholder="New Date"
                                min={moment().format('YYYY-MM-DD')}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <div className="relative">
                                <input
                                  type="time"
                                  value={conflictStartTimes[conflict.occupant.Id] || ""}
                                  onChange={(e) => {
                                    const startTime = e.target.value;
                                    setConflictStartTimes(prev => ({ ...prev, [conflict.occupant.Id]: startTime }));
                                    // Check for conflicts when time changes
                                    const roomId = conflictRoomSelections[conflict.occupant.Id];
                                    const date = conflictDates[conflict.occupant.Id];
                                    const endTime = conflictEndTimes[conflict.occupant.Id];
                                    if (roomId && date && startTime && endTime) {
                                      checkConflictRoomConflicts(conflict.occupant.Id, roomId, date, startTime, endTime)
                                        .then(hasConflicts => {
                                          setConflictRoomConflictStatus(prev => ({ ...prev, [conflict.occupant.Id]: hasConflicts }));
                                        });
                                    }
                                  }}
                                  className={`px-3 py-2 border rounded-md text-sm w-full ${
                                    conflictRoomSelections[conflict.occupant.Id] && conflictDates[conflict.occupant.Id] && conflictStartTimes[conflict.occupant.Id] && conflictEndTimes[conflict.occupant.Id] && !conflictRoomConflictStatus[conflict.occupant.Id]
                                      ? 'border-green-300 bg-green-50'
                                      : conflictRoomConflictStatus[conflict.occupant.Id]
                                      ? 'border-red-300 bg-red-50'
                                      : 'border-gray-300'
                                  }`}
                                  placeholder="Start Time"
                                />
                                {conflictRoomSelections[conflict.occupant.Id] && conflictDates[conflict.occupant.Id] && conflictStartTimes[conflict.occupant.Id] && conflictEndTimes[conflict.occupant.Id] && (
                                  <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                                    conflictRoomConflictStatus[conflict.occupant.Id] ? 'bg-red-500' : 'bg-green-500'
                                  }`}></div>
                                )}
                              </div>
                              <div className="relative">
                                <input
                                  type="time"
                                  value={conflictEndTimes[conflict.occupant.Id] || ""}
                                  onChange={(e) => {
                                    const endTime = e.target.value;
                                    setConflictEndTimes(prev => ({ ...prev, [conflict.occupant.Id]: endTime }));
                                    // Check for conflicts when time changes
                                    const roomId = conflictRoomSelections[conflict.occupant.Id];
                                    const date = conflictDates[conflict.occupant.Id];
                                    const startTime = conflictStartTimes[conflict.occupant.Id];
                                    if (roomId && date && startTime && endTime) {
                                      checkConflictRoomConflicts(conflict.occupant.Id, roomId, date, startTime, endTime)
                                        .then(hasConflicts => {
                                          setConflictRoomConflictStatus(prev => ({ ...prev, [conflict.occupant.Id]: hasConflicts }));
                                        });
                                    }
                                  }}
                                  className={`px-3 py-2 border rounded-md text-sm w-full ${
                                    conflictRoomSelections[conflict.occupant.Id] && conflictDates[conflict.occupant.Id] && conflictStartTimes[conflict.occupant.Id] && conflictEndTimes[conflict.occupant.Id] && !conflictRoomConflictStatus[conflict.occupant.Id]
                                      ? 'border-green-300 bg-green-50'
                                      : conflictRoomConflictStatus[conflict.occupant.Id]
                                      ? 'border-red-300 bg-red-50'
                                      : 'border-gray-300'
                                  }`}
                                  placeholder="End Time"
                                />
                                {conflictRoomSelections[conflict.occupant.Id] && conflictDates[conflict.occupant.Id] && conflictStartTimes[conflict.occupant.Id] && conflictEndTimes[conflict.occupant.Id] && (
                                  <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                                    conflictRoomConflictStatus[conflict.occupant.Id] ? 'bg-red-500' : 'bg-green-500'
                                  }`}></div>
                                )}
                              </div>
                            </div>
                            
                            {/* Conflict Status Message */}
                            {conflictRoomSelections[conflict.occupant.Id] && conflictDates[conflict.occupant.Id] && conflictStartTimes[conflict.occupant.Id] && conflictEndTimes[conflict.occupant.Id] && (
                              <div className={`text-xs mt-1 px-2 py-1 rounded ${
                                conflictRoomConflictStatus[conflict.occupant.Id] 
                                  ? 'bg-red-100 text-red-700 border border-red-300' 
                                  : 'bg-green-100 text-green-700 border border-green-300'
                              }`}>
                                {conflictRoomConflictStatus[conflict.occupant.Id] 
                                  ? (conflictRoomSelections[conflict.occupant.Id] === selectedRoomId && conflictDates[conflict.occupant.Id] === maintenanceDate
                                      ? '⚠️ This time slot conflicts with scheduled maintenance'
                                      : '⚠️ This time slot conflicts with existing occupants')
                                  : '✅ Time slot is available'
                                }
                              </div>
                            )}
                            
                            {/* View Schedule Button */}
                            {conflictRoomSelections[conflict.occupant.Id] && conflictDates[conflict.occupant.Id] && (
                              <button
                                onClick={() => setShowConflictRoomSchedule(prev => ({ ...prev, [conflict.occupant.Id]: !prev[conflict.occupant.Id] }))}
                                className="mt-2 flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200"
                                disabled={isLoadingConflictRoomInfo[conflict.occupant.Id]}
                              >
                                <Eye className="w-4 h-4" />
                                {isLoadingConflictRoomInfo[conflict.occupant.Id] ? 'Loading...' : (showConflictRoomSchedule[conflict.occupant.Id] ? 'Hide' : 'View') + ' Schedule'}
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
                                {conflictRoomInfos[conflict.occupant.Id] && conflictRoomInfos[conflict.occupant.Id]?.occupants && (conflictRoomInfos[conflict.occupant.Id]?.occupants?.length || 0) > 0 && (
                                  <div className="mt-3">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">Existing Occupants:</h4>
                                    <div className="space-y-1">
                                      {conflictRoomInfos[conflict.occupant.Id]?.occupants
                                        ?.filter(occupant => moment(occupant.scheduledDate).format('YYYY-MM-DD') === conflictDates[conflict.occupant.Id])
                                        ?.map((occupant, index) => (
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
                              disabled={!conflictRoomSelections[conflict.occupant.Id] || !conflictDates[conflict.occupant.Id] || !conflictStartTimes[conflict.occupant.Id] || !conflictEndTimes[conflict.occupant.Id]}
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
                        <div className="bg-red-50 border border-red-200 p-3 rounded">
                          <div className="flex items-center mb-2">
                            <div className="text-red-500 mr-2">🚫</div>
                            <p className="text-red-800 font-medium text-sm">
                              Non-editable Conflict
                            </p>
                          </div>
                          <p className="text-red-700 text-sm">
                            This is a class from the timetable that cannot be modified from this portal. 
                            Please contact the faculty ({conflict.occupant.occupantName}) to change their class schedule 
                            before proceeding with maintenance.
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
            {isSubmitting 
              ? 'Scheduling...' 
              : hasNonEditableConflicts 
                ? 'Cannot Schedule - Non-editable Conflicts' 
                : 'Schedule Maintenance'
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceModal;
