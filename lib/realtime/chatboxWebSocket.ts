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

export type ChatbotRealtimeHandlers = {
  onOpen?: () => void;
  onClose?: () => void;
  onMessage?: (message: ChatbotMessage) => void;
  onError?: () => void;
};

const sendLogToServer = (event: string, payload: any) => {
  if (typeof window === 'undefined') return;
  fetch('/api/ws-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, payload })
  }).catch(() => {});
};

export class ChatbotRealtimeClient {
  private readonly url: string;
  private readonly collection: string;
  private readonly handlers: ChatbotRealtimeHandlers;
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private closedManually = false;

  constructor(url: string, collection: string, handlers: ChatbotRealtimeHandlers) {
    this.url = url;
    this.collection = collection;
    this.handlers = handlers;
  }

  connect() {
    this.closedManually = false;
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
    const ragPayload = { query: text, collection: this.collection };

    console.log('[Chatbot] Sending request to https://rag.soictlab.com/query:', {
      requestId,
      payload: ragPayload,
      hasAuth: !!token
    });

    try {
      const res = await fetch('https://rag.soictlab.com/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(ragPayload),
      });

      console.log('[Chatbot] Received response from https://rag.soictlab.com/query:', {
        requestId,
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        contentType: res.headers.get('content-type')
      });

      const bodyText = await res.text();

      let outgoing: unknown;
      try {
        const json = bodyText ? JSON.parse(bodyText) : null;
        outgoing = {
          type: 'rag_response',
          request_id: requestId,
          ok: res.ok,
          status: res.status,
          data: json,
        };

        console.log('[Chatbot] Parsed response body:', {
          requestId,
          outgoing
        });
      } catch {
        outgoing = {
          type: 'rag_response',
          request_id: requestId,
          ok: res.ok,
          status: res.status,
          text: bodyText,
        };

        console.log('[Chatbot] Non-JSON response body:', {
          requestId,
          text: bodyText,
          length: bodyText.length
        });
      }

      const msg = outgoing as ChatbotMessage;
      console.log('[Chatbot] Sending WebSocket message:', {
        requestId,
        type: msg.type,
        hasData: !!msg.data,
        dataSize: JSON.stringify(outgoing).length
      });

      sendLogToServer('WS_SEND', outgoing);
      this.socket.send(JSON.stringify(outgoing));

      // Also notify local UI immediately (server may not echo).
      this.handlers.onMessage?.(outgoing as ChatbotMessage);
      return true;
    } catch (err) {
      console.error('[Chatbot] Error sending question to RAG:', {
        requestId,
        error: err,
        question: text,
        collection: this.collection
      });

      const outgoing = {
        type: 'rag_error',
        request_id: requestId,
        error: String(err),
      };
      try {
        sendLogToServer('WS_SEND', outgoing);
        this.socket.send(JSON.stringify(outgoing));
      } catch {
        // ignore
      }
      this.handlers.onMessage?.(outgoing as ChatbotMessage);
      return false;
    }
  }

  private openSocket() {
    const ws = new WebSocket(this.url);
    this.socket = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.handlers.onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data ?? '{}')) as ChatbotMessage;
        sendLogToServer('WS_RECEIVE', payload);
        this.handlers.onMessage?.(payload);
      } catch {
        this.handlers.onError?.();
      }
    };

    ws.onerror = () => {
      this.handlers.onError?.();
    };

    ws.onclose = () => {
      this.handlers.onClose?.();

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
