import { URL_NOT_FOUND } from "@/constants";
import { Occupant, Room, RoomInfo } from "@/types";
import { callApi } from "@/utils/apiIntercepter";
import moment from "moment";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/app/store";
import MaintenanceCardModal from "./MaintenanceCardModal";

interface RoomCardProps {
  room: Room;
  isExpanded?: boolean;
  onClick?: (room: Room) => void;
  cachedSubrooms?: Room[]; // Optional prop for cached subrooms
}
const WORK_HOURS_PER_DAY = 9;

const getOccupancyStatus = (room: Room): "low" | "medium" | "high" => {
  const occupancyRate = room.occupied / room.roomCapactiy;
  if (occupancyRate <= 0.1) return "low";
  if (occupancyRate > 0.8) return "high";
  return "medium";
};

export default function RoomCard({ room, isExpanded = false, onClick, cachedSubrooms }: RoomCardProps) {
  const occupancyStatus = getOccupancyStatus(room);

  // Debug log to check room properties
  console.log(`Room ${room.roomName}: IsSitting=${room.IsSitting}, hasSubroom=${room.hasSubroom}`);

  const statusClasses = {
    low: {
      leftBorderColor: "border-l-green-600",
      text: "text-green-600",
      background: "bg-green-600/10",
      progressBar: "bg-green-600",
    },
    high: {
      leftBorderColor: "border-l-red-500",
      text: "text-red-500",
      background: "bg-red-500/10",
      progressBar: "bg-red-500",
    },
    medium: {
      leftBorderColor: "border-l-yellow-500",
      text: "text-yellow-500",
      background: "bg-yellow-500/10",
      progressBar: "bg-yellow-500",
    },
  };

  const isActiveSession = useSelector((state: RootState) => state.dataState.isActiveSession);
  const academicSessionStartDate = useSelector((state: RootState) => state.dataState.selectedAcademicSessionStartDate);
  const academicSessionEndDate = useSelector((state: RootState) => state.dataState.selectedAcademicSessionEndDate);
  const acadmeicYear = useSelector((state: RootState) => state.dataState.selectedAcademicYear);
  const acadmeicSession = useSelector((state: RootState) => state.dataState.selectedAcademicSession);

  const [totalOccupants, setTotalOccupants] = useState<number>(0);
  const [occupancyPercent, setOccupancyPercent] = useState<number>(0);
  const [currentOccupants, setCurrentOccupants] = useState<Occupant[]>([]);
  const [, setLoading] = useState<boolean>(true);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState<boolean>(false);

  useEffect(() => {
    const fetchRoomInfo = async () => {
      try {
        setLoading(true);
        // Determine start/end dates depending on session
        const startDate = isActiveSession ? moment().startOf("isoWeek").format("YYYY-MM-DD") : moment(academicSessionStartDate).format("YYYY-MM-DD");

        const endDate = isActiveSession ? moment().endOf("isoWeek").format("YYYY-MM-DD") : moment(academicSessionEndDate).format("YYYY-MM-DD");

        if (room.hasSubroom) {
          // Skip API calls for rooms with subrooms as per user request
          setTotalOccupants(0);
          setOccupancyPercent(0);
          setCurrentOccupants([]);
        } else {
          // Handle regular room or subroom
          await fetchRegularRoomOccupancy(startDate, endDate);
          await fetchRegularRoomCurrentOccupancy();
        }
      } catch (error) {
        console.error("Error fetching room occupancy:", error);
        setOccupancyPercent(0);
      } finally {
        setLoading(false);
      }
    };

    const fetchRegularRoomOccupancy = async (startDate: string, endDate: string) => {
      const requestBody = {
        roomID: room.parentId ? room.parentId : room.roomId,
        subroomID: room.parentId ? room.roomId : "",
        academicYr: acadmeicYear,
        acadSess: acadmeicSession,
        startDate,
        endDate,
      };

      const response = await callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, requestBody);

      if (response.success && response.data) {
        const roomData = response.data;
        console.log("roomData", roomData);

        setTotalOccupants(response.data.occupants?.length || 0);
        // Determine date range
        const startDateMoment = isActiveSession ? moment().startOf("isoWeek") : moment(academicSessionStartDate);
        const endDateMoment = isActiveSession ? moment().endOf("isoWeek") : moment(academicSessionEndDate);

        const weeklyOccupants: Occupant[] =
          roomData.occupants?.filter((o) => {
            if (!o.scheduledDate) return false;
            const scheduled = moment(o.scheduledDate);
            return scheduled.isBetween(startDateMoment, endDateMoment, "day", "[]");
          }) || [];

        // Calculate occupancy differently for sitting vs non-sitting rooms
        let percent = 0;

        if (roomData.isSitting) {
          // For sitting rooms, calculate based on current active occupants
          const today = moment();
          const activeOccupants =
            roomData.occupants?.filter((o) => {
              if (!o.scheduledDate) return false;
              const startDate = moment(o.scheduledDate);
              const endDate = o.scheduledEndDate ? moment(o.scheduledEndDate) : startDate;

              // Check if the occupant is currently active (today is between start and end date)
              return today.isBetween(startDate, endDate, "day", "[]");
            }) || [];

          // Calculate occupancy percentage based on room capacity
          const capacity = roomData.capacity || 1; // Avoid division by zero
          percent = Math.min((activeOccupants.length / capacity) * 100, 100);
        } else {
          // For non-sitting rooms, use time-based calculation
          const totalMinutes = weeklyOccupants.reduce((sum, occupant) => {
            if (!occupant.startTime || !occupant.endTime) return sum;
            const start = moment(occupant.startTime, "HH:mm");
            const end = moment(occupant.endTime, "HH:mm");
            return sum + Math.max(end.diff(start, "minutes"), 0);
          }, 0);

          const totalDays = endDateMoment.diff(startDateMoment, "days") + 1;
          const maxMinutes = totalDays * WORK_HOURS_PER_DAY * 60;
          percent = maxMinutes > 0 ? (totalMinutes / maxMinutes) * 100 : 0;
        }
        setOccupancyPercent(percent);
      }
    };

    const fetchRegularRoomCurrentOccupancy = async () => {
      try {
        const currentDate = moment().format("YYYY-MM-DD");
        const currentTime = moment().format("HH:mm");

        const requestBody = {
          roomID: room.parentId ? room.parentId : room.roomId,
          subroomID: room.parentId ? room.roomId : "",
          academicYr: acadmeicYear,
          acadSess: acadmeicSession,
          startDate: currentDate,
          endDate: currentDate,
        };

        const response = await callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, requestBody);

        if (response.success && response.data) {
          const roomData = response.data;

          // Filter occupants for current date and time
          const currentOccupants =
            roomData.occupants?.filter((o) => {
              if (!o.scheduledDate) return false;

              if (roomData.isSitting) {
                // For sitting rooms, check if current date is within the occupant's date range
                const startDate = moment(o.scheduledDate);
                const endDate = o.scheduledEndDate ? moment(o.scheduledEndDate) : startDate;
                const today = moment(currentDate);

                return today.isBetween(startDate, endDate, "day", "[]");
              } else {
                // For non-sitting rooms, check time slots
                if (!o.startTime || !o.endTime) return false;
                const scheduledDate = moment(o.scheduledDate).format("YYYY-MM-DD");
                const currentMoment = moment(currentTime, "HH:mm");
                const startMoment = moment(o.startTime, "HH:mm");
                const endMoment = moment(o.endTime, "HH:mm");

                return scheduledDate === currentDate && currentMoment.isBetween(startMoment, endMoment, null, "[)");
              }
            }) || [];

          setCurrentOccupants(currentOccupants);
        } else {
          setCurrentOccupants([]);
        }
      } catch (error) {
        console.error("Error fetching regular room current occupancy:", error);
        setCurrentOccupants([]);
      }
    };

    fetchRoomInfo();
  }, [academicSessionStartDate, academicSessionEndDate, isActiveSession, room.roomId, room.hasSubroom, room.buildingId]);

  return (
    <div className="">
      <div
        onClick={() => onClick && onClick(room)}
        className={`hover:shadow-lg transition-shadow duration-300 rounded-lg border-t border-r border-b border-l-4 shadow-sm py-4 px-3 min-h-[140px] flex flex-col justify-between ${
          currentOccupants.length > 0 ? "border-l-red-500" : "border-l-green-600"
        } ${isExpanded ? "ring-2 ring-orange-500 " : "none"} ${room.hasSubroom ? "cursor-pointer hover:bg-gray-50" : ""}`}
      >
        <div className="flex w-full items-start justify-between">
          <div className="flex flex-col items-start text-left">
            <div className="flex items-center gap-2">
              <p className="text-sm font-[540] text-gray-800 text-ellipsis">{room.roomName}</p>
            </div>
            <p className="text-[10px] text-gray-500">Building ID: {room.buildingId}</p>
            <p className="text-[10px] text-gray-500">Capacity: {room.roomCapactiy}</p>
            {!room.hasSubroom &&
              (currentOccupants.length > 0 ? (
                <p className="text-[10px] text-gray-500">
                  Current: {currentOccupants.map((occupant) => `${occupant.occupantName || occupant.Id} (${occupant.Id})`).join(", ")}
                </p>
              ) : (
                <p className="text-[10px] text-gray-500">Currently Available</p>
              ))}
          </div>
          <div className="flex items-center gap-2">
            {!room.hasSubroom && (
              <div className="flex items-center gap-2">
                <div
                  className={` inline-flex h-fit items-center rounded-md px-3 py-2 text-sm font-semibold ${
                    currentOccupants.length > 0 ? "text-red-500 bg-red-500/10" : "text-green-600 bg-green-600/10"
                  }`}
                >
                  {`${occupancyPercent.toFixed(1)}%`}
                </div>
                {room.IsSitting === true && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMaintenanceModal(true);
                    }}
                    className="inline-flex h-fit items-center justify-center rounded-md px-2 py-2 text-sm font-semibold text-blue-600 bg-blue-600/10 hover:bg-blue-600/20 transition-colors"
                    title="Maintenance"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                )}
              </div>
            )}
            {room.hasSubroom && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMaintenanceModal(true);
                }}
                className="inline-flex h-fit items-center justify-center rounded-md px-3 py-2 text-sm font-semibold text-blue-600 bg-blue-600/10 hover:bg-blue-600/20 transition-colors"
                title="Maintenance"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {!room.hasSubroom && (
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full ${currentOccupants.length > 0 ? "bg-red-500" : "bg-green-600"}`}
              style={{
                width: `${occupancyPercent}%`,
              }}
            />
          </div>
        )}

        {/* Expandable indicator positioned at same location as progress bar */}
        {room.hasSubroom && (
          <div className="mt-4 w-full">
            <div className="flex items-center justify-center gap-1 bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-xs font-medium w-full">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Expandable
            </div>
          </div>
        )}
      </div>

      {/* Maintenance Modal */}
      {showMaintenanceModal && <MaintenanceCardModal room={room} onClose={() => setShowMaintenanceModal(false)} />}
    </div>
  );
}
