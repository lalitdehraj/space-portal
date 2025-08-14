// This file can be named `apiWrapper.ts` or `apiWrapper.tsx` and placed in a `lib` or `utils` directory.
// It uses Axios to make API requests and provides a standardized wrapper function with caching.

import axios, { AxiosResponse, AxiosError } from 'axios';
import { setupCache } from 'axios-cache-interceptor';

export const api = setupCache(axios.create({
    baseURL:process.env.NEXT_PUBLIC_BASE_URL
}));

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export const callApi = async <T,>(apiCall: Promise<AxiosResponse<T>>): Promise<ApiResponse<T>> => {
  try {
    const response = await apiCall;
    return { success: true, data: response.data };
  } catch (err) {
    const error = err as AxiosError;
    //@ts-ignore
    const errorMessage = error.response?.data?.message || error.message || 'An unknown error occurred';
    return { success: false, error: errorMessage };
  }
};
export const callApiWithFilters = async <T,>(apiCall: Promise<AxiosResponse<T>>): Promise<T> => {
  try {
    const response = await apiCall;
    return  response.data
  } catch (err) {
    const error = err as AxiosError;
    //@ts-ignore
    const errorMessage = error.response?.data?.message || error.message || 'An unknown error occurred';
    return  errorMessage
  }
};