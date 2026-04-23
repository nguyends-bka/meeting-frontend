'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useChat, useRoomContext } from '@livekit/components-react';
import VotePanel from '@/components/meeting/VotePanel';
import MeetingDocumentsPanel from '@/components/meeting/MeetingDocumentsPanel';
import TranscriptPanel from '@/components/meeting/TranscriptPanel';
import MeetingToolsChatboxPanel from '@/components/meeting/MeetingToolsChatboxPanel';
import { useTranscriptRoom } from '@/components/meeting/TranscriptRoomProvider';
import { useVoteRoom } from '@/components/meeting/VoteRoomProvider';
import { meetingApi } from '@/services/meeting/meetingApi';

export type MeetingToolsTab = 'vote' | 'documents' | 'chat' | 'chatbox' | 'transcript';
const STATUS_MESSAGE_REGEX = /_+STATUS_+:(JOINED|LEFT):(\d+)/i;
const MEETING_TOOLS_MIN_WIDTH = 260;
const MEETING_TOOLS_MAX_WIDTH = 840;

function findControlBar(shell: HTMLElement): HTMLElement | null {
  return shell.querySelector('.lk-control-bar') as HTMLElement | null;
}

function clickChatToggle(shell: HTMLElement) {
  const bar = findControlBar(shell);
  const chatToggle = bar?.querySelector(
    '.lk-chat-toggle:not(.meeting-transcript-toggle)',
  ) as HTMLElement | null;
  chatToggle?.click();
}

