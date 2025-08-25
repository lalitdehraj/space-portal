import Image from "next/image";
import { Building1 } from "@/types";
import React, { SVGProps } from "react";

type BuildingCardProps = {
  building: Building1;
  onClick?: (building: Building1) => void;
};

const FloorIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
  >
    <path
      d="M10 5V10H9V5H5V13H9V12H10V17H9V14H5V19H12V17H13V19H19V17H21V21H3V3H21V15H19V10H13V15H12V9H19V5H10Z"
      fill="white"
    />
  </svg>
);

const RoomIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
  >
    <path
      d="M12.531 1.71936C12.4613 1.64952 12.3786 1.5941 12.2875 1.5563C12.1963 1.51849 12.0987 1.49902 12 1.49902C11.9014 1.49902 11.8037 1.51849 11.7126 1.5563C11.6214 1.5941 11.5387 1.64952 11.469 1.71936L2.469 10.7194C2.3994 10.7891 2.34423 10.872 2.30665 10.9631C2.26908 11.0542 2.24983 11.1518 2.25 11.2504V21.7504C2.25 21.9493 2.32902 22.14 2.46967 22.2807C2.61032 22.4213 2.80109 22.5004 3 22.5004H9.75C9.94891 22.5004 10.1397 22.4213 10.2803 22.2807C10.421 22.14 10.5 21.9493 10.5 21.7504V15.7504H13.5V21.7504C13.5 21.9493 13.579 22.14 13.7197 22.2807C13.8603 22.4213 14.0511 22.5004 14.25 22.5004H21C21.1989 22.5004 21.3897 22.4213 21.5303 22.2807C21.671 22.14 21.75 21.9493 21.75 21.7504V11.2504C21.7502 11.1518 21.7309 11.0542 21.6933 10.9631C21.6558 10.872 21.6006 10.7891 21.531 10.7194L19.5 8.68986V3.75036C19.5 3.55145 19.421 3.36069 19.2803 3.22003C19.1397 3.07938 18.9489 3.00036 18.75 3.00036H17.25C17.0511 3.00036 16.8603 3.07938 16.7197 3.22003C16.579 3.36069 16.5 3.55145 16.5 3.75036V5.68986L12.531 1.71936ZM3.75 21.0004V11.5609L12 3.31086L20.25 11.5609V21.0004H15V15.0004C15 14.8015 14.921 14.6107 14.7803 14.47C14.6397 14.3294 14.4489 14.2504 14.25 14.2504H9.75C9.55109 14.2504 9.36032 14.3294 9.21967 14.47C9.07902 14.6107 9 14.8015 9 15.0004V21.0004H3.75Z"
      fill="white"
    />
  </svg>
);

const BuildingCard = ({ building, onClick }: BuildingCardProps) => {
  let occupancyRate = Math.floor(
    (building.occupied / building.totalOccupancy) * 100
  );
  const occupancyBgClass =
    occupancyRate <= 10
      ? "bg-green-700/50"
      : occupancyRate >= 80
      ? "bg-red-700/50"
      : "bg-yellow-500/50";

  return (
    <button
      onClick={() => onClick && onClick(building)}
      className="relative rounded-lg shadow-md overflow-hidden transition-transform transform hover:scale-[1.02] cursor-pointer"
    >
      <Image
        src={building.image || "/images/main-building.jpg"}
        alt={building.name}
        width={400}
        height={200}
        className="h-48 w-full object-cover"
      />
      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
        <div
          className={`flex items-center justify-between gap-4 rounded-md p-2 ${occupancyBgClass}`}
        >
          {/* Building name and stats */}
          <div className="flex flex-col">
            <h4 className="mb-1 text-left text-sm font-bold">
              {building.name}
            </h4>
            <div className="flex items-center gap-2">
              <FloorIcon className="h-3 w-3 fill-white" />
              <p className="text-[10px]">Floors - {building.totalFloors}</p>
              <RoomIcon className="ml-3 h-2.5 w-2.5 fill-white" />
              <p className="text-[10px]">Rooms - {building.totalRooms}</p>
            </div>
          </div>
          {/* Occupancy rate */}
          <div className="flex flex-col items-center">
            <span className="text-[10px]">Occupied</span>
            <span className="text-lg font-bold">{occupancyRate}%</span>
          </div>
        </div>
      </div>
    </button>
  );
};

export default BuildingCard;
