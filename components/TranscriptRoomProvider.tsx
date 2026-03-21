'use client';

/**
 * Đồng bộ transcript cho cả phòng qua LiveKit publishData (topic bkmt-transcript).
 *
 * - Mỗi client mở WebSocket tới wsUrl (thường ws://127.0.0.1:9001/transcript trên máy của họ),
 *   nhận tin từ ASR/local, gắn speaker (ưu tiên fullName đăng nhập) rồi publishData lên phòng.
 * - Mọi client cũng lắng RoomEvent.DataReceived để nhận transcript từ người khác (bỏ qua echo từ chính mình).
 */

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
import {
  applyTranscriptRaw,
  resetTranscriptState,
  type TranscriptRoomState,
} from '@/lib/transcriptReducer';

export const TRANSCRIPT_DATA_TOPIC = 'bkmt-transcript';

type WsRelayStatus = 'idle' | 'connecting' | 'open' | 'error' | 'closed';

type TranscriptRoomContextValue = TranscriptRoomState & {
  /** Trạng thái WebSocket transcript trên máy client hiện tại (mỗi user một kết nối). */
  transcriptWsStatus: WsRelayStatus;
  hasRoomTranscriptData: boolean;
};

const TranscriptRoomContext = createContext<TranscriptRoomContextValue | null>(null);

function enrichTranscriptWithRelaySpeaker(
  raw: string,
  relaySpeaker: string | null,
): string {
  if (!relaySpeaker) return raw;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return raw;

  try {
    const payload = JSON.parse(trimmed) as Record<string, unknown>;
    if (payload.type !== 'partial' && payload.type !== 'final') return raw;

    const currentSpeaker =
      (typeof payload.speaker === 'string' && payload.speaker.trim()) ||
      (typeof payload.displayName === 'string' && payload.displayName.trim()) ||
      (typeof payload.senderName === 'string' && payload.senderName.trim()) ||
      (typeof payload.username === 'string' && payload.username.trim()) ||
      (typeof payload.user === 'string' && payload.user.trim());

    if (currentSpeaker) return raw;

    return JSON.stringify({
      ...payload,
      speaker: relaySpeaker,
    });
  } catch {
    return raw;
  }
}

export function useTranscriptRoom(): TranscriptRoomContextValue {
  const ctx = useContext(TranscriptRoomContext);
  if (!ctx) {
    throw new Error('useTranscriptRoom must be used inside TranscriptRoomProvider');
  }
  return ctx;
}

export function TranscriptRoomProvider({
  wsUrl,
  children,
}: {
  wsUrl: string;
  children: React.ReactNode;
}) {
  const room = useRoomContext();
  /** Subscribe trạng thái phòng — room.state trong deps không luôn gây re-render; cần hook này để mở WS transcript ngay khi Connected */
  const connectionState = useConnectionState(room);
  const { user } = useAuth();
  const [state, setState] = useState<TranscriptRoomState>(() => resetTranscriptState());
  const [transcriptWsStatus, setTranscriptWsStatus] = useState<WsRelayStatus>('idle');
  const [hasRoomTranscriptData, setHasRoomTranscriptData] = useState(false);

  useEffect(() => {
    if (connectionState === ConnectionState.Disconnected) {
      setState(resetTranscriptState());
      setHasRoomTranscriptData(false);
      setTranscriptWsStatus('idle');
    }
  }, [connectionState]);

  // Mọi người (trừ echo từ chính relay): nhận transcript qua LiveKit Data
  useEffect(() => {
    const onData = (
      payload: Uint8Array,
      participant: { identity: string } | undefined,
      _kind: unknown,
      topic?: string,
    ) => {
      if (topic !== TRANSCRIPT_DATA_TOPIC) return;
      if (participant?.identity === room.localParticipant.identity) {
        return;
      }
      let raw: string;
      try {
        raw = new TextDecoder().decode(payload);
      } catch {
        return;
      }
      setHasRoomTranscriptData(true);
      setState((prev) => applyTranscriptRaw(prev, raw));
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  // WebSocket trên máy client → publishData tới cả phòng
  const publishRef = useRef<(raw: string) => void>(() => {});

  useEffect(() => {
    publishRef.current = (raw: string) => {
      if (connectionState !== ConnectionState.Connected) return;
      try {
        void room.localParticipant.publishData(new TextEncoder().encode(raw), {
          reliable: true,
          topic: TRANSCRIPT_DATA_TOPIC,
        });
      } catch (e) {
        console.warn('Transcript publishData failed:', e);
      }
    };
  }, [room, connectionState]);

  useEffect(() => {
    if (!wsUrl?.trim()) {
      setTranscriptWsStatus('idle');
      return;
    }
    if (connectionState !== ConnectionState.Connected) {
      return;
    }

    let cancelled = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const openSocket = () => {
      if (cancelled) return;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
      }
      if (socket) {
        try {
          socket.close();
        } catch {
          /* ignore */
        }
        socket = null;
      }

      setTranscriptWsStatus('connecting');
      let s: WebSocket;
      try {
        s = new WebSocket(wsUrl);
        socket = s;
      } catch {
        setTranscriptWsStatus('error');
        reconnectTimer = setTimeout(openSocket, 2800);
        return;
      }

      s.onopen = () => {
        if (cancelled || socket !== s) return;
        setTranscriptWsStatus('open');
      };

      s.onmessage = async (event) => {
        if (cancelled || socket !== s) return;
        let raw = '';
        if (typeof event.data === 'string') {
          raw = event.data;
        } else if (event.data instanceof Blob) {
          raw = await event.data.text();
        } else {
          raw = String(event.data);
        }
        const relaySpeaker =
          user?.fullName?.trim() ||
          room.localParticipant.name?.trim() ||
          room.localParticipant.identity?.trim() ||
          null;
        const normalizedRaw = enrichTranscriptWithRelaySpeaker(raw, relaySpeaker);
        setHasRoomTranscriptData(true);
        setState((prev) => applyTranscriptRaw(prev, normalizedRaw));
        publishRef.current(normalizedRaw);
      };

      s.onerror = () => {
        if (cancelled || socket !== s) return;
        setTranscriptWsStatus('error');
      };

      s.onclose = () => {
        if (socket === s) socket = null;
        if (cancelled) return;
        setTranscriptWsStatus('closed');
        reconnectTimer = setTimeout(openSocket, 2800);
      };
    };

    openSocket();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
      socket = null;
    };
  }, [wsUrl, connectionState, room, user?.fullName]);

  const value = useMemo<TranscriptRoomContextValue>(
    () => ({
      ...state,
      transcriptWsStatus,
      hasRoomTranscriptData,
    }),
    [state, transcriptWsStatus, hasRoomTranscriptData],
  );

  return (
    <TranscriptRoomContext.Provider value={value}>{children}</TranscriptRoomContext.Provider>
  );
}
