'use client';

/**
 * Đồng bộ transcript cho cả phòng qua LiveKit publishData (topic bkmt-transcript), tương tự chat.
 *
 * - Một client "relay": identity LiveKit nhỏ nhất (so sánh chuỗi) mở WebSocket tới nguồn transcript
 *   và broadcast mọi tin nhận được lên phòng.
 * - Các client khác chỉ nhận qua RoomEvent.DataReceived — không cần truy cập WS nguồn.
 * - Máy chạy ASR / transcript.html nên dùng tài khoản có identity nhỏ (vào phòng trước) hoặc
 *   đảm bảo URL WS tới được từ máy relay.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRoomContext } from '@livekit/components-react';
import { ConnectionState, RoomEvent } from 'livekit-client';
import {
  applyTranscriptRaw,
  resetTranscriptState,
  type TranscriptRoomState,
} from '@/lib/transcriptReducer';

export const TRANSCRIPT_DATA_TOPIC = 'bkmt-transcript';

type WsRelayStatus = 'idle' | 'connecting' | 'open' | 'error' | 'closed';

type TranscriptRoomContextValue = TranscriptRoomState & {
  isRelay: boolean;
  wsRelayStatus: WsRelayStatus;
  hasRoomTranscriptData: boolean;
};

const TranscriptRoomContext = createContext<TranscriptRoomContextValue | null>(null);

export function useTranscriptRoom(): TranscriptRoomContextValue {
  const ctx = useContext(TranscriptRoomContext);
  if (!ctx) {
    throw new Error('useTranscriptRoom must be used inside TranscriptRoomProvider');
  }
  return ctx;
}

/** Participant có identity nhỏ nhất trong phòng đảm nhiệm kết nối WS → publishData (tránh trùng lặp). */
function computeTranscriptRelayIdentity(room: {
  state: ConnectionState;
  localParticipant: { identity: string };
  remoteParticipants: Map<string, { identity: string }>;
}): boolean {
  if (room.state !== ConnectionState.Connected) return false;
  const ids = [room.localParticipant.identity];
  room.remoteParticipants.forEach((p) => ids.push(p.identity));
  const sorted = [...new Set(ids)].sort((a, b) => a.localeCompare(b));
  return sorted[0] === room.localParticipant.identity;
}

export function TranscriptRoomProvider({
  wsUrl,
  children,
}: {
  wsUrl: string;
  children: React.ReactNode;
}) {
  const room = useRoomContext();
  const [state, setState] = useState<TranscriptRoomState>(() => resetTranscriptState());
  const [isRelay, setIsRelay] = useState(false);
  const [wsRelayStatus, setWsRelayStatus] = useState<WsRelayStatus>('idle');
  const [hasRoomTranscriptData, setHasRoomTranscriptData] = useState(false);

  const updateRelayFlag = useCallback(() => {
    setIsRelay(computeTranscriptRelayIdentity(room));
  }, [room]);

  useEffect(() => {
    updateRelayFlag();
    room.on(RoomEvent.Connected, updateRelayFlag);
    room.on(RoomEvent.ParticipantConnected, updateRelayFlag);
    room.on(RoomEvent.ParticipantDisconnected, updateRelayFlag);
    return () => {
      room.off(RoomEvent.Connected, updateRelayFlag);
      room.off(RoomEvent.ParticipantConnected, updateRelayFlag);
      room.off(RoomEvent.ParticipantDisconnected, updateRelayFlag);
    };
  }, [room, updateRelayFlag]);

  useEffect(() => {
    if (room.state === ConnectionState.Disconnected) {
      setState(resetTranscriptState());
      setHasRoomTranscriptData(false);
      setWsRelayStatus('idle');
    }
  }, [room.state]);

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

  // Chỉ relay: WebSocket → publishData tới cả phòng
  const publishRef = useRef<(raw: string) => void>(() => {});

  useEffect(() => {
    publishRef.current = (raw: string) => {
      if (room.state !== ConnectionState.Connected) return;
      try {
        void room.localParticipant.publishData(new TextEncoder().encode(raw), {
          reliable: true,
          topic: TRANSCRIPT_DATA_TOPIC,
        });
      } catch (e) {
        console.warn('Transcript publishData failed:', e);
      }
    };
  }, [room]);

  useEffect(() => {
    if (!isRelay || !wsUrl?.trim()) {
      setWsRelayStatus('idle');
      return;
    }
    if (room.state !== ConnectionState.Connected) {
      return;
    }

    let cancelled = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const openSocket = () => {
      if (cancelled || !computeTranscriptRelayIdentity(room)) return;
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

      setWsRelayStatus('connecting');
      let s: WebSocket;
      try {
        s = new WebSocket(wsUrl);
        socket = s;
      } catch {
        setWsRelayStatus('error');
        reconnectTimer = setTimeout(openSocket, 2800);
        return;
      }

      s.onopen = () => {
        if (cancelled || socket !== s) return;
        setWsRelayStatus('open');
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
        setHasRoomTranscriptData(true);
        setState((prev) => applyTranscriptRaw(prev, raw));
        publishRef.current(raw);
      };

      s.onerror = () => {
        if (cancelled || socket !== s) return;
        setWsRelayStatus('error');
      };

      s.onclose = () => {
        if (socket === s) socket = null;
        if (cancelled) return;
        setWsRelayStatus('closed');
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
  }, [isRelay, wsUrl, room.state, room]);

  const value = useMemo<TranscriptRoomContextValue>(
    () => ({
      ...state,
      isRelay,
      wsRelayStatus,
      hasRoomTranscriptData,
    }),
    [state, isRelay, wsRelayStatus, hasRoomTranscriptData],
  );

  return (
    <TranscriptRoomContext.Provider value={value}>{children}</TranscriptRoomContext.Provider>
  );
}
