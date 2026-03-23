// Frontend DTOs for Auth domain - only fields used by frontend

export interface RegisterRequest {
  username: string;
  password: string;
  fullName?: string;
  email?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthUser {
  id: string;
  username: string;
  role: string;
  fullName?: string;
  position?: string | null;
  academicRank?: 'GS' | 'PGS' | null;
  academicDegree?: 'TS' | 'ThS' | 'CN' | 'KS' | null;
  organizationUnitId?: string | null;
  faceTemplate?: string | null;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}
