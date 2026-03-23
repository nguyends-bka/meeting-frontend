import { apiClient } from '@/services/base/apiClient';
import type {
  OrganizationUnitItem,
  OrganizationUnitUpsertRequest,
} from '@/dtos/organization.dto';

export const organizationApi = {
  list: async () => {
    return apiClient.request<OrganizationUnitItem[]>('/api/admin/organization-units', {
      method: 'GET',
    });
  },

  getById: async (id: string) => {
    return apiClient.request<OrganizationUnitItem>(`/api/admin/organization-units/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
  },

  create: async (body: OrganizationUnitUpsertRequest) => {
    return apiClient.request<{ id: string }>('/api/admin/organization-units', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  update: async (id: string, body: OrganizationUnitUpsertRequest) => {
    return apiClient.request<{ ok: boolean }>(`/api/admin/organization-units/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  remove: async (id: string) => {
    return apiClient.request<{ ok: boolean }>(`/api/admin/organization-units/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};
