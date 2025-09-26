import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { Building } from "@/types";
import { RootState } from "@/app/store";

export const useBuildingsData = () => {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const academicSession = useSelector((state: RootState) => state.dataState.selectedAcademicSession);
  const academicYear = useSelector((state: RootState) => state.dataState.selectedAcademicYear);

  useEffect(() => {
    const fetchBuildings = async () => {
      if (!academicSession || !academicYear) {
        setBuildings([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const reqBody = {
          acadSession: `${academicSession}`,
          acadYear: `${academicYear}`,
        };

        const response = await callApi<Building[]>(
          process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND,
          reqBody,
          { ttl: 5 * 60 * 1000 } // Cache for 5 minutes
        );

        if (response.success) {
          setBuildings(response.data || []);
        } else {
          setError(response.error || "Failed to fetch buildings");
        }
      } catch (err) {
        console.error("Error fetching buildings:", err);
        setError("An error occurred while fetching buildings");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBuildings();
  }, [academicSession, academicYear]);

  return {
    buildings,
    isLoading,
    error,
    refetch: () => {
      if (academicSession && academicYear) {
        const fetchBuildings = async () => {
          setIsLoading(true);
          setError(null);

          try {
            const reqBody = {
              acadSession: `${academicSession}`,
              acadYear: `${academicYear}`,
            };

            const response = await callApi<Building[]>(
              process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND,
              reqBody,
              { ttl: 5 * 60 * 1000 } // Cache for 5 minutes
            );

            if (response.success) {
              setBuildings(response.data || []);
            } else {
              setError(response.error || "Failed to fetch buildings");
            }
          } catch (err) {
            console.error("Error fetching buildings:", err);
            setError("An error occurred while fetching buildings");
          } finally {
            setIsLoading(false);
          }
        };
        fetchBuildings();
      }
    },
  };
};
