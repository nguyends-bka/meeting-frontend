// Base API client with common request handling
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://meeting.soict.io:8080';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiClient {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }

  async request<T>(
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
        if (response.status === 401 && typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return { error: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.' };
        }

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
}

export const apiClient = new ApiClient();
