// Frontend DTOs for User domain

export interface UserProfile {
  id: string;
  username: string;
  role: string;
  fullName: string | null;
  email: string | null;
  position: string | null;
  academicRank: 'GS' | 'PGS' | null;
  academicDegree: 'TS' | 'ThS' | 'CN' | 'KS' | null;
  organizationUnitId: string | null;
  organizationUnitName: string | null;
  faceTemplate: string | null;
  createdAt: string;
}

export interface UpdateProfileRequest {
  fullName?: string;
  email?: string;
  position?: string | null;
  academicRank?: 'GS' | 'PGS' | null;
  academicDegree?: 'TS' | 'ThS' | 'CN' | 'KS' | null;
  organizationUnitId?: string | null;
  faceTemplate?: string | null;
}

export interface UpdateProfileResponse {
  message: string;
  user: {
    id: string;
    username: string;
    role: string;
    fullName: string | null;
    email: string | null;
    position: string | null;
    academicRank: 'GS' | 'PGS' | null;
    academicDegree: 'TS' | 'ThS' | 'CN' | 'KS' | null;
    organizationUnitId: string | null;
    organizationUnitName: string | null;
    faceTemplate: string | null;
  };
}

export interface OrganizationUnitOption {
  id: string;
  name: string;
  level: number;
  parentId: string | null;
  isActive: boolean;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  message: string;
}
