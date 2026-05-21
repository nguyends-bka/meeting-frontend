// ── Server-terminal logger ─────────────────────────────────────────────────
// Gửi log WS lên Next.js API route → hiện trên terminal docker logs
function wsLog(event: string, payload: unknown): void {
  if (typeof window === 'undefined') return;

  // fire-and-forget, không block
  fetch('/next-api/ws-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, payload }),
  }).catch(() => { /* ignore network errors */ });
}

export type ChatbotMessage = {
  partial?: string;
  final?: string;
  question?: string;

  // Bridge payloads (aligned with RAG wrapper patterns)
  type?: 'rag_response' | 'rag_error' | string;
  request_id?: string;
  ok?: boolean;
  status?: number;
  data?: unknown;
  text?: string;
  error?: string;
};

export type RagQueryMode = 'meeting' | 'collection' | 'both';

export type ChatbotRealtimeHandlers = {
  onOpen?: () => void;
  onClose?: () => void;
  onMessage?: (message: ChatbotMessage) => void;
  onError?: () => void;
};

export class ChatbotRealtimeClient {
  private readonly url: string;
  private readonly meetingId: string;
  private readonly mode: RagQueryMode;
  private readonly handlers: ChatbotRealtimeHandlers;
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private closedManually = false;
  private hasEverConnected = false;

  constructor(url: string, meetingId: string, mode: RagQueryMode, handlers: ChatbotRealtimeHandlers) {
    this.url = url;
    this.meetingId = meetingId;
    this.mode = mode;
    this.handlers = handlers;
  }

  connect() {
    this.closedManually = false;
    this.hasEverConnected = false;
    this.openSocket();
  }

