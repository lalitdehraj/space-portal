"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import BuildingCard from "@/components/BuildingCard";
import { URL_NOT_FOUND } from "@/constants";
import { Building, Room, RoomInfo } from "@/types";
import { callApi } from "@/utils/apiIntercepter";
import { setSelectedBuildingId } from "@/app/feature/dataSlice";
import { encrypt } from "@/utils/encryption";
import moment from "moment";
import { format } from "path";

export default function Buildings() {
  const router = useRouter();
  const dispatcher = useDispatch();
  const [isLoadingBuildings, setIsLoadingBuildings] = useState(false);
  const acadmeicYear = useSelector(
    (state: any) => state.dataState.selectedAcademicYear
  );
  const acadmeicSession = useSelector(
    (state: any) => state.dataState.selectedAcademicSession
  );

  const encryptAndPush = (id: string) => {
    let encrytedId = encrypt(id);
    router.push(`/space-portal/buildings/${encrytedId}`);
  };

  useEffect(() => {
    const fetchBuildings = async () => {
      if (!acadmeicSession && !acadmeicYear) return;
      setIsLoadingBuildings(true);
      try {
        const reqBody = {
          acadSession: `${acadmeicSession}`,
          acadYear: `${acadmeicYear}`,
        };

        const response = await callApi<Building[]>(
          process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND,
          reqBody
        );
        if (response.success) {
          setAllBuildingsData(response.data || []);
        }
      } catch (error) {
        console.error("Error fetching buildings:", error);
      } finally {
        setIsLoadingBuildings(false);
      }
    };
    fetchBuildings();
  }, [acadmeicSession, acadmeicYear]);

  const [allBuildingsData, setAllBuildingsData] = useState<Building[]>([]);

  return (
    <div>
      <h2 className="mb-4 text-base font-semibold text-gray-800 md:ml-2">
        Building Utilizations Details
      </h2>
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">
              Building Utilization
            </h3>
            <p className="text-[10px] text-gray-500">
              Comparative analysis across all campus facilities
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 grid-col-1 lg:grid-cols-3">
          {isLoadingBuildings ? (
            <p>Loading buildings...</p>
          ) : allBuildingsData.length === 0 ? (
            <p>No buildings data available.</p>
          ) : (
            allBuildingsData.map((building) => (
              <BuildingCard
                building={building}
                key={building.id}
                onClick={() => {
                  dispatcher(setSelectedBuildingId(building.id));
                  encryptAndPush(building.id);
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
