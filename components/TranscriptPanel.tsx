'use client';

import { useMemo, useRef, useEffect } from 'react';
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
}: {
  title?: string;
  currentUserName?: string;
}) {
  const {
    finalized,
    draftText,
    transcriptServiceReady,
    isRelay,
    wsRelayStatus,
    hasRoomTranscriptData,
  } = useTranscriptRoom();

  const listRef = useRef<HTMLDivElement | null>(null);

  const scrollDeps = finalized.length + (draftText ?? '').length;
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [scrollDeps, draftText]);

  const { statusLabel, statusClass } = useMemo(() => {
    if (isRelay) {
      if (wsRelayStatus === 'connecting') {
        return { statusLabel: 'Đang kết nối nguồn…', statusClass: 'status-connecting' };
      }
      if (wsRelayStatus === 'error') {
        return { statusLabel: 'Lỗi nguồn transcript', statusClass: 'status-error' };
      }
      if (wsRelayStatus === 'closed') {
        return { statusLabel: 'Mất nguồn (thử lại sau)', statusClass: 'status-disconnected' };
      }
    } else if (!hasRoomTranscriptData) {
      return { statusLabel: 'Đang đồng bộ với phòng…', statusClass: 'status-waiting' };
    }

    if (transcriptServiceReady) {
      return { statusLabel: 'Transcript đã kết nối', statusClass: 'status-transcript-ready' };
    }
    if (hasRoomTranscriptData || (isRelay && wsRelayStatus === 'open')) {
      return { statusLabel: 'Đang chờ transcript…', statusClass: 'status-waiting' };
    }
    return { statusLabel: 'Đang kết nối…', statusClass: 'status-connecting' };
  }, [
    isRelay,
    wsRelayStatus,
    hasRoomTranscriptData,
    transcriptServiceReady,
  ]);

  const hasContent = finalized.length > 0 || (draftText != null && draftText !== '');
  const showEmpty = !hasContent;

  return (
    <aside className="meeting-transcript-panel">
      <div className="meeting-transcript-header">
        <span>{title}</span>
        <span className={`meeting-transcript-status ${statusClass}`}>{statusLabel}</span>
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
                    {currentUserName || 'Current user'}
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
                    {currentUserName || 'Current user'}
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
