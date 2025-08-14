import { Room1 } from "@/types";

interface RoomCardProps {
  room: Room1;
  isExpanded?: boolean;
  onClick?: (room: Room1) => void;
}

const getOccupancyStatus = (room: Room1): "low" | "medium" | "high" => {
  const occupancyRate = room.occupied / room.capacity;
  if (occupancyRate <= 0.1) return "low";
  if (occupancyRate > 0.8) return "high";
  return "medium";
};

export default function RoomCard({
  room,
  isExpanded = false,
  onClick,
}: RoomCardProps) {
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

  const classes = statusClasses[occupancyStatus];
  return (
    <div className="">
      <div
        onClick={() => onClick && onClick(room)}
        className={`hover:shadow-lg transition-shadow duration-300 rounded-lg border-t border-r border-b  border-l-4 shadow-sm py-4 px-3 ${
          classes.leftBorderColor
        } ${isExpanded ? "ring-2 ring-orange-500 " : "none"}`}
      >
        <button
          className="flex w-full items-start justify-between"
          title={`View details for ${room.roomName}`}
        >
          <div className="flex flex-col items-start text-left">
            <p className="text-sm font-[540] text-gray-800 text-ellipsis">
              {room.roomName}
            </p>
            <p className="text-[10px] text-gray-500">
              Occupied: {room.occupied} / {room.capacity}
            </p>
          </div>
          <div
            className={` inline-flex h-fit items-center rounded-md px-3 py-2 text-sm font-semibold ${classes.text} ${classes.background}`}
          >
            {room.occupied}
          </div>
        </button>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full ${classes.progressBar}`}
            style={{
              width: `${(room.occupied / room.capacity) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
