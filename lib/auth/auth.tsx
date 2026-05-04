'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api';
import { FaceRegistrationGate } from '@/components/FaceRegistrationGate';

export interface User {
  id: string;
  username: string;
  role: string;
  fullName?: string | null;
  position?: string | null;
  academicRank?: 'GS' | 'PGS' | null;
  academicDegree?: 'TS' | 'ThS' | 'CN' | 'KS' | null;
  organizationUnitId?: string | null;
  avatar?: string | null;
  /** Đã có FaceEmbedding trong DB (đăng nhập bằng khuôn mặt) */
  hasFaceEmbedding?: boolean;
}

interface NamePlatePayload {
  name: string;
  position: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithFaceEmbedding: (embedding: number[]) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string, fullName?: string, email?: string) => Promise<{ success: boolean; error?: string }>;
  updateUser: (patch: Partial<User>) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const NAMEPLATE_WS_URL = 'ws://127.0.0.1:9001/setnameplate';
const NAMEPLATE_RETRY_MS = 2000;
const DEFAULT_NAMEPLATE: NamePlatePayload = {
  name: 'Chào mừng đại biểu',
  position: 'Cộng hòa Xã hội chủ nghĩa Việt Nam',
};

let namePlateRetryTimer: ReturnType<typeof setTimeout> | null = null;
let namePlateSocket: WebSocket | null = null;
let lastDeliveredPayloadKey: string | null = null;

function stopNamePlateRetry(): void {
  if (namePlateRetryTimer) {
    clearTimeout(namePlateRetryTimer);
    namePlateRetryTimer = null;
  }

  if (namePlateSocket) {
    namePlateSocket.close();
    namePlateSocket = null;
  }
}

function buildDisplayName(user: User): string {
  const parts = [
    user.academicRank?.trim() || null,
    user.academicDegree?.trim() || null,
    user.fullName?.trim() || null,
  ].filter(Boolean) as string[];

  return parts.join(' ').trim();
}

function getNamePlatePayload(user: User): NamePlatePayload | null {
  const payload: NamePlatePayload = {
    name: buildDisplayName(user),
    position: user.position?.trim() || '',
  };

  if (!payload.name) return null;
  return payload;
}

function sendNamePlateRaw(payload: NamePlatePayload, retry = false): void {
  if (typeof window === 'undefined') return;

  const normalizedPayload: NamePlatePayload = {
    name: payload.name.trim(),
    position: payload.position.trim(),
  };

  if (!normalizedPayload.name) return;

  const payloadKey = JSON.stringify(normalizedPayload);
  if (lastDeliveredPayloadKey === payloadKey) return;

  stopNamePlateRetry();

  const tryConnect = () => {
    const ws = new WebSocket(NAMEPLATE_WS_URL);
    namePlateSocket = ws;
    let sent = false;

    ws.onopen = () => {
      ws.send(JSON.stringify(normalizedPayload));
      sent = true;
      lastDeliveredPayloadKey = payloadKey;
      ws.close();
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onclose = () => {
      if (namePlateSocket === ws) {
        namePlateSocket = null;
      }

      if (!sent && retry) {
        namePlateRetryTimer = setTimeout(tryConnect, NAMEPLATE_RETRY_MS);
      }
    };
  };

  tryConnect();
}

function sendNamePlate(user: User): void {
  const payload = getNamePlatePayload(user);
  if (!payload) return;
  sendNamePlateRaw(payload, true);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');

      if (savedToken && savedUser) {
        try {
          const parsed = JSON.parse(savedUser) as User;
          setToken(savedToken);
          setUser(parsed);
          if (!('hasFaceEmbedding' in parsed)) {
            void apiService.getProfile().then((res) => {
              if (res.data && typeof res.data.hasFaceEmbedding === 'boolean') {
                setUser((prev) => {
                  if (!prev) return prev;
                  const next = { ...prev, hasFaceEmbedding: res.data!.hasFaceEmbedding };
                  localStorage.setItem('user', JSON.stringify(next));
                  return next;
                });
              }
            });
          }
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }

      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token && user) {
      sendNamePlate(user);
    } else {
      stopNamePlateRetry();
      lastDeliveredPayloadKey = null;
    }

    return () => {
      stopNamePlateRetry();
    };
  }, [token, user]);

  const login = async (username: string, password: string) => {
    const result = await apiService.login(username, password);

    if (result.error || !result.data) {
      return { success: false, error: result.error || 'Login failed' };
    }

    const { token: newToken, user: userData } = result.data;

    setToken(newToken);
    setUser(userData);

    if (typeof window !== 'undefined') {
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));
    }

    return { success: true };
  };

  const loginWithFaceEmbedding = async (embedding: number[]) => {
    const result = await apiService.loginWithFaceEmbedding(embedding);

    if (result.error || !result.data) {
      return { success: false, error: result.error || 'Face login failed' };
    }

    const { token: newToken, user: userData } = result.data;

    setToken(newToken);
    setUser(userData);

    if (typeof window !== 'undefined') {
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));
    }

    return { success: true };
  };

  const register = async (username: string, password: string, fullName?: string, email?: string) => {
    const result = await apiService.register(username, password, fullName, email);

    if (result.error) {
      return { success: false, error: result.error };
    }

    return await login(username, password);
  };

  const updateUser = (patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;

      const next = { ...prev, ...patch };

      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(next));
      }

      return next;
    });
  };

  const logout = () => {
    stopNamePlateRetry();
    lastDeliveredPayloadKey = null;
    try {
      sessionStorage.removeItem('bk_face_reg_skipped');
    } catch {
      // ignore
    }
    setToken(null);
    setUser(null);

    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }

    router.push('/login');

    // Gửi nameplate mặc định sau khi đã clear session để useEffect không đóng socket đang mở
    // và không gọi stopNamePlateRetry() ngay sau khi bắt đầu kết nối.
    if (typeof window !== 'undefined') {
      queueMicrotask(() => {
        sendNamePlateRaw(DEFAULT_NAMEPLATE, false);
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        loginWithFaceEmbedding,
        register,
        updateUser,
        logout,
        isAuthenticated: !!token && !!user,
        isAdmin: user?.role === 'Admin',
      }}
    >
      {children}
      <FaceRegistrationGate />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}