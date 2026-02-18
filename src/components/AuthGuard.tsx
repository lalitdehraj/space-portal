"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { callApi, getBearerToken } from "@/utils/apiIntercepter";
import { callApiViaProxy } from "@/utils/proxyApiIntercepter";
import { URL_NOT_FOUND, OBE_GET_EMPLOYEE_DETAILS_PATH, OBE_GET_COURSE_COORDINATOR_PATH, DISABLE_MENU_AUTH_LOGIC } from "@/constants";
import { UserProfile, type CourseCoordinatorRow, type GetCourseCoordinatorResponse } from "@/types";
import { checkRouteAccess, extractUserRoles } from "@/utils/roleBasedAccess";
import { useDispatch, useSelector } from "react-redux";
import {
  setBearerToken,
  setIsSpaceAdmin,
  setIsOBEUser,
  setOBEProfile,
  setAcademicYearId,
  setAcademicSessionId,
  type OBEPublicProfile,
} from "@/app/feature/dataSlice";
import { RootState } from "@/app/store";

const PUBLIC_PATHS = ["/login"];

/** Normalize proxy/OData response to array (data may be array, or { value } / { values }). */
function getODataArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "values" in data && Array.isArray((data as { values: unknown }).values)) return (data as { values: T[] }).values;
  if (data && typeof data === "object" && "value" in data && Array.isArray((data as { value: unknown }).value)) return (data as { value: T[] }).value;
  return [];
}

const LoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-white">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
      <p className="mt-4 text-gray-600">Loading...</p>
    </div>
  </div>
);

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"));
  const dispatch = useDispatch();
  const bearerToken = useSelector((state: RootState) => state.dataState.bearerToken);
  const bearerTokenExpiry = useSelector((state: RootState) => state.dataState.bearerTokenExpiry);
  const selectedAcademicYear = useSelector((state: RootState) => state.dataState.selectedAcademicYear);
  const selectedAcademicSession = useSelector((state: RootState) => state.dataState.selectedAcademicSession);

  const [isAuthCheckComplete, setIsAuthCheckComplete] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Single effect: run full auth flow and all redirect/sign-out logic. Show loading until complete.
  useEffect(() => {
    if (status === "loading") return;

    const path = pathname;
    const publicPath = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

    // No session
    if (!session) {
      dispatch(setIsSpaceAdmin(false));
      dispatch(setIsOBEUser(false));
      dispatch(setOBEProfile(null));
      setIsAuthCheckComplete(false);
      if (!publicPath) signOut({ callbackUrl: "/login" });
      return;
    }

    if (!session.user?.email) {
      dispatch(setIsSpaceAdmin(false));
      dispatch(setIsOBEUser(false));
      setIsAuthCheckComplete(true);
      return;
    }

    const email = session.user.email;
    let cancelled = false;
    setIsAuthCheckComplete(false);

    const applyPostCheck = (spaceAdmin: boolean, obeUser: boolean, roles: string[]) => {
      if (cancelled) return;

      if (publicPath) {
        // On login page: redirect based on access (user has at least one of Space or OBE)
        if (spaceAdmin) {
          router.replace("/space-portal/dashboard");
          return;
        }
        if (obeUser) {
          router.replace("/obe/calculate-co");
          return;
        }
        alert("You don't have access.");
        signOut({ callbackUrl: "/login" });
        return;
      }

      // Protected route — require access to the section being accessed
      if (!DISABLE_MENU_AUTH_LOGIC && path.startsWith("/space-portal")) {
        if (!spaceAdmin) {
          if (obeUser) {
            router.replace("/obe/calculate-co");
            return;
          }
          alert("You don't have access.");
          signOut({ callbackUrl: "/login" });
          return;
        }
      }
      if (!DISABLE_MENU_AUTH_LOGIC && path.startsWith("/obe")) {
        if (!obeUser) {
          if (spaceAdmin) {
            router.replace("/space-portal/dashboard");
            return;
          }
          alert("You don't have access.");
          signOut({ callbackUrl: "/login" });
          return;
        }
      }

      // Route-level access: Space uses role-based check; OBE requires obeUser
      const hasAccess = path.startsWith("/obe") ? obeUser : path.startsWith("/space-portal") ? checkRouteAccess(path, roles) : true;
      setIsAuthorized(hasAccess);
      if (!hasAccess) {
        if (spaceAdmin) router.push("/space-portal/dashboard");
        else if (obeUser) router.push("/obe/calculate-co");
        else signOut({ callbackUrl: "/login" });
      }
    };

    const runAuthCheck = async () => {
      dispatch(setIsSpaceAdmin(false));
      dispatch(setIsOBEUser(false));
      dispatch(setOBEProfile(null));

      let spaceAdmin = false;
      let obeUser = false;
      let roles: string[] = [];

      try {
        // Ensure we have bearer token so Space Admin check can run
        let token = bearerToken;
        if (!token || bearerTokenExpiry <= Date.now()) {
          const tokenData = await getBearerToken();
          if (cancelled) return;
          if (tokenData) {
            dispatch(setBearerToken({ token: tokenData.token, expiry: tokenData.expiry }));
            token = tokenData.token;
          }
        }

        // Step 1: Space — check if user exists in Space user list
        if (token) {
          const response = await callApi<UserProfile[]>(process.env.NEXT_PUBLIC_GET_USER || URL_NOT_FOUND);
          if (cancelled) return;
          if (response.success && response.data?.length) {
            const currentUser = response.data.find((u) => u.userEmail?.toLowerCase() === email?.toLowerCase());
            if (currentUser) {
              spaceAdmin = true;
              roles = extractUserRoles([currentUser]);
              dispatch(setIsSpaceAdmin(true));
            }
          }
        }

        // Step 2: OBE — always check so we know if user is Space-only, OBE-only, or both
        const empRes = await callApiViaProxy<unknown>(OBE_GET_EMPLOYEE_DETAILS_PATH, { email});
        const empList = getODataArray<{ employeeNo?: string; activeSession?: string; activeYear?: string }>(empRes.data);
        if (cancelled) return;

        if (empRes.success && empList.length > 0) {
          const emp = empList[0];
          const employeeNo = emp?.employeeNo;
          const acadSess = emp?.activeSession;
          const acadYear = emp?.activeYear;
          // First time use emp; when header year/session are set, re-check OBE using header
          const acadYearForCoord = selectedAcademicYear?.trim() && selectedAcademicSession?.trim() ? selectedAcademicYear : (acadYear ?? "");
          const acadSessForCoord = selectedAcademicYear?.trim() && selectedAcademicSession?.trim() ? selectedAcademicSession : (acadSess ?? "");

          const coordRes = await callApiViaProxy<GetCourseCoordinatorResponse>(OBE_GET_COURSE_COORDINATOR_PATH, {
            acadYear: acadYearForCoord,
            acadSess: acadSessForCoord,
            facultyCode: employeeNo ?? "",
          });
          if (cancelled) return;

          const coordList = getODataArray<CourseCoordinatorRow>(coordRes.data);
          obeUser = !!(coordRes.success && coordList.length);
          dispatch(setIsOBEUser(obeUser));

          if (obeUser && emp) {
            const profile: OBEPublicProfile = {
              email,
              employeeNo: employeeNo ?? "",
              activeSession: acadSess ?? "",
              activeYear: acadYear ?? "",
            };
            dispatch(setOBEProfile(profile));
            // Set header from emp only when user is not Space and header is not yet set
            if (!spaceAdmin && (!selectedAcademicYear?.trim() || !selectedAcademicSession?.trim())) {
              if (acadYear) dispatch(setAcademicYearId(acadYear));
              if (acadSess) dispatch(setAcademicSessionId(acadSess));
            }
          } else {
            dispatch(setOBEProfile(null));
          }
        } else {
          dispatch(setIsOBEUser(false));
          dispatch(setOBEProfile(null));
        }

        // User has access to neither Space nor OBE — logout and send to login
        if (!spaceAdmin && !obeUser) {
          if (!cancelled) setIsAuthCheckComplete(true);
          alert("You don't have access.");
          signOut({ callbackUrl: "/login" });
          return;
        }

        if (!cancelled) setIsAuthCheckComplete(true);
        applyPostCheck(spaceAdmin, obeUser, roles);
      } catch {
        if (!cancelled) {
          dispatch(setIsOBEUser(false));
          dispatch(setOBEProfile(null));
          setIsAuthCheckComplete(true);
          if (!publicPath) {
            alert("You don't have access.");
            signOut({ callbackUrl: "/login" });
          }
        }
      }
    };

    runAuthCheck();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.email, status, pathname, bearerToken, bearerTokenExpiry, selectedAcademicYear, selectedAcademicSession, dispatch, router]);
  // --- Render ---

  if (isPublicPath) {
    if (session && status === "authenticated" && !isAuthCheckComplete) return <LoadingScreen />;
    return <>{children}</>;
  }

  if (status === "loading" || !isAuthCheckComplete) return <LoadingScreen />;

  if (!session) {
    if (pathname.startsWith("/obe")) return <LoadingScreen />;
    return null;
  }

  if (!isAuthorized) return <LoadingScreen />;

  return <>{children}</>;
}
