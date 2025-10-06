import { URL_NOT_FOUND } from "@/constants";
import { Occupant, Room, RoomInfo } from "@/types";
import { callApi } from "@/utils/apiIntercepter";
import moment from "moment";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/app/store";

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

  useEffect(() => {
    const fetchRoomInfo = async () => {
      try {
        setLoading(true);
        // Determine start/end dates depending on session
        const startDate = isActiveSession ? moment().startOf("isoWeek").format("YYYY-MM-DD") : moment(academicSessionStartDate).format("YYYY-MM-DD");

        const endDate = isActiveSession ? moment().endOf("isoWeek").format("YYYY-MM-DD") : moment(academicSessionEndDate).format("YYYY-MM-DD");

        if (room.hasSubroom) {
          // Handle parent room with subrooms
          await fetchParentRoomOccupancy(startDate, endDate);
          await fetchParentRoomCurrentOccupancy();
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

    const fetchParentRoomOccupancy = async (startDate: string, endDate: string) => {
      try {
        let subrooms: Room[] = [];

        // Use cached subrooms if available, otherwise fetch them
        if (cachedSubrooms && cachedSubrooms.length > 0) {
          subrooms = cachedSubrooms.filter((subroom) => subroom.parentId === room.roomId);
        } else {
          // Fallback to individual API call if no cached subrooms
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
          subrooms = subroomsResponse.data;
        }

        if (subrooms.length === 0) {
          setTotalOccupants(0);
          setOccupancyPercent(0);
          return;
        }
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
            const startDateMoment = isActiveSession ? moment().startOf("isoWeek") : moment(academicSessionStartDate);
            const endDateMoment = isActiveSession ? moment().endOf("isoWeek") : moment(academicSessionEndDate);

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
        subroomID: room.parentId ? room.roomId : "",
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
        const startDateMoment = isActiveSession ? moment().startOf("isoWeek") : moment(academicSessionStartDate);
        const endDateMoment = isActiveSession ? moment().endOf("isoWeek") : moment(academicSessionEndDate);

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

    const fetchParentRoomCurrentOccupancy = async () => {
      try {
        const currentDate = moment().format("YYYY-MM-DD");
        const currentTime = moment().format("HH:mm");

        let subrooms: Room[] = [];

        // Use cached subrooms if available, otherwise fetch them
        if (cachedSubrooms && cachedSubrooms.length > 0) {
          subrooms = cachedSubrooms.filter((subroom) => subroom.parentId === room.roomId);
        } else {
          // Fallback to individual API call if no cached subrooms
          const subroomsResponse = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_SUBROOMS_LIST || URL_NOT_FOUND, {
            roomID: room.roomId,
            buildingNo: room.buildingId,
            acadSess: acadmeicSession,
            acadYr: acadmeicYear,
          });

          if (!subroomsResponse.success || !subroomsResponse.data || subroomsResponse.data.length === 0) {
            setCurrentOccupants([]);
            return;
          }
          subrooms = subroomsResponse.data;
        }

        if (subrooms.length === 0) {
          setCurrentOccupants([]);
          return;
        }

        // Fetch current occupancy for each subroom
        const subroomPromises = subrooms.map(async (subroom) => {
          const requestBody = {
            roomID: room.roomId, // parent room ID
            subroomID: subroom.roomId, // subroom ID
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
                if (!o.scheduledDate || !o.startTime || !o.endTime) return false;
                const scheduledDate = moment(o.scheduledDate).format("YYYY-MM-DD");
                const currentMoment = moment(currentTime, "HH:mm");
                const startMoment = moment(o.startTime, "HH:mm");
                const endMoment = moment(o.endTime, "HH:mm");

                return scheduledDate === currentDate && currentMoment.isBetween(startMoment, endMoment, null, "[)");
              }) || [];

            return currentOccupants;
          }
          return [];
        });

        const subroomResults = await Promise.all(subroomPromises);

        // Flatten all current occupants from all subrooms
        const allCurrentOccupants = subroomResults.flat();
        setCurrentOccupants(allCurrentOccupants);
      } catch (error) {
        console.error("Error fetching parent room current occupancy:", error);
        setCurrentOccupants([]);
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
              if (!o.scheduledDate || !o.startTime || !o.endTime) return false;
              const scheduledDate = moment(o.scheduledDate).format("YYYY-MM-DD");
              const currentMoment = moment(currentTime, "HH:mm");
              const startMoment = moment(o.startTime, "HH:mm");
              const endMoment = moment(o.endTime, "HH:mm");

              return scheduledDate === currentDate && currentMoment.isBetween(startMoment, endMoment, null, "[)");
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
        className={`hover:shadow-lg transition-shadow duration-300 rounded-lg border-t border-r border-b border-l-4 shadow-sm py-4 px-3 ${
          currentOccupants.length > 0 ? "border-l-red-500" : "border-l-green-600"
        } ${isExpanded ? "ring-2 ring-orange-500 " : "none"}`}
      >
        <button className="flex w-full items-start justify-between" title={`View details for ${room.roomName}`}>
          <div className="flex flex-col items-start text-left">
            <p className="text-sm font-[540] text-gray-800 text-ellipsis">{room.roomName}</p>
            <p className="text-[10px] text-gray-500">Building ID: {room.buildingId}</p>
            <p className="text-[10px] text-gray-500">Capacity: {room.roomCapactiy}</p>
            {currentOccupants.length > 0 ? (
              <p className="text-[10px] text-gray-500">
                Current: {currentOccupants.map((occupant) => `${occupant.occupantName || occupant.Id} (${occupant.Id})`).join(", ")}
              </p>
            ) : (
              <p className="text-[10px] text-gray-500">Currently Available</p>
            )}
          </div>
          <div
            className={` inline-flex h-fit items-center rounded-md px-3 py-2 text-sm font-semibold ${
              currentOccupants.length > 0 ? "text-red-500 bg-red-500/10" : "text-green-600 bg-green-600/10"
            }`}
          >
            {`${occupancyPercent.toFixed(1)}%`}
          </div>
        </button>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full ${currentOccupants.length > 0 ? "bg-red-500" : "bg-green-600"}`}
            style={{
              width: `${occupancyPercent}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
