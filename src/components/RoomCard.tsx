import { URL_NOT_FOUND } from "@/constants";
import { Occupant, Room, RoomInfo } from "@/types";
import { callApi } from "@/utils/apiIntercepter";
import moment from "moment";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

interface RoomCardProps {
  room: Room;
  isExpanded?: boolean;
  onClick?: (room: Room) => void;
}
const WORK_HOURS_PER_DAY = 9;

const getOccupancyStatus = (room: Room): "low" | "medium" | "high" => {
  const occupancyRate = room.occupied / room.roomCapactiy;
  if (occupancyRate <= 0.1) return "low";
  if (occupancyRate > 0.8) return "high";
  return "medium";
};

export default function RoomCard({ room, isExpanded = false, onClick }: RoomCardProps) {
  const occupancyStatus = getOccupancyStatus(room);

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

  const isActiveSession = useSelector((state: any) => state.dataState.isActiveSession);
  const academicSessionStartDate = useSelector((state: any) => state.dataState.selectedAcademicSessionStartDate);
  const academicSessionEndDate = useSelector((state: any) => state.dataState.selectedAcademicSessionEndDate);
  const acadmeicYear = useSelector((state: any) => state.dataState.selectedAcademicYear);
  const acadmeicSession = useSelector((state: any) => state.dataState.selectedAcademicSession);

  const [totalOccupants, setTotalOccupants] = useState<number>(0);
  const [occupancyPercent, setOccupancyPercent] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchRoomInfo = async () => {
      try {
        setLoading(true);
        // Determine start/end dates depending on session
        const startDate = isActiveSession ? moment().startOf("week").format("YYYY-MM-DD") : moment(academicSessionStartDate).format("YYYY-MM-DD");

        const endDate = isActiveSession ? moment().endOf("week").format("YYYY-MM-DD") : moment(academicSessionEndDate).format("YYYY-MM-DD");

        if (room.hasSubroom) {
          // Handle parent room with subrooms
          await fetchParentRoomOccupancy(startDate, endDate);
        } else {
          // Handle regular room or subroom
          await fetchRegularRoomOccupancy(startDate, endDate);
        }
      } catch (error) {
        console.error("Error fetching room occupancy:", error);
        setOccupancyPercent(0);
      } finally {
        setLoading(false);
      }
    };

    const fetchParentRoomOccupancy = async (startDate: string, endDate: string) => {
      try {
        // First, fetch all subrooms for this parent room
        const subroomsResponse = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_SUBROOMS_LIST || URL_NOT_FOUND, {
          roomID: room.roomId,
          buildingNo: room.buildingId,
          acadSess: acadmeicSession,
          acadYr: acadmeicYear,
        });

        if (!subroomsResponse.success || !subroomsResponse.data || subroomsResponse.data.length === 0) {
          setTotalOccupants(0);
          setOccupancyPercent(0);
          return;
        }

        const subrooms = subroomsResponse.data;
        let totalSubroomOccupants = 0;
        let totalSubroomOccupancyPercent = 0;

        // Fetch occupancy for each subroom
        const subroomPromises = subrooms.map(async (subroom) => {
          const requestBody = {
            roomID: room.roomId, // parent room ID
            subroomID: subroom.roomId, // subroom ID
            academicYr: acadmeicYear,
            acadSess: acadmeicSession,
            startDate,
            endDate,
          };

          const response = await callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, requestBody);

          if (response.success && response.data) {
            const roomData = response.data;
            const occupants = roomData.occupants?.length || 0;

            // Calculate occupancy percentage for this subroom
            const startDateMoment = isActiveSession ? moment().startOf("week") : moment(academicSessionStartDate);
            const endDateMoment = isActiveSession ? moment().endOf("week") : moment(academicSessionEndDate);

            const weeklyOccupants: Occupant[] =
              roomData.occupants?.filter((o) => {
                if (!o.scheduledDate) return false;
                const scheduled = moment(o.scheduledDate);
                return scheduled.isBetween(startDateMoment, endDateMoment, "day", "[]");
              }) || [];

            const totalMinutes = weeklyOccupants.reduce((sum, occupant) => {
              if (!occupant.startTime || !occupant.endTime) return sum;
              const start = moment(occupant.startTime, "HH:mm");
              const end = moment(occupant.endTime, "HH:mm");
              return sum + Math.max(end.diff(start, "minutes"), 0);
            }, 0);

            const totalDays = endDateMoment.diff(startDateMoment, "days") + 1;
            const maxMinutes = totalDays * WORK_HOURS_PER_DAY * 60;
            const percent = maxMinutes > 0 ? (totalMinutes / maxMinutes) * 100 : 0;

            return { occupants, occupancyPercent: percent };
          }
          return { occupants: 0, occupancyPercent: 0 };
        });

        const subroomResults = await Promise.all(subroomPromises);

        // Calculate totals
        totalSubroomOccupants = subroomResults.reduce((sum, result) => sum + result.occupants, 0);
        totalSubroomOccupancyPercent = subroomResults.reduce((sum, result) => sum + result.occupancyPercent, 0);

        // Average occupancy percentage across all subrooms
        const averageOccupancyPercent = subrooms.length > 0 ? totalSubroomOccupancyPercent / subrooms.length : 0;

        setTotalOccupants(totalSubroomOccupants);
        setOccupancyPercent(averageOccupancyPercent);
      } catch (error) {
        console.error("Error fetching parent room occupancy:", error);
        setTotalOccupants(0);
        setOccupancyPercent(0);
      }
    };

    const fetchRegularRoomOccupancy = async (startDate: string, endDate: string) => {
      const requestBody = {
        roomID: room.parentId ? room.parentId : room.roomId,
        subroomID: room.parentId ? room.roomId : 0,
        academicYr: acadmeicYear,
        acadSess: acadmeicSession,
        startDate,
        endDate,
      };

      const response = await callApi<RoomInfo>(process.env.NEXT_PUBLIC_GET_ROOM_INFO || URL_NOT_FOUND, requestBody);

      if (response.success && response.data) {
        const roomData = response.data;

        setTotalOccupants(response.data.occupants?.length || 0);
        // Determine date range
        const startDateMoment = isActiveSession ? moment().startOf("week") : moment(academicSessionStartDate);
        const endDateMoment = isActiveSession ? moment().endOf("week") : moment(academicSessionEndDate);

        const weeklyOccupants: Occupant[] =
          roomData.occupants?.filter((o) => {
            if (!o.scheduledDate) return false;
            const scheduled = moment(o.scheduledDate);
            return scheduled.isBetween(startDateMoment, endDateMoment, "day", "[]");
          }) || [];

        const totalMinutes = weeklyOccupants.reduce((sum, occupant) => {
          if (!occupant.startTime || !occupant.endTime) return sum;
          const start = moment(occupant.startTime, "HH:mm");
          const end = moment(occupant.endTime, "HH:mm");
          return sum + Math.max(end.diff(start, "minutes"), 0);
        }, 0);

        const totalDays = endDateMoment.diff(startDateMoment, "days") + 1;
        const maxMinutes = totalDays * WORK_HOURS_PER_DAY * 60;

        const percent = maxMinutes > 0 ? (totalMinutes / maxMinutes) * 100 : 0;
        setOccupancyPercent(percent);
      }
    };

    fetchRoomInfo();
  }, [academicSessionStartDate, academicSessionEndDate, isActiveSession, room.roomId, room.hasSubroom, room.buildingId]);

  const classes = statusClasses[occupancyStatus];
  return (
    <div className="">
      <div
        onClick={() => onClick && onClick(room)}
        className={`hover:shadow-lg transition-shadow duration-300 rounded-lg border-t border-r border-b  border-l-4 shadow-sm py-4 px-3 ${
          classes.leftBorderColor
        } ${isExpanded ? "ring-2 ring-orange-500 " : "none"}`}
      >
        <button className="flex w-full items-start justify-between" title={`View details for ${room.roomName}`}>
          <div className="flex flex-col items-start text-left">
            <p className="text-sm font-[540] text-gray-800 text-ellipsis">{room.roomName}</p>
            <p className="text-[10px] text-gray-500">Building ID: {room.buildingId}</p>
            <p className="text-[10px] text-gray-500">Capacity: {room.roomCapactiy}</p>
            <p className="text-[10px] text-gray-500">
              {isActiveSession ? "Weeks" : "Total"} Bookings: {totalOccupants}
            </p>
          </div>
          <div className={` inline-flex h-fit items-center rounded-md px-3 py-2 text-sm font-semibold ${classes.text} ${classes.background}`}>
            {`${occupancyPercent.toFixed(1)}%`}
          </div>
        </button>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full ${classes.progressBar}`}
            style={{
              width: `${occupancyPercent}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
