import { apiClient } from '../base/apiClient';

export interface AdminCountry {
  code: string;
  countryName: string;
  isActive: boolean;
}

export interface AdminLanguage {
  code: string;
  languageName: string;
  isActive: boolean;
}

export interface UpsertCountryRequest {
  code: string;
  countryName: string;
  isActive: boolean;
}

export interface UpsertLanguageRequest {
  code: string;
  languageName: string;
  isActive: boolean;
}

// Admin Catalog API - manages Countries and Languages
export const catalogApi = {
  // Countries
  getAllCountries: async () => {
    return apiClient.request<AdminCountry[]>('/api/admin/catalog/countries', {
      method: 'GET',
    });
  },

  createCountry: async (request: UpsertCountryRequest) => {
    return apiClient.request<AdminCountry>('/api/admin/catalog/countries', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  updateCountry: async (code: string, request: UpsertCountryRequest) => {
    return apiClient.request<AdminCountry>(`/api/admin/catalog/countries/${code}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  },

  // Languages
  getAllLanguages: async () => {
    return apiClient.request<AdminLanguage[]>('/api/admin/catalog/languages', {
      method: 'GET',
    });
  },

  createLanguage: async (request: UpsertLanguageRequest) => {
    return apiClient.request<AdminLanguage>('/api/admin/catalog/languages', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  updateLanguage: async (code: string, request: UpsertLanguageRequest) => {
    return apiClient.request<AdminLanguage>(`/api/admin/catalog/languages/${code}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  },
};
