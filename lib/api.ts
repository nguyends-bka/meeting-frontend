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
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          error: errorText || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      // Đọc response text trước
      const text = await response.text();
      
      // Nếu response rỗng, trả về success với empty data
      if (!text || text.trim() === '') {
        return { data: {} as T };
      }

      // Thử parse JSON
      try {
        const data = JSON.parse(text);
        return { data };
      } catch (error) {
        // Nếu không parse được JSON, coi như success với empty data
        // (một số endpoint có thể trả về empty response)
        return { data: {} as T };
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // Auth APIs
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

  // Meeting APIs
  async createMeeting(title: string, hostName: string, passcode?: string) {
    return this.request<{ 
      meetingId: string; 
      meetingCode: string;
      passcode: string;
      roomName: string;
    }>(
      '/api/meeting/create',
      {
        method: 'POST',
        body: JSON.stringify({ title, hostName, passcode }),
      }
    );
  }

  async joinMeetingByLink(meetingId: string) {
    return this.request<{
      token: string;
      liveKitUrl: string;
      roomName: string;
      meetingId: string;
      meetingCode: string;
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
    }>('/api/meeting/join', {
      method: 'POST',
      body: JSON.stringify({ 
        MeetingId: meetingId, // Capital M to match C# property name
        Passcode: passcode 
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
    }>('/api/meeting/join', {
      method: 'POST',
      body: JSON.stringify({ 
        MeetingCode: meetingCode.toUpperCase(),
        Passcode: passcode 
      }),
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
