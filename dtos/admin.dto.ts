// Frontend DTOs for Admin domain

export interface AdminUser {
  id: string;
  username: string;
  role: string;
  createdAt: string;
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
  participantCount: number;
  activeParticipantCount: number;
}

export interface DeleteMeetingResponse {
  message: string;
}
