import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { setAuth, getAuth, clearAuth, getRefreshToken } from '../utils/auth';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';

class SapyApiClient {
  private client: AxiosInstance;
  private refreshTokenPromise: Promise<string | null> = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        const token = await this.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await this.refreshAccessToken();
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            await this.clearAuthData();
            throw refreshError;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Authentication
  // ════════════════════════════════════════════════════════════════════════════

  async loginWithGoogle(data: any) {
    const response = await this.client.post('/auth/google/login', data);
    await setAuth(response.data.access_token, response.data.refresh_token);
    return response.data;
  }

  async requestPhoneOtp(data: any) {
    return this.client.post('/auth/phone/request-otp', data);
  }

  async verifyPhoneOtp(data: any) {
    const response = await this.client.post('/auth/phone/verify-otp', data);
    await setAuth(response.data.access_token, response.data.refresh_token);
    return response.data;
  }

  async refreshAccessToken(): Promise<string | null> {
    if (this.refreshTokenPromise) {
      return this.refreshTokenPromise;
    }

    this.refreshTokenPromise = (async () => {
      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) return null;

        const response = await this.client.post('/auth/token/refresh', {
          refresh_token: refreshToken,
        });

        await setAuth(response.data.access_token, response.data.refresh_token);
        return response.data.access_token;
      } catch (error) {
        console.error('Token refresh error:', error);
        return null;
      } finally {
        this.refreshTokenPromise = null;
      }
    })();

    return this.refreshTokenPromise;
  }

  async logout() {
    try {
      await this.client.post('/auth/logout');
    } finally {
      await this.clearAuthData();
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // User Profile
  // ════════════════════════════════════════════════════════════════════════════

  async getUserProfile() {
    const response = await this.client.get('/auth/profile');
    return response.data;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Chat / Messages
  // ════════════════════════════════════════════════════════════════════════════

  async sendMessage(data: any) {
    const response = await this.client.post('/chat/send', data);
    return response.data;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Licenses
  // ════════════════════════════════════════════════════════════════════════════

  async generateLicense(deviceInfo: any) {
    return this.client.post('/licenses/generate', { device_info: deviceInfo });
  }

  async validateLicense(licenseData: any) {
    return this.client.post('/licenses/validate', licenseData);
  }

  async listDevices() {
    return this.client.get('/licenses/devices');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Payments
  // ════════════════════════════════════════════════════════════════════════════

  async createRazorpayOrder(tier: string, amount: number, currency: string = 'INR') {
    return this.client.post('/payments/razorpay/create', {
      tier,
      amount_paise: amount,
      currency,
      billing_cycle: 'monthly',
    });
  }

  async createStripeSession(tier: string, amount: number, currency: string = 'USD') {
    return this.client.post('/payments/stripe/create', {
      tier,
      amount_cents: amount,
      currency,
      billing_cycle: 'monthly',
    });
  }

  async getPaymentHistory() {
    return this.client.get('/payments/history');
  }

  async getSubscription() {
    return this.client.get('/payments/subscription');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Usage & Limits
  // ════════════════════════════════════════════════════════════════════════════

  async checkMessageLimit() {
    return this.client.post('/usage/check-limit');
  }

  async consumeMessage() {
    return this.client.post('/usage/consume-message');
  }

  async getUsageToday() {
    return this.client.get('/usage/today');
  }

  async getUsageHistory(period: string = '30days') {
    return this.client.get(`/usage/history?period=${period}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Helper Methods
  // ════════════════════════════════════════════════════════════════════════════

  private async getAccessToken(): Promise<string | null> {
    try {
      const token = await getAuth();
      return token;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  private async clearAuthData() {
    try {
      await clearAuth();
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  }

  async getToken(): Promise<string | null> {
    return this.getAccessToken();
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    return !!token;
  }
}

export const api = new SapyApiClient();
export default api;

