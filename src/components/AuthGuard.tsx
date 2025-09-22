"use client";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { UserProfile } from "@/types";
import { checkRouteAccess, extractUserRoles } from "@/utils/roleBasedAccess";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Fetch user roles
  useEffect(() => {
    const fetchUserRoles = async () => {
      if (status === "loading" || !session) return;

      try {
        const response = await callApi<UserProfile[]>(process.env.NEXT_PUBLIC_GET_USER || URL_NOT_FOUND);
        if (response.success) {
          // Filter roles for the current user only
          const currentUserRoles = response.data?.filter((u) => u.userEmail.toLowerCase() === session?.user?.email?.toLowerCase()) || [];
          const roles = extractUserRoles(currentUserRoles);
          console.log("Current user roles:", roles, "for user:", session?.user?.email);
          setUserRoles(roles);
        }
      } catch (error) {
        console.error("Error fetching user roles:", error);
      } finally {
        setIsLoadingRoles(false);
      }
    };

    fetchUserRoles();
  }, [session, status]);

  // Check authorization
  useEffect(() => {
    if (status === "loading" || isLoadingRoles) return;

    if (!session) {
      router.push("/login");
      return;
    }

    // Check if user has access to the current route
    const hasAccess = checkRouteAccess(pathname, userRoles);
    console.log("Access check:", { pathname, userRoles, hasAccess });
    setIsAuthorized(hasAccess);

    if (!hasAccess) {
      // Redirect to dashboard if user doesn't have access
      router.push("/space-portal/dashboard");
    }
  }, [session, status, pathname, userRoles, isLoadingRoles, router]);

  if (status === "loading" || isLoadingRoles) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl font-semibold mb-4">Access Denied</div>
          <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
          <button
            onClick={() => router.push("/space-portal/dashboard")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
