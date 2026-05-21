export * from './admin/admin.dto';
// Frontend DTOs for Admin domain

import type { UserCountryItem, UserLanguageItem } from './user.dto';

export interface AdminUser {
  id: string;
  username: string;
  role: string;
  fullName?: string | null;
  email?: string | null;
  position?: string | null;
  academicRank?: string | null;
  academicDegree?: string | null;
  organizationUnitId?: string | null;
  organizationUnitName?: string | null;
  hasAvatar?: boolean;
  createdAt: string;
  countries: UserCountryItem[];
  languages: UserLanguageItem[];
}

export interface UpdateUserRoleRequest {
  role: string;
}

export interface UpdateUserRoleResponse {
  message: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
}

export interface DeleteUserResponse {
  message: string;
}

export interface AdminStats {
  totalUsers: number;
  totalAdmins: number;
  totalUsersRole: number;
  totalMeetings: number;
  totalParticipants: number;
}

export interface AdminMeeting {
  id: string;
  title: string;
  hostName: string;
  hostIdentity: string;
  meetingCode: string;
  passcode: string;
  roomName: string;
  createdAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  participantCount: number;
  activeParticipantCount: number;
}

export interface DeleteMeetingResponse {
  message: string;
}
