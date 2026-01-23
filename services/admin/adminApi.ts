import { apiClient } from '../base/apiClient';
import type {
  AdminUser,
  UpdateUserRoleRequest,
  UpdateUserRoleResponse,
  DeleteUserResponse,
  AdminStats,
  AdminMeeting,
  DeleteMeetingResponse,
} from '@/dtos/admin.dto';

// Admin domain API - React Query compatible
export const adminApi = {
  getAllUsers: async () => {
    return apiClient.request<AdminUser[]>('/api/admin/users', {
      method: 'GET',
    });
  },

  updateUserRole: async (userId: string, request: UpdateUserRoleRequest) => {
    return apiClient.request<UpdateUserRoleResponse>(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  },

  deleteUser: async (userId: string) => {
    return apiClient.request<DeleteUserResponse>(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });
  },

  getStats: async () => {
    return apiClient.request<AdminStats>('/api/admin/stats', {
      method: 'GET',
    });
  },

  getAllMeetings: async () => {
    return apiClient.request<AdminMeeting[]>('/api/admin/meetings', {
      method: 'GET',
    });
  },

  deleteMeeting: async (meetingId: string) => {
    return apiClient.request<DeleteMeetingResponse>(`/api/admin/meetings/${meetingId}`, {
      method: 'DELETE',
    });
  },
};
