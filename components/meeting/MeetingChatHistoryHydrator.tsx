'use client';

import { useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { useTranscriptRoom } from '@/components/meeting/TranscriptRoomProvider';
import { useAuth } from '@/lib/auth';

const STATUS_MESSAGE_REGEX = /_+STATUS_+:(JOINED|LEFT):(\d+)/i;

function isNearBottom(el: HTMLElement, threshold = 80): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

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

function isStatusSystemMessage(raw: string): boolean {
  const text = raw.trim();
  return STATUS_MESSAGE_REGEX.test(text);
}

export default function MeetingChatHistoryHydrator() {
  const room = useRoomContext();
  const { chatHistory } = useTranscriptRoom();
  const { user } = useAuth();

  useEffect(() => {
    const pinState = new WeakMap<HTMLElement, boolean>();

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
        const listEl = list as HTMLElement;
        const isFirstBind = !listEl.dataset.bkmtChatScrollBound;
        if (!listEl.dataset.bkmtChatScrollBound) {
          const onScroll = () => {
            pinState.set(listEl, isNearBottom(listEl));
          };
          listEl.addEventListener('scroll', onScroll);
          listEl.dataset.bkmtChatScrollBound = '1';
          pinState.set(listEl, true);
        }

        const shouldPinToBottom = pinState.get(listEl) ?? isNearBottom(listEl);
        const prevScrollTop = listEl.scrollTop;
        const prevScrollHeight = listEl.scrollHeight;
        let insertedCount = 0;

        for (let i = chatHistory.length - 1; i >= 0; i -= 1) {
          const item = chatHistory[i];
          if (isStatusSystemMessage(item.message)) {
            continue;
          }

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
          insertedCount += 1;
        }

        const rows = list.querySelectorAll('.lk-chat-entry');
        rows.forEach((row) => {
          const rowEl = row as HTMLElement;
          const origin = rowEl.getAttribute('data-lk-message-origin');
          const metaEl = row.querySelector('.lk-meta-data') as HTMLElement | null;
          const bodyEl = row.querySelector('.lk-message-body') as HTMLElement | null;

          const rowText = rowEl.textContent?.trim() ?? '';
          if (STATUS_MESSAGE_REGEX.test(rowText)) {
            rowEl.remove();
            return;
          }

          if (bodyEl) {
            if (isStatusSystemMessage(bodyEl.textContent ?? '')) {
              rowEl.remove();
              return;
            }
          }

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

        // Giống transcript/chat chuẩn: nếu user đang ở gần đáy thì giữ auto-scroll xuống tin mới.
        // Nếu user đã kéo lên để xem cũ thì không ép kéo xuống.
        if ((insertedCount > 0 && shouldPinToBottom) || (isFirstBind && shouldPinToBottom)) {
          requestAnimationFrame(() => {
            listEl.scrollTop = listEl.scrollHeight;
          });
        } else if (insertedCount > 0 && !shouldPinToBottom) {
          // Giữ nguyên "điểm nhìn" khi user đang đọc lịch sử cũ, tránh bị nhảy/đẩy.
          const delta = listEl.scrollHeight - prevScrollHeight;
          listEl.scrollTop = prevScrollTop + Math.max(0, delta);
        }
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
