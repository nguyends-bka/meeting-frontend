'use client';

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatboxRealtimeClient } from '@/lib/realtime/chatboxWebSocket';

type ChatFinalItem = {
  id: string;
  role: 'self' | 'chatbox';
  text: string;
  receivedAt: number;
};

const CHATBOX_WS_URL =
  process.env.NEXT_PUBLIC_WS_CHATBOT_URL ??
  `${process.env.NEXT_PUBLIC_WS_BASE_URL ?? 'ws://127.0.0.1:9001'}/chatbot`;

function formatChatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('vi-VN', { hour12: false });
}

const markdownComponents = {
  p: ({ children }: { children?: ReactNode }) => <p style={{ margin: '0 0 8px' }}>{children}</p>,
  ul: ({ children }: { children?: ReactNode }) => <ul style={{ margin: '0 0 8px 18px' }}>{children}</ul>,
  ol: ({ children }: { children?: ReactNode }) => <ol style={{ margin: '0 0 8px 18px' }}>{children}</ol>,
  li: ({ children }: { children?: ReactNode }) => <li style={{ marginBottom: 4 }}>{children}</li>,
  table: ({ children }: { children?: ReactNode }) => (
    <div style={{ overflowX: 'auto', marginBottom: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: ReactNode }) => (
    <thead style={{ background: '#e2e8f0' }}>{children}</thead>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'left', verticalAlign: 'top' }}>
      {children}
    </th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', verticalAlign: 'top' }}>{children}</td>
  ),
  code: ({ children }: { children?: ReactNode }) => (
    <code
      style={{
        background: 'rgba(148, 163, 184, 0.18)',
        padding: '1px 4px',
        borderRadius: 4,
        fontSize: 12,
      }}
    >
      {children}
    </code>
  ),
  pre: ({ children }: { children?: ReactNode }) => (
    <pre
      style={{
        margin: '0 0 8px',
        background: '#e2e8f0',
        borderRadius: 8,
        padding: 10,
        overflowX: 'auto',
      }}
    >
      {children}
    </pre>
  ),
};

