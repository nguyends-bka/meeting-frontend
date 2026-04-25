const DEFAULT_QUERY_WS_URL =
  process.env.NEXT_PUBLIC_WS_QUERY_URL ?? `${process.env.NEXT_PUBLIC_WS_BASE_URL ?? 'ws://127.0.0.1:9001'}/query`;

const QUERY_LOG_PREFIX = '[QueryWS]';

class QueryWebSocketManager {
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private meetingId: string;

  constructor(meetingId: string, wsUrl: string) {
    this.meetingId = meetingId;
    this.wsUrl = wsUrl;
  }

  start() {
    console.info(QUERY_LOG_PREFIX, 'start', {
      meetingId: this.meetingId,
      wsUrl: this.wsUrl,
    });
    if (this.reconnectTimer != null) return;
    this.connect();
  }

  stop() {
    console.info(QUERY_LOG_PREFIX, 'stop');
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
  }

  private connect() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.info(QUERY_LOG_PREFIX, 'skip connect: websocket already active', {
        readyState: this.ws.readyState,
        wsUrl: this.wsUrl,
      });
      return;
    }

    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    console.info(QUERY_LOG_PREFIX, 'connecting', { wsUrl: this.wsUrl });
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.info(QUERY_LOG_PREFIX, 'websocket open', { wsUrl: this.wsUrl });
    };

    this.ws.onmessage = async (event) => {
      const raw = typeof event.data === 'string' ? event.data : '';
      console.info(QUERY_LOG_PREFIX, 'websocket receive raw', raw);
      let parsed: any = null;
      try {
        parsed = JSON.parse(raw);
        console.info(QUERY_LOG_PREFIX, 'websocket receive parsed', parsed);
      } catch {
        console.warn(QUERY_LOG_PREFIX, 'websocket receive non-json payload', raw);
      }

      const query = parsed && typeof parsed.query === 'string' ? parsed.query : null;
      const requestId =
        parsed && typeof parsed.request_id === 'string'
          ? parsed.request_id
          : parsed && typeof parsed.id === 'string'
            ? parsed.id
            : '';
      if (!query) {
        console.warn(QUERY_LOG_PREFIX, 'ignore websocket message without query', parsed ?? raw);
        return;
      }

      // Prepare request to RAG service
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const ragPayload = { query, collection: this.meetingId };
        console.info(QUERY_LOG_PREFIX, 'rag request', {
          url: 'https://rag.soictlab.com/query',
          hasToken: Boolean(token),
          body: ragPayload,
        });

        const res = await fetch('https://rag.soictlab.com/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(ragPayload),
        });

        const text = await res.text();
        console.info(QUERY_LOG_PREFIX, 'rag response', {
          ok: res.ok,
          status: res.status,
          statusText: res.statusText,
          bodyText: text,
        });
        try {
          const json = text ? JSON.parse(text) : null;
          const responsePayload = requestId
            ? {
                type: 'rag_response',
                request_id: requestId,
                ok: res.ok,
                status: res.status,
                data: json,
              }
            : json;
          // Send JSON response back to WS client
          const outgoing = JSON.stringify(responsePayload);
          console.info(QUERY_LOG_PREFIX, 'websocket send rag json', responsePayload);
          this.ws?.send(outgoing);
        } catch {
          // Non-JSON response - forward as text wrapper
          const responsePayload = requestId
            ? {
                type: 'rag_response',
                request_id: requestId,
                ok: res.ok,
                status: res.status,
                text,
              }
            : text;
          console.info(QUERY_LOG_PREFIX, 'websocket send rag text', responsePayload);
          this.ws?.send(typeof responsePayload === 'string' ? responsePayload : JSON.stringify(responsePayload));
        }
      } catch (err) {
        console.error(QUERY_LOG_PREFIX, 'rag request failed', err);
        try {
          const outgoing = { type: 'rag_error', request_id: requestId, error: String(err) };
          console.info(QUERY_LOG_PREFIX, 'websocket send error', outgoing);
          this.ws?.send(JSON.stringify(outgoing));
        } catch {
          // ignore
        }
      }
    };

    this.ws.onerror = (event) => {
      console.error(QUERY_LOG_PREFIX, 'websocket error', event);
    };

    this.ws.onclose = (event) => {
      console.warn(QUERY_LOG_PREFIX, 'websocket close', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      // schedule reconnect
      if (this.reconnectTimer != null) return;
      this.reconnectTimer = window.setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, 2000);
    };
  }
}

let queryManager: QueryWebSocketManager | null = null;

export function startQueryConnection(meetingId: string, wsUrl: string = DEFAULT_QUERY_WS_URL) {
  if (typeof window === 'undefined') return;
  if (!queryManager) queryManager = new QueryWebSocketManager(meetingId, wsUrl);
  queryManager.start();
}

export function stopQueryConnection() {
  if (!queryManager) return;
  queryManager.stop();
  queryManager = null;
}

export function getQueryConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
  // lightweight: we don't expose internal status; caller can attempt a lightweight check if needed
  return queryManager ? 'connected' : 'disconnected';
}
