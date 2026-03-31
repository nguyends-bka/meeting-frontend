'use client';

import { useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { useTranscriptRoom } from '@/components/TranscriptRoomProvider';
import { useAuth } from '@/lib/auth';

function toDomId(senderIdentity: string, at: number, clientMessageId?: string | null): string {
  if (clientMessageId && clientMessageId.trim()) {
    return `history-${clientMessageId.trim()}`;
  }
  const base = `${senderIdentity}|${at}`;
  return `history-${btoa(unescape(encodeURIComponent(base))).replace(/=+$/g, '')}`;
}

function formatFullTime(ts: number): string {
  return new Date(ts).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function normalizeTimestampText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/\d{2}\/\d{2}\/\d{4}/.test(trimmed)) return trimmed;
  const now = new Date();
  const datePart = now.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return `${trimmed} ${datePart}`;
}

function getNowFullTime(): string {
  return formatFullTime(Date.now());
}

export default function MeetingChatHistoryHydrator() {
  const room = useRoomContext();
  const { chatHistory } = useTranscriptRoom();
  const { user } = useAuth();

  useEffect(() => {
    const localIdentity = room.localParticipant.identity;
    const preferredLocalName =
      user?.fullName?.trim() ||
      room.localParticipant.name?.trim() ||
      user?.username?.trim() ||
      localIdentity;

    const sync = () => {
      const lists = document.querySelectorAll('.lk-chat .lk-chat-messages');
      if (!lists.length) return;

      lists.forEach((list) => {
        for (let i = chatHistory.length - 1; i >= 0; i -= 1) {
          const item = chatHistory[i];
          const domId = toDomId(item.senderIdentity, item.at, item.clientMessageId);
          if (list.querySelector(`[data-room-log-id="${domId}"]`)) continue;

          const li = document.createElement('li');
          li.className = 'lk-chat-entry';
          li.setAttribute('data-room-log-id', domId);
          li.setAttribute(
            'data-lk-message-origin',
            item.senderIdentity === localIdentity ? 'local' : 'remote',
          );
          li.title = new Date(item.at).toLocaleTimeString([], { timeStyle: 'full' as const });

          const meta = document.createElement('span');
          meta.className = 'lk-meta-data';

          const name = document.createElement('strong');
          name.className = 'lk-participant-name';
          name.textContent = item.senderName || item.senderIdentity;

          const time = document.createElement('span');
          time.className = 'lk-timestamp';
          time.textContent = formatFullTime(item.at);

          const body = document.createElement('span');
          body.className = 'lk-message-body';
          body.textContent = item.message;

          meta.appendChild(name);
          meta.appendChild(time);
          li.appendChild(meta);
          li.appendChild(body);

          list.prepend(li);
        }

        const rows = list.querySelectorAll('.lk-chat-entry');
        rows.forEach((row) => {
          const rowEl = row as HTMLElement;
          const origin = rowEl.getAttribute('data-lk-message-origin');
          const metaEl = row.querySelector('.lk-meta-data') as HTMLElement | null;
          const bodyEl = row.querySelector('.lk-message-body') as HTMLElement | null;

          // LiveKit có thể group liên tiếp và bỏ metadata ở vài dòng.
          // Ép mọi dòng có đủ metadata để giao diện đồng bộ.
          let ensuredMetaEl = metaEl;
          if (!ensuredMetaEl && bodyEl) {
            ensuredMetaEl = document.createElement('span');
            ensuredMetaEl.className = 'lk-meta-data';

            const ensuredName = document.createElement('strong');
            ensuredName.className = 'lk-participant-name';
            ensuredName.textContent =
              origin === 'local' ? preferredLocalName : (rowEl.getAttribute('data-lk-participant-name') || '');

            const ensuredTime = document.createElement('span');
            ensuredTime.className = 'lk-timestamp';
            ensuredTime.textContent = getNowFullTime();

            ensuredMetaEl.appendChild(ensuredName);
            ensuredMetaEl.appendChild(ensuredTime);
            row.insertBefore(ensuredMetaEl, bodyEl);
          }

          if (origin === 'local' && ensuredMetaEl) {
            const localNameEl = ensuredMetaEl.querySelector('.lk-participant-name') as HTMLElement | null;
            if (localNameEl && preferredLocalName && localNameEl.textContent !== preferredLocalName) {
              localNameEl.textContent = preferredLocalName;
            }
          }

          const timeEl = (ensuredMetaEl ?? row).querySelector('.lk-timestamp') as HTMLElement | null;
          if (!timeEl) return;
          const current = timeEl.textContent?.trim() ?? '';
          if (!current) {
            timeEl.textContent = getNowFullTime();
            return;
          }
          if (/\d{2}\/\d{2}\/\d{4}/.test(current)) return;

          const rowTitle = (row as HTMLElement).getAttribute('title')?.trim() ?? '';
          const parsed = rowTitle ? new Date(rowTitle) : null;
          if (parsed && !Number.isNaN(parsed.getTime())) {
            timeEl.textContent = formatFullTime(parsed.getTime());
            return;
          }
          timeEl.textContent = normalizeTimestampText(current);
        });
      });
    };

    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(sync, 1500);

    return () => {
      obs.disconnect();
      window.clearInterval(timer);
    };
  }, [
    chatHistory,
    room.localParticipant.identity,
    room.localParticipant.name,
    user?.fullName,
    user?.username,
  ]);

  return null;
}
