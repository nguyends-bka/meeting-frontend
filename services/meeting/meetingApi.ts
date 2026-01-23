import { apiClient } from '../base/apiClient';
import type {
  CreateMeetingRequest,
  CreateMeetingResponse,
  JoinMeetingRequest,
  JoinMeetingResponse,
  LeaveMeetingRequest,
  LeaveMeetingResponse,
  MeetingListItem,
  MeetingHistoryItem,
  MyHistoryItem,
} from '@/dtos/meeting.dto';

// Meeting domain API - React Query compatible
export const meetingApi = {
  create: async (request: CreateMeetingRequest) => {
    return apiClient.request<CreateMeetingResponse>('/api/meeting/create', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  joinByLink: async (meetingId: string) => {
    return apiClient.request<JoinMeetingResponse>('/api/meeting/join-by-link', {
      method: 'POST',
      body: JSON.stringify({ meetingId }),
    });
  },

  join: async (request: JoinMeetingRequest) => {
    const body: any = {};
    if (request.meetingId) {
      body.MeetingId = request.meetingId;
    }
    if (request.meetingCode) {
      body.MeetingCode = request.meetingCode.toUpperCase();
    }
    body.Passcode = request.passcode;

    return apiClient.request<JoinMeetingResponse>('/api/meeting/join', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  leave: async (request: LeaveMeetingRequest) => {
    const body: any = {};
    if (request.participantId) {
      body.ParticipantId = request.participantId;
    }
    if (request.meetingId) {
      body.MeetingId = request.meetingId;
    }

    return apiClient.request<LeaveMeetingResponse>('/api/meeting/leave', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  getList: async () => {
    return apiClient.request<MeetingListItem[]>('/api/meeting', {
      method: 'GET',
    });
  },

  getHistory: async (meetingId: string) => {
    return apiClient.request<MeetingHistoryItem[]>(`/api/meeting/${meetingId}/history`, {
      method: 'GET',
    });
  },

  getMyHistory: async () => {
    return apiClient.request<MyHistoryItem[]>('/api/meeting/my-history', {
      method: 'GET',
    });
  },
};
