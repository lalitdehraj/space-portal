"use client";
import React, { cache, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { callApi } from "@/utils/apiIntercepter";
import {
  SearchResult,
  AcademicSession,
  AcademicYear,
  SearchResults,
  UserProfile,
} from "@/types";
import { URL_NOT_FOUND } from "@/constants";
import { useDispatch, useSelector } from "react-redux";
import {
  setAcademicSessionId,
  setAcademicYearId,
  setUserRoleId,
} from "@/app/feature/dataSlice";
import { useRouter } from "next/navigation";
import { encrypt } from "@/utils/encryption";
import { signOut, useSession } from "next-auth/react";

export type AcademicYearResponse = {
  "Academic Year": AcademicYear[];
};
export type AcademicSessionResponse = {
  "Academic Session": AcademicSession[];
};
export default function Header() {
  const router = useRouter();
  const dispatcher = useDispatch();
  const [academicYearsList, setAcademicYearsList] = useState<AcademicYear[]>();
  const [academicSessionsList, setAcademicSessionsList] =
    useState<AcademicSession[]>();
  const { data } = useSession();
  useEffect(() => {
    const fetchUserRoles = async () => {
      const response = await callApi<UserProfile[]>(
        process.env.NEXT_PUBLIC_GET_USER || URL_NOT_FOUND
      );
      if (response.success) {
        const user = response.data?.filter(
          (u) => u.userEmail.toLowerCase() === data?.user?.email?.toLowerCase()
        );
        if (user && user.length > 0) {
          dispatcher(setUserRoleId(user[0].userRole));
          dispatcher(setAcademicYearId(user[0].activeYear));
          dispatcher(setAcademicSessionId(user[0].activeSession));
        }
      }
    };
    fetchUserRoles();
  }, []);
  const academicYear = useSelector(
    (state: any) => state.dataState.selectedAcademicYear
  );

  useEffect(() => {
    const getAcadmicCalender = async () => {
      const responseYear = await callApi<AcademicYearResponse>(
        process.env.NEXT_PUBLIC_GET_ACADMIC_YEARS || URL_NOT_FOUND
      );
      if (responseYear.success) {
        const acadYearsList = responseYear.data?.["Academic Year"]?.reverse();
        setAcademicYearsList(acadYearsList);
      }

      let responseSession = await callApi<AcademicSessionResponse>(
        process.env.NEXT_PUBLIC_GET_ACADMIC_SESSIONS || URL_NOT_FOUND
      );

      if (responseSession.success) {
        setAcademicSessionsList(responseSession.data?.["Academic Session"]);
      }
    };
    getAcadmicCalender();
  }, []);

  const [sessionsPerYear, setSessionsPerYear] = useState<string[]>();

  useEffect(() => {
    if (!academicYear || !setAcademicSessionsList || !academicYearsList) return;
    const filteredList = academicSessionsList?.filter(
      (year) => year["Academic Year"] == academicYear
    );
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
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node)
      ) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [filterRef]);
  const profileRef = useRef<HTMLDivElement>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  useEffect(() => {
    const handleClickOutsideProfile = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutsideProfile);
    return () => {
      document.removeEventListener("mousedown", handleClickOutsideProfile);
    };
  }, [profileRef]);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(
    null
  );

  useEffect(() => {
    if (searchText.trim() === "") {
      setSearchResults(null);
      return;
    }

    const timerId = setTimeout(() => {
      const fetchSearchResults = async (text: string) => {
        const response = await callApi<SearchResults>(
          process.env.NEXT_PUBLIC_GET_SEARCH || URL_NOT_FOUND,
          {
            searchKey: text,
          }
        );
        setSearchResults(response.data || null);
      };

      fetchSearchResults(searchText);
    }, 300);

    return () => {
      clearTimeout(timerId);
    };
  }, [searchText]);
  const handleListClick = (result: SearchResult) => {
    result.type === "building"
      ? router.push(`/space-portal/buildings/${encrypt(result.buildingId)}`)
      : router.push(
          `/space-portal/buildings/${encrypt(result.buildingId)}/${encrypt(
            result.roomId
          )}`
        );

    setSearchText("");
    setIsSearchFocused(false);
  };

  return (
    <header className="flex w-full items-center justify-between bg-white px-4 py-2 shadow-sm md:px-6">
      <div className="relative mr-4 flex-1 max-w-sm" ref={filterRef}>
        <input
          type="text"
          placeholder="Search"
          value={searchText}
          onClick={() => setIsSearchFocused(true)}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-full rounded-lg border border-[#EBEDF2] bg-[#F5F6F8] py-2 pl-12 pr-4 text-sm text-gray-700 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
          aria-label="Search"
        />
        <img
          src="/images/search-normal.svg"
          alt="Search icon"
          className="h-[20px] w-[20px] absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
        />
        {isSearchFocused && (
          <>
            {(searchText !== "" &&
              (searchResults?.buildings.length || 0) > 0) ||
            (searchResults?.rooms.length || 0) > 0 ? (
              <div className="absolute pt-4 top-full left-0 w-full bg-white border max-h-80 overflow-y-auto border-gray-200 rounded-lg shadow-lg z-10">
                {(searchResults?.buildings.length || 0) > 0 && (
                  <>
                    <span className="flex items-center ml-2 text-gray-500">
                      Buildings
                    </span>
                    <ul className="py-2">
                      {searchResults?.buildings.map((result, index) => (
                        <li
                          key={index}
                          onClick={() => {
                            handleListClick(result);
                          }}
                          className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                        >
                          {result.name}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {(searchResults?.rooms.length || 0) > 0 && (
                  <>
                    <span className=" flex items-center ml-2 text-gray-500">
                      Rooms
                    </span>
                    <ul className="py-2">
                      {searchResults?.rooms.map((result, index) => (
                        <li
                          key={index}
                          onClick={() => {
                            handleListClick(result);
                          }}
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
              <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
                <p className="px-4 py-2 text-sm text-gray-500 text-center">
                  No results found.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center space-x-2 md:space-x-4 ">
        <select
          value={useSelector(
            (state: any) => state.dataState.selectedAcademicSession
          )}
          className={`hidden rounded-md px-2 py-2 text-xs text-gray-700 focus:outline-none ${
            (sessionsPerYear?.length || 0) > 0 ? "md:block" : ""
          }`}
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
          <img
            className="h-[24px] w-[24px]"
            src="/images/messages.svg"
            alt="Messages"
          />
        </button>

        <button className="p-2 text-gray-600 transition-colors hover:text-blue-600">
          <Image
            src="/images/notification.svg"
            alt="Notifications"
            width={24}
            height={24}
          />
        </button>

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen((prev) => !prev)}
            className="flex items-center space-x-2 focus:outline-none"
            aria-haspopup="menu"
            aria-expanded={isProfileOpen}
            title="User menu"
          >
            <Image
              src="/images/avatar-svgrepo-com.svg"
              alt="User Avatar"
              width={32}
              height={32}
              className="h-8 w-8 rounded-full"
            />
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
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
