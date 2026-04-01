'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import VotePanel from '@/components/VotePanel';
import MeetingDocumentsPanel from '@/components/MeetingDocumentsPanel';

export type MeetingToolsTab = 'vote' | 'documents' | 'chat';

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
  voteOpen,
  setVoteOpen,
  documentsOpen,
  setDocumentsOpen,
  chatOpen,
  canCreatePoll,
  meetingId,
  canUpload,
}: {
  shellRef: React.RefObject<HTMLElement | null>;
  visible: boolean;
  activeTab: MeetingToolsTab;
  setActiveTab: React.Dispatch<React.SetStateAction<MeetingToolsTab>>;
  voteOpen: boolean;
  setVoteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  documentsOpen: boolean;
  setDocumentsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  chatOpen: boolean;
  canCreatePoll: boolean;
  meetingId: string;
  canUpload: boolean;
}) {
  const chatSlotRef = useRef<HTMLDivElement | null>(null);
  const chatRestoreParentRef = useRef<{ parent: Node | null; next: ChildNode | null }>({
    parent: null,
    next: null,
  });

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
    return () => {
      restoreChatToConference();
    };
  }, [restoreChatToConference]);

  const closeAll = useCallback(() => {
    const shell = shellRef.current;
    setVoteOpen(false);
    setDocumentsOpen(false);
    if (chatOpen && shell) {
      clickChatToggle(shell);
    }
  }, [shellRef, setVoteOpen, setDocumentsOpen, chatOpen]);

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

  if (!visible) {
    return null;
  }

  return (
    <aside className="meeting-unified-side-panel" aria-label="Biểu quyết, tài liệu và tin nhắn">
      <div className="meeting-unified-tabs">
        <div className="meeting-unified-tabs-inner" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'vote'}
            className={`meeting-unified-tab${activeTab === 'vote' ? ' is-active' : ''}`}
            onClick={onTabVote}
          >
            Biểu quyết
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'documents'}
            className={`meeting-unified-tab${activeTab === 'documents' ? ' is-active' : ''}`}
            onClick={onTabDocuments}
          >
            Tài liệu
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'chat'}
            className={`meeting-unified-tab${activeTab === 'chat' ? ' is-active' : ''}`}
            onClick={onTabChat}
          >
            Chat
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
      </div>
    </aside>
  );
}
