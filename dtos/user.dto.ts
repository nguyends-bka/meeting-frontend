// Frontend DTOs for User domain

export interface UserProfile {
  id: string;
  username: string;
  role: string;
  fullName: string | null;
  email: string | null;
  createdAt: string;
}

export interface UpdateProfileRequest {
  fullName?: string;
  email?: string;
}

export interface UpdateProfileResponse {
  message: string;
  user: {
    id: string;
    username: string;
    role: string;
    fullName: string | null;
    email: string | null;
  };
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  message: string;
}
