'use client';

export interface PhysicalMicWebSocketSession {
  stop: () => Promise<void>;
}

const INITIAL_CONNECT_TIMEOUT_MS = 5000;
const RECONNECT_MIN_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30_000;

function floatTo16BitPCM(float32Array: Float32Array): Int16Array {
  const buffer = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return buffer;
}

export async function startPhysicalMicWebSocket(
  wsUrl: string,
  deviceId?: string | null,
): Promise<PhysicalMicWebSocketSession> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: deviceId
      ? {
          deviceId: { ideal: deviceId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      : {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
    video: false,
  });

  const audioContext = new AudioContext({
    sampleRate: 16000,
    latencyHint: 'interactive',
  });

  const source = audioContext.createMediaStreamSource(stream);

  const processor = audioContext.createScriptProcessor(4096, 1, 1);

  const wsHolder = { current: null as WebSocket | null };
  let stopped = false;
  /** Browser: setTimeout trả về number (khác NodeJS.Timeout) */
  let reconnectTimer: number | null = null;
  /** Tăng khi mất kết nối hoặc reconnect thất bại; reset về 0 khi mở lại được */
  let failureCount = 0;

  const clearReconnectTimer = () => {
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (stopped) return;
    if (reconnectTimer != null) return;
    const exp = Math.min(
      RECONNECT_MAX_DELAY_MS,
      RECONNECT_MIN_DELAY_MS * 2 ** Math.min(failureCount, 10),
    );
    const delay = exp + Math.random() * 250;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      void attemptConnect(false);
    }, delay);
  };

  function attemptConnect(isFirst: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      if (stopped) {
        if (isFirst) reject(new Error('Đã dừng'));
        return;
      }

      const w = new WebSocket(wsUrl);
      w.binaryType = 'arraybuffer';

      if (stopped) {
        try {
          w.close();
        } catch {}
        if (isFirst) reject(new Error('Đã dừng'));
        else resolve();
        return;
      }

      let settled = false;
      const timeoutId = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          w.close();
        } catch {}
        failureCount++;
        scheduleReconnect();
        resolve();
      }, INITIAL_CONNECT_TIMEOUT_MS);

      const handleEarlyFailure = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        failureCount++;
        scheduleReconnect();
        resolve();
      };

      w.onopen = () => {
        if (stopped) {
          try {
            w.close();
          } catch {}
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          if (isFirst) reject(new Error('Đã dừng'));
          else resolve();
          return;
        }
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        failureCount = 0;
        wsHolder.current = w;
        w.onclose = () => {
          wsHolder.current = null;
          if (stopped) return;
          failureCount++;
          scheduleReconnect();
        };
        resolve();
      };

      w.onclose = () => {
        if (settled) return;
        handleEarlyFailure();
      };

      w.onerror = () => {
        /* thường kèm onclose */
      };
    });
  }

  await attemptConnect(true);

  processor.onaudioprocess = (event) => {
    const w = wsHolder.current;
    if (!w || w.readyState !== WebSocket.OPEN) return;

    const input = event.inputBuffer.getChannelData(0);
    const pcm16 = floatTo16BitPCM(input);
    w.send(pcm16.buffer);
  };

  source.connect(processor);
  processor.connect(audioContext.destination);

  return {
    stop: async () => {
      stopped = true;
      clearReconnectTimer();

      const w = wsHolder.current;
      wsHolder.current = null;

      try {
        processor.disconnect();
      } catch {}

      try {
        source.disconnect();
      } catch {}

      try {
        stream.getTracks().forEach((track) => track.stop());
      } catch {}

      try {
        if (
          w &&
          (w.readyState === WebSocket.OPEN ||
            w.readyState === WebSocket.CONNECTING)
        ) {
          await new Promise<void>((resolve) => {
            let resolved = false;

            const cleanup = () => {
              if (resolved) return;
              resolved = true;
              w.removeEventListener('close', handleClose);
              resolve();
            };

            const handleClose = () => {
              clearTimeout(timeoutId);
              cleanup();
            };

            const timeoutId = window.setTimeout(() => {
              cleanup();
            }, 3000);

            w.addEventListener('close', handleClose);
            w.close();
          });
        }
      } catch {}

      try {
        if (audioContext.state !== 'closed') {
          await audioContext.close();
        }
      } catch {}
    },
  };
}
