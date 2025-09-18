// Role-based access control utilities

export type UserRole = "Admin" | "Faculty" | "Staff" | "Student";

// Define role hierarchy (higher number = more privileges)
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  Admin: 4,
  Faculty: 3,
  Staff: 2,
  Student: 1,
};

// Define role-specific permissions
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  Admin: [
    "dashboard:view",
    "buildings:view",
    "buildings:manage",
    "allocation:create",
    "allocation:view",
    "allocation:manage",
    "requests:view",
    "requests:approve",
    "requests:manage",
    "reports:view",
    "reports:generate",
    "profile:view",
    "profile:edit",
  ],
  Faculty: [
    "dashboard:view",
    "buildings:view",
    "allocation:view",
    "requests:view",
    "profile:view",
    "profile:edit",
  ],
  Staff: [
    "dashboard:view",
    "buildings:view",
    "allocation:view",
    "requests:view",
    "profile:view",
    "profile:edit",
  ],
  Student: [
    "dashboard:view",
    "profile:view",
    "profile:edit",
  ],
};

// Check if user has specific permission
export function hasPermission(userRole: UserRole, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(permission);
}

// Check if user role has higher or equal privilege than required
export function hasRolePrivilege(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// Get all permissions for a role
export function getRolePermissions(userRole: UserRole): string[] {
  return ROLE_PERMISSIONS[userRole] || [];
}

// Check if user can access a specific path
export function canAccessPath(userRole: UserRole, pathname: string): boolean {
  const pathPermissions: Record<string, string> = {
    "/space-portal/dashboard": "dashboard:view",
    "/space-portal/buildings": "buildings:view",
    "/space-portal/allocation": "allocation:create",
    "/space-portal/requests": "requests:view",
    "/space-portal/reports": "reports:view",
    "/space-portal/profile": "profile:view",
  };

  // Check if path requires specific permission
  for (const [path, permission] of Object.entries(pathPermissions)) {
    if (pathname.startsWith(path)) {
      return hasPermission(userRole, permission);
    }
  }

  // Default to allowing access if no specific permission required
  return true;
}

// Get user-friendly role display name
export function getRoleDisplayName(userRole: UserRole): string {
  const displayNames: Record<UserRole, string> = {
    Admin: "Administrator",
    Faculty: "Faculty Member",
    Staff: "Staff Member",
    Student: "Student",
  };
  return displayNames[userRole] || userRole;
}

// Check if role can manage other users
export function canManageUsers(userRole: UserRole): boolean {
  return hasPermission(userRole, "users:manage");
}

// Check if role can approve requests
export function canApproveRequests(userRole: UserRole): boolean {
  return hasPermission(userRole, "requests:approve");
}

// Check if role can create allocations
export function canCreateAllocations(userRole: UserRole): boolean {
  return hasPermission(userRole, "allocation:create");
}