export default function MeetingToolsChatboxPanel() {
  const clientRef = useRef<ChatboxRealtimeClient | null>(null);
  const [finalized, setFinalized] = useState<ChatFinalItem[]>([]);
  const [draftText, setDraftText] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [connected, setConnected] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const pinToBottomRef = useRef(true);

  const canSend = connected && question.trim().length > 0;

  const sortedFinalized = useMemo(
    () => [...finalized].sort((a, b) => a.receivedAt - b.receivedAt),
    [finalized],
  );

  const scrollToBottom = useCallback((force: boolean) => {
    const el = listRef.current;
    const bottom = bottomRef.current;
    if (!el) return;
    if (force) {
      el.scrollTop = el.scrollHeight;
      bottom?.scrollIntoView({ block: 'end', behavior: 'auto' });
      return;
    }
    if (!pinToBottomRef.current) return;
    window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
      bottom?.scrollIntoView({ block: 'end', behavior: 'auto' });
    });
  }, []);

  const onMessagesScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const threshold = 80;
    pinToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (pinToBottomRef.current) scrollToBottom(true);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollToBottom]);

  const scrollDeps = sortedFinalized.length + (draftText ?? '').length;
  useEffect(() => {
    const isDraft = draftText != null && draftText !== '';
    scrollToBottom(isDraft);
  }, [scrollDeps, draftText, scrollToBottom]);

  useEffect(() => {
    const client = new ChatboxRealtimeClient(CHATBOX_WS_URL, {
      onOpen: () => {
        setConnected(true);
      },
      onClose: () => {
        setConnected(false);
      },
      onMessage: (payload) => {
        const partial = (payload.partial ?? '').trim();
        const finalText = (payload.final ?? '').trim();
        const incomingQuestion = (payload.question ?? '').trim();

        if (incomingQuestion) {
          setFinalized((prev) => [
            ...prev,
            {
              id: `${Date.now()}-incoming-question`,
              role: 'chatbox',
              text: incomingQuestion,
              receivedAt: Date.now(),
            },
          ]);
          return;
        }

        if (partial) {
          setDraftText(partial);
          return;
        }

        if (finalText) {
          setFinalized((prev) => [
            ...prev,
            {
              id: `${Date.now()}-final`,
              role: 'chatbox',
              text: finalText,
              receivedAt: Date.now(),
            },
          ]);
          setDraftText(null);
        }
      },
      onError: () => {
      },
    });

    clientRef.current = client;
    client.connect();

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
      setConnected(false);
    };
  }, []);

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    const text = question.trim();
    if (!text) return;

    const client = clientRef.current;
    if (!client || !client.sendQuestion(text)) {
      return;
    }

    setFinalized((prev) => [
      ...prev,
      {
        id: `${Date.now()}-question`,
        role: 'self',
        text,
        receivedAt: Date.now(),
      },
    ]);
    setQuestion('');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        ref={listRef}
        onScroll={onMessagesScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: 10,
          background: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {sortedFinalized.length > 0 || (draftText ?? '').length > 0 ? (
          <>
            {sortedFinalized.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: item.role === 'self' ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{ maxWidth: '86%' }}>
                  <div
                    style={{
                      borderRadius: 10,
                      padding: '8px 10px',
                      color: item.role === 'self' ? '#ffffff' : '#0f172a',
                      background: item.role === 'self' ? '#1d4ed8' : '#ffffff',
                      border: item.role === 'self' ? 'none' : '1px solid #e2e8f0',
                      fontSize: 13,
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {item.role === 'chatbox' ? (
                      <div
                        style={{
                          fontSize: 11,
                          color: '#64748b',
                          marginBottom: 6,
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span style={{ color: '#334155' }}>Chatbot</span>
                        <span>{formatChatTime(item.receivedAt)}</span>
                      </div>
                    ) : null}
                    {item.role === 'chatbox' ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                      >
                        {item.text}
                      </ReactMarkdown>
                    ) : (
                      item.text
                    )}
                  </div>
                </div>
              </div>
            ))}
            {draftText != null && draftText !== '' ? (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ maxWidth: '86%' }}>
                  <div
                    style={{
                      borderRadius: 10,
                      padding: '8px 10px',
                      color: '#334155',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      fontSize: 13,
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      opacity: 0.92,
                      boxShadow: 'inset 0 0 0 1px rgba(14, 116, 144, 0.18)',
                      backgroundImage:
                        'linear-gradient(120deg, rgba(224, 242, 254, 0.88) 0%, rgba(255, 255, 255, 0.96) 55%, rgba(236, 253, 245, 0.9) 100%)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: '#64748b',
                        marginBottom: 6,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span style={{ color: '#334155' }}>Chatbot</span>
                      <span className="meeting-chatbox-thinking-pill">
                        Đang trả lời
                        <span className="meeting-chatbox-dot-wave" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </span>
                      </span>
                    </div>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {draftText}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ) : null}
            <div ref={bottomRef} aria-hidden="true" className="meeting-transcript-scroll-anchor" />
          </>
        ) : null}
      </div>

      <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Nhập câu hỏi hoặc mô tả lỗi cần sửa..."
          style={{
            flex: 1,
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#0f172a',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={!canSend}
          style={{
            border: 'none',
            borderRadius: 8,
            background: canSend ? '#2563eb' : '#94a3b8',
            color: '#fff',
            padding: '8px 12px',
            cursor: canSend ? 'pointer' : 'not-allowed',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Gửi
        </button>
      </form>

      <style jsx>{`
        .meeting-chatbox-thinking-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid rgba(20, 184, 166, 0.35);
          background: rgba(240, 253, 250, 0.9);
          color: #0f766e;
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        .meeting-chatbox-dot-wave {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          min-width: 20px;
        }

        .meeting-chatbox-dot-wave > span {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #0f766e;
          opacity: 0.5;
          animation: meeting-chatbox-dot-wave 1s infinite ease-in-out;
        }

        .meeting-chatbox-dot-wave > span:nth-child(2) {
          animation-delay: 0.15s;
        }

        .meeting-chatbox-dot-wave > span:nth-child(3) {
          animation-delay: 0.3s;
        }

        @keyframes meeting-chatbox-dot-wave {
          0%,
          80%,
          100% {
            transform: translateY(0);
            opacity: 0.35;
          }

          40% {
            transform: translateY(-2px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
