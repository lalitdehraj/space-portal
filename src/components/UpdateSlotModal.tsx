import React, { useState, useEffect } from "react";
import { X, Calendar, Clock, AlertTriangle, CheckCircle, Eye } from "lucide-react";
import moment from "moment";
import { Occupant } from "@/types";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";

type UpdateSlotModalProps = {
  occupant: Occupant;
  occupants: Occupant[]; // All occupants for conflict checking
  onClose: () => void;
  onUpdate: () => void; // Callback after successful update
  academicSessionStartDate: string;
  academicSessionEndDate: string;
};

interface ConflictInfo {
  hasConflict: boolean;
  conflictingOccupants: Occupant[];
}

export default function UpdateSlotModal({
  occupant,
  occupants,
  onClose,
  onUpdate,
  academicSessionStartDate,
  academicSessionEndDate,
}: UpdateSlotModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>(
    moment(occupant.scheduledDate).format("YYYY-MM-DD")
  );
  const [startTime, setStartTime] = useState<string>(
    typeof occupant.startTime === "string" 
      ? occupant.startTime 
      : moment(occupant.startTime).format("HH:mm")
  );
  const [endTime, setEndTime] = useState<string>(
    typeof occupant.endTime === "string" 
      ? occupant.endTime 
      : moment(occupant.endTime).format("HH:mm")
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo>({
    hasConflict: false,
    conflictingOccupants: [],
  });

  // Check if the slot is partially elapsed (current ongoing slot)
  const isSlotPartiallyElapsed = () => {
    const now = moment();
    const slotStart = moment(`${moment(occupant.scheduledDate).format("YYYY-MM-DD")} ${startTime}`);
    const slotEnd = moment(`${moment(occupant.scheduledDate).format("YYYY-MM-DD")} ${endTime}`);
    
    return now.isAfter(slotStart) && now.isBefore(slotEnd);
  };

  // Check if this is a current ongoing slot (same date as today)
  const isCurrentOngoingSlot = () => {
    const now = moment();
    const slotDate = moment(occupant.scheduledDate).format("YYYY-MM-DD");
    const today = now.format("YYYY-MM-DD");
    
    return slotDate === today && isSlotPartiallyElapsed();
  };

  // Get the current time rounded to the next hour for partial slot editing
  const getCurrentTimeRounded = () => {
    const now = moment();
    return now.add(1, 'hour').startOf('hour').format("HH:mm");
  };

  // Get minimum time for validation
  const getMinTime = () => {
    if (isSlotPartiallyElapsed() && moment(occupant.scheduledDate).format("YYYY-MM-DD") === selectedDate) {
      return moment().format("HH:mm");
    }
    return "09:00";
  };

  // Get maximum time
  const getMaxTime = () => {
    return "18:00";
  };

  // Debounced conflict checking to prevent UI sticking
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (selectedDate && startTime && endTime) {
        checkForConflicts();
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [selectedDate, startTime, endTime]);

  // Auto-adjust start time for partially elapsed slots (only once)
  useEffect(() => {
    if (isSlotPartiallyElapsed() && moment(occupant.scheduledDate).format("YYYY-MM-DD") === selectedDate) {
      const currentTime = moment().format("HH:mm");
      if (moment(currentTime, "HH:mm").isAfter(moment(startTime, "HH:mm"))) {
        setStartTime(currentTime);
      }
    }
  }, [selectedDate]);

  const checkForConflicts = React.useCallback(() => {
    if (!selectedDate || !startTime || !endTime) {
      setConflictInfo({ hasConflict: false, conflictingOccupants: [] });
      return;
    }

    // Early exit if times are invalid
    if (!validateTimeRange()) {
      setConflictInfo({ hasConflict: false, conflictingOccupants: [] });
      return;
    }

    const newStartTime = moment(`${selectedDate} ${startTime}`);
    const newEndTime = moment(`${selectedDate} ${endTime}`);

    // Filter occupants for the same date first (more efficient)
    const sameDateOccupants = occupants.filter((otherOccupant) => {
      if (otherOccupant.Id === occupant.Id) return false;
      const otherDate = moment(otherOccupant.scheduledDate).format("YYYY-MM-DD");
      return otherDate === selectedDate;
    });

    // For current ongoing slots, only check conflicts for the extended time (after original end time)
    let conflictingOccupants: Occupant[] = [];
    
    if (isCurrentOngoingSlot()) {
      // For current ongoing slots, only check conflicts in the extended time period
      const originalEndTime = moment(`${selectedDate} ${typeof occupant.endTime === "string" ? occupant.endTime : moment(occupant.endTime).format("HH:mm")}`);
      
      // Only check conflicts if we're extending beyond original end time
      if (newEndTime.isAfter(originalEndTime)) {
        conflictingOccupants = sameDateOccupants.filter((otherOccupant) => {
          const otherStartTime = typeof otherOccupant.startTime === "string" 
            ? moment(`${selectedDate} ${otherOccupant.startTime}`)
            : moment(otherOccupant.startTime);
          const otherEndTime = typeof otherOccupant.endTime === "string" 
            ? moment(`${selectedDate} ${otherOccupant.endTime}`)
            : moment(otherOccupant.endTime);

          // Check for overlap in the extended time period only
          return (
            (originalEndTime.isBefore(otherEndTime) && newEndTime.isAfter(otherStartTime)) ||
            (originalEndTime.isSame(otherStartTime) && newEndTime.isAfter(otherEndTime))
          );
        });
      }
    } else {
      // For non-current slots, check all conflicts as usual
      conflictingOccupants = sameDateOccupants.filter((otherOccupant) => {
        const otherStartTime = typeof otherOccupant.startTime === "string" 
          ? moment(`${selectedDate} ${otherOccupant.startTime}`)
          : moment(otherOccupant.startTime);
        const otherEndTime = typeof otherOccupant.endTime === "string" 
          ? moment(`${selectedDate} ${otherOccupant.endTime}`)
          : moment(otherOccupant.endTime);

        // Check for time overlap
        return (
          (newStartTime.isBefore(otherEndTime) && newEndTime.isAfter(otherStartTime)) ||
          (newStartTime.isSame(otherStartTime) && newEndTime.isSame(otherEndTime))
        );
      });
    }

    setConflictInfo({
      hasConflict: conflictingOccupants.length > 0,
      conflictingOccupants,
    });
  }, [selectedDate, startTime, endTime, occupants, occupant.Id]);

  const validateTimeRange = () => {
    if (!startTime || !endTime) return false;
    
    const start = moment(startTime, "HH:mm");
    const end = moment(endTime, "HH:mm");
    
    return end.isAfter(start);
  };

  const validateDateRange = () => {
    if (!selectedDate) return false;
    
    const selected = moment(selectedDate);
    const sessionStart = moment(academicSessionStartDate);
    const sessionEnd = moment(academicSessionEndDate);
    
    return selected.isBetween(sessionStart, sessionEnd, "day", "[]");
  };

  const validateSlotNotInPast = () => {
    if (!selectedDate || !startTime) return true; // Allow if not set yet
    
    const slotDateTime = moment(`${selectedDate} ${startTime}`);
    const now = moment();
    
    // Must be in the future (not equal to current time)
    return slotDateTime.isAfter(now);
  };

  const validateTimeNotInPast = () => {
    if (!selectedDate || !startTime) return true;
    
    const selectedDateMoment = moment(selectedDate);
    const now = moment();
    
    // If it's today, check if time is in the past
    if (selectedDateMoment.isSame(now, 'day')) {
      const currentTime = now.format("HH:mm");
      return moment(startTime, "HH:mm").isAfter(moment(currentTime, "HH:mm"));
    }
    
    return true; // Future dates are always valid
  };

  const isSlotFullyElapsed = () => {
    const now = moment();
    const slotEnd = moment(`${moment(occupant.scheduledDate).format("YYYY-MM-DD")} ${endTime}`);
    
    return now.isAfter(slotEnd);
  };

  const handleUpdate = async () => {
    if (isSlotFullyElapsed()) {
      alert("This slot has already ended and cannot be edited");
      return;
    }

    if (!validateTimeRange()) {
      alert("End time must be after start time");
      return;
    }

    if (!validateDateRange()) {
      alert("Selected date must be within the academic session");
      return;
    }

    if (!validateSlotNotInPast()) {
      alert("Cannot schedule a slot in the past");
      return;
    }

    if (!validateTimeNotInPast()) {
      alert("Cannot schedule a time in the past");
      return;
    }

    if (conflictInfo.hasConflict) {
      alert("Cannot update slot due to conflicts with existing allocations");
      return;
    }

    setIsUpdating(true);

    try {
      const updateData = {
        allocationEntNo: occupant.Id,
        scheduledDate: selectedDate,
        startTime: startTime,
        endTime: endTime,
        isAllocationActive: true,
      };

      const response = await callApi(
        process.env.NEXT_PUBLIC_UPDATE_SPACE_ALLOCATION_ENTRY || URL_NOT_FOUND,
        updateData
      );

      if (response.success) {
        onUpdate();
        onClose();
      } else {
        alert("Failed to update slot. Please try again.");
      }
    } catch (error) {
      console.error("Error updating slot:", error);
      alert("An error occurred while updating the slot");
    } finally {
      setIsUpdating(false);
    }
  };

  const isFormValid = () => {
    // Case 3: Disable update for current ongoing slots
    if (isCurrentOngoingSlot()) {
      return false;
    }

    return (
      selectedDate &&
      startTime &&
      endTime &&
      validateTimeRange() &&
      validateDateRange() &&
      validateSlotNotInPast() &&
      validateTimeNotInPast() &&
      !conflictInfo.hasConflict &&
      !isSlotFullyElapsed()
    );
  };

  return (
    <section className="fixed inset-0 z-50 h-screen w-screen bg-[#00000070] flex items-center justify-center text-gray-600 p-4">
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-8 py-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">Update Slot</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">

        {/* Current Info */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-700 mb-2">Current Allocation</h3>
          <div className="text-sm space-y-1">
            <p><span className="text-gray-500">Occupant:</span> {occupant.occupantName}</p>
            <p><span className="text-gray-500">Type:</span> {occupant.type}</p>
            <p><span className="text-gray-500">Date:</span> {moment(occupant.scheduledDate).format("dddd, MMM D, YYYY")}</p>
            <p><span className="text-gray-500">Time:</span> {startTime} - {endTime}</p>
          </div>
        </div>

        {/* Warning Messages */}
        {isSlotFullyElapsed() && (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center mb-2">
              <Eye className="w-5 h-5 text-gray-500 mr-2" />
              <span className="font-medium text-gray-700">Read-Only View</span>
            </div>
            <p className="text-sm text-gray-600">
              This slot has already ended. You can view the details but cannot make changes.
            </p>
          </div>
        )}

        {isSlotPartiallyElapsed() && !isSlotFullyElapsed() && !isCurrentOngoingSlot() && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center mb-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
              <span className="font-medium text-yellow-700">Partial Slot Editing</span>
            </div>
            <p className="text-sm text-yellow-600">
              This slot is currently in progress. You can only edit the remaining time.
            </p>
          </div>
        )}

        {isCurrentOngoingSlot() && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center mb-2">
              <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
              <span className="font-medium text-red-700">Current Ongoing Slot</span>
            </div>
            <p className="text-sm text-red-600">
              This slot is currently ongoing and cannot be updated. You can only unallocate the remaining time.
            </p>
          </div>
        )}

        {/* Update Form */}
        <div className="space-y-4">
          {/* Date Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline w-4 h-4 mr-1" />
              Select Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedDate(value);
              }}
              min={moment().format("YYYY-MM-DD")}
              max={academicSessionEndDate}
              disabled={isSlotPartiallyElapsed() || isSlotFullyElapsed() || isCurrentOngoingSlot()}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-orange-500 ${
                (isSlotPartiallyElapsed() || isSlotFullyElapsed() || isCurrentOngoingSlot()) ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
            />
            {(isSlotPartiallyElapsed() || isSlotFullyElapsed() || isCurrentOngoingSlot()) && (
              <p className="text-xs text-gray-500 mt-1">
                {isSlotFullyElapsed() 
                  ? "Date cannot be changed for past slots" 
                  : isCurrentOngoingSlot()
                  ? "Date cannot be changed for current ongoing slots"
                  : "Date cannot be changed for slots in progress"
                }
              </p>
            )}
          </div>

          {/* Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="inline w-4 h-4 mr-1" />
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => {
                  const value = e.target.value;
                  setStartTime(value);
                }}
                onBlur={(e) => {
                  // Validate and adjust on blur to prevent UI sticking
                  const value = e.target.value;
                  if (value && moment(value, "HH:mm").isBefore(moment(getMinTime(), "HH:mm"))) {
                    setStartTime(getMinTime());
                  }
                }}
                min={getMinTime()}
                max={getMaxTime()}
                disabled={isSlotPartiallyElapsed() || isSlotFullyElapsed() || isCurrentOngoingSlot()}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                  (isSlotPartiallyElapsed() || isSlotFullyElapsed() || isCurrentOngoingSlot()) ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              />
              {(isSlotPartiallyElapsed() || isSlotFullyElapsed() || isCurrentOngoingSlot()) && (
                <p className="text-xs text-gray-500 mt-1">
                  {isSlotFullyElapsed() 
                    ? "Start time locked for past slots" 
                    : isCurrentOngoingSlot()
                    ? "Start time locked for current ongoing slots"
                    : "Start time locked for slots in progress"
                  }
                </p>
              )}
              {!isSlotFullyElapsed() && !isSlotPartiallyElapsed() && (
                <p className="text-xs text-gray-500 mt-1">
                  Select any time between 09:00 and 18:00
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="inline w-4 h-4 mr-1" />
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => {
                  const value = e.target.value;
                  setEndTime(value);
                }}
                onBlur={(e) => {
                  // Validate end time on blur
                  const value = e.target.value;
                  if (value && startTime && moment(value, "HH:mm").isSameOrBefore(moment(startTime, "HH:mm"))) {
                    // Auto-adjust to 1 hour after start time
                    const adjustedEnd = moment(startTime, "HH:mm").add(1, 'hour').format("HH:mm");
                    setEndTime(adjustedEnd);
                  }
                }}
                min={startTime || "09:00"}
                max={getMaxTime()}
                disabled={isSlotFullyElapsed() || isCurrentOngoingSlot()}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                  (isSlotFullyElapsed() || isCurrentOngoingSlot()) ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              />
              {(isSlotPartiallyElapsed() || isSlotFullyElapsed() || isCurrentOngoingSlot()) && (
                <p className="text-xs text-gray-500 mt-1">
                  {isSlotFullyElapsed() 
                    ? "End time locked for past slots" 
                    : isCurrentOngoingSlot()
                    ? "End time locked for current ongoing slots"
                    : "Only remaining time can be edited"
                  }
                </p>
              )}
              {!isSlotFullyElapsed() && !isSlotPartiallyElapsed() && (
                <p className="text-xs text-gray-500 mt-1">
                  Must be after start time
                </p>
              )}
            </div>
          </div>

          {/* Conflict Check */}
          {conflictInfo.hasConflict && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center mb-2">
                <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
                <span className="font-medium text-red-700">Conflict Detected</span>
              </div>
              <p className="text-sm text-red-600 mb-2">
                The selected time slot conflicts with existing allocations:
              </p>
              <ul className="text-sm text-red-600 space-y-1">
                {conflictInfo.conflictingOccupants.map((conflict) => (
                  <li key={conflict.Id} className="flex items-center">
                    <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                    {conflict.occupantName} ({conflict.startTime} - {conflict.endTime})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Validation Messages */}
          {selectedDate && startTime && endTime && !validateTimeRange() && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center mb-2">
                <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
                <span className="font-medium text-red-700">Invalid Time Range</span>
              </div>
              <p className="text-sm text-red-600">
                End time must be after start time.
              </p>
            </div>
          )}

          {selectedDate && startTime && !validateTimeNotInPast() && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center mb-2">
                <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
                <span className="font-medium text-red-700">Past Time Selected</span>
              </div>
              <p className="text-sm text-red-600">
                Cannot schedule a time in the past.
              </p>
            </div>
          )}

          {/* Success Message */}
          {!conflictInfo.hasConflict && selectedDate && startTime && endTime && validateTimeRange() && validateTimeNotInPast() && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-orange-500 mr-2" />
                <span className="font-medium text-orange-700">No Conflicts</span>
              </div>
              <p className="text-sm text-orange-600 mt-1">
                The selected time slot is available for allocation.
              </p>
            </div>
          )}
        </div>
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 px-8 py-6 border-t border-gray-200">
          <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded-lg text-gray-700 hover:bg-gray-300 transition"
            disabled={isUpdating}
          >
            {isSlotFullyElapsed() ? "Close" : "Cancel"}
          </button>
          {!isSlotFullyElapsed() && !isCurrentOngoingSlot() && (
            <button
              onClick={handleUpdate}
              disabled={!isFormValid() || isUpdating}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isUpdating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Updating...
                </>
              ) : (
                "Update Slot"
              )}
            </button>
          )}
          {isSlotFullyElapsed() && (
            <div className="px-4 py-2 bg-gray-100 rounded-lg flex items-center gap-2 text-gray-500">
              <Eye className="w-4 h-4" />
              View Only
            </div>
          )}
          {isCurrentOngoingSlot() && (
            <div className="px-4 py-2 bg-red-100 rounded-lg flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-4 h-4" />
              Update Disabled
            </div>
          )}
          </div>
        </div>
      </div>
    </section>
  );
}
