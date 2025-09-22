// Role-based access control utility
import { UserProfile } from "@/types";

export interface RouteAccess {
  [route: string]: string[];
}

// Define role-based access control mapping
export const roleBasedAccess: RouteAccess = {
  // Dashboard - accessible to all authenticated users
  "/space-portal/dashboard": ["*"],

  // Space Management - accessible to all authenticated users
  "/space-portal/buildings": ["*"],

  // Role-specific pages - only accessible to users with that specific role
  "/space-portal/role": [], // This will be validated dynamically based on the role parameter

  // Maintenance - accessible to all authenticated users
  "/space-portal/allocation": ["*"],
  "/space-portal/requests": ["*"],
  "/space-portal/maintenance": ["*"],

  // Reports - accessible to all authenticated users
  "/space-portal/reports": ["*"],

  // Profile - accessible to all authenticated users
  "/space-portal/profile": ["*"],
};

/**
 * Check if a user has access to a specific route
 * @param currentPath - The current pathname
 * @param userRoles - Array of user roles
 * @returns boolean indicating if user has access
 */
export const checkRouteAccess = (currentPath: string, userRoles: string[]): boolean => {
  // Find the matching route pattern
  const matchingRoute = Object.keys(roleBasedAccess).find((route) => {
    if (route === "/space-portal/role") {
      // Special handling for role-specific pages
      return currentPath.startsWith("/space-portal/role/");
    }
    return currentPath.startsWith(route);
  });

  if (!matchingRoute) {
    // If no specific route is found, allow access (for new routes)
    return true;
  }

  const allowedRoles = roleBasedAccess[matchingRoute];

  // For role-specific pages, check if user has the specific role
  if (matchingRoute === "/space-portal/role") {
    const roleFromPath = currentPath.split("/space-portal/role/")[1];
    if (roleFromPath) {
      const decodedRole = decodeURIComponent(roleFromPath);
      const hasRole = userRoles.includes(decodedRole);
      console.log("Role validation:", { decodedRole, userRoles, hasRole });
      return hasRole;
    }
    // If no role in path, deny access
    return false;
  }

  // If "*" is in allowed roles, everyone can access
  if (allowedRoles.includes("*")) {
    return true;
  }

  // Check if user has any of the allowed roles
  return userRoles.some((role) => allowedRoles.includes(role));
};

/**
 * Extract user roles from user profile data
 * @param userProfiles - Array of user profiles
 * @returns Array of unique user roles
 */
export const extractUserRoles = (userProfiles: UserProfile[]): string[] => {
  const roles = userProfiles?.map((u) => u.userRole) || [];
  return Array.from(new Set(roles));
};

/**
 * Check if user has a specific role
 * @param userRoles - Array of user roles
 * @param requiredRole - The role to check for
 * @returns boolean indicating if user has the required role
 */
export const hasRole = (userRoles: string[], requiredRole: string): boolean => {
  return userRoles.includes(requiredRole);
};

/**
 * Check if user has any of the specified roles
 * @param userRoles - Array of user roles
 * @param requiredRoles - Array of roles to check for
 * @returns boolean indicating if user has any of the required roles
 */
export const hasAnyRole = (userRoles: string[], requiredRoles: string[]): boolean => {
  return userRoles.some((role) => requiredRoles.includes(role));
};
