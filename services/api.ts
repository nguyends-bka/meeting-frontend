const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiService {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: headers as HeadersInit,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.message) {
            errorMessage = errorJson.message;
          } else if (errorJson.title) {
            if (response.status === 401) {
              errorMessage = 'Tên đăng nhập hoặc mật khẩu không đúng. Vui lòng thử lại.';
            } else if (response.status === 400) {
              errorMessage =
                errorJson.title === 'Bad Request'
                  ? 'Thông tin không hợp lệ. Vui lòng kiểm tra lại.'
                  : errorJson.title;
            } else if (response.status === 404) {
              errorMessage = 'Không tìm thấy tài nguyên.';
            } else if (response.status === 500) {
              errorMessage = 'Lỗi máy chủ. Vui lòng thử lại sau.';
            } else {
              errorMessage = errorJson.title || errorMessage;
            }
          } else if (typeof errorJson === 'string') {
            errorMessage = errorJson;
          }
        } catch {
          if (errorText && errorText.trim() !== '') {
            if (!errorText.startsWith('{')) {
              errorMessage = errorText;
            } else if (response.status === 401) {
              errorMessage = 'Tên đăng nhập hoặc mật khẩu không đúng. Vui lòng thử lại.';
            }
          }
        }

        return { error: errorMessage };
      }

      const text = await response.text();
      if (!text || text.trim() === '') {
        return { data: {} as T };
      }

      try {
        const data = JSON.parse(text);
        return { data };
      } catch {
        return { data: {} as T };
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  async register(username: string, password: string) {
    return this.request<{ token: string; user: any }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async login(username: string, password: string) {
    return this.request<{ token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async createMeeting(title: string, hostName: string, passcode?: string) {
    return this.request<{
      meetingId: string;
      meetingCode: string;
      passcode: string;
      roomName: string;
    }>('/api/meeting/create', {
      method: 'POST',
      body: JSON.stringify({ title, hostName, passcode }),
    });
  }

  async joinMeetingByLink(meetingId: string) {
    return this.request<{
      token: string;
      liveKitUrl: string;
      roomName: string;
      meetingId: string;
      meetingCode: string;
      participantId: string;
    }>('/api/meeting/join-by-link', {
      method: 'POST',
      body: JSON.stringify({ meetingId }),
    });
  }

  async joinMeeting(meetingId: string, passcode: string) {
    return this.request<{
      token: string;
      liveKitUrl: string;
      roomName: string;
      meetingId: string;
      meetingCode: string;
      participantId: string;
    }>('/api/meeting/join', {
      method: 'POST',
      body: JSON.stringify({
        MeetingId: meetingId,
        Passcode: passcode,
      }),
    });
  }

  async joinMeetingByCode(meetingCode: string, passcode: string) {
    return this.request<{
      token: string;
      liveKitUrl: string;
      roomName: string;
      meetingId: string;
      meetingCode: string;
      title: string;
      participantId: string;
    }>('/api/meeting/join', {
      method: 'POST',
      body: JSON.stringify({
        MeetingCode: meetingCode.toUpperCase(),
        Passcode: passcode,
      }),
    });
  }

  async leaveMeeting(participantId: string, meetingId: string) {
    return this.request<{ message: string; updatedCount?: number }>('/api/meeting/leave', {
      method: 'POST',
      body: JSON.stringify({
        ParticipantId: participantId,
        MeetingId: meetingId,
      }),
    });
  }

  async getMeetingHistory(meetingId: string) {
    return this.request<
      Array<{
        id: string;
        username: string;
        userId: string;
        joinedAt: string;
        leftAt: string | null;
        duration: number | null;
      }>
    >(`/api/meeting/${meetingId}/history`, {
      method: 'GET',
    });
  }

  async getMeetings() {
    return this.request<
      Array<{
        id: string;
        title: string;
        hostName: string;
        meetingCode: string;
        passcode: string;
        createdAt: string;
      }>
    >('/api/meeting', {
      method: 'GET',
    });
  }
}

export const apiService = new ApiService();
