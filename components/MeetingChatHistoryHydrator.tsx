'use client';

import { useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { useTranscriptRoom } from '@/components/TranscriptRoomProvider';

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

export default function MeetingChatHistoryHydrator() {
  const room = useRoomContext();
  const { chatHistory } = useTranscriptRoom();

  useEffect(() => {
    if (chatHistory.length === 0) return;
    const localIdentity = room.localParticipant.identity;

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
  }, [chatHistory, room.localParticipant.identity]);

  return null;
}
