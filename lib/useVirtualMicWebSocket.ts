'use client';

import { useCallback, useRef, useState } from 'react';
import {
  createVirtualMicWebSocket,
  startVirtualMicStream,
  type VirtualMicConfig,
} from './virtualMicWebSocket';

export interface UseVirtualMicWebSocketOptions {
  meetingId?: string;
  config?: Partial<VirtualMicConfig>;
  /** deviceId from enumerateDevices() to use as virtual/default mic */
  audioDeviceId?: string;
}

export function useVirtualMicWebSocket(options: UseVirtualMicWebSocketOptions = {}) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'open' | 'error' | 'closed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const start = useCallback(async () => {
    setError(null);
    setStatus('connecting');

    const ws = createVirtualMicWebSocket({
      meetingId: options.meetingId,
      token: token ?? undefined,
      config: { sampleRate: 48000, channels: 1, ...options.config },
      onOpen: () => setStatus('open'),
      onClose: () => {
        setStatus('closed');
        wsRef.current = null;
      },
      onError: () => {
        setStatus('error');
        setError('WebSocket error');
      },
    });

    if (!ws) {
      setStatus('error');
      setError('WebSocket not available');
      return;
    }

    wsRef.current = ws;

    const openHandler = () => {
      setStatus('open');
      const constraints: MediaStreamConstraints = {
        audio: options.audioDeviceId
          ? { deviceId: { exact: options.audioDeviceId } }
          : true,
        video: false,
      };

      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          const stop = startVirtualMicStream(stream, ws, {
            sampleRate: options.config?.sampleRate ?? 48000,
          });
          stopStreamRef.current = () => {
            stop();
            stream.getTracks().forEach((t) => t.stop());
          };
        })
        .catch((err) => {
          setStatus('error');
          setError(err.message || 'Failed to get microphone');
        });
    };

    if (ws.readyState === WebSocket.OPEN) {
      openHandler();
    } else {
      ws.addEventListener('open', openHandler, { once: true });
    }
  }, [options.meetingId, options.audioDeviceId, options.config]);

  const stop = useCallback(() => {
    stopStreamRef.current?.();
    stopStreamRef.current = null;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('closed');
  }, []);

  return { start, stop, status, error };
}
