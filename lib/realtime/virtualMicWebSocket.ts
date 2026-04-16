/**
 * WebSocket client for virtual mic: sends PCM16 audio to backend.
 *
 * Backend URL: wss://<API_HOST>/ws/virtual-mic?meetingId=xxx&token=JWT
 * Protocol:
 *   1. Client connects, then sends one text message: JSON { sampleRate, channels } (e.g. 48000, 1).
 *   2. Client sends binary messages: raw PCM16 (16-bit signed LE, mono).
 */

const getWsBaseUrl = (): string => {
  if (typeof window === 'undefined') return '';
  const api = process.env.NEXT_PUBLIC_API_URL || 'https://meeting.soict.io:8080';
  return api.replace(/^https?/, (s) => (s === 'https' ? 'wss' : 'ws'));
};

export interface VirtualMicConfig {
  sampleRate: number;
  channels: number;
}

export interface VirtualMicWebSocketOptions {
  meetingId?: string;
  token?: string;
  config: VirtualMicConfig;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
}

const DEFAULT_CONFIG: VirtualMicConfig = {
  sampleRate: 48000,
  channels: 1,
};

/**
 * Connect to /ws/virtual-mic and send config (JSON) then PCM16 binary chunks.
 */
export function createVirtualMicWebSocket(options: VirtualMicWebSocketOptions): WebSocket | null {
  const base = getWsBaseUrl();
  if (!base) return null;

  const params = new URLSearchParams();
  if (options.meetingId) params.set('meetingId', options.meetingId);
  if (options.token) params.set('token', options.token);
  const qs = params.toString();
  const url = `${base}/ws/virtual-mic${qs ? `?${qs}` : ''}`;

  const ws = new WebSocket(url);

  ws.onopen = () => {
    const config = { ...DEFAULT_CONFIG, ...options.config };
    ws.send(JSON.stringify({ sampleRate: config.sampleRate, channels: config.channels }));
    options.onOpen?.();
  };

  ws.onclose = (e) => options.onClose?.(e);
  ws.onerror = (e) => options.onError?.(e);

  return ws;
}

/**
 * Convert Float32Array (Web Audio) to PCM16 (16-bit signed LE) and return as ArrayBuffer.
 */
export function float32ToPcm16(float32: Float32Array): ArrayBuffer {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16.buffer;
}

/**
 * Capture audio from a MediaStream (e.g. getUserMedia - system or virtual device),
 * convert to PCM16 and send via WebSocket.
 */
export function startVirtualMicStream(
  stream: MediaStream,
  ws: WebSocket,
  options: { sampleRate?: number; frameSize?: number } = {}
): () => void {
  const sampleRate = options.sampleRate ?? 48000;
  const frameSize = options.frameSize ?? 1024;

  const audioContext = new AudioContext({ sampleRate });
  const source = audioContext.createMediaStreamSource(stream);

  // ScriptProcessor is deprecated but works; for production consider AudioWorklet
  const processor = audioContext.createScriptProcessor(frameSize, 1, 1);

  processor.onaudioprocess = (e) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const input = e.inputBuffer.getChannelData(0);
    const pcm16 = float32ToPcm16(input);
    ws.send(pcm16);
  };

  const gainNode = audioContext.createGain();
  gainNode.gain.value = 0;
  source.connect(processor);
  processor.connect(gainNode);
  gainNode.connect(audioContext.destination);

  return () => {
    processor.disconnect();
    gainNode.disconnect();
    source.disconnect();
    audioContext.close();
  };
}
