import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// NOTE: No API keys are embedded here. All secrets live in backend environment variables.
const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Navigation callback for handling unauthenticated state
let navigationCallback: (() => void) | null = null;

export function setNavigationCallback(callback: () => void) {
  navigationCallback = callback;
}

// Attach Authorization header from AsyncStorage on every request
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses: attempt token refresh, then retry original request
let isRefreshing = false;
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  pendingQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  pendingQueue = [];
}

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest: AxiosRequestConfig & { _retry?: boolean } = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token) => {
            if (originalRequest.headers) {
              (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${token}`;
            }
            resolve(apiClient(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const farmerId = await AsyncStorage.getItem('farmerId');
    const refreshToken = await AsyncStorage.getItem('refreshToken');

    try {
      const { data } = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/refresh`,
        { farmerId, refreshToken },
      );
      const newAccessToken: string = data.data.accessToken;
      await AsyncStorage.setItem('accessToken', newAccessToken);
      processQueue(null, newAccessToken);
      if (originalRequest.headers) {
        (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${newAccessToken}`;
      }
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      await AsyncStorage.clear();
      if (navigationCallback) {
        navigationCallback();
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default apiClient;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (mobileNumber: string) =>
    apiClient.post('/auth/register', { mobileNumber }),

  verifyOtp: (mobileNumber: string, otp: string) =>
    apiClient.post('/auth/verify-otp', { mobileNumber, otp }),

  refresh: (farmerId: string, refreshToken: string) =>
    apiClient.post('/auth/refresh', { farmerId, refreshToken }),

  logout: () =>
    apiClient.post('/auth/logout'),
};

// ── Farmer ────────────────────────────────────────────────────────────────────
export const farmerApi = {
  getProfile: () =>
    apiClient.get('/farmers/me'),

  updateProfile: (data: Record<string, unknown>) =>
    apiClient.put('/farmers/me', data),
};

// ── Soil Profiles ─────────────────────────────────────────────────────────────
export const soilApi = {
  create: (data: Record<string, unknown>) =>
    apiClient.post('/soil-profiles', data),

  get: (id: string) =>
    apiClient.get(`/soil-profiles/${id}`),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/soil-profiles/${id}`, data),
};

// ── Advisory ──────────────────────────────────────────────────────────────────
export const advisoryApi = {
  getCrops: (plotId: string) =>
    apiClient.get('/advisory/crops', { params: { plotId } }),

  getFertilizer: (plotId: string, cropId: string) =>
    apiClient.get('/advisory/fertilizer', { params: { plotId, cropId } }),
};

// ── Weather ───────────────────────────────────────────────────────────────────
export const weatherApi = {
  get: (lat: number, lon: number) =>
    apiClient.get('/weather', { params: { lat, lon } }),
};

// ── Market Prices ─────────────────────────────────────────────────────────────
export const marketApi = {
  getPrices: (crop: string) =>
    apiClient.get('/market-prices', { params: { crop } }),
};

// ── Image Analysis ────────────────────────────────────────────────────────────
export const imageApi = {
  analyze: (file: { uri: string; name: string; type: string }) => {
    const form = new FormData();
    form.append('image', file as unknown as Blob);
    return apiClient.post('/images/analyze', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ── Feedback ──────────────────────────────────────────────────────────────────
export const feedbackApi = {
  submit: (sessionId: string, rating: number) =>
    apiClient.post('/feedback', { sessionId, rating }),

  dismiss: (sessionId: string) =>
    apiClient.post('/feedback', { sessionId, dismissed: true }),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationApi = {
  getAll: () =>
    apiClient.get('/notifications'),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  getReports: (role: string) =>
    apiClient.get('/dashboard/reports', { params: { role } }),
};