  disconnect() {
    this.closedManually = true;
    this.clearReconnectTimer();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  async sendQuestion(question: string): Promise<boolean> {
    const text = question.trim();
    if (!text || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    const requestId = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
      ? (globalThis.crypto as Crypto).randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    type RagPayload = {
      query: string;
      collection: string;
      top_k?: number;
    };
    // let ragPayload: Record<string, string>;
    let ragPayloads: RagPayload[];
    
    switch (this.mode) {
      case 'meeting':
        ragPayloads = [
              { query: text, collection: `meeting-${this.meetingId}`, top_k: 10 }
            ];
        break;
      case 'collection':
        ragPayloads = [
          { query: text, collection: `docs-${this.meetingId}`, top_k: 10 }
        ];        
        break;
      case 'both':
        ragPayloads = [
          { query: text, collection: `meeting-${this.meetingId}`, top_k: 8 },
          { query: text, collection: `docs-${this.meetingId}`, top_k: 8 }
        ];
        break;
    }

    // Gọi qua proxy nội bộ (đã đổi sang /next-api để không bị Nginx chặn)
    const PROXY_URL = '/next-api/rag-proxy/query';

    console.log('[Chatbot] Sending request via proxy:', {
      requestId,
      proxy: PROXY_URL,
      mode: this.mode,
      payload: ragPayloads,
      hasAuth: !!token
    });

    try {
      // const res = await fetch(PROXY_URL, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     ...(token ? { Authorization: `Bearer ${token}` } : {}),
      //   },
      //   body: JSON.stringify(ragPayloads),
      // });

      // console.log('[Chatbot] Proxy response received (full log on server terminal):', {
      //   requestId,
      //   status: res.status,
      //   statusText: res.statusText,
      //   ok: res.ok,
      //   contentType: res.headers.get('content-type')
      // });

      // const bodyText = await res.text();
      const responses = await Promise.all(
        ragPayloads.map(async (ragPayload) => {
          const res = await fetch(PROXY_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(ragPayload),
          });

          const bodyText = await res.text();

          console.log('[Chatbot] Proxy response received:', {
            requestId,
            status: res.status,
            statusText: res.statusText,
            ok: res.ok,
            contentType: res.headers.get('content-type'),
            payload: ragPayload,
            bodyText,
          });

          return {
            ok: res.ok,
            status: res.status,
            statusText: res.statusText,
            payload: ragPayload,
            bodyText,
          };
        })
      );

      // const bodyText =
      //   responses.length === 1
      //     ? responses[0].bodyText
      //     : JSON.stringify(responses);
      const bodyText =
        responses.length === 1
          ? responses[0].bodyText
          : responses
              .filter((r) => r.ok)
              .map((r) => r.bodyText)
              .join(','); 


      // let outgoing: unknown;
      // try {
      //   // Chỉ dùng để kiểm tra xem có phải JSON hợp lệ không
      //   const json = bodyText ? JSON.parse(bodyText) : null;
        
      //   // Bọc toàn bộ nội dung (dưới dạng chuỗi string) vào field "question" như bạn yêu cầu
      //   outgoing = { question: bodyText };

      //   console.log('[Chatbot] Wrapped response body in question field:', { requestId, outgoing });
      // } catch {
      //   // Non-JSON: gửi dạng object có text
      //   outgoing = { text: bodyText };

      //   console.log('[Chatbot] Non-JSON response body:', {
      //     requestId,
      //     text: bodyText,
      //     length: bodyText.length
      //   });
      // }

      let outgoing: unknown = { question: bodyText };

      console.log('[Chatbot] Wrapped response body in question field:', {
        requestId,
        outgoing,
      });
      console.log('[Chatbot] Sending WebSocket message:', {
        requestId,
        dataSize: JSON.stringify(outgoing).length
      });

      const outgoingStr = JSON.stringify(outgoing);
      console.log(`[WS Chatbot] 📤 SEND → ${this.url}`, outgoing);
      wsLog('ws:send', { url: this.url, ts: new Date().toISOString(), question: outgoing });
      this.socket.send(outgoingStr);
      return true;
    } catch (err) {
      console.error('[Chatbot] Error calling RAG proxy:', {
        requestId,
        proxy: PROXY_URL,
        error: err,
        question: text,
        mode: this.mode,
        meetingId: this.meetingId
      });

      const outgoing = {
        type: 'rag_error',
        request_id: requestId,
        error: String(err),
      };
      try {
        const errStr = JSON.stringify(outgoing);
        console.log(`[WS Chatbot] 📤 SEND (error payload) → ${this.url}`, outgoing);
        wsLog('ws:send', { url: this.url, ts: new Date().toISOString(), question: outgoing });
        this.socket.send(errStr);
      } catch {
        // ignore
      }
      return false;
    }
  }

  private openSocket() {
    const ws = new WebSocket(this.url);
    this.socket = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.hasEverConnected = true;
      const msg = `✅ WebSocket OPEN → ${this.url}`;
      console.log(`[WS Chatbot] ${msg}`);
      wsLog('ws:open', { url: this.url, ts: new Date().toISOString() });
      this.handlers.onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data ?? '{}')) as ChatbotMessage;
        console.log(`[WS Chatbot] 📨 RECEIVE ← ${this.url}`, payload);
        wsLog('ws:receive', { url: this.url, ts: new Date().toISOString(), data: payload });
        this.handlers.onMessage?.(payload);
      } catch {
        console.warn(`[WS Chatbot] ⚠️ Failed to parse message from ${this.url}`, event.data);
        wsLog('ws:receive:error', { url: this.url, ts: new Date().toISOString(), raw: String(event.data) });
        this.handlers.onError?.();
      }
    };

    ws.onerror = (err) => {
      if (this.hasEverConnected) {
        // Lỗi thật sự sau khi đã kết nối thành công ít nhất 1 lần
        console.error(`[WS Chatbot] ❌ ERROR on ${this.url}`, err);
        wsLog('ws:error', { url: this.url, ts: new Date().toISOString(), message: String(err) });
        this.handlers.onError?.();
      } else {
        // Lỗi kết nối lần đầu (server chưa sẵn sàng) → chỉ log nhẹ
        console.warn(`[WS Chatbot] ⏳ Waiting for server on ${this.url}, retrying...`);
        wsLog('ws:error', { url: this.url, ts: new Date().toISOString(), message: 'initial-connect-failed' });
      }
    };

    ws.onclose = (ev) => {
      if (this.hasEverConnected) {
        // Mất kết nối sau khi đã open → log đầy đủ
        console.log(`[WS Chatbot] 🔌 CLOSE ← ${this.url}`, { code: ev.code, reason: ev.reason, wasClean: ev.wasClean });
        wsLog('ws:close', { url: this.url, ts: new Date().toISOString(), code: ev.code, reason: ev.reason, wasClean: ev.wasClean });
        this.handlers.onClose?.();
      }
      // Nếu chưa từng kết nối thành công → bỏ qua close event, chờ reconnect

      if (this.closedManually) {
        return;
      }

      this.reconnectAttempts += 1;
      const delayMs = Math.min(5000, 800 * this.reconnectAttempts);
      this.clearReconnectTimer();
      this.reconnectTimer = window.setTimeout(() => {
        this.openSocket();
      }, delayMs);
    };
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// Backwards-compat exports (avoid breaking older imports).
export type ChatboxMessage = ChatbotMessage;
export type ChatboxRealtimeHandlers = ChatbotRealtimeHandlers;
export const ChatboxRealtimeClient = ChatbotRealtimeClient;
