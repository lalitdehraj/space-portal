"use client";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { api, callApi } from "@/utils/apiIntercepter";
import { AcademicSessions, SearchResult } from "@/types";
import { URL_NOT_FOUND } from "@/constants";
import { useDispatch, useSelector } from "react-redux";
import { setAcademicSession, setAcademicYear } from "@/app/feature/dataSlice";
import { useRouter } from "next/navigation";
import { encrypt } from "@/utils/encryption";
import { signOut, useSession } from "next-auth/react";

type SearchResults = {
  buildings: SearchResult[];
  rooms: SearchResult[];
};

export default function Header() {
  const router = useRouter();
  const dispatcher = useDispatch();
  const [academic, setAcademic] = useState<AcademicSessions>();
  useEffect(() => {
    const getAcadmicCalender = async () => {
      let reponse = callApi<AcademicSessions>(
        api.get(process.env.NEXT_PUBLIC_GET_ACADMIC_CALENDER || URL_NOT_FOUND)
      );
      let res = await reponse;
      if (res.success) {
        setAcademic(res.data);
        dispatcher(setAcademicSession(res.data?.academicSessions[0]));
        dispatcher(
          setAcademicYear(
            res.data?.academicYears[res.data?.academicYears.length - 1]
          )
        );
      }
    };
    getAcadmicCalender();
  }, []);

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { data: session } = useSession();

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
          api.get(process.env.NEXT_PUBLIC_GET_SEARCH || URL_NOT_FOUND, {
            params: {
              searchKey: text,
            },
          })
        );
        setSearchResults(response.data || null);
        console.log("Result: ", JSON.stringify(response.data));
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

      <div className="flex items-center space-x-2 md:space-x-4">
        <select
          value={useSelector((state: any) => state.dataState.academicSession)}
          className="hidden rounded-md px-2 py-2 text-xs text-gray-700 focus:outline-none md:block"
          onChange={(event) => {
            dispatcher(setAcademicSession(event.target.value));
          }}
        >
          {academic?.academicSessions.map((session) => (
            <option key={session}>{session}</option>
          ))}
        </select>
        <select
          value={useSelector((state: any) => state.dataState.academicYear)}
          className="hidden rounded-md  px-2 py-2 text-xs text-gray-700 focus:outline-none md:block"
          onChange={(event) => {
            dispatcher(setAcademicYear(event.target.value));
          }}
        >
          {academic?.academicYears.map((year) => (
            <option key={year}>{year}</option>
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
