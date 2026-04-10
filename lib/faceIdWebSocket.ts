export interface FaceEmbeddingResponse {
  embedding: number[];
}
export type FaceAngle = 'straight' | 'right' | 'left' | 'up';

export interface RegisterFaceEmbeddingResponse {
  straight?: number[];
  right?: number[];
  left?: number[];
  up?: number[];
}

export interface FaceEmbeddingMessage {
  embedding: number[];
  angle?: FaceAngle;
}

const DEFAULT_FACE_WS_URL = 'ws://127.0.0.1:9001/faceId';

/** WebSocket đăng ký khuôn mặt (embedding) — tách biệt với luồng xác thực /faceId */
export const DEFAULT_REGISTER_FACE_WS_URL = 'ws://127.0.0.1:9001/registerface';

/** Gửi 1 ảnh (JPEG base64) lên thiết bị mỗi N ms — dùng chung login face + đăng ký sinh trắc học. */
export const FACE_FRAME_SEND_INTERVAL_MS = 50;

type FaceIdConnectionStatus = 'disconnected' | 'connecting' | 'connected';

class FaceIdDeviceWebSocketManager {
  private wsUrl: string;
  private status: FaceIdConnectionStatus = 'disconnected';
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;

  private pending:
    | {
        resolve: (value: number[]) => void;
        reject: (reason: unknown) => void;
        timeoutTimer: number | null;
      }
    | null = null;
  private embeddingListeners = new Set<(message: FaceEmbeddingMessage) => void>();

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  start() {
    if (this.reconnectTimer != null) return;
    this.connect();
  }

  stop() {
    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.close();
      } catch {
        // ignore
      }
    }
    this.ws = null;
    this.status = 'disconnected';

    this.rejectPending(new Error('WebSocket stopped'));
  }

  getStatus(): FaceIdConnectionStatus {
    return this.status;
  }

  addEmbeddingListener(listener: (message: FaceEmbeddingMessage) => void) {
    this.embeddingListeners.add(listener);
  }

  removeEmbeddingListener(listener: (message: FaceEmbeddingMessage) => void) {
    this.embeddingListeners.delete(listener);
  }

  private connect() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.status = 'connecting';
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      this.status = 'connected';
    };

    this.ws.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : '';
      try {
        const parsed = JSON.parse(raw) as Partial<FaceEmbeddingResponse & RegisterFaceEmbeddingResponse>;
        let angle: FaceAngle | undefined;
        let rawEmbedding: unknown = parsed.embedding;
        if (!Array.isArray(rawEmbedding)) {
          const orderedAngles: FaceAngle[] = ['straight', 'right', 'left', 'up'];
          for (const key of orderedAngles) {
            const candidate = parsed[key];
            if (Array.isArray(candidate)) {
              angle = key;
              rawEmbedding = candidate;
              break;
            }
          }
        }
        if (!Array.isArray(rawEmbedding)) {
          if (this.pending) this.rejectPending(new Error('Invalid embedding response from device'));
          return;
        }

        const embedding = rawEmbedding.map((x) => Number(x));
        const message: FaceEmbeddingMessage = { embedding, angle };

        // Notify stream listeners (fire-and-forget mode).
        for (const cb of this.embeddingListeners) {
          try {
            cb(message);
          } catch {
            // ignore listener error
          }
        }

        // Resolve single pending request mode if any.
        if (this.pending) {
          const { resolve } = this.pending;
          this.clearPending();
          resolve(embedding);
        }
      } catch (e) {
        if (this.pending) this.rejectPending(e instanceof Error ? e : new Error('Failed to parse embedding response'));
      }
    };

    this.ws.onerror = () => {
      // Many browsers will also trigger onclose; reconnect is handled there.
    };

    this.ws.onclose = () => {
      this.status = 'disconnected';
      this.rejectPending(new Error('WebSocket closed before embedding received'));
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(delayMs: number = 2000) {
    if (this.reconnectTimer != null) return;
    if (typeof window === 'undefined') return;

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delayMs);
  }

  private clearPending() {
    if (this.pending?.timeoutTimer != null) {
      window.clearTimeout(this.pending.timeoutTimer);
    }
    this.pending = null;
  }

  private rejectPending(reason: unknown) {
    if (!this.pending) return;
    if (this.pending.timeoutTimer != null) {
      window.clearTimeout(this.pending.timeoutTimer);
    }
    const { reject } = this.pending;
    this.pending = null;
    reject(reason);
  }

  async requestEmbedding(
    imageBase64: string,
    timeoutMs: number = 10000,
  ): Promise<number[]> {
    if (!imageBase64) throw new Error('Image base64 is empty');

    if (typeof window === 'undefined') throw new Error('WebSocket not available');

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Wait for OPEN (but connection manager will keep reconnecting).
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) break;
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Không kết nối được WebSocket faceId');
    }

    if (this.pending) {
      throw new Error('Another face embedding request is in progress');
    }

    return new Promise<number[]>((resolve, reject) => {
      this.pending = {
        resolve,
        reject,
        timeoutTimer: null,
      };

      this.ws!.send(JSON.stringify({ image: imageBase64 }));
    });
  }

  async sendImage(imageBase64: string, waitOpenMs: number = 2000): Promise<void> {
    if (!imageBase64) throw new Error('Image base64 is empty');

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      const start = Date.now();
      while (Date.now() - start < waitOpenMs) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) break;
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Không kết nối được WebSocket faceId');
    }

    this.ws.send(JSON.stringify({ image: imageBase64 }));
  }
}

