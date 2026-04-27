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
  MeetingDocumentDto,
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
  EndMeetingResponse,
  UpdateMeetingRequest,
  MeetingInvitee,
  MeetingCoHostItem,
  MeetingNotificationItem,
  MeetingRecordingDto,
} from '@/dtos/meeting.dto';

const MAX_MEETING_DOCUMENT_SIZE_BYTES = 100 * 1024 * 1024;
const RETRYABLE_UPLOAD_STATUS = new Set([502, 503, 504]);
const MAX_UPLOAD_RETRIES = 2;
const UPLOAD_RETRY_DELAY_MS = 1200;

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

  /** LÆ°u biá»ƒu quyáº¿t vÃ o DB (host). pollId gá»­i lÃªn Ä‘á»ƒ trÃ¹ng vá»›i LiveKit. */
  listPolls: async (meetingId: string) => {
    return apiClient.request<PollResponse[]>(`/api/meeting/${encodeURIComponent(meetingId)}/polls`, {
      method: 'GET',
    });
  },

  /** LÆ°u biá»ƒu quyáº¿t vÃ o DB (host). pollId gá»­i lÃªn Ä‘á»ƒ trÃ¹ng vá»›i LiveKit. */
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

  endMeeting: async (meetingId: string) => {
    return apiClient.request<EndMeetingResponse>(`/api/meeting/${encodeURIComponent(meetingId)}/end`, {
      method: 'POST',
    });
  },

  updateMeeting: async (meetingId: string, request: UpdateMeetingRequest) => {
    return apiClient.request<MeetingListItem>(`/api/meeting/${encodeURIComponent(meetingId)}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  },

  listInvitees: async (meetingId: string) => {
    return apiClient.request<MeetingInvitee[]>(
      `/api/meeting/${encodeURIComponent(meetingId)}/invitees`,
      { method: 'GET' },
    );
  },

  addInvitee: async (meetingId: string, username: string) => {
    return apiClient.request<MeetingInvitee>(
      `/api/meeting/${encodeURIComponent(meetingId)}/invitees`,
      {
        method: 'POST',
        body: JSON.stringify({ username: username.trim() }),
      },
    );
  },

  removeInvitee: async (meetingId: string, username: string) => {
    return apiClient.request<{ message: string }>(
      `/api/meeting/${encodeURIComponent(meetingId)}/invitees/${encodeURIComponent(username)}`,
      { method: 'DELETE' },
    );
  },

  listCoHosts: async (meetingId: string) => {
    return apiClient.request<MeetingCoHostItem[]>(
      `/api/meeting/${encodeURIComponent(meetingId)}/co-hosts`,
      { method: 'GET' },
    );
  },

  promoteInviteeToCoHost: async (meetingId: string, username: string) => {
    return apiClient.request<MeetingCoHostItem>(
      `/api/meeting/${encodeURIComponent(meetingId)}/co-hosts/promote`,
      {
        method: 'POST',
        body: JSON.stringify({ username: username.trim() }),
      },
    );
  },

  demoteCoHostToInvitee: async (meetingId: string, username: string) => {
    return apiClient.request<{ message: string }>(
      `/api/meeting/${encodeURIComponent(meetingId)}/co-hosts/demote`,
      {
        method: 'POST',
        body: JSON.stringify({ username: username.trim() }),
      },
    );
  },

  removeCoHost: async (meetingId: string, hostUserId: string) => {
    return apiClient.request<{ message: string }>(
      `/api/meeting/${encodeURIComponent(meetingId)}/co-hosts/${encodeURIComponent(hostUserId)}`,
      { method: 'DELETE' },
    );
  },

  getMyNotifications: async () => {
    return apiClient.request<MeetingNotificationItem[]>('/api/meeting/my-notifications', {
      method: 'GET',
    });
  },

  openNotification: async (notificationId: string) => {
    return apiClient.request<{ openedAt?: string | null }>(
      `/api/meeting/notifications/${encodeURIComponent(notificationId)}/open`,
      { method: 'POST' },
    );
  },

  listMeetingDocuments: async (meetingId: string) => {
    return apiClient.request<MeetingDocumentDto[]>(
      `/api/meeting/${encodeURIComponent(meetingId)}/documents`,
      { method: 'GET' },
    );
  },

  uploadMeetingDocument: async (meetingId: string, file: File) => {
    if (file.size > MAX_MEETING_DOCUMENT_SIZE_BYTES) {
      return { error: 'File qua lon. Vui long chon tai lieu nho hon 100MB.' } as { error: string };
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const apiPath = `/api/meeting/${encodeURIComponent(meetingId)}/documents/upload`;
    const directApiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
    const sameOriginBase = typeof window !== 'undefined' ? window.location.origin.replace(/\/+$/, '') : '';
    const directUploadUrl = directApiBase ? `${directApiBase}${apiPath}` : '';
    const uploadTargets = [apiPath];
    if (directUploadUrl && directUploadUrl !== `${sameOriginBase}${apiPath}`) {
      uploadTargets.push(directUploadUrl);
    }

    console.info('[MeetingDocuments] upload request', {
      meetingId,
      uploadTargets,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type,
      hasToken: Boolean(token),
      maxRetries: MAX_UPLOAD_RETRIES,
    });

    let res: Response | null = null;
    let responseText = '';
    let usedUploadUrl = uploadTargets[0];

    for (let targetIndex = 0; targetIndex < uploadTargets.length; targetIndex++) {
      usedUploadUrl = uploadTargets[targetIndex];
      for (let attempt = 0; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
        const form = new FormData();
        form.append('file', file);

        res = await fetch(usedUploadUrl, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: form,
        });

        if (res.ok) {
          break;
        }

        responseText = await res.text();
        const shouldRetry = RETRYABLE_UPLOAD_STATUS.has(res.status) && attempt < MAX_UPLOAD_RETRIES;

        console.error('[MeetingDocuments] upload failed', {
          meetingId,
          uploadUrl: usedUploadUrl,
          targetIndex,
          attempt: attempt + 1,
          status: res.status,
          statusText: res.statusText,
          responseText,
          willRetry: shouldRetry,
        });

        if (!shouldRetry) {
          break;
        }

        await new Promise((resolve) => window.setTimeout(resolve, UPLOAD_RETRY_DELAY_MS * (attempt + 1)));
      }

      if (res?.ok) {
        break;
      }
      if (!res || !RETRYABLE_UPLOAD_STATUS.has(res.status)) {
        break;
      }
    }

    if (!res) {
      return { error: 'Khong the gui yeu cau tai tai lieu.' } as { error: string };
    }

    if (!res.ok) {
      const text = responseText || (await res.text());
      let msg = `HTTP ${res.status}`;

      if (res.status === 413 || /request entity too large/i.test(text)) {
        msg = 'File qua lon. Vui long chon tai lieu nho hon 100MB.';
        return { error: msg } as { error: string };
      }
      if (RETRYABLE_UPLOAD_STATUS.has(res.status)) {
        msg = 'Server upload dang timeout (Gateway Timeout). Vui long thu lai sau vai giay.';
        return { error: msg } as { error: string };
      }

      try {
        const j = JSON.parse(text);
        msg = j?.message || j?.title || msg;
      } catch {
        if (text && !/^\s*<(!doctype|html)/i.test(text)) msg = text;
      }
      return { error: msg } as { error: string };
    }

    const data = (await res.json()) as MeetingDocumentDto;
    console.info('[MeetingDocuments] upload success', {
      meetingId,
      uploadUrl: usedUploadUrl,
      documentId: data?.id,
      fileName: data?.fileName,
      size: data?.size,
    });

    // After successful upload, also send file + doc_id + collection to embedding service
    try {
      const embedForm = new FormData();
      embedForm.append('file', file);
      embedForm.append('doc_id', (data as any).id);
      embedForm.append('collection', meetingId);

      // Fire-and-forget; do not fail the main upload if embedding fails
      fetch('https://rag.soictlab.com/embed/file', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: embedForm,
      })
        .then(async (res) => {
          const text = await res.text();
          try {
            const json = text ? JSON.parse(text) : null;
            console.info('embed/file response', { status: res.status, ok: res.ok, body: json });
          } catch (e) {
            console.info('embed/file response', { status: res.status, ok: res.ok, body: text });
          }
        })
        .catch((err) => {
          console.warn('embed/file error', err);
        });
    } catch (err) {
      // swallow errors intentionally
    }

    return { data };
  },

  getMeetingDocumentFileBlob: async (meetingId: string, documentId: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const res = await fetch(
      `/api/meeting/${encodeURIComponent(meetingId)}/documents/${encodeURIComponent(documentId)}/file`,
      {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      },
    );

    if (!res.ok) {
      const text = await res.text();
      let msg = `HTTP ${res.status}`;
      try {
        const j = JSON.parse(text);
        msg = j?.message || j?.title || msg;
      } catch {
        if (text) msg = text;
      }
      throw new Error(msg);
    }

    const blob = await res.blob();
    return blob;
  },

  deleteMeetingDocument: async (meetingId: string, documentId: string) => {
    return apiClient.request<unknown>(
      `/api/meeting/${encodeURIComponent(meetingId)}/documents/${encodeURIComponent(documentId)}`,
      {
        method: 'DELETE',
      },
    );
  },

  updateMeetingDocumentVisibility: async (meetingId: string, documentId: string, isShared: boolean) => {
    return apiClient.request<MeetingDocumentDto>(
      `/api/meeting/${encodeURIComponent(meetingId)}/documents/${encodeURIComponent(documentId)}/visibility`,
      {
        method: 'PATCH',
        body: JSON.stringify({ isShared }),
      },
    );
  },

  listRecordings: async (meetingId: string) => {
    return apiClient.request<MeetingRecordingDto[]>(
      `/api/meeting/${encodeURIComponent(meetingId)}/recordings`,
      {
        method: 'GET',
      },
    );
  },

  startRecording: async (meetingId: string) => {
    return apiClient.request<MeetingRecordingDto>(
      `/api/meeting/${encodeURIComponent(meetingId)}/recordings/start`,
      {
        method: 'POST',
      },
    );
  },

  stopRecording: async (meetingId: string, recordingId: string) => {
    return apiClient.request<MeetingRecordingDto>(
      `/api/meeting/${encodeURIComponent(meetingId)}/recordings/${encodeURIComponent(recordingId)}/stop`,
      {
        method: 'POST',
      },
    );
  },

  deleteRecording: async (meetingId: string, recordingId: string) => {
    return apiClient.request<unknown>(
      `/api/meeting/${encodeURIComponent(meetingId)}/recordings/${encodeURIComponent(recordingId)}`,
      {
        method: 'DELETE',
      },
    );
  },

  getRecordingFileBlob: async (meetingId: string, recordingId: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const res = await fetch(
      `/api/meeting/${encodeURIComponent(meetingId)}/recordings/${encodeURIComponent(recordingId)}/file`,
      {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      },
    );

    if (!res.ok) {
      const text = await res.text();
      let msg = `HTTP ${res.status}`;
      try {
        const j = JSON.parse(text);
        msg = j?.message || j?.title || msg;
      } catch {
        if (text) msg = text;
      }
      throw new Error(msg);
    }

    return res.blob();
  },
};
