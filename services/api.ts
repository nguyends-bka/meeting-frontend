// Legacy API service - maintained for backward compatibility
// New code should use domain-specific APIs: authApi, userApi, meetingApi, adminApi
import { authApi } from './auth/authApi';
import { userApi } from './user/userApi';
import { meetingApi } from './meeting/meetingApi';
import { adminApi } from './admin/adminApi';
import type { ApiResponse } from './base/apiClient';

// Re-export for convenience
export { authApi, userApi, meetingApi, adminApi };
export type { ApiResponse };

// Legacy wrapper for backward compatibility
class ApiService {
  async register(username: string, password: string, fullName?: string, email?: string) {
    return authApi.register({ username, password, fullName, email });
  }

  async login(username: string, password: string) {
    return authApi.login({ username, password });
  }

  async createMeeting(title: string, hostName: string, passcode?: string) {
    return meetingApi.create({ title, hostName, passcode });
  }

  async joinMeetingByLink(meetingId: string) {
    return meetingApi.joinByLink(meetingId);
  }

  async joinMeeting(meetingId: string, passcode: string) {
    return meetingApi.join({ meetingId, passcode });
  }

  async joinMeetingByCode(meetingCode: string, passcode: string) {
    return meetingApi.join({ meetingCode, passcode });
  }

  async leaveMeeting(participantId: string, meetingId: string) {
    return meetingApi.leave({ participantId, meetingId });
  }

  async getMeetingHistory(meetingId: string) {
    return meetingApi.getHistory(meetingId);
  }

  async getMyHistory() {
    return meetingApi.getMyHistory();
  }

  async getMeetings() {
    return meetingApi.getList();
  }

  async getAllUsers() {
    return adminApi.getAllUsers();
  }

  async updateUserRole(userId: string, role: string) {
    return adminApi.updateUserRole(userId, { role });
  }

  async deleteUser(userId: string) {
    return adminApi.deleteUser(userId);
  }

  async getAdminStats() {
    return adminApi.getStats();
  }

  async getAllMeetings() {
    return adminApi.getAllMeetings();
  }

  async deleteMeeting(meetingId: string) {
    return adminApi.deleteMeeting(meetingId);
  }

  async getProfile() {
    return userApi.getProfile();
  }

  async updateProfile(fullName?: string, email?: string) {
    return userApi.updateProfile({ fullName, email });
  }

  async changePassword(oldPassword: string, newPassword: string) {
    return userApi.changePassword({ oldPassword, newPassword });
  }
}

export const apiService = new ApiService();