let faceIdManager: FaceIdDeviceWebSocketManager | null = null;
let registerFaceManager: FaceIdDeviceWebSocketManager | null = null;

export function startFaceIdDeviceConnection(wsUrl: string = DEFAULT_FACE_WS_URL) {
  if (typeof window === 'undefined') return;
  if (!faceIdManager) faceIdManager = new FaceIdDeviceWebSocketManager(wsUrl);
  faceIdManager.start();
}

export function stopFaceIdDeviceConnection() {
  if (!faceIdManager) return;
  faceIdManager.stop();
  faceIdManager = null;
}

export function getFaceIdConnectionStatus(wsUrl: string = DEFAULT_FACE_WS_URL): FaceIdConnectionStatus {
  if (!faceIdManager) {
    // chưa start => disconnected
    return 'disconnected';
  }
  return faceIdManager.getStatus();
}

export async function requestFaceEmbeddingFromDevice(
  imageBase64: string,
  wsUrl: string = DEFAULT_FACE_WS_URL,
): Promise<number[]> {
  if (typeof window === 'undefined') throw new Error('WebSocket not available');

  // Always start manager so it can auto-reconnect.
  startFaceIdDeviceConnection(wsUrl);
  if (!faceIdManager) throw new Error('FaceId WebSocket manager not initialized');

  return faceIdManager.requestEmbedding(imageBase64);
}

export function addFaceEmbeddingListener(listener: (message: FaceEmbeddingMessage) => void) {
  if (!faceIdManager) return;
  faceIdManager.addEmbeddingListener(listener);
}

export function removeFaceEmbeddingListener(listener: (message: FaceEmbeddingMessage) => void) {
  if (!faceIdManager) return;
  faceIdManager.removeEmbeddingListener(listener);
}

export async function sendFaceImageToDevice(
  imageBase64: string,
  wsUrl: string = DEFAULT_FACE_WS_URL,
): Promise<void> {
  if (typeof window === 'undefined') throw new Error('WebSocket not available');
  startFaceIdDeviceConnection(wsUrl);
  if (!faceIdManager) throw new Error('FaceId WebSocket manager not initialized');
  await faceIdManager.sendImage(imageBase64);
}

export function startRegisterFaceDeviceConnection(wsUrl: string = DEFAULT_REGISTER_FACE_WS_URL) {
  if (typeof window === 'undefined') return;
  if (!registerFaceManager) registerFaceManager = new FaceIdDeviceWebSocketManager(wsUrl);
  registerFaceManager.start();
}

export function stopRegisterFaceDeviceConnection() {
  if (!registerFaceManager) return;
  registerFaceManager.stop();
  registerFaceManager = null;
}

export async function requestRegisterFaceEmbeddingFromDevice(
  imageBase64: string,
  wsUrl: string = DEFAULT_REGISTER_FACE_WS_URL,
): Promise<number[]> {
  if (typeof window === 'undefined') throw new Error('WebSocket not available');

  startRegisterFaceDeviceConnection(wsUrl);
  if (!registerFaceManager) throw new Error('Register face WebSocket manager not initialized');

  return registerFaceManager.requestEmbedding(imageBase64);
}

/** Gửi ảnh lên /registerface (fire-and-forget), giống sendFaceImageToDevice cho /faceId — dùng với addRegisterFaceEmbeddingListener. */
export async function sendRegisterFaceImageToDevice(
  imageBase64: string,
  wsUrl: string = DEFAULT_REGISTER_FACE_WS_URL,
): Promise<void> {
  if (typeof window === 'undefined') throw new Error('WebSocket not available');
  startRegisterFaceDeviceConnection(wsUrl);
  if (!registerFaceManager) throw new Error('Register face WebSocket manager not initialized');
  await registerFaceManager.sendImage(imageBase64);
}

export function addRegisterFaceEmbeddingListener(listener: (message: FaceEmbeddingMessage) => void) {
  if (!registerFaceManager) return;
  registerFaceManager.addEmbeddingListener(listener);
}

export function removeRegisterFaceEmbeddingListener(listener: (message: FaceEmbeddingMessage) => void) {
  if (!registerFaceManager) return;
  registerFaceManager.removeEmbeddingListener(listener);
}

export async function checkFaceIdDeviceConnection(
  wsUrl: string = DEFAULT_FACE_WS_URL,
  timeoutMs: number = 2000,
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const ws = new WebSocket(wsUrl);

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {
        // ignore
      }
      resolve(false);
    }, timeoutMs);

    ws.onopen = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // ignore
      }
      resolve(true);
    };

    ws.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // ignore
      }
      resolve(false);
    };

    ws.onclose = () => {
      // if we didn't resolve via onopen/onerror, let timeout decide
    };
  });
}

