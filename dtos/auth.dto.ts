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
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}
