// This file can be named `apiWrapper.ts` or `apiWrapper.tsx` and placed in a `lib` or `utils` directory.
// It uses Axios to make API requests and provides a standardized wrapper function with caching.

import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { CacheProperties, setupCache } from "axios-cache-interceptor";
import { reduxStore } from "@/app/store";
import { setBearerToken } from "@/app/feature/dataSlice";

export const api = setupCache(
  axios.create({
    baseURL: process.env.NEXT_PUBLIC_BASE_URL,
  })
);

// Token refresh promise to prevent multiple simultaneous token refreshes
let tokenRefreshPromise: Promise<{ token: string; expiry: number } | null> | null = null;

// Safeguards to prevent infinite loops
const MAX_TOKEN_RETRIES = 3; // Maximum number of consecutive token fetch failures
const TOKEN_RETRY_COOLDOWN = 60000; // 60 seconds cooldown after max failures

let tokenFetchFailureCount = 0;
let lastTokenFetchAttempt = 0;
let tokenFetchPermanentlyFailed = false;

// Reset token failure tracking on successful fetch
const resetTokenFailureTracking = () => {
  tokenFetchFailureCount = 0;
  tokenFetchPermanentlyFailed = false;
  lastTokenFetchAttempt = 0;
};

// Check if we should attempt token fetch (prevent infinite loops)
const shouldAttemptTokenFetch = (): boolean => {
  if (tokenFetchPermanentlyFailed) {
    // Check if cooldown period has passed
    const now = Date.now();
    if (now - lastTokenFetchAttempt > TOKEN_RETRY_COOLDOWN) {
      // Reset and allow retry after cooldown
      tokenFetchPermanentlyFailed = false;
      tokenFetchFailureCount = 0;
      return true;
    }
    return false;
  }
  return true;
};

// Ensure bearer token is available before making API calls
const ensureBearerToken = async (): Promise<string | null> => {
  if (typeof window === "undefined") return null;

  // Check if we should attempt token fetch (prevent infinite loops)
  if (!shouldAttemptTokenFetch()) {
    console.warn("Bearer token fetch temporarily disabled due to repeated failures. Will retry after cooldown.");
    return null;
  }

  const state = reduxStore.getState();
  let bearerToken = state.dataState.bearerToken;
  const bearerTokenExpiry = state.dataState.bearerTokenExpiry;

  // Check if token exists and is not expired (with 2 minute buffer)
  const isTokenValid = bearerToken && bearerTokenExpiry > Date.now();

  if (isTokenValid) {
    // Reset failure tracking on successful token validation
    if (tokenFetchFailureCount > 0) {
      resetTokenFailureTracking();
    }
    return bearerToken;
  }

  // Token is missing or expired, fetch a new one
  console.log("Bearer token expired or missing, refreshing...");

  // If a token refresh is already in progress, wait for it
  if (tokenRefreshPromise) {
    const tokenData = await tokenRefreshPromise;
    if (tokenData?.token) {
      resetTokenFailureTracking();
      return tokenData.token;
    }
    return null;
  }

  // Start new token refresh
  lastTokenFetchAttempt = Date.now();
  tokenRefreshPromise = getBearerToken();

  try {
    const tokenData = await tokenRefreshPromise;
    if (tokenData) {
      // Reset failure tracking on success
      resetTokenFailureTracking();

      // Dispatch to Redux store
      reduxStore.dispatch(setBearerToken({ token: tokenData.token, expiry: tokenData.expiry }));
      return tokenData.token;
    } else {
      // Increment failure count
      tokenFetchFailureCount++;

      if (tokenFetchFailureCount >= MAX_TOKEN_RETRIES) {
        tokenFetchPermanentlyFailed = true;
        console.error(
          `Bearer token fetch failed ${tokenFetchFailureCount} times. Disabling token fetch for ${
            TOKEN_RETRY_COOLDOWN / 1000
          } seconds to prevent infinite loops.`
        );
      }

      return null;
    }
  } catch (error) {
    // Increment failure count on error
    tokenFetchFailureCount++;

    if (tokenFetchFailureCount >= MAX_TOKEN_RETRIES) {
      tokenFetchPermanentlyFailed = true;
      console.error(
        `Bearer token fetch error occurred ${tokenFetchFailureCount} times. Disabling token fetch for ${
          TOKEN_RETRY_COOLDOWN / 1000
        } seconds to prevent infinite loops.`
      );
    }

    console.error("Error ensuring bearer token:", error);
    return null;
  } finally {
    tokenRefreshPromise = null;
  }
};

// Add request interceptor to automatically add bearer token from Redux store
api.interceptors.request.use(
  async (config) => {
    if (typeof window !== "undefined") {
      // Ensure bearer token is available before making the request
      const bearerToken = await ensureBearerToken();
      if (bearerToken && config.headers) {
        config.headers.Authorization = `Bearer ${bearerToken}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle 401 errors and retry with fresh token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If we get a 401 and haven't already retried, try refreshing token
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Check if token fetch is disabled to prevent loops
      if (tokenFetchPermanentlyFailed && !shouldAttemptTokenFetch()) {
        console.warn("Token fetch is disabled due to repeated failures. Not retrying 401 request.");
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      console.log("Received 401, refreshing bearer token and retrying request...");

      // Get fresh token using ensureBearerToken which has safeguards
      const bearerToken = await ensureBearerToken();
      if (bearerToken && typeof window !== "undefined") {
        // Update the Authorization header
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${bearerToken}`;
        }

        // Retry the original request
        return api(originalRequest);
      } else {
        console.error("Failed to refresh bearer token for 401 retry. Request will fail.");
      }
    }

    return Promise.reject(error);
  }
);

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type BearerTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export const getBearerToken = async (): Promise<{ token: string; expiry: number } | null> => {
  try {
    const response = await fetch("/api/auth/bearer-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch bearer token from API route:", response.status);
      return null;
    }

    const data = await response.json();

    if (data.success && data.token && data.expiry) {
      return {
        token: data.token,
        expiry: data.expiry,
      };
    }

    return null;
  } catch (error) {
    console.error("Error generating bearer token:", error);
    return null;
  }
};

export const callApi = async <T>(
  url: string,
  requestBody?: unknown,
  config?: false | Partial<CacheProperties<unknown, string>>,
  abortSignal?: AbortSignal
): Promise<ApiResponse<T>> => {
  try {
    const response = await api.post(url, JSON.stringify(requestBody || {}), {
      headers: {
        "Content-Type": "application/json",
      },
      cache: config,
      signal: abortSignal,
    });
    return { success: true, data: JSON.parse((response.data as { value: string }).value) };
  } catch (err) {
    const error = err as AxiosError;

    // Check if it's an abort error
    if (axios.isCancel(error) || (error as Error).name === "CanceledError") {
      return { success: false, error: "Request cancelled" };
    }

    //@ts-expect-error - error.response.data.message is not typed
    const errorMessage = error.response?.data?.message || error.message || "An unknown error occurred";
    return { success: false, error: errorMessage };
  }
};
