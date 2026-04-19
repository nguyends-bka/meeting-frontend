export type ChatboxMessage = {
  partial?: string;
  final?: string;
  question?: string;
};

export type ChatboxRealtimeHandlers = {
  onOpen?: () => void;
  onClose?: () => void;
  onMessage?: (message: ChatboxMessage) => void;
  onError?: () => void;
};

export class ChatboxRealtimeClient {
  private readonly url: string;
  private readonly handlers: ChatboxRealtimeHandlers;
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private closedManually = false;

  constructor(url: string, handlers: ChatboxRealtimeHandlers) {
    this.url = url;
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

  sendQuestion(question: string): boolean {
    const text = question.trim();
    if (!text || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    this.socket.send(JSON.stringify({ question: text }));
    return true;
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
        const payload = JSON.parse(String(event.data ?? '{}')) as ChatboxMessage;
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
