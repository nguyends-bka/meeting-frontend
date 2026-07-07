import { apiClient } from '../base/apiClient';
import type {
  AdminUser,
  UpdateUserRoleRequest,
  UpdateUserRoleResponse,
  DeleteUserResponse,
  AdminStats,
  AdminMeeting,
  DeleteMeetingResponse,
  AuditLogPage,
  AuditLogQuery,
  AnalyticsResponse,
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

  getAuditLogs: async (query: AuditLogQuery = {}) => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    if (query.category) params.set('category', query.category);
    if (query.severity) params.set('severity', query.severity);
    if (query.search) params.set('search', query.search);
    const qs = params.toString();
    return apiClient.request<AuditLogPage>(`/api/admin/audit-logs${qs ? `?${qs}` : ''}`, {
      method: 'GET',
    });
  },

  getAnalytics: async (days = 30) => {
    return apiClient.request<AnalyticsResponse>(`/api/admin/analytics?days=${days}`, {
      method: 'GET',
    });
  },
};
