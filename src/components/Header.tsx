"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { callApi } from "@/utils/apiIntercepter";
import moment from "moment";
import { SearchResult, AcademicSession, AcademicYear, SearchResults, UserProfile, Building, Room } from "@/types";
import { URL_NOT_FOUND } from "@/constants";
import { useDispatch, useSelector } from "react-redux";
import {
  setAcademicSessionEndDate,
  setAcademicSessionId,
  setAcademicSessionStartDate,
  setAcademicYearId,
  setIsActiveSession,
  setUser,
  setUserRoleId,
} from "@/app/feature/dataSlice";
import { useRouter } from "next/navigation";
import { encrypt } from "@/utils/encryption";
import { signOut, useSession } from "next-auth/react";
import { AdvancedSearch } from "./SearchBar";
import path from "path";

export type AcademicYearResponse = {
  "Academic Year": AcademicYear[];
};
export type AcademicSessionResponse = {
  "Academic Session": AcademicSession[];
};

export default function Header() {
  const router = useRouter();
  const dispatcher = useDispatch();
  const { data } = useSession();

  // redux values
  const academicYear = useSelector((state: any) => state.dataState.selectedAcademicYear);
  const acadSession = useSelector((state: any) => state.dataState.selectedAcademicSession);

  // Local state
  const [academicYearsList, setAcademicYearsList] = useState<AcademicYear[] | undefined>();
  const [academicSessionsList, setAcademicSessionsList] = useState<AcademicSession[] | undefined>();
  const [sessionsPerYear, setSessionsPerYear] = useState<string[]>();

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Lazy-load buildings & rooms on first focus
  const [isLoadedBuildingsRooms, setIsLoadedBuildingsRooms] = useState(false);
  const [buildingsList, setBuildingsList] = useState<Building[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [loadingBuildingsRooms, setLoadingBuildingsRooms] = useState(false);

  // State for handling subrooms in search
  const [parentRoomsForSearch, setParentRoomsForSearch] = useState<Room[]>([]);
  const [subroomsForSearch, setSubroomsForSearch] = useState<Room[]>([]);
  const [loadingSubrooms, setLoadingSubrooms] = useState(false);

  // advanced search placeholder toggle
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

  // profile dropdown
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // refs for outside click detection
  const filterRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUserRoles = async () => {
      if (!data?.user?.email) return;
      try {
        const response = await callApi<UserProfile[]>(process.env.NEXT_PUBLIC_GET_USER || URL_NOT_FOUND);
        if (response.success) {
          const user = response.data?.filter((u) => u.userEmail.toLowerCase() === data?.user?.email?.toLowerCase());
          console.log(data.user, user, response.data);
          if (user && user.length > 0) {
            dispatcher(setUserRoleId(user[0].userRole));
            dispatcher(setUser(user[0]));
            dispatcher(setAcademicYearId(user[0].activeYear));
            dispatcher(setAcademicSessionId(user[0].activeSession));
          } else {
            router.push("/login");
          }
        }
      } catch (err) {
        console.error("fetchUserRoles error:", err);
      }
    };
    fetchUserRoles();
  }, [data?.user?.email]);

  useEffect(() => {
    const getAcadmicCalender = async () => {
      try {
        const responseYear = await callApi<AcademicYearResponse>(process.env.NEXT_PUBLIC_GET_ACADMIC_YEARS || URL_NOT_FOUND);
        if (responseYear.success) {
          const acadYearsList = responseYear.data?.["Academic Year"]?.reverse();
          setAcademicYearsList(acadYearsList);
        }

        const responseSession = await callApi<AcademicSessionResponse>(process.env.NEXT_PUBLIC_GET_ACADMIC_SESSIONS || URL_NOT_FOUND);
        if (responseSession.success) {
          setAcademicSessionsList(responseSession.data?.["Academic Session"] || []);
        }
      } catch (err) {
        console.error("getAcadmicCalender error:", err);
      }
    };
    getAcadmicCalender();
  }, []);

  // build sessionsPerYear based on selected academicYear
  useEffect(() => {
    if (!academicYear || !academicSessionsList || !academicYearsList) return;
    const filteredList = academicSessionsList?.filter((year) => year["Academic Year"] == academicYear);
    const unique = new Map<string, string[]>();
    if (!filteredList) return;
    for (const item of filteredList) {
      if (unique.has(item.Code)) {
        unique.get(item.Code)?.push(item.Code);
      } else {
        unique.set(item.Code, [item.Code]);
      }
    }
    setSessionsPerYear(Array.from(unique.keys()) || []);
  }, [academicYear, academicSessionsList, academicYearsList]);

  // when academicYear changes set a default session (preserve original behavior)
  useEffect(() => {
    if (!academicYearsList) return;
    const currentSession = academicSessionsList?.filter((s) => s["Academic Year"] === academicYear)?.[0];
    dispatcher(setAcademicSessionId(currentSession?.Code));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear, academicSessionsList, academicYearsList]);

  // set session start/end and isActiveSession (preserve original behavior)
  useEffect(() => {
    if (!acadSession && !academicSessionsList) return;
    const currentSession = academicSessionsList?.find((s) => s.Code === acadSession);
    dispatcher(setAcademicSessionStartDate(currentSession?.["Start Session"]));
    dispatcher(setAcademicSessionEndDate(currentSession?.["End Session"]));
    const startDate = moment(currentSession?.["Start Session"], "YYYY-MM-DD");
    const endDate = moment(currentSession?.["End Session"], "YYYY-MM-DD");
    const today = moment();
    const isActiveSession = today.isBetween(startDate, endDate, "day", "[]");
    dispatcher(setIsActiveSession(isActiveSession));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acadSession, academicSessionsList, academicYear]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
        setShowAdvancedSearch(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterRef]);

  useEffect(() => {
    const handleClickOutsideProfile = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutsideProfile);
    return () => document.removeEventListener("mousedown", handleClickOutsideProfile);
  }, [profileRef]);

  const handleSearchFocus = async () => {
    setIsSearchFocused(true);
    // toggle advanced search off if opening simple search
    setShowAdvancedSearch(false);

    if (isLoadedBuildingsRooms) return;

    // ensure we have academic year/session — backend expects them
    if (!academicYear || !acadSession) {
      // still mark loaded so we don't attempt repeatedly, but keep empty lists
      setIsLoadedBuildingsRooms(true);
      return;
    }

    setLoadingBuildingsRooms(true);

    try {
      const buildingsResponse = await callApi<Building[]>(process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND, {
        acadSession: `${acadSession}`,
        acadYear: `${academicYear}`,
      });

      if (!buildingsResponse.success || !buildingsResponse.data) {
        setBuildingsList([]);
        setAllRooms([]);
        setLoadingBuildingsRooms(false);
        setIsLoadedBuildingsRooms(true);
        return;
      }

      const buildings = buildingsResponse.data || [];
      setBuildingsList(buildings);

      // aggregate rooms - fetch all rooms at once per building
      const aggregatedRooms: Room[] = [];

      // Fetch all rooms for each building at once using empty floorID
      const buildingPromises = buildings.map((building) =>
        callApi<Room[]>(process.env.NEXT_PUBLIC_GET_ROOMS_LIST || URL_NOT_FOUND, {
          buildingNo: building.id,
          floorID: "", // Empty floorID to fetch all rooms at once
          // using moment for consistent time format
          curreentTime: moment().format("HH:mm"),
        })
      );

      // wait for all buildings
      const buildingResponses = await Promise.all(buildingPromises);

      for (const buildingRes of buildingResponses) {
        if (buildingRes && (buildingRes as any).success && (buildingRes as any).data) {
          // types: callApi returns { success, data, ...}
          aggregatedRooms.push(...((buildingRes as any).data as Room[]));
        }
      }

      setAllRooms(aggregatedRooms);
      setIsLoadedBuildingsRooms(true);
    } catch (error) {
      console.error("Error fetching buildings/rooms:", error);
      setBuildingsList([]);
      setAllRooms([]);
      setIsLoadedBuildingsRooms(true);
    } finally {
      setLoadingBuildingsRooms(false);
    }
  };

  useEffect(() => {
    if (searchText.trim() === "") {
      setSearchResults(null);
      setParentRoomsForSearch([]);
      setSubroomsForSearch([]);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        if (isLoadedBuildingsRooms) {
          // local filtering
          const q = searchText.toLowerCase();

          const filteredBuildings: SearchResult[] = buildingsList
            .filter((b) => b.name?.toLowerCase().includes(q))
            .map((b) => ({
              buildingId: b.id,
              name: b.name,
              type: "building",
            }));

          // Filter rooms that match search query
          const matchingRooms = allRooms.filter((r) => r.roomName?.toLowerCase().includes(q) || r.roomId?.toLowerCase().includes(q));

          // Separate parent rooms (hasSubroom: true) from regular rooms
          const parentRooms = matchingRooms.filter((r) => r.hasSubroom);
          const regularRooms = matchingRooms.filter((r) => !r.hasSubroom);

          // Convert regular rooms to search results
          const filteredRooms: SearchResult[] = regularRooms.map((r) => ({
            buildingId: (r as any).buildingId || (r as any).building, // defensive
            roomId: r.roomId,
            name: r.roomName,
            type: "room",
          }));

          // Store parent rooms for subroom fetching
          setParentRoomsForSearch(parentRooms);

          setSearchResults({
            buildings: filteredBuildings,
            rooms: filteredRooms,
          });
          setSearchLoading(false);
        } else {
          // fallback to original search API
          const response = await callApi<SearchResults>(process.env.NEXT_PUBLIC_GET_SEARCH || URL_NOT_FOUND, {
            searchKey: searchText,
          });
          setSearchResults(response.data || { buildings: [], rooms: [] });
          setSearchLoading(false);
        }
      } catch (err) {
        console.error("search error:", err);
        setSearchResults({ buildings: [], rooms: [] });
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchText, isLoadedBuildingsRooms, buildingsList, allRooms]);

  // Effect to fetch subrooms for parent rooms that match search
  useEffect(() => {
    const fetchSubroomsForSearch = async () => {
      if (parentRoomsForSearch.length === 0 || !academicYear || !acadSession) {
        setSubroomsForSearch([]);
        return;
      }

      setLoadingSubrooms(true);

      // Add 250ms delay before making API calls
      await new Promise((resolve) => setTimeout(resolve, 250));

      try {
        // Get unique buildings from parent rooms
        const uniqueBuildings = [...new Set(parentRoomsForSearch.map((room) => room.buildingId))];

        // Fetch all subrooms for each building at once using blank roomID
        const buildingSubroomPromises = uniqueBuildings.map(async (buildingId) => {
          const response = await callApi<Room[]>(process.env.NEXT_PUBLIC_GET_SUBROOMS_LIST || URL_NOT_FOUND, {
            roomID: "", // Use blank roomID to get all subrooms for the building
            buildingNo: buildingId,
            acadSess: acadSession,
            acadYr: academicYear,
          });
          return response.success ? response.data || [] : [];
        });

        const buildingSubroomArrays = await Promise.all(buildingSubroomPromises);
        const allBuildingSubrooms = buildingSubroomArrays.flat();

        // Filter subrooms that belong to the parent rooms we're searching for
        const relevantSubrooms = allBuildingSubrooms.filter((subroom) => parentRoomsForSearch.some((parentRoom) => parentRoom.roomId === subroom.parentId));

        setSubroomsForSearch(relevantSubrooms);

        // Update search results to include subrooms
        setSearchResults((prevResults) => {
          if (!prevResults) return prevResults;

          const subroomSearchResults: SearchResult[] = relevantSubrooms.map((subroom: Room) => ({
            buildingId: subroom.buildingId,
            roomId: subroom.roomId,
            name: subroom.roomName,
            type: "room",
            parentId: subroom.parentId,
          }));

          return {
            buildings: prevResults.buildings,
            rooms: [...prevResults.rooms, ...subroomSearchResults],
          };
        });
      } catch (error) {
        console.error("Error fetching subrooms for search:", error);
        setSubroomsForSearch([]);
      } finally {
        setLoadingSubrooms(false);
      }
    };

    fetchSubroomsForSearch();
  }, [parentRoomsForSearch, academicYear, acadSession]);

  const handleListClick = (result: SearchResult) => {
    if (result.type === "building") {
      router.push(`/space-portal/buildings/${encrypt(result.buildingId)}`);
    } else {
      // Check if this is a subroom (has parentId)
      if (result.parentId) {
        // Navigate to subroom using parentId|roomId format
        router.push(`/space-portal/buildings/${encrypt(result.buildingId)}/${encrypt(`${result.parentId}|${result.roomId}`)}`);
      } else {
        // Navigate to regular room
        router.push(`/space-portal/buildings/${encrypt(result.buildingId)}/${encrypt(result.roomId || "")}`);
      }
    }
    setSearchText("");
    setIsSearchFocused(false);
    setShowAdvancedSearch(false);
  };

  return (
    <header className="flex w-full items-center justify-between bg-white px-4 py-2 shadow-sm md:px-6">
      <div className="relative mr-4 flex-1 max-w-md" ref={filterRef}>
        <input
          type="text"
          placeholder="Search"
          value={searchText}
          onClick={handleSearchFocus}
          onFocus={handleSearchFocus}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-full rounded-lg border border-[#EBEDF2] bg-[#F5F6F8] py-2 pl-12 pr-12 text-sm text-gray-700 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
          aria-label="Search"
        />

        <img src="/images/search-normal.svg" alt="Search icon" className="h-[20px] w-[20px] absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />

        {/* Advanced search icon inside the search bar */}
        <button
          type="button"
          title="Advanced Search"
          onClick={() => {
            setShowAdvancedSearch((p) => !p);
            // also open main search area
            setIsSearchFocused(true);
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
        >
          <img src="/images/bx-filter-alt.svg" alt="Filter" className="h-5 w-5" />
        </button>

        {/* Simple search dropdown */}
        {isSearchFocused && (
          <>
            {searchLoading || loadingBuildingsRooms || loadingSubrooms ? (
              <div className="absolute top-full left-0 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 px-4 py-3 text-sm text-gray-500 z-20">
                Loading...
              </div>
            ) : searchResults && (searchResults.buildings.length > 0 || searchResults.rooms.length > 0) ? (
              <div className="absolute pt-4 top-full left-0 w-full bg-white border max-h-80 overflow-y-auto border-gray-200 rounded-lg shadow-lg z-20">
                {searchResults.buildings.length > 0 && (
                  <>
                    <span className="flex items-center ml-2 text-gray-500">Buildings</span>
                    <ul className="py-2">
                      {searchResults.buildings.map((result, index) => (
                        <li
                          key={`b-${index}`}
                          onClick={() => handleListClick(result)}
                          className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                        >
                          {result.name}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {searchResults.rooms.length > 0 && (
                  <>
                    <span className="flex items-center ml-2 text-gray-500">Rooms</span>
                    <ul className="py-2">
                      {searchResults.rooms.map((result, index) => (
                        <li
                          key={`r-${index}`}
                          onClick={() => handleListClick(result)}
                          className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                        >
                          {result.name}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ) : searchText === "" ? null : (
              <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                <p className="px-4 py-2 text-sm text-gray-500 text-center">No results found.</p>
              </div>
            )}
          </>
        )}

        {/* Advanced Search placeholder */}
        {showAdvancedSearch && <AdvancedSearch onClose={() => setShowAdvancedSearch(false)} />}
      </div>

      <div className="flex items-center space-x-2 md:space-x-4">
        <select
          value={useSelector((state: any) => state.dataState.selectedAcademicSession)}
          className={`hidden rounded-md px-2 py-2 text-xs text-gray-700 focus:outline-none ${(sessionsPerYear?.length || 0) > 0 ? "md:block" : ""}`}
          onChange={(event) => {
            dispatcher(setAcademicSessionId(event.target.value));
          }}
        >
          {sessionsPerYear?.map((session) => (
            <option key={session} value={session}>
              {session}
            </option>
          ))}
        </select>

        <select
          value={academicYear}
          className="hidden rounded-md  px-2 py-2 text-xs text-gray-700 focus:outline-none md:block"
          onChange={(event) => {
            dispatcher(setAcademicYearId(event.target.value));
          }}
        >
          {academicYearsList?.map((year) => (
            <option key={year.Code} value={year.Code}>
              {year.Description}
            </option>
          ))}
        </select>

        <button className="p-2 text-gray-600 transition-colors hover:text-blue-600 hidden">
          <img className="h-[24px] w-[24px]" src="/images/messages.svg" alt="Messages" />
        </button>

        <button className="p-2 text-gray-600 transition-colors hover:text-blue-600 hidden">
          <Image src="/images/notification.svg" alt="Notifications" width={24} height={24} />
        </button>

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen((prev) => !prev)}
            className="flex items-center space-x-2 focus:outline-none"
            aria-haspopup="menu"
            aria-expanded={isProfileOpen}
            title="User menu"
          >
            <Image src="/images/avatar-svgrepo-com.svg" alt="User Avatar" width={32} height={32} className="h-8 w-8 rounded-full" />
          </button>
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  router.push("/space-portal/profile");
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Profile
              </button>
              <button onClick={() => signOut({ callbackUrl: "/login" })} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
