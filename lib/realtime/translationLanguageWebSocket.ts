'use client';

export interface LanguageSettingsPayload {
  source_language: string;
  destination_languages: string[];
}

export type TranslationLanguageConnectionStatus = 'disconnected' | 'connecting' | 'connected';

const DEFAULT_SET_LANGUAGE_WS_URL =
  `${process.env.NEXT_PUBLIC_WS_BASE_URL ?? 'ws://127.0.0.1:9001'}/setlanguage`;

class TranslationLanguageWebSocketManager {
  private wsUrl: string;
  private status: TranslationLanguageConnectionStatus = 'disconnected';
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private isServerReady = false;

  // Lưu cấu hình ngôn ngữ gần nhất để tự động gửi lại khi kết nối lại
  private lastPayload: LanguageSettingsPayload | null = null;
  // Tránh gửi trùng lặp cùng một cấu hình liên tiếp
  private lastSentPayloadStr: string | null = null;
  private statusListeners = new Set<(status: TranslationLanguageConnectionStatus) => void>();
  private messageListeners = new Set<(data: any) => void>();

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  updateUrl(wsUrl: string) {
    if (this.wsUrl === wsUrl) return;
    console.log(`[WS Language] URL changed from ${this.wsUrl} to ${wsUrl}. Reconnecting...`);
    this.wsUrl = wsUrl;
    if (this.ws) {
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
      this.lastSentPayloadStr = null;
      this.isServerReady = false;
      this.connect();
    }
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
    this.lastSentPayloadStr = null;
    this.isServerReady = false;
    this.updateStatus('disconnected');
  }

  getStatus(): TranslationLanguageConnectionStatus {
    return this.status;
  }

  addStatusListener(listener: (status: TranslationLanguageConnectionStatus) => void) {
    this.statusListeners.add(listener);
  }

  removeStatusListener(listener: (status: TranslationLanguageConnectionStatus) => void) {
    this.statusListeners.delete(listener);
  }

  addMessageListener(listener: (data: any) => void) {
    this.messageListeners.add(listener);
  }

  removeMessageListener(listener: (data: any) => void) {
    this.messageListeners.delete(listener);
  }

  /**
   * Cập nhật ngôn ngữ dịch thuật.
   * Gửi ngay nếu WebSocket đang kết nối, hoặc lưu lại để tự động gửi sau khi kết nối thành công.
   */
  setLanguage(sourceLanguage: string, destinationLanguages: string[]) {
    const srcLang = (sourceLanguage || '').trim();

    // Loại bỏ khoảng trắng thừa, loại bỏ trùng lặp và loại trừ ngôn ngữ nguồn
    const uniqueDestLanguages = Array.from(
      new Set(
        (destinationLanguages || [])
          .map((lang) => (lang || '').trim())
          .filter(Boolean)
      )
    ).filter((lang) => lang !== srcLang);

    const payload: LanguageSettingsPayload = {
      source_language: srcLang,
      destination_languages: uniqueDestLanguages,
    };
    
    this.lastPayload = payload;

    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isServerReady) {
      this.sendPayload(payload);
    } else {
      console.log('[WS Language] Saved language configuration to send on next connect or when ready:', payload);
    }
  }

  private sendPayload(payload: LanguageSettingsPayload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (!this.isServerReady) {
      console.log('[WS Language] Server not ready yet. Delaying payload send.');
      return;
    }
    try {
      const dataStr = JSON.stringify(payload);
      if (dataStr === this.lastSentPayloadStr) {
        console.log('[WS Language] Skipping duplicate payload:', dataStr);
        return;
      }
      console.log(`[WS Language] 📤 SEND → ${this.wsUrl}`, payload);
      this.ws.send(dataStr);
      this.lastSentPayloadStr = dataStr;
    } catch (err) {
      console.error('[WS Language] Failed to send language payload:', err);
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
      console.log(`[WS Language] ✅ WebSocket OPEN → ${this.wsUrl}`);
      this.updateStatus('connected');
      this.isServerReady = false; // Chờ gói tin ready từ server
    };

    this.ws.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : '';
      console.log(`[WS Language] 📨 RECEIVE ← ${this.wsUrl}`, raw);
      try {
        const parsed = JSON.parse(raw);

        // Phát hiện gói tin ready từ server
        if (parsed && typeof parsed === 'object' && parsed.type === 'ready') {
          console.log('[WS Language] Server reported ready. Sending cached language payload if any.');
          this.isServerReady = true;
          if (this.lastPayload) {
            this.sendPayload(this.lastPayload);
          }
        }

        for (const cb of this.messageListeners) {
          try {
            cb(parsed);
          } catch {
            // ignore
          }
        }
      } catch (e) {
        // Nếu không phải JSON, gửi dữ liệu thô
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
      console.error(`[WS Language] ❌ ERROR on ${this.wsUrl}`, err);
    };

    this.ws.onclose = () => {
      console.log(`[WS Language] 🔌 CLOSE ← ${this.wsUrl}`);
      this.lastSentPayloadStr = null;
      this.isServerReady = false;
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

  private updateStatus(newStatus: TranslationLanguageConnectionStatus) {
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

let languageManager: TranslationLanguageWebSocketManager | null = null;

/** Bắt đầu duy trì kết nối WebSocket tới cổng setlanguage */
export function startTranslationLanguageConnection(wsUrl: string = DEFAULT_SET_LANGUAGE_WS_URL) {
  if (typeof window === 'undefined') return;
  if (!languageManager) {
    languageManager = new TranslationLanguageWebSocketManager(wsUrl);
  } else {
    languageManager.updateUrl(wsUrl);
  }
  languageManager.start();
}

/** Đóng hoàn toàn kết nối WebSocket setlanguage */
export function stopTranslationLanguageConnection() {
  if (!languageManager) return;
  languageManager.stop();
}

/** Lấy trạng thái kết nối hiện tại */
export function getTranslationLanguageConnectionStatus(): TranslationLanguageConnectionStatus {
  if (!languageManager) return 'disconnected';
  return languageManager.getStatus();
}

/** Cập nhật cấu hình ngôn ngữ dịch thuật */
export function setTranslationLanguage(sourceLanguage: string, destinationLanguages: string[]) {
  if (typeof window === 'undefined') return;
  
  // Tự động start kết nối nếu chưa khởi tạo
  if (!languageManager) {
    startTranslationLanguageConnection();
  }

  if (languageManager) {
    languageManager.setLanguage(sourceLanguage, destinationLanguages);
  }
}

/** Đăng ký lắng nghe thay đổi trạng thái kết nối */
export function addTranslationLanguageStatusListener(listener: (status: TranslationLanguageConnectionStatus) => void) {
  if (!languageManager) startTranslationLanguageConnection();
  languageManager?.addStatusListener(listener);
}

/** Hủy đăng ký lắng nghe thay đổi trạng thái kết nối */
export function removeTranslationLanguageStatusListener(listener: (status: TranslationLanguageConnectionStatus) => void) {
  languageManager?.removeStatusListener(listener);
}

/** Đăng ký lắng nghe phản hồi tin nhắn từ server */
export function addTranslationLanguageMessageListener(listener: (data: any) => void) {
  if (!languageManager) startTranslationLanguageConnection();
  languageManager?.addMessageListener(listener);
}

/** Hủy đăng ký lắng nghe phản hồi tin nhắn từ server */
export function removeTranslationLanguageMessageListener(listener: (data: any) => void) {
  languageManager?.removeMessageListener(listener);
}
