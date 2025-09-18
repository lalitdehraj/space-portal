"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { UserRole, hasPermission, canAccessPath, getRolePermissions } from "@/utils/roleUtils";
import { callApi } from "@/utils/apiIntercepter";
import { UserProfile } from "@/types";
import { URL_NOT_FOUND } from "@/constants";

interface UsePermissionsReturn {
  userRole: UserRole | null;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  canAccessPath: (pathname: string) => boolean;
  getPermissions: () => string[];
  isAdmin: boolean;
  isFaculty: boolean;
  isStaff: boolean;
  isStudent: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const { data: session, status } = useSession();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (status === "loading") return;
      
      if (!session?.user?.email) {
        setUserRole(null);
        setIsLoading(false);
        return;
      }

      try {
        const response = await callApi<UserProfile[]>(
          process.env.NEXT_PUBLIC_GET_USER || URL_NOT_FOUND
        );
        
        if (response.success && response.data) {
          const user = response.data.find(u => u.userEmail === session.user.email);
          setUserRole(user?.userRole as UserRole || null);
        } else {
          setUserRole(null);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        setUserRole(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserRole();
  }, [session, status]);

  const checkPermission = (permission: string): boolean => {
    if (!userRole) return false;
    return hasPermission(userRole, permission);
  };

  const checkPathAccess = (pathname: string): boolean => {
    if (!userRole) return false;
    return canAccessPath(userRole, pathname);
  };

  const getPermissions = (): string[] => {
    if (!userRole) return [];
    return getRolePermissions(userRole);
  };

  return {
    userRole,
    isLoading,
    hasPermission: checkPermission,
    canAccessPath: checkPathAccess,
    getPermissions,
    isAdmin: userRole === "Admin",
    isFaculty: userRole === "Faculty",
    isStaff: userRole === "Staff",
    isStudent: userRole === "Student",
  };
}
