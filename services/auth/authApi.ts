import { apiClient } from '../base/apiClient';
import type { RegisterRequest, LoginRequest, LoginResponse } from '@/dtos/auth.dto';

// Auth domain API - React Query compatible
export const authApi = {
  register: async (request: RegisterRequest) => {
    return apiClient.request<LoginResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  login: async (request: LoginRequest) => {
    return apiClient.request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },
};
