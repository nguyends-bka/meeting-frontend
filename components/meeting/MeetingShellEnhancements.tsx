'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MeetingToolsTab } from '@/components/meeting/MeetingUnifiedSidePanel';

function isElementVisible(el: HTMLElement | null): boolean {
  if (!el) return false;
  const st = getComputedStyle(el);
  if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function findControlBar(root: HTMLElement | Document): HTMLElement | null {
  return root.querySelector?.('.lk-control-bar') as HTMLElement | null;
}

/** Matches LiveKit ControlBar `useMediaQuery` (see `@livekit/components-react` prefabs/ControlBar.tsx). */
const CONTROL_BAR_BREAKPOINT_CHAT_OPEN = 1000;
const CONTROL_BAR_BREAKPOINT_CHAT_CLOSED = 760;

function isControlBarIconOnlyMode(chatOpen: boolean): boolean {
  const max = chatOpen ? CONTROL_BAR_BREAKPOINT_CHAT_OPEN : CONTROL_BAR_BREAKPOINT_CHAT_CLOSED;
  return window.matchMedia(`(max-width: ${max}px)`).matches;
}

function shouldCompactControlBar(bar: HTMLElement, chatOpen: boolean): boolean {
  void bar;
  return isControlBarIconOnlyMode(chatOpen);
}

/**
 * Sets `data-meeting-bar-compact` so CSS collapses labels on all icon buttons (see globals.css).
 * Native LiveKit buttons use plain text nodes, not `.lk-button-text`, so CSS must target `.lk-button:has(> svg)`.
 */
function syncControlBarCompact(bar: HTMLElement, chatOpen: boolean) {
  if (shouldCompactControlBar(bar, chatOpen)) {
    bar.dataset.meetingBarCompact = 'true';
  } else {
    delete bar.dataset.meetingBarCompact;
  }
}

function placeToolsButtonInBar(bar: HTMLElement, btn: HTMLButtonElement) {
  const chatToggle = bar.querySelector('.lk-chat-toggle:not(.meeting-transcript-toggle)');
  const disconnectBtn = bar.querySelector('.lk-disconnect-button');
  const anchor = (chatToggle ?? disconnectBtn) as HTMLElement | null;
  if (!anchor?.parentNode) return;
  const parent = anchor.parentNode;
  if (btn.nextSibling === anchor && btn.parentNode === parent) return;
  parent.insertBefore(btn, anchor);
}

function placeTranscriptButtonRight(bar: HTMLElement, btn: HTMLButtonElement) {
  if (btn.parentNode === bar) return;
  bar.appendChild(btn);
}

const TOOLS_BUTTON_INNER =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>' +
  '<span class="lk-button-text">Công cụ</span>';

const MORE_BUTTON_INNER =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

export type MeetingLayoutDataset =
  | 'neither'
  | 'tools-only';

export type { MeetingToolsTab };

export default function MeetingShellEnhancements({
  shellRef,
  transcriptOpen,
  setTranscriptOpen,
  voteOpen,
  setVoteOpen,
  documentsOpen,
  setDocumentsOpen,
  activeToolsTab,
  setActiveToolsTab,
  onChatVisibilityChange,
  onChatUnreadChange,
  canManageRecording = false,
  recordingActive = false,
  recordingBusy = false,
  onStartRecording,
  onStopRecording,
}: {
  shellRef: React.RefObject<HTMLDivElement | null>;
  transcriptOpen: boolean;
  setTranscriptOpen: React.Dispatch<React.SetStateAction<boolean>>;
  voteOpen: boolean;
  setVoteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  documentsOpen: boolean;
  setDocumentsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeToolsTab: MeetingToolsTab;
  setActiveToolsTab?: (tab: MeetingToolsTab) => void;
  onChatVisibilityChange?: (open: boolean) => void;
  onChatUnreadChange?: (count: number) => void;
  canManageRecording?: boolean;
  recordingActive?: boolean;
  recordingBusy?: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const chatOpenRef = useRef(chatOpen);
  chatOpenRef.current = chatOpen;
  const prevChatOpenRef = useRef(false);
  const setTranscriptOpenRef = useRef(setTranscriptOpen);
  setTranscriptOpenRef.current = setTranscriptOpen;
  const setVoteOpenRef = useRef(setVoteOpen);
  setVoteOpenRef.current = setVoteOpen;
  const setDocumentsOpenRef = useRef(setDocumentsOpen);
  setDocumentsOpenRef.current = setDocumentsOpen;
  const setActiveToolsTabRef = useRef(setActiveToolsTab);
  setActiveToolsTabRef.current = setActiveToolsTab;
  const onChatUnreadChangeRef = useRef(onChatUnreadChange);
  onChatUnreadChangeRef.current = onChatUnreadChange;
  const transcriptOpenRef = useRef(transcriptOpen);
  transcriptOpenRef.current = transcriptOpen;
  const voteOpenRef = useRef(voteOpen);
  voteOpenRef.current = voteOpen;

  const documentsOpenRef = useRef(documentsOpen);
  documentsOpenRef.current = documentsOpen;
  const activeToolsTabRef = useRef(activeToolsTab);
  activeToolsTabRef.current = activeToolsTab;
  const canManageRecordingRef = useRef(canManageRecording);
  canManageRecordingRef.current = canManageRecording;
  const recordingActiveRef = useRef(recordingActive);
  recordingActiveRef.current = recordingActive;
  const recordingBusyRef = useRef(recordingBusy);
  recordingBusyRef.current = recordingBusy;
  const onStartRecordingRef = useRef(onStartRecording);
  onStartRecordingRef.current = onStartRecording;
  const onStopRecordingRef = useRef(onStopRecording);
  onStopRecordingRef.current = onStopRecording;

  useEffect(() => {
    if (chatOpen && !prevChatOpenRef.current) {
      setActiveToolsTabRef.current?.('chat');
    }
    prevChatOpenRef.current = chatOpen;
  }, [chatOpen]);

  useEffect(() => {
    onChatVisibilityChange?.(chatOpen);
  }, [chatOpen, onChatVisibilityChange]);

  useEffect(() => {
    if (!onChatUnreadChangeRef.current) return;
    const shell = shellRef.current;
    if (!shell) return;
    const bar = findControlBar(shell);
    if (!bar) return;
    const chatToggle = bar.querySelector('.lk-chat-toggle:not(.meeting-transcript-toggle)') as HTMLElement | null;
    const unreadRaw =
      chatToggle?.getAttribute('data-lk-unread-msgs') ??
      chatToggle?.getAttribute('data-unread-msgs') ??
      '0';
    const unreadNum = Number.parseInt(unreadRaw, 10);
    onChatUnreadChangeRef.current?.(Number.isFinite(unreadNum) ? unreadNum : 0);
  }, [shellRef, chatOpen, activeToolsTab]);

  // Add an explicit "X" close button for Chat panel header.
  // LiveKit's chat toggle can be closed via control-bar button; we just provide UI in the panel header.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const bar = findControlBar(shell);
    const header = shell.querySelector('.lk-chat-header') as HTMLElement | null;
    if (!bar || !header) return;

    const CHAT_CLOSE_CLASS = 'meeting-chat-close';

    const ensureButton = () => {
      if (!chatOpenRef.current) return;
      if (header.querySelector(`.${CHAT_CLOSE_CLASS}`)) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = CHAT_CLOSE_CLASS;
      btn.setAttribute('aria-label', 'Đóng messages');
      btn.innerHTML = '×';

      // Use absolute positioning to guarantee it's on top-right.
      btn.style.position = 'absolute';
      btn.style.right = '8px';
      btn.style.top = '10px';
      btn.style.zIndex = '20';
      btn.style.border = 'none';
      btn.style.background = 'transparent';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '20px';
      btn.style.lineHeight = '20px';
      btn.style.color = '#6b7280';
      btn.onmouseenter = () => {
        btn.style.background = '#f3f4f6';
        btn.style.borderRadius = '8px';
        btn.style.padding = '4px';
        btn.style.margin = '-4px';
      };
      btn.onmouseleave = () => {
        btn.style.background = 'transparent';
        btn.style.borderRadius = '0';
        btn.style.padding = '0';
        btn.style.margin = '0';
      };

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Close chat by clicking the chat toggle in control bar.
        const chatToggle = bar.querySelector('.lk-chat-toggle:not(.meeting-transcript-toggle)') as HTMLElement | null;
        chatToggle?.click();
      });

      // Ensure containing block for absolute positioning.
      if (getComputedStyle(header).position === 'static') {
        header.style.position = 'sticky';
      }
      header.appendChild(btn);
    };

    const removeButton = () => {
      const el = header.querySelector(`.${CHAT_CLOSE_CLASS}`) as HTMLElement | null;
      if (el) el.remove();
    };

    if (chatOpen) ensureButton();
    else removeButton();

    return () => removeButton();
  }, [shellRef, chatOpen]);

  const updateShellLayout = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const t = transcriptOpen;
    const v = voteOpen;
    const c = chatOpen;
    const d = documentsOpen;
    const toolsOpen = t || v || d || c;
    let layout: MeetingLayoutDataset = 'neither';

    if (toolsOpen) layout = 'tools-only';
    else layout = 'neither';
    shell.dataset.meetingLayout = layout;
    if (toolsOpen) {
      shell.dataset.meetingToolsTab = activeToolsTab;
    } else {
      delete shell.dataset.meetingToolsTab;
    }
  }, [shellRef, transcriptOpen, voteOpen, chatOpen, documentsOpen, activeToolsTab]);

  useEffect(() => {
    updateShellLayout();
  }, [updateShellLayout]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const checkChat = () => {
      const chat = shell.querySelector('.lk-chat') as HTMLElement | null;
      if (!chat) {
        setChatOpen(false);
        return;
      }
      if (chat.closest('.meeting-unified-chat-slot')) {
        const bar = findControlBar(shell);
        const toggle = bar?.querySelector(
          '.lk-chat-toggle:not(.meeting-transcript-toggle)',
        ) as HTMLElement | null;
        const pressed =
          toggle?.getAttribute('aria-pressed') === 'true' ||
          toggle?.classList.contains('lk-button-active');
        setChatOpen(!!pressed);
        return;
      }
      setChatOpen(isElementVisible(chat));
    };
    checkChat();
    const obs = new MutationObserver(checkChat);
    obs.observe(shell, { attributes: true, subtree: true, childList: true });
    const poll = window.setInterval(checkChat, 350);
    return () => {
      obs.disconnect();
      window.clearInterval(poll);
    };
  }, [shellRef]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const bar = findControlBar(shell);
    if (!bar) return;
    syncControlBarCompact(bar, chatOpen);
  }, [shellRef, chatOpen]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    let cancelled = false;
    let toolsBtnEl: HTMLButtonElement | null = null;
    let moreBtnEl: HTMLButtonElement | null = null;
    let moreMenuEl: HTMLDivElement | null = null;
    let transcriptToggleBtnEl: HTMLButtonElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let transcriptEnabled = true;
    let transcriptHasContent = false;

    const closeMoreMenu = () => {
      if (!moreMenuEl) return;
      moreMenuEl.remove();
      moreMenuEl = null;
    };

    const renderMoreMenu = () => {
      if (!moreBtnEl) return;
      closeMoreMenu();

      const menu = document.createElement('div');
      menu.className = 'meeting-more-menu';

      const transcriptItem = document.createElement('button');
      transcriptItem.type = 'button';
      transcriptItem.className = 'meeting-more-item';
      transcriptItem.textContent = transcriptEnabled ? 'Tắt transcript' : 'Bật transcript';
      transcriptItem.addEventListener('click', () => {
        window.dispatchEvent(new Event('bkmt-toggle-latest-transcript'));
        closeMoreMenu();
      });
      menu.appendChild(transcriptItem);

      if (canManageRecordingRef.current) {
        const recordItem = document.createElement('button');
        recordItem.type = 'button';
        recordItem.className = `meeting-more-item${recordingActiveRef.current ? ' is-danger' : ''}`;
        recordItem.disabled = recordingBusyRef.current;
        recordItem.textContent = recordingActiveRef.current ? 'Dừng ghi' : 'Ghi hình';
        recordItem.addEventListener('click', () => {
          if (recordingBusyRef.current) return;
          if (recordingActiveRef.current) {
            onStopRecordingRef.current?.();
          } else {
            onStartRecordingRef.current?.();
          }
          closeMoreMenu();
        });
        menu.appendChild(recordItem);
      }

      document.body.appendChild(menu);
      const rect = moreBtnEl.getBoundingClientRect();
      const top = Math.max(8, rect.top - menu.offsetHeight - 8);
      const left = Math.max(8, rect.right - menu.offsetWidth);
      menu.style.top = `${top}px`;
      menu.style.left = `${left}px`;

      moreMenuEl = menu;
    };

    const toolsSideOpen = () =>
      transcriptOpenRef.current || voteOpenRef.current || documentsOpenRef.current || chatOpenRef.current;

    const syncButtonUI = () => {
      if (cancelled) return;
      const bar = findControlBar(shell);
      if (!bar) return;
      syncControlBarCompact(bar, chatOpenRef.current);
      if (!toolsBtnEl) return;

      const chatToggle = bar.querySelector('.lk-chat-toggle:not(.meeting-transcript-toggle)') as HTMLElement | null;
      const unread =
        chatToggle?.getAttribute('data-lk-unread-msgs') ??
        chatToggle?.getAttribute('data-unread-msgs') ??
        '0';
      if (unread && unread !== '0') {
        toolsBtnEl.setAttribute('data-unread-msgs', unread);
      } else {
        toolsBtnEl.removeAttribute('data-unread-msgs');
      }
      onChatUnreadChangeRef.current?.(
        unread && unread !== '0' ? Number.parseInt(unread, 10) || 0 : 0,
      );

      if (toolsSideOpen()) {
        toolsBtnEl.setAttribute('data-active', 'true');
        toolsBtnEl.classList.add('lk-button-active');
      } else {
        toolsBtnEl.removeAttribute('data-active');
        toolsBtnEl.classList.remove('lk-button-active');
      }
    };

    const attach = () => {
      if (cancelled) return;
      const bar = findControlBar(shell);
      if (!bar) return;
      let btn = bar.querySelector('.meeting-tools-toggle') as HTMLButtonElement | null;
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lk-button meeting-tools-toggle';
        btn.innerHTML = TOOLS_BUTTON_INNER;
        const toggleTools = () => {
          const isOpen = toolsSideOpen();
          if (isOpen) {
            setTranscriptOpenRef.current(false);
            setVoteOpenRef.current(false);
            setDocumentsOpenRef.current(false);
            if (chatOpenRef.current) {
              const chatToggle = bar.querySelector('.lk-chat-toggle:not(.meeting-transcript-toggle)') as HTMLElement | null;
              chatToggle?.click();
            }
            return;
          }

          const tab = activeToolsTabRef.current;
          if (tab === 'transcript') {
            setTranscriptOpenRef.current(true);
          } else if (tab === 'documents') {
            setDocumentsOpenRef.current(true);
          } else if (tab === 'chatbox') {
            setDocumentsOpenRef.current(true);
          } else if (tab === 'chat') {
            const chatToggle = bar.querySelector('.lk-chat-toggle:not(.meeting-transcript-toggle)') as HTMLElement | null;
            chatToggle?.click();
          } else {
            setVoteOpenRef.current(true);
          }
        };
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleTools();
        });
        btn.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          toggleTools();
        });
      }
      placeToolsButtonInBar(bar, btn);
      toolsBtnEl = btn;

      let moreBtn = bar.querySelector('.meeting-more-toggle') as HTMLButtonElement | null;
      if (!moreBtn) {
        moreBtn = document.createElement('button');
        moreBtn.type = 'button';
        moreBtn.className = 'lk-button meeting-more-toggle';
        moreBtn.innerHTML = MORE_BUTTON_INNER;
        moreBtn.setAttribute('aria-label', 'Khác');
        const toggleMore = () => {
          if (moreMenuEl) {
            closeMoreMenu();
            return;
          }
          renderMoreMenu();
        };
        moreBtn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleMore();
        });
        moreBtn.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          toggleMore();
        });
      }
      placeToolsButtonInBar(bar, moreBtn);
      moreBtnEl = moreBtn;

      let transcriptBtn = bar.querySelector('.meeting-transcript-toggle-inbar') as HTMLButtonElement | null;
      if (!transcriptBtn) {
        transcriptBtn = document.createElement('button');
        transcriptBtn.type = 'button';
        transcriptBtn.className = 'meeting-transcript-toggle-inbar';
        transcriptBtn.addEventListener('click', () => {
          window.dispatchEvent(new Event('bkmt-toggle-latest-transcript'));
        });
      }
      placeTranscriptButtonRight(bar, transcriptBtn);
      transcriptToggleBtnEl = transcriptBtn;
      transcriptBtn.style.display = transcriptHasContent ? 'inline-flex' : 'none';
      transcriptBtn.textContent = transcriptEnabled ? 'Tắt transcript' : 'Bật transcript';
      transcriptBtn.setAttribute(
        'aria-label',
        transcriptEnabled ? 'Tắt hiển thị transcript' : 'Bật hiển thị transcript',
      );

      syncButtonUI();

      if (!resizeObserver) {
        resizeObserver = new ResizeObserver(() => {
          syncButtonUI();
        });
        resizeObserver.observe(bar);
      }
    };

    attach();
    const t = window.setInterval(attach, 350);
    const onTranscriptState = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean; hasContent?: boolean }>).detail;
      transcriptEnabled = detail?.enabled !== false;
      transcriptHasContent = Boolean(detail?.hasContent);
      if (!transcriptToggleBtnEl) return;
      transcriptToggleBtnEl.style.display = transcriptHasContent ? 'inline-flex' : 'none';
      transcriptToggleBtnEl.textContent = transcriptEnabled ? 'Tắt transcript' : 'Bật transcript';
      transcriptToggleBtnEl.setAttribute(
        'aria-label',
        transcriptEnabled ? 'Tắt hiển thị transcript' : 'Bật hiển thị transcript',
      );
      if (moreMenuEl) {
        renderMoreMenu();
      }
    };
    window.addEventListener('bkmt-latest-transcript-state', onTranscriptState as EventListener);

    return () => {
      cancelled = true;
      window.clearInterval(t);
      window.removeEventListener('bkmt-latest-transcript-state', onTranscriptState as EventListener);
      if (resizeObserver) resizeObserver.disconnect();
      const bar = findControlBar(shell);
      if (bar) delete bar.dataset.meetingBarCompact;
      closeMoreMenu();
      toolsBtnEl?.remove();
      moreBtnEl?.remove();
      transcriptToggleBtnEl?.remove();
    };
  }, [shellRef]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const toolsOpen = voteOpen || documentsOpen || chatOpen || transcriptOpen;
    const toolsBtn = shell.querySelector('.meeting-tools-toggle') as HTMLButtonElement | null;
    if (toolsBtn) {
      if (toolsOpen) {
        toolsBtn.setAttribute('data-active', 'true');
        toolsBtn.classList.add('lk-button-active');
      } else {
        toolsBtn.removeAttribute('data-active');
        toolsBtn.classList.remove('lk-button-active');
      }
    }
  }, [shellRef, voteOpen, transcriptOpen, documentsOpen, chatOpen, activeToolsTab]);

  return null;
}