export default function MeetingUnifiedSidePanel({
  shellRef,
  visible,
  activeTab,
  setActiveTab,
  transcriptOpen,
  setTranscriptOpen,
  voteOpen,
  setVoteOpen,
  documentsOpen,
  setDocumentsOpen,
  chatOpen,
  chatUnreadCount = 0,
  canCreatePoll,
  meetingId,
  canUpload,
  currentUserName,
}: {
  shellRef: React.RefObject<HTMLElement | null>;
  visible: boolean;
  activeTab: MeetingToolsTab;
  setActiveTab: React.Dispatch<React.SetStateAction<MeetingToolsTab>>;
  transcriptOpen: boolean;
  setTranscriptOpen: React.Dispatch<React.SetStateAction<boolean>>;
  voteOpen: boolean;
  setVoteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  documentsOpen: boolean;
  setDocumentsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  chatOpen: boolean;
  chatUnreadCount?: number;
  canCreatePoll: boolean;
  meetingId: string;
  canUpload: boolean;
  currentUserName?: string;
}) {
  const { finalized, draftText } = useTranscriptRoom();
  const { polls } = useVoteRoom();
  const { chatMessages } = useChat();
  const room = useRoomContext();
  const [seenTranscriptKey, setSeenTranscriptKey] = useState<string>('');
  const [seenVoteKey, setSeenVoteKey] = useState<string>('');
  const [latestDocumentsKey, setLatestDocumentsKey] = useState<string>('');
  const [seenDocumentsKey, setSeenDocumentsKey] = useState<string>('');
  const [seenRemoteChatCount, setSeenRemoteChatCount] = useState(0);

  const latestTranscriptKey = useMemo(() => {
    const lastFinal = finalized.length > 0 ? finalized[finalized.length - 1] : null;
    const draft = (draftText ?? '').trim();
    if (draft) return `draft:${draft}`;
    if (!lastFinal) return '';
    return `final:${lastFinal.receivedAt}:${lastFinal.text}`;
  }, [finalized, draftText]);

  const latestVoteKey = useMemo(() => {
    const list = Object.values(polls);
    if (list.length === 0) return '';
    const latest = list.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
    return `${latest.id}:${latest.createdAt}:${latest.status}`;
  }, [polls]);

  useEffect(() => {
    let cancelled = false;
    const mid = meetingId?.trim();
    if (!mid) {
      setLatestDocumentsKey('');
      return;
    }

    const pull = async () => {
      const res = await meetingApi.listMeetingDocuments(mid);
      if (cancelled || res.error || !res.data || res.data.length === 0) return;
      const latestDoc = [...res.data].sort((a, b) => {
        const at = new Date(a.createdAt).getTime();
        const bt = new Date(b.createdAt).getTime();
        return bt - at;
      })[0];
      setLatestDocumentsKey(`${latestDoc.id}:${latestDoc.createdAt}`);
    };

    void pull();
    const timer = window.setInterval(() => void pull(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [meetingId]);

  useEffect(() => {
    if (activeTab === 'transcript' && latestTranscriptKey) {
      setSeenTranscriptKey(latestTranscriptKey);
    }
  }, [activeTab, latestTranscriptKey]);

  useEffect(() => {
    if (activeTab === 'vote' && latestVoteKey) {
      setSeenVoteKey(latestVoteKey);
    }
  }, [activeTab, latestVoteKey]);

  useEffect(() => {
    if (activeTab === 'documents' && latestDocumentsKey) {
      setSeenDocumentsKey(latestDocumentsKey);
    }
  }, [activeTab, latestDocumentsKey]);

  const remoteChatCount = useMemo(() => {
    const localIdentity = room.localParticipant.identity;
    return chatMessages.reduce((acc, msg) => {
      const sender = msg.from?.identity?.trim() || '';
      const text = msg.message?.trim() || '';
      if (!sender || sender === localIdentity) return acc;
      if (STATUS_MESSAGE_REGEX.test(text)) return acc;
      return acc + 1;
    }, 0);
  }, [chatMessages, room.localParticipant.identity]);

  useEffect(() => {
    if (activeTab === 'chat') {
      setSeenRemoteChatCount(remoteChatCount);
    }
  }, [activeTab, remoteChatCount]);

  const showTranscriptBadge = false;
  const showVoteBadge = Boolean(latestVoteKey && latestVoteKey !== seenVoteKey && activeTab !== 'vote');
  const showDocumentsBadge = Boolean(
    latestDocumentsKey && latestDocumentsKey !== seenDocumentsKey && activeTab !== 'documents',
  );
  const computedChatUnread = Math.max(0, remoteChatCount - seenRemoteChatCount);
  const effectiveChatUnread = Math.max(chatUnreadCount, computedChatUnread);
  const showChatBadge = effectiveChatUnread > 0;

  const chatSlotRef = useRef<HTMLDivElement | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const chatRestoreParentRef = useRef<{ parent: Node | null; next: ChildNode | null }>({
    parent: null,
    next: null,
  });

  const applyToolsWidth = useCallback(
    (nextWidth: number) => {
      const shell = shellRef.current;
      if (!shell) return;
      const maxByViewport = Math.max(
        MEETING_TOOLS_MIN_WIDTH,
        Math.min(MEETING_TOOLS_MAX_WIDTH, window.innerWidth - 80),
      );
      const clamped = Math.round(Math.max(MEETING_TOOLS_MIN_WIDTH, Math.min(nextWidth, maxByViewport)));
      shell.style.setProperty('--meeting-side-width', `${clamped}px`);
    },
    [shellRef],
  );

  const onResizeHandlePointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    const isMouse = event.pointerType === 'mouse';
    if (isMouse && event.button !== 0) return;

    const shell = shellRef.current;
    if (!shell) return;

    const sideStack = shell.querySelector('.meeting-side-stack') as HTMLElement | null;
    const startWidth = sideStack?.getBoundingClientRect().width ?? 360;
    const startX = event.clientX;

    event.preventDefault();

    setIsResizing(true);
    document.body.classList.add('meeting-resizing-tools');

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = startX - moveEvent.clientX;
      applyToolsWidth(startWidth + deltaX);
    };

    const onPointerUp = () => {
      setIsResizing(false);
      document.body.classList.remove('meeting-resizing-tools');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.dispatchEvent(new Event('resize'));
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  useEffect(() => {
    return () => {
      document.body.classList.remove('meeting-resizing-tools');
    };
  }, []);

  const mountChatInSlot = useCallback(() => {
    const shell = shellRef.current;
    const slot = chatSlotRef.current;
    if (!shell || !slot) return;
    const chat = shell.querySelector('.lk-chat') as HTMLElement | null;
    if (!chat) return;
    if (chat.parentNode === slot) return;
    chatRestoreParentRef.current = {
      parent: chat.parentNode,
      next: chat.nextSibling,
    };
    slot.appendChild(chat);
  }, [shellRef]);

  const restoreChatToConference = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const chat = shell.querySelector('.lk-chat') as HTMLElement | null;
    if (!chat) return;
    const conference = shell.querySelector('.lk-video-conference') as HTMLElement | null;
    if (!conference) return;
    if (chat.parentNode === conference) return;
    const { parent, next } = chatRestoreParentRef.current;
    if (parent && document.contains(parent as Node)) {
      if (next && next.parentNode === parent) {
        parent.insertBefore(chat, next);
      } else {
        parent.appendChild(chat);
      }
      return;
    }
    conference.appendChild(chat);
  }, [shellRef]);

  useLayoutEffect(() => {
    if (!visible) {
      restoreChatToConference();
      return;
    }
    mountChatInSlot();
  }, [visible, activeTab, mountChatInSlot, restoreChatToConference]);

  useEffect(() => {
    if (!visible) return;
    const shell = shellRef.current;
    if (!shell) return;
    mountChatInSlot();
    const obs = new MutationObserver(() => {
      mountChatInSlot();
    });
    obs.observe(shell, { childList: true, subtree: true });
    const poll = window.setInterval(() => mountChatInSlot(), 400);
    return () => {
      obs.disconnect();
      window.clearInterval(poll);
    };
  }, [visible, shellRef, mountChatInSlot]);

  useEffect(() => {
    if (!visible || activeTab !== 'chat') return;
    const shell = shellRef.current;
    if (!shell) return;
    let didInitialScroll = false;

    const scrollChatToBottom = () => {
      const list = shell.querySelector('.lk-chat .lk-chat-messages') as HTMLElement | null;
      if (!list) return;
      list.scrollTop = list.scrollHeight;
    };

    const ensureChatVisible = () => {
      const chat = shell.querySelector('.lk-chat') as HTMLElement | null;
      const isVisible = !!chat && chat.offsetParent !== null;
      if (!isVisible) {
        clickChatToggle(shell);
        return;
      }
      mountChatInSlot();
      if (!didInitialScroll) {
        scrollChatToBottom();
        didInitialScroll = true;
      }
    };

    ensureChatVisible();
    const raf = window.requestAnimationFrame(() => {
      if (!didInitialScroll) {
        scrollChatToBottom();
        didInitialScroll = true;
      }
    });
    const timer = window.setInterval(ensureChatVisible, 350);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(timer);
    };
  }, [visible, activeTab, shellRef, mountChatInSlot]);

  useEffect(() => {
    return () => {
      restoreChatToConference();
    };
  }, [restoreChatToConference]);

  const closeAll = useCallback(() => {
    const shell = shellRef.current;
    setTranscriptOpen(false);
    setVoteOpen(false);
    setDocumentsOpen(false);
    if (chatOpen && shell) {
      clickChatToggle(shell);
    }
  }, [shellRef, setTranscriptOpen, setVoteOpen, setDocumentsOpen, chatOpen]);

  const onTabVote = () => {
    setActiveTab('vote');
    setVoteOpen(true);
  };

  const onTabDocuments = () => {
    setActiveTab('documents');
    setDocumentsOpen(true);
  };

  const onTabChat = () => {
    setActiveTab('chat');
    const shell = shellRef.current;
    if (!shell) return;
    if (!chatOpen) {
      clickChatToggle(shell);
    }
  };

  const onTabChatbox = () => {
    setActiveTab('chatbox');
    if (!documentsOpen) {
      setDocumentsOpen(true);
    }
  };

  const onTabTranscript = () => {
    setActiveTab('transcript');
    if (!transcriptOpen) {
      setTranscriptOpen(true);
    }
  };

  // Luôn giữ aside trong DOM khi đóng công cụ: `.lk-chat` được append vào slot bên trong;
  // nếu return null thì React gỡ cả subtree trước khi useLayoutEffect chạy restore → mất node chat.
  // Ẩn bằng CSS: `.meeting-unified-side-panel { display: none }` khi shell không `data-meeting-layout='tools-only'`.
  return (
    <aside
      className={`meeting-unified-side-panel${isResizing ? ' is-resizing' : ''}`}
      aria-label="Biểu quyết, tài liệu và tin nhắn"
      aria-hidden={!visible}
    >
      <div
        className="meeting-unified-resize-handle"
        onPointerDown={onResizeHandlePointerDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Thay đổi kích thước bảng công cụ"
      />
      <div className="meeting-unified-tabs">
        <div className="meeting-unified-tabs-inner" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'chat'}
            className={`meeting-unified-tab${activeTab === 'chat' ? ' is-active' : ''}`}
            onClick={onTabChat}
          >
            Chat
            {showChatBadge ? (
              <span className="meeting-unified-tab-badge" aria-label={`${effectiveChatUnread} unread messages`}>
                {effectiveChatUnread > 99 ? '99+' : effectiveChatUnread}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'chatbox'}
            className={`meeting-unified-tab${activeTab === 'chatbox' ? ' is-active' : ''}`}
            onClick={onTabChatbox}
          >
            Chatbot
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'documents'}
            className={`meeting-unified-tab${activeTab === 'documents' ? ' is-active' : ''}`}
            onClick={onTabDocuments}
          >
            Tài liệu
            {showDocumentsBadge ? <span className="meeting-unified-tab-dot" aria-hidden="true" /> : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'transcript'}
            className={`meeting-unified-tab${activeTab === 'transcript' ? ' is-active' : ''}`}
            onClick={onTabTranscript}
          >
            Transcript
            {showTranscriptBadge ? <span className="meeting-unified-tab-dot" aria-hidden="true" /> : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'vote'}
            className={`meeting-unified-tab${activeTab === 'vote' ? ' is-active' : ''}`}
            onClick={onTabVote}
          >
            Biểu quyết
            {showVoteBadge ? <span className="meeting-unified-tab-dot" aria-hidden="true" /> : null}
          </button>
        </div>
        <button
          type="button"
          className="meeting-unified-close"
          aria-label="Đóng bảng công cụ"
          onClick={closeAll}
        >
          ×
        </button>
      </div>

      <div className="meeting-unified-panels">
        <div
          className="meeting-unified-panel"
          role="tabpanel"
          hidden={activeTab !== 'vote'}
        >
          <VotePanel
            canCreatePoll={canCreatePoll}
            embedded
            onClose={closeAll}
          />
        </div>
        <div
          className="meeting-unified-panel"
          role="tabpanel"
          hidden={activeTab !== 'documents'}
        >
          <MeetingDocumentsPanel
            documentsOpen={documentsOpen}
            meetingId={meetingId}
            canUpload={canUpload}
            embedded
            onClose={closeAll}
          />
        </div>
        <div
          className="meeting-unified-panel meeting-unified-panel--chat"
          role="tabpanel"
          hidden={activeTab !== 'chat'}
        >
          <div ref={chatSlotRef} className="meeting-unified-chat-slot" />
        </div>
        <div
          className="meeting-unified-panel"
          role="tabpanel"
          hidden={activeTab !== 'chatbox'}
        >
          <MeetingToolsChatboxPanel />
        </div>
        <div
          className="meeting-unified-panel"
          role="tabpanel"
          hidden={activeTab !== 'transcript'}
        >
          <TranscriptPanel currentUserName={currentUserName} onClose={closeAll} />
        </div>
      </div>
    </aside>
  );
}
