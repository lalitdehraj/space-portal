"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import BuildingCard from "@/components/BuildingCard";
import { URL_NOT_FOUND } from "@/constants";
import { Building1 } from "@/types";
import { api, callApi } from "@/utils/apiIntercepter";
import { setSelectedBuilding } from "@/app/feature/dataSlice";
import { encrypt } from "@/utils/encryption";

export default function Buildings() {
  const router = useRouter();
  const dispatcher = useDispatch();
  const acadmeicYear = useSelector(
    (state: any) => state.dataState.academicYear
  );
  const acadmeicSession = useSelector(
    (state: any) => state.dataState.academicSession
  );
  const encryptAndPush = (id: string) => {
    let encrytedId = encrypt(id);
    router.push(`/space-portal/buildings/${encrytedId}`);
  };

  useEffect(() => {
    const fetchBuildings = async () => {
      let response = callApi<Building1[]>(
        api.get(process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND, {
          params: {
            acadmeicSession: acadmeicSession,
            acadmeicYear: acadmeicYear,
          },
        })
      );
      let res = await response;
      if (res.success) {
        setAllBuildingsData(res.data || []);
      }
    };
    fetchBuildings();
  }, [acadmeicSession, acadmeicYear]);

  const [allBuildingsData, setAllBuildingsData] = useState<Building1[]>([]);

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

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {allBuildingsData.map((building) => (
            <BuildingCard
              building={building}
              key={building.id}
              onClick={() => {
                dispatcher(setSelectedBuilding(building));
                encryptAndPush(building.id);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
