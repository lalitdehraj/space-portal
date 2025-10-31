// This file can be named `apiWrapper.ts` or `apiWrapper.tsx` and placed in a `lib` or `utils` directory.
// It uses Axios to make API requests and provides a standardized wrapper function with caching.

import axios, { AxiosError } from "axios";
import { CacheProperties, setupCache } from "axios-cache-interceptor";
import { reduxStore } from "@/app/store";

export const api = setupCache(
  axios.create({
    baseURL: process.env.NEXT_PUBLIC_BASE_URL,
  })
);

// Add request interceptor to automatically add bearer token from Redux store
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const state = reduxStore.getState();
      const bearerToken = state.dataState.bearerToken;
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
    const params = new URLSearchParams();
    params.append("client_id", process.env.CLIENT_ID || "");
    params.append("client_secret", process.env.CLIENT_SECRET || "");
    params.append("scope", process.env.SCOPE || "");
    params.append("grant_type", process.env.GRANT_TYPE || "client_credentials");
    params.append("token_name", process.env.TOKEN_NAME || "");

    const tenantId = process.env.TENANT_ID;
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const response = await axios.post<BearerTokenResponse>(tokenUrl, params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (response.data.access_token) {
      const expiryTime = Date.now() + response.data.expires_in * 1000 - 2 * 60 * 1000; // Subtract 2 minutes
      return {
        token: response.data.access_token,
        expiry: expiryTime,
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
