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
  PollCreateRequest,
  PollVoteRequest,
  PollCloseRequest,
  PollPublishRequest,
  AddPollManagerRequest,
  PollManagerItem,
  PollResponse,
  MeetingMinutes,
  RoomLogResponse,
  RoomChatCreateRequest,
  RoomTranscriptCreateRequest,
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
    const body: Record<string, unknown> = {};
    if (request.meetingId) {
      body.meetingId = request.meetingId;
    }
    if (request.meetingCode) {
      body.meetingCode = request.meetingCode.toUpperCase();
    }
    body.passcode = request.passcode;

    return apiClient.request<JoinMeetingResponse>('/api/meeting/join', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  leave: async (request: LeaveMeetingRequest) => {
    const body: Record<string, unknown> = {};
    if (request.participantId) {
      body.participantId = request.participantId;
    }
    if (request.meetingId) {
      body.meetingId = request.meetingId;
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

  /** Lưu biểu quyết vào DB (host). pollId gửi lên để trùng với LiveKit. */
  listPolls: async (meetingId: string) => {
    return apiClient.request<PollResponse[]>(`/api/meeting/${encodeURIComponent(meetingId)}/polls`, {
      method: 'GET',
    });
  },

  /** Lưu biểu quyết vào DB (host). pollId gửi lên để trùng với LiveKit. */
  createPoll: async (meetingId: string, body: PollCreateRequest) => {
    return apiClient.request<unknown>(`/api/meeting/${encodeURIComponent(meetingId)}/polls`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updateDraftPoll: async (meetingId: string, pollId: string, body: PollCreateRequest) => {
    const pid = encodeURIComponent(pollId);
    return apiClient.request<PollResponse>(
      `/api/meeting/${encodeURIComponent(meetingId)}/polls/${pid}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      },
    );
  },

  deleteDraftPoll: async (meetingId: string, pollId: string) => {
    const pid = encodeURIComponent(pollId);
    return apiClient.request<unknown>(
      `/api/meeting/${encodeURIComponent(meetingId)}/polls/${pid}`,
      {
        method: 'DELETE',
      },
    );
  },

  votePoll: async (meetingId: string, pollId: string, body: PollVoteRequest) => {
    const pid = encodeURIComponent(pollId);
    return apiClient.request<unknown>(
      `/api/meeting/${encodeURIComponent(meetingId)}/polls/${pid}/vote`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
  },

  closePoll: async (meetingId: string, pollId: string, body: PollCloseRequest) => {
    const pid = encodeURIComponent(pollId);
    return apiClient.request<unknown>(
      `/api/meeting/${encodeURIComponent(meetingId)}/polls/${pid}/close`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
  },

  publishPoll: async (meetingId: string, pollId: string, body: PollPublishRequest) => {
    const pid = encodeURIComponent(pollId);
    return apiClient.request<PollResponse>(
      `/api/meeting/${encodeURIComponent(meetingId)}/polls/${pid}/publish`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
  },

  listPollManagers: async (meetingId: string) => {
    return apiClient.request<PollManagerItem[]>(
      `/api/meeting/${encodeURIComponent(meetingId)}/polls/managers`,
      {
        method: 'GET',
      },
    );
  },

  addPollManager: async (meetingId: string, body: AddPollManagerRequest) => {
    const endpoint = `/api/meeting/${encodeURIComponent(meetingId)}/polls/managers`;
    const first = await apiClient.request<unknown>(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
    if (!first.error || !first.error.includes('HTTP 405')) {
      return first;
    }
    return apiClient.request<unknown>(
      endpoint,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      },
    );
  },

  removePollManager: async (meetingId: string, username: string) => {
    return apiClient.request<unknown>(
      `/api/meeting/${encodeURIComponent(meetingId)}/polls/managers/${encodeURIComponent(username)}`,
      {
        method: 'DELETE',
      },
    );
  },

  getRoomLog: async (meetingId: string) => {
    return apiClient.request<RoomLogResponse>(`/api/meeting/${encodeURIComponent(meetingId)}/room-log`, {
      method: 'GET',
    });
  },

  appendRoomChat: async (meetingId: string, body: RoomChatCreateRequest) => {
    return apiClient.request<unknown>(`/api/meeting/${encodeURIComponent(meetingId)}/room-log/chat`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  appendRoomTranscript: async (meetingId: string, body: RoomTranscriptCreateRequest) => {
    return apiClient.request<unknown>(`/api/meeting/${encodeURIComponent(meetingId)}/room-log/transcript`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  getMinutes: async (meetingId: string) => {
    return apiClient.request<MeetingMinutes>(`/api/meeting/${encodeURIComponent(meetingId)}/minutes`, {
      method: 'GET',
    });
  },
};
