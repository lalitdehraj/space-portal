export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type ProxyHttpMethod = "POST" | "GET";

/**
 * OBE-specific API helper. Uses /api/proxy to avoid CORS when calling
 * OBE/MUJWEB APIs from the browser.
 */
export const callApiViaProxy = async <T>(
  url: string,
  requestBody?: unknown,
  abortSignal?: AbortSignal,
  method: ProxyHttpMethod = "POST"
): Promise<ApiResponse<T>> => {
  try {
    const response = await fetch("/api/proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        endpoint: url,
        method,
        requestBody: requestBody !== undefined && requestBody !== null ? requestBody : {},
      }),
      signal: abortSignal,
    });

    if (abortSignal?.aborted) {
      return { success: false, error: "Request cancelled" };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }));
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const result = await response.json();

    return {
      success: result.success,
      data: result.data,
      error: result.error,
    };
  } catch (err) {
    if (abortSignal?.aborted || (err as Error)?.name === "CanceledError") {
      return { success: false, error: "Request cancelled" };
    }
    const error = err as Error;
    return {
      success: false,
      error: error.message || "An unknown error occurred",
    };
  }
};
