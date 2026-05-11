/**
 * Course exit feedback OData GET — live MUJWEB host.
 * Format: .../courseExitFeedbacks?$filter=acadYear eq '...' and acadSession eq '...' and courseId eq '...' and programCode eq '...'
 */
/** Same resource path for OData GET ($filter) and POST (JSON body). */
export const COURSE_EXIT_FEEDBACK_BASE_URL =
  "http://mujerp.jaipur.manipal.edu:3445/MUJWEB/api/MUJ/CourseExitFeedbackAPIGROUP/v2.0/companies(480ceadc-3108-f011-8e30-7c1e520f486f)/courseExitFeedbacks";

/** POST body: `{ acadYear, acadSession, courseId, programCode, coNo, feedbackValue }` — called from Calculate CO after calculation completes. */
export const COURSE_EXIT_FEEDBACK_POST_URL = COURSE_EXIT_FEEDBACK_BASE_URL;

export function buildCourseExitFeedbackGetUrl(args: {
  acadYear: string;
  acadSession: string;
  courseId: string;
  programCode: string;
}): string {
  const filter = `acadYear eq '${args.acadYear}' and acadSession eq '${args.acadSession}' and courseId eq '${args.courseId}' and programCode eq '${args.programCode}'`;
  return `${COURSE_EXIT_FEEDBACK_BASE_URL}?$filter=${encodeURIComponent(filter)}`;
}
