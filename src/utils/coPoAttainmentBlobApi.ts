/**
 * Live MUJWEB COPO blob APIs (same company/MUJOBE segment as Postman).
 * Save: POST SaveCOPOBase64ToBlob — body includes base64-encoded calculation JSON.
 * Get: POST GetCOPOBase64FromBlob — body is academicYear, academicSession, courseId, programCode only.
 */

const MUJOBE_COPO_BASE =
  "http://mujerp.jaipur.manipal.edu:3445/MUJWEB/api/MUJOBE/MUJAPIOBE/v2.0/companies(480ceadc-3108-f011-8e30-7c1e520f486f)/MUJOBE(00000000-0000-0000-0000-000000000000)";

export const COPO_BLOB_SAVE_URL_TEST = `${MUJOBE_COPO_BASE}/Microsoft.NAV.SaveCOPOBase64ToBlob`;

/**
 * Read back saved blob — POST with same keys as save (no base64 in body).
 * OData returns `{ "@odata.context": "...", "value": "<base64 string>" }` (Edm.String).
 * `/api/proxy` unwraps `value`; if it is not JSON-parseable, the client receives the raw base64 string.
 */
export const COPO_BLOB_GET_URL_TEST = `${MUJOBE_COPO_BASE}/Microsoft.NAV.GetCOPOBase64FromBlob`;

export type SaveCOPOBase64Payload = {
  academicYear: string;
  academicSession: string;
  courseId: string;
  programCode: string;
  base64Value: string;
  fileName: string;
  fileExtension: string;
};

export type GetCOPOBase64Body = {
  academicYear: string;
  academicSession: string;
  courseId: string;
  programCode: string;
};

/** UTF-8 safe base64 encode (calculation JSON may contain non-ASCII). */
export function jsonToBase64Utf8(obj: unknown): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export function base64Utf8ToJson<T = unknown>(b64: string): T {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as T;
}

/** Extract base64 from GetCOPOBase64FromBlob: raw string after proxy, or `{ value }` / `{ base64Value }` if unwrapped. */
export function extractBase64FromCOPOApiResponse(data: unknown): string | null {
  if (data == null) return null;
  if (typeof data === "string") {
    const t = data.trim();
    return t || null;
  }
  if (typeof data === "object") {
    const o = data as Record<string, unknown>;
    const direct = o.value ?? o.base64Value ?? o.Base64Value;
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    if (Array.isArray(o.value) && o.value.length > 0) {
      const row = o.value[0] as Record<string, unknown>;
      const v = row?.base64Value ?? row?.Base64Value;
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return null;
}
