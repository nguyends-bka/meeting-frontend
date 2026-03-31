'use client';

import { useRef, useEffect } from 'react';
import { useTranscriptRoom } from '@/components/TranscriptRoomProvider';

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

export default function TranscriptPanel({
  title = 'Transcript',
  currentUserName,
  onClose,
}: {
  title?: string;
  currentUserName?: string;
  onClose?: () => void;
}) {
  const {
    finalized,
    draftText,
    draftSpeaker,
  } = useTranscriptRoom();

  const listRef = useRef<HTMLDivElement | null>(null);

  const scrollDeps = finalized.length + (draftText ?? '').length;
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [scrollDeps, draftText]);

  const hasContent = finalized.length > 0 || (draftText != null && draftText !== '');
  const showEmpty = !hasContent;

  return (
    <aside className="meeting-transcript-panel">
      <div className="meeting-transcript-header">
        <div className="meeting-transcript-header-main">
          <span className="meeting-transcript-title">{title}</span>
        </div>
        {onClose && (
          <button
            type="button"
            className="meeting-transcript-close"
            aria-label="Đóng transcript"
            onClick={onClose}
          >
            ×
          </button>
        )}
      </div>

      <div ref={listRef} className="meeting-transcript-messages">
        {showEmpty ? (
          <div className="meeting-transcript-empty">Chưa có transcript...</div>
        ) : (
          <>
            {finalized.map((item) => (
              <div key={item.id} className="meeting-transcript-entry">
                <div className="meeting-transcript-meta">
                  <span className="meeting-transcript-speaker">
                    {item.speaker || currentUserName || 'Current user'}
                  </span>
                  <span className="meeting-transcript-time">{formatReceivedTime(item.receivedAt)}</span>
                </div>
                <div className="meeting-transcript-body">{item.text}</div>
              </div>
            ))}
            {draftText != null && draftText !== '' && (
              <div className="meeting-transcript-entry meeting-transcript-entry--draft">
                <div className="meeting-transcript-meta">
                  <span className="meeting-transcript-speaker">
                    {draftSpeaker || currentUserName || 'Current user'}
                  </span>
                  <span className="meeting-transcript-draft-label">Đang nhận…</span>
                </div>
                <div className="meeting-transcript-body">{draftText}</div>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
