export const URL_NOT_FOUND = "http://localhost:3000";
export const credentials = btoa(`${"IG_Admin4"}:${"nN,^@Z}q/I3a!t;*ITL:sxw(o0#E<H"}`);

// OBE menu visibility APIs (paths relative to NEXT_PUBLIC_BASE_URL)
export const OBE_GET_EMPLOYEE_DETAILS_PATH =
  "/MUJOBE/MUJAPIOBE/v2.0/companies(480ceadc-3108-f011-8e30-7c1e520f486f)/MUJOBE(00000000-0000-0000-0000-000000000000)/Microsoft.NAV.GetEmployeDetails";
export const OBE_GET_COURSE_COORDINATOR_PATH =
  "/MUJOBE/MUJAPIOBE/v2.0/companies(480ceadc-3108-f011-8e30-7c1e520f486f)/MUJOBE(00000000-0000-0000-0000-000000000000)/Microsoft.NAV.GetCourseCoOrdinator";

// TEMPORARY: set to false when done with dev work (see comments below)
/** When true: SideNav always shows Space Portal & OBE sections regardless of role/OBE check */
export const DISABLE_MENU_VISIBILITY_LOGIC = false;
/** When true: AuthGuard does not sign out or redirect on space-portal when user has no SpaceAdmin roles */
export const DISABLE_MENU_AUTH_LOGIC = false;
