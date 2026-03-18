'use client';

export interface PhysicalMicWebSocketSession {
  stop: () => Promise<void>;
}

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
    sampleRate: 48000,
    latencyHint: 'interactive',
  });

  const source = audioContext.createMediaStreamSource(stream);

  // ScriptProcessor đơn giản, dễ chạy
  const processor = audioContext.createScriptProcessor(4096, 1, 1);

  const ws = new WebSocket(wsUrl);
  ws.binaryType = 'arraybuffer';

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Timeout khi kết nối websocket: ${wsUrl}`));
    }, 5000);

    ws.onopen = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve();
    };

    ws.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error(`Không kết nối được websocket: ${wsUrl}`));
    };
  });

  processor.onaudioprocess = (event) => {
    if (ws.readyState !== WebSocket.OPEN) return;

    const input = event.inputBuffer.getChannelData(0);
    const pcm16 = floatTo16BitPCM(input);
    ws.send(pcm16.buffer);
  };

  source.connect(processor);
  processor.connect(audioContext.destination);

  return {
    stop: async () => {
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
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
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