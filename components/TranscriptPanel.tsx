'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type TranscriptItem = {
  id: string;
  text: string;
};

function normalizeTranscriptMessage(raw: string): TranscriptItem | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  return {
    id: crypto.randomUUID(),
    text: trimmed,
  };
}

export default function TranscriptPanel({
  wsUrl,
  title = 'Transcript',
  currentUserName,
}: {
  wsUrl: string;
  title?: string;
  currentUserName?: string;
}) {
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>(
    'connecting',
  );

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let isUnmounted = false;

    try {
      setStatus('connecting');
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        if (isUnmounted) return;
        setStatus('connected');
      };

      socket.onmessage = async (event) => {
        if (isUnmounted) return;

        let raw = '';

        if (typeof event.data === 'string') {
          raw = event.data;
        } else if (event.data instanceof Blob) {
          raw = await event.data.text();
        } else {
          raw = String(event.data);
        }

        const nextItem = normalizeTranscriptMessage(raw);
        if (!nextItem) return;

        setItems((prev) => [...prev, nextItem]);
      };

      socket.onerror = () => {
        if (isUnmounted) return;
        setStatus('error');
      };

      socket.onclose = () => {
        if (isUnmounted) return;
        setStatus('disconnected');
      };
    } catch (error) {
      console.error('Transcript websocket failed:', error);
      setStatus('error');
    }

    return () => {
      isUnmounted = true;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [wsUrl]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Error';
      default:
        return '';
    }
  }, [status]);

  return (
    <aside className="meeting-transcript-panel">
      <div className="meeting-transcript-header">
        <span>{title}</span>
        <span className={`meeting-transcript-status status-${status}`}>{statusLabel}</span>
      </div>

      <div ref={listRef} className="meeting-transcript-messages">
        {items.length === 0 ? (
          <div className="meeting-transcript-empty">Chưa có transcript...</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="meeting-transcript-entry">
              <div className="meeting-transcript-meta">
                <span className="meeting-transcript-speaker">
                  {currentUserName || 'Current user'}
                </span>
              </div>
              <div className="meeting-transcript-body">{item.text}</div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}