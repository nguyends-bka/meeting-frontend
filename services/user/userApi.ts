import { apiClient } from '../base/apiClient';
import type {
  UserProfile,
  UpdateProfileRequest,
  UpdateProfileResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  OrganizationUnitOption,
} from '@/dtos/user.dto';

// User domain API - React Query compatible
export const userApi = {
  getProfile: async () => {
    return apiClient.request<UserProfile>('/api/user/profile', {
      method: 'GET',
    });
  },

  listOrganizationUnits: async () => {
    return apiClient.request<OrganizationUnitOption[]>('/api/user/organization-units', {
      method: 'GET',
    });
  },

  updateProfile: async (request: UpdateProfileRequest) => {
    return apiClient.request<UpdateProfileResponse>('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  },

  changePassword: async (request: ChangePasswordRequest) => {
    return apiClient.request<ChangePasswordResponse>('/api/user/profile/password', {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  },
};
