'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useConnectionState, useRoomContext } from '@livekit/components-react';
import { ConnectionState, RoomEvent } from 'livekit-client';
import { useAuth } from '@/lib/auth';
import { apiService } from '@/services/api';
import {
  addTranslationMessageListener,
  removeTranslationMessageListener,
  addTranslationStatusListener,
  removeTranslationStatusListener,
  getTranslationConnectionStatus,
  type TranslationConnectionStatus,
} from '@/lib/translationWebSocket';

export interface TranslationItem {
  id: string;
  speaker: string | null;
  text: string;
  receivedAt: number;
}

export interface TranslationRoomState {
  finalized: TranslationItem[];
}

export type TranslationRoomContextValue = TranslationRoomState & {
  preferredLanguage: string;
  translationWsStatus: TranslationConnectionStatus;
};

export const TRANSLATION_DATA_TOPIC = 'bkmt-translation';

const TranslationRoomContext = createContext<TranslationRoomContextValue | null>(null);

export function useTranslationRoom(): TranslationRoomContextValue {
  const ctx = useContext(TranslationRoomContext);
  if (!ctx) {
    throw new Error('useTranslationRoom must be used inside TranslationRoomProvider');
  }
  return ctx;
}

function getTranslationText(data: any, preferredLanguage: string): string {
  let text = '';
  if (data && typeof data === 'object') {
    // Bỏ qua các gói tin điều khiển của Server AI
    if (data.type === 'ready' || data.type === 'keepalive') {
      return '';
    }

    // Gói tin dạng: { "vi": "xin chào", "en": "Hello everyone.", "zh": "大家好。" }
    const userLang = preferredLanguage.toLowerCase();
    const keys = Object.keys(data);

    // Tìm key khớp chính xác với ngôn ngữ ưu tiên
    const matchedKey = keys.find((key) => key.toLowerCase() === userLang);

    if (matchedKey) {
      text = String(data[matchedKey] ?? '');
    } else {
      // Fallback 1: Thử tiếng Việt 'vi'
      const viKey = keys.find((key) => key.toLowerCase() === 'vi');
      if (viKey) {
        text = String(data[viKey] ?? '');
      } else {
        // Fallback 2: Lấy bản dịch đầu tiên có trong object
        const firstKey = keys[0];
        if (firstKey) {
          text = String(data[firstKey] ?? '');
        }
      }
    }

    if (!text) {
      text = JSON.stringify(data);
    }
  } else {
    // Fallback: Tin nhắn là chuỗi văn bản thô
    text = String(data || '');
  }
  return text;
}

export function TranslationRoomProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const room = useRoomContext();
  const connectionState = useConnectionState(room);
  const [preferredLanguage, setPreferredLanguage] = useState<string>('vi');
  const [finalized, setFinalized] = useState<TranslationItem[]>([]);
  const [translationWsStatus, setTranslationWsStatus] = useState<TranslationConnectionStatus>(() =>
    getTranslationConnectionStatus()
  );

  // Clear dữ liệu khi ngắt kết nối cuộc họp
  useEffect(() => {
    if (connectionState === ConnectionState.Disconnected) {
      setFinalized([]);
      setTranslationWsStatus('disconnected');
    }
  }, [connectionState]);

  // Đưa ngôn ngữ ưu tiên lên window để có thể truy vấn trực tiếp từ console
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).preferredLanguage = preferredLanguage;
    }
  }, [preferredLanguage]);

  // 1. Phân giải ngôn ngữ ưu tiên của người dùng khi mount/đăng nhập
  useEffect(() => {
    if (!user?.username) return;

    apiService
      .lookupLanguages([user.username])
      .then((res) => {
        const data = res.data?.[user.username];
        if (data?.preferredLanguage) {
          console.log('[TranslationRoomProvider] Resolving preferred language:', data.preferredLanguage);
          setPreferredLanguage(data.preferredLanguage);
        }
      })
      .catch((err) => {
        console.error('[TranslationRoomProvider] Failed to lookup user preferred language:', err);
      });
  }, [user?.username]);

  // 2. Lắng nghe trạng thái kết nối WebSocket dịch thuật
  useEffect(() => {
    const handleStatus = (status: TranslationConnectionStatus) => {
      setTranslationWsStatus(status);
    };
    addTranslationStatusListener(handleStatus);
    return () => {
      removeTranslationStatusListener(handleStatus);
    };
  }, []);

  // Ref để gửi dữ liệu dịch thuật thông qua LiveKit publishData
  const publishRef = useRef<(raw: string) => void>(() => {});

  useEffect(() => {
    publishRef.current = (raw: string) => {
      if (connectionState !== ConnectionState.Connected) return;
      try {
        void room.localParticipant.publishData(new TextEncoder().encode(raw), {
          reliable: true,
          topic: TRANSLATION_DATA_TOPIC,
        });
      } catch (e) {
        console.warn('Translation publishData failed:', e);
      }
    };
  }, [room, connectionState]);

  // 3. Lắng nghe và xử lý tin nhắn từ WebSocket dịch thuật cục bộ -> Gửi lên phòng LiveKit
  useEffect(() => {
    const handleMsg = (data: any) => {
      const text = getTranslationText(data, preferredLanguage);
      if (!text.trim()) return;

      const relaySpeaker =
        user?.fullName?.trim() ||
        room.localParticipant.name?.trim() ||
        room.localParticipant.identity?.trim() ||
        'Bản dịch';

      const newItem: TranslationItem = {
        id: crypto.randomUUID(),
        speaker: relaySpeaker,
        text,
        receivedAt: Date.now(),
      };

      setFinalized((prev) => [...prev, newItem]);

      // Gửi gói tin chứa metadata (speaker + translations gốc) cho toàn phòng qua LiveKit
      const sharedPayload = {
        speaker: relaySpeaker,
        translations: data,
      };
      publishRef.current(JSON.stringify(sharedPayload));
    };

    addTranslationMessageListener(handleMsg);
    return () => {
      removeTranslationMessageListener(handleMsg);
    };
  }, [preferredLanguage, room.localParticipant, user?.fullName]);

  // 4. Lắng nghe bản dịch từ những người dùng khác trong phòng gửi qua LiveKit Data
  useEffect(() => {
    const onData = (
      payload: Uint8Array,
      participant: { identity: string } | undefined,
      _kind: unknown,
      topic?: string,
    ) => {
      if (topic !== TRANSLATION_DATA_TOPIC) return;
      
      // Bỏ qua echo từ chính mình
      if (participant?.identity === room.localParticipant.identity) {
        return;
      }
      
      let raw: string;
      try {
        raw = new TextDecoder().decode(payload);
      } catch {
        return;
      }

      try {
        const parsed = JSON.parse(raw);
        const speaker = parsed.speaker || 'Bản dịch';
        const translations = parsed.translations;

        const text = getTranslationText(translations, preferredLanguage);
        if (!text.trim()) return;

        const newItem: TranslationItem = {
          id: crypto.randomUUID(),
          speaker,
          text,
          receivedAt: Date.now(),
        };

        setFinalized((prev) => [...prev, newItem]);
      } catch (err) {
        console.warn('Failed to parse translation from room:', err);
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, preferredLanguage]);

  const value = useMemo<TranslationRoomContextValue>(
    () => ({
      finalized,
      preferredLanguage,
      translationWsStatus,
    }),
    [finalized, preferredLanguage, translationWsStatus]
  );

  return (
    <TranslationRoomContext.Provider value={value}>
      {children}
    </TranslationRoomContext.Provider>
  );
}
