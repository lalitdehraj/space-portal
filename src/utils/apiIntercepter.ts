import axios from 'axios';
import { setupCache } from 'axios-cache-interceptor';

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
});

const apiRequestHandler = setupCache(axiosInstance,{
    ttl : 1000 * 60 * 5
});

export default apiRequestHandler;