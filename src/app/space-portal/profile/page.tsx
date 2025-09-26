"use client";
import { useSession } from "next-auth/react";
import React, { useEffect, useState } from "react";
import { Mail, Phone, Building2, CalendarCheck, ArrowRightCircle } from "lucide-react";
import { callApi } from "@/utils/apiIntercepter";
import { UserProfile } from "@/types";
import { URL_NOT_FOUND } from "@/constants";
import { useDispatch, useSelector } from "react-redux";
import { setUser } from "@/app/feature/dataSlice";
import { useRouter } from "next/navigation";
import { RootState } from "@/app/store";

function ProfilePage() {
  const router = useRouter();
  const { data } = useSession();
  const dispatcher = useDispatch();
  const userEmail = data?.user?.email;
  const user = useSelector((state: RootState) => state.dataState.user);
  const [isLoadingUser, setIsLoadingUser] = useState(false);

  useEffect(() => {
    const fetchUser = async (email: string | null) => {
      if (!email) return;
      setIsLoadingUser(true);
      try {
        const response = await callApi<UserProfile[]>(process.env.NEXT_PUBLIC_GET_USER || URL_NOT_FOUND);
        if (response.success) {
          const filteredUsers = response.data?.filter((u) => u.userEmail.toLowerCase().trim() === email.toLowerCase().trim());
          dispatcher(setUser(filteredUsers?.[0] || null));
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      } finally {
        setIsLoadingUser(false);
      }
    };
    fetchUser(userEmail || null);
  }, []);

  return (
    <div className="w-full p-8 bg-white rounded-xl shadow-lg border border-gray-200">
      {/* Profile Header Section */}
      <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8 pb-8 border-b border-gray-200 mb-8">
        <div className="relative w-40 h-40 rounded-full overflow-hidden border-4 border-white shadow-md">
          <img
            src={user?.userImage ? `data:image/png;base64,${user?.userImage}` : `https://placehold.co/150x150/E2E8F0/A0AEC0?text=Munipal`}
            alt={`${data?.user?.name}'s profile`}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-2">
          <h1 className="text-3xl font-bold text-gray-800">{data?.user?.name}</h1>
          {isLoadingUser ? (
            <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
          ) : (
            <p className="text-lg text-orange-600 font-semibold">{user?.userPosition}</p>
          )}
          <div className="flex flex-col space-y-2 pt-4 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <Mail size={16} className="text-gray-500" />
              <span>{data?.user?.email}</span>
            </div>
            {isLoadingUser ? (
              <>
                <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-40 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-36 animate-pulse"></div>
              </>
            ) : (
              <>
                <div className="flex items-center space-x-2">
                  <Phone size={16} className="text-gray-500" />
                  <span>{user?.userContact}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Building2 size={16} className="text-gray-500" />
                  <span>{user?.userDepartment} Department</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CalendarCheck size={16} className="text-gray-500" />
                  <span>{`${user?.activeSession}, ${user?.activeYear}`}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-8 hidden"> */}
      {/* Allocated Spaces Section */}
      {/* <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800">Allocated Spaces</h2>
          <ul className="space-y-4">
            {allocatedSpaces.map((space) => (
              <li
                key={space.id}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between transition-transform duration-200 hover:scale-[1.01]"
              >
                <div className="flex flex-col">
                  <span className="text-base font-semibold text-gray-800">
                    {space.name}
                  </span>
                  <span className="text-sm text-gray-600">
                    {space.building}
                  </span>
                </div>
                <div className="px-3 py-1 text-xs font-medium text-white bg-blue-500 rounded-full">
                  {space.purpose}
                </div>
              </li>
            ))}
          </ul>
        </div> */}
      {/* Pending Requests Section */}
      {/* <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800">Recent Requests</h2>
          <ul className="space-y-4">
            {pendingRequests.map((request) => (
              <li
                key={request.id}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between transition-transform duration-200 hover:scale-[1.01]"
              >
                <div className="flex items-center space-x-3">
                  {getStatusIcon(request.status)}
                  <div className="flex flex-col">
                    <span className="text-base font-semibold text-gray-800">
                      {request.type}
                    </span>
                    <span className="text-sm text-gray-600">
                      {request.space}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <CalendarCheck size={16} />
                  <span>{request.date}</span>
                </div>
              </li>
            ))}
          </ul>
        </div> */}
      {/* </div> */}

      {/* Action Button */}
      <div className="flex justify-end mt-8">
        <button
          onClick={() => router.push("/space-portal/buildings")}
          className="flex items-center space-x-2 px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg shadow-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50 transition-colors duration-200"
        >
          <span>Manage Spaces</span>
          <ArrowRightCircle size={18} />
        </button>
      </div>
    </div>
  );
}

export default ProfilePage;
