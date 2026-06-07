'use client';

export type TranslationConnectionStatus = 'disconnected' | 'connecting' | 'connected';

const DEFAULT_TRANSLATION_WS_URL =
  `${process.env.NEXT_PUBLIC_WS_BASE_URL ?? 'ws://127.0.0.1:9001'}/translation`;

class TranslationWebSocketManager {
  private wsUrl: string;
  private status: TranslationConnectionStatus = 'disconnected';
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private statusListeners = new Set<(status: TranslationConnectionStatus) => void>();
  private messageListeners = new Set<(data: any) => void>();

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
    this.updateStatus('disconnected');
  }

  getStatus(): TranslationConnectionStatus {
    return this.status;
  }

  addStatusListener(listener: (status: TranslationConnectionStatus) => void) {
    this.statusListeners.add(listener);
  }

  removeStatusListener(listener: (status: TranslationConnectionStatus) => void) {
    this.statusListeners.delete(listener);
  }

  addMessageListener(listener: (data: any) => void) {
    this.messageListeners.add(listener);
  }

  removeMessageListener(listener: (data: any) => void) {
    this.messageListeners.delete(listener);
  }

  sendMessage(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const dataStr = typeof message === 'string' ? message : JSON.stringify(message);
        console.log(`[WS Translation] 📤 SEND → ${this.wsUrl}`, message);
        this.ws.send(dataStr);
      } catch (err) {
        console.error('[WS Translation] Failed to send message:', err);
      }
    }
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

    this.updateStatus('connecting');
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log(`[WS Translation] ✅ WebSocket OPEN → ${this.wsUrl}`);
      this.updateStatus('connected');
    };

    this.ws.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : '';
      console.log(`[WS Translation] 📨 RECEIVE ← ${this.wsUrl}`, raw);
      try {
        const parsed = JSON.parse(raw);
        for (const cb of this.messageListeners) {
          try {
            cb(parsed);
          } catch {
            // ignore
          }
        }
      } catch (e) {
        for (const cb of this.messageListeners) {
          try {
            cb({ raw });
          } catch {
            // ignore
          }
        }
      }
    };

    this.ws.onerror = (err) => {
      console.error(`[WS Translation] ❌ ERROR on ${this.wsUrl}`, err);
    };

    this.ws.onclose = () => {
      console.log(`[WS Translation] 🔌 CLOSE ← ${this.wsUrl}`);
      this.updateStatus('disconnected');
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(delayMs: number = 3000) {
    if (this.reconnectTimer != null) return;
    if (typeof window === 'undefined') return;

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delayMs);
  }

  private updateStatus(newStatus: TranslationConnectionStatus) {
    this.status = newStatus;
    for (const cb of this.statusListeners) {
      try {
        cb(newStatus);
      } catch {
        // ignore
      }
    }
  }
}

let translationManager: TranslationWebSocketManager | null = null;

export function startTranslationConnection(wsUrl: string = DEFAULT_TRANSLATION_WS_URL) {
  if (typeof window === 'undefined') return;
  if (!translationManager) translationManager = new TranslationWebSocketManager(wsUrl);
  translationManager.start();
}

export function stopTranslationConnection() {
  if (!translationManager) return;
  translationManager.stop();
  translationManager = null;
}

export function getTranslationConnectionStatus(): TranslationConnectionStatus {
  if (!translationManager) return 'disconnected';
  return translationManager.getStatus();
}

export function sendTranslationMessage(message: any) {
  translationManager?.sendMessage(message);
}

export function addTranslationStatusListener(listener: (status: TranslationConnectionStatus) => void) {
  if (!translationManager) startTranslationConnection();
  translationManager?.addStatusListener(listener);
}

export function removeTranslationStatusListener(listener: (status: TranslationConnectionStatus) => void) {
  translationManager?.removeStatusListener(listener);
}

export function addTranslationMessageListener(listener: (data: any) => void) {
  if (!translationManager) startTranslationConnection();
  translationManager?.addMessageListener(listener);
}

export function removeTranslationMessageListener(listener: (data: any) => void) {
  translationManager?.removeMessageListener(listener);
}
