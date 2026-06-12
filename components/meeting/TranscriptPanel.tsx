'use client';

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranscriptRoom } from '@/components/meeting/TranscriptRoomProvider';
import { useTranslationRoom } from '@/components/meeting/TranslationRoomProvider';
import { TranslationOutlined } from '@ant-design/icons';

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

  const { finalized: translationFinalized } = useTranslationRoom();

  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  /** Giống chat: chỉ auto-scroll xuống đáy nếu user đang ở gần đáy (hoặc đang có draft). */
  const pinToBottomRef = useRef(true);

  const sortedFinalized = useMemo(
    () => [...finalized].sort((a, b) => a.receivedAt - b.receivedAt),
    [finalized],
  );

  const sortedTranslations = useMemo(
    () => [...translationFinalized].sort((a, b) => a.receivedAt - b.receivedAt),
    [translationFinalized],
  );

  const matchedTranslations = useMemo(() => {
    const mapping: Record<string, typeof sortedTranslations[0]> = {};
    const usedTranslationIds = new Set<string>();

    for (const transcript of sortedFinalized) {
      let bestMatch: typeof sortedTranslations[0] | null = null;
      let minDiff = Infinity;

      for (const trans of sortedTranslations) {
        if (usedTranslationIds.has(trans.id)) continue;

        // Check speaker match if speakers exist
        if (transcript.speaker && trans.speaker) {
          const ts = trans.speaker.toLowerCase();
          const tis = transcript.speaker.toLowerCase();
          if (ts !== tis && ts !== 'bản dịch' && tis !== 'bản dịch') {
            continue;
          }
        }

        const diff = trans.receivedAt - transcript.receivedAt;
        if (diff >= -5000 && diff <= 20000) {
          const absDiff = Math.abs(diff);
          if (absDiff < minDiff) {
            minDiff = absDiff;
            bestMatch = trans;
          }
        }
      }

      if (bestMatch) {
        mapping[transcript.id] = bestMatch;
        usedTranslationIds.add(bestMatch.id);
      }
    }
    return mapping;
  }, [sortedFinalized, sortedTranslations]);

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

  const hasContent = sortedFinalized.length > 0 || (draftText != null && draftText !== '');
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

      <div
        ref={listRef}
        className="meeting-transcript-messages"
        onScroll={onMessagesScroll}
      >
        {showEmpty ? (
          <div className="meeting-transcript-empty">Chưa có transcript...</div>
        ) : (
          <>
            {sortedFinalized.map((item) => {
              const transItem = matchedTranslations[item.id];
              return (
                <div key={item.id} className="meeting-transcript-entry">
                  <div className="meeting-transcript-meta">
                    <span className="meeting-transcript-speaker">
                      {item.speaker || currentUserName || 'Current user'}
                    </span>
                    <span className="meeting-transcript-time">{formatReceivedTime(item.receivedAt)}</span>
                  </div>
                  <div className="meeting-transcript-body">{item.text}</div>
                  {transItem && transItem.text && (
                    <>
                      <div className="meeting-transcript-divider" />
                      <div className="meeting-transcript-translation">
                        <TranslationOutlined className="meeting-transcript-trans-icon" />
                        <span className="meeting-transcript-trans-text">{transItem.text}</span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
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
            <div ref={bottomRef} aria-hidden="true" className="meeting-transcript-scroll-anchor" />
          </>
        )}
      </div>
    </aside>
  );
}
