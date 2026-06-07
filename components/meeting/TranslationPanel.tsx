'use client';

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslationRoom } from '@/components/meeting/TranslationRoomProvider';

function formatReceivedTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function TranslationPanel({
  title,
  currentUserName,
  onClose,
}: {
  title?: string;
  currentUserName?: string;
  onClose?: () => void;
}) {
  const { finalized, preferredLanguage } = useTranslationRoom();

  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const pinToBottomRef = useRef(true);

  // Tạo tiêu đề động hiển thị ngôn ngữ đang được lọc
  const displayTitle = useMemo(() => {
    if (title) return title;
    return `Phiên dịch (${preferredLanguage.toUpperCase()})`;
  }, [title, preferredLanguage]);

  const sortedFinalized = useMemo(
    () => [...finalized].sort((a, b) => a.receivedAt - b.receivedAt),
    [finalized]
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

  useEffect(() => {
    scrollToBottom(false);
  }, [sortedFinalized.length, scrollToBottom]);

  const showEmpty = sortedFinalized.length === 0;

  return (
    <aside className="meeting-transcript-panel">
      <div className="meeting-transcript-header">
        <div className="meeting-transcript-header-main">
          <span className="meeting-transcript-title">{displayTitle}</span>
        </div>
        {onClose && (
          <button
            type="button"
            className="meeting-transcript-close"
            aria-label="Đóng phiên dịch"
            onClick={onClose}
          >
            ×
          </button>
        )}
      </div>

      <div
        ref={listRef}
        className="meeting-transcript-messages"
        onScroll={onMessagesScroll}
      >
        {showEmpty ? (
          <div className="meeting-transcript-empty">Chưa nhận được bản dịch nào...</div>
        ) : (
          <>
            {sortedFinalized.map((item) => (
              <div key={item.id} className="meeting-transcript-entry">
                <div className="meeting-transcript-meta">
                  <span className="meeting-transcript-speaker">
                    {item.speaker || 'Bản dịch'}
                  </span>
                  <span className="meeting-transcript-time">{formatReceivedTime(item.receivedAt)}</span>
                </div>
                <div className="meeting-transcript-body">{item.text}</div>
              </div>
            ))}
            <div ref={bottomRef} aria-hidden="true" className="meeting-transcript-scroll-anchor" />
          </>
        )}
      </div>
    </aside>
  );
}
