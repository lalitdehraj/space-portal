// This file can be named `apiWrapper.ts` or `apiWrapper.tsx` and placed in a `lib` or `utils` directory.
// It uses Axios to make API requests and provides a standardized wrapper function with caching.

import { credentials } from "@/constants";
import axios, { AxiosResponse, AxiosError } from "axios";
import { CacheProperties, setupCache } from "axios-cache-interceptor";

export const api = setupCache(
  axios.create({
    baseURL: process.env.NEXT_PUBLIC_BASE_URL,
  })
);

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export const callApi = async <T>(
  url: string,
  requestBody?: any,
  config?: false | Partial<CacheProperties<any, string>>
): Promise<ApiResponse<T>> => {
  try {
    const response = await api.post(url, JSON.stringify(requestBody));
    //@ts-ignore
    return { success: true, data: response.data };
  } catch (err) {
    console.log(err);
    const error = err as AxiosError;
    const errorMessage =
      //@ts-ignore
      error.response?.data?.message ||
      error.message ||
      "An unknown error occurred";
    return { success: false, error: errorMessage };
  }
};

// export const callApi = async <T>(
//   url: string,
//   requestBody?: any,
//   config?: false | Partial<CacheProperties<any, string>>
// ): Promise<ApiResponse<T>> => {
//   try {
//     const response = await api.post(url, JSON.stringify(requestBody || {}), {
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Basic ${credentials}`,
//       },
//       cache: config,
//     });
//     //@ts-ignore
//     return { success: true, data: JSON.parse(response.data.value) };
//     // return { success: true, data: response.data };
//   } catch (err) {
//     const error = err as AxiosError;
//     const errorMessage =
//       //@ts-ignore
//       error.response?.data?.message ||
//       error.message ||
//       "An unknown error occurred";
//     return { success: false, error: errorMessage };
//   }
// };
