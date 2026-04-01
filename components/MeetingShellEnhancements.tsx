'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MeetingToolsTab } from '@/components/MeetingUnifiedSidePanel';

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

/** Vote → Transcript → Chat → Leave */
function placeVoteButtonInBar(bar: HTMLElement, btn: HTMLButtonElement) {
  const transcriptBtn = bar.querySelector('.meeting-transcript-toggle');
  const chatToggle = bar.querySelector('.lk-chat-toggle:not(.meeting-transcript-toggle)');
  const disconnectBtn = bar.querySelector('.lk-disconnect-button');
  const anchor = (transcriptBtn ?? chatToggle ?? disconnectBtn) as HTMLElement | null;
  if (!anchor?.parentNode) return;
  const parent = anchor.parentNode;
  if (btn.nextSibling === anchor && btn.parentNode === parent) return;
  parent.insertBefore(btn, anchor);
}

function placeTranscriptButtonInBar(bar: HTMLElement, btn: HTMLButtonElement) {
  const chatToggle = bar.querySelector('.lk-chat-toggle:not(.meeting-transcript-toggle)');
  const disconnectBtn = bar.querySelector('.lk-disconnect-button');
  const anchor = (chatToggle ?? disconnectBtn) as HTMLElement | null;
  if (!anchor?.parentNode) return;
  const parent = anchor.parentNode;
  if (btn.nextSibling === anchor && btn.parentNode === parent) return;
  parent.insertBefore(btn, anchor);
}

function placeDocumentsButtonInBar(bar: HTMLElement, btn: HTMLButtonElement) {
  const transcriptBtn = bar.querySelector('.meeting-transcript-toggle') as HTMLElement | null;
  const chatToggle = bar.querySelector('.lk-chat-toggle:not(.meeting-transcript-toggle)') as HTMLElement | null;
  const disconnectBtn = bar.querySelector('.lk-disconnect-button') as HTMLElement | null;
  const anchor = (transcriptBtn ?? chatToggle ?? disconnectBtn) as HTMLElement | null;
  if (!anchor?.parentNode) return;
  const parent = anchor.parentNode;
  if (btn.nextSibling === anchor && btn.parentNode === parent) return;
  parent.insertBefore(btn, anchor);
}

const VOTE_BUTTON_INNER =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6"/><path d="M9 16h4"/></svg>' +
  '<span class="lk-button-text">Biểu quyết</span>';

const TRANSCRIPT_BUTTON_INNER =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>' +
  '<span class="lk-button-text">Transcript</span>';

const DOCUMENTS_BUTTON_INNER =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M7 13h10"/><path d="M7 17h6"/></svg>' +
  '<span class="lk-button-text">Tài liệu</span>';

export type MeetingLayoutDataset =
  | 'neither'
  | 'transcript-only'
  | 'tools-only'
  | 'transcript-tools';

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
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const chatOpenRef = useRef(chatOpen);
  chatOpenRef.current = chatOpen;
  const prevChatOpenRef = useRef(false);
  const setActiveToolsTabRef = useRef(setActiveToolsTab);
  setActiveToolsTabRef.current = setActiveToolsTab;
  const transcriptOpenRef = useRef(transcriptOpen);
  transcriptOpenRef.current = transcriptOpen;
  const voteOpenRef = useRef(voteOpen);
  voteOpenRef.current = voteOpen;

  const documentsOpenRef = useRef(documentsOpen);
  documentsOpenRef.current = documentsOpen;
  const activeToolsTabRef = useRef(activeToolsTab);
  activeToolsTabRef.current = activeToolsTab;

  useEffect(() => {
    if (chatOpen && !prevChatOpenRef.current) {
      setActiveToolsTabRef.current?.('chat');
    }
    prevChatOpenRef.current = chatOpen;
  }, [chatOpen]);

  useEffect(() => {
    onChatVisibilityChange?.(chatOpen);
  }, [chatOpen, onChatVisibilityChange]);

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
    const toolsOpen = v || d || c;
    let layout: MeetingLayoutDataset = 'neither';

    if (t && toolsOpen) layout = 'transcript-tools';
    else if (t && !toolsOpen) layout = 'transcript-only';
    else if (!t && toolsOpen) layout = 'tools-only';
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
    let voteBtnEl: HTMLButtonElement | null = null;
    let transcriptBtnEl: HTMLButtonElement | null = null;
    let documentsBtnEl: HTMLButtonElement | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const syncTranscriptActive = (btn: HTMLButtonElement) => {
      if (transcriptOpenRef.current) {
        btn.setAttribute('data-active', 'true');
        btn.classList.add('lk-button-active');
      } else {
        btn.removeAttribute('data-active');
        btn.classList.remove('lk-button-active');
      }
    };

    const toolsSideOpen = () =>
      voteOpenRef.current || documentsOpenRef.current || chatOpenRef.current;

    const syncVoteActive = (btn: HTMLButtonElement) => {
      if (toolsSideOpen() && activeToolsTabRef.current === 'vote') {
        btn.setAttribute('data-active', 'true');
        btn.classList.add('lk-button-active');
      } else {
        btn.removeAttribute('data-active');
        btn.classList.remove('lk-button-active');
      }
    };

    const syncDocumentsActive = (btn: HTMLButtonElement) => {
      if (toolsSideOpen() && activeToolsTabRef.current === 'documents') {
        btn.setAttribute('data-active', 'true');
        btn.classList.add('lk-button-active');
      } else {
        btn.removeAttribute('data-active');
        btn.classList.remove('lk-button-active');
      }
    };

    const syncButtonUI = () => {
      if (cancelled) return;
      const bar = findControlBar(shell);
      if (!bar) return;
      syncControlBarCompact(bar, chatOpenRef.current);
    };

    const attach = () => {
      if (cancelled) return;
      const bar = findControlBar(shell);
      if (!bar) return;

      let vBtn = bar.querySelector('.meeting-vote-toggle') as HTMLButtonElement | null;
      if (!vBtn) {
        vBtn = document.createElement('button');
        vBtn.type = 'button';
        vBtn.className = 'lk-button meeting-vote-toggle';
        vBtn.innerHTML = VOTE_BUTTON_INNER;
        vBtn.addEventListener('click', () => {
          const vote = voteOpenRef.current;
          const tab = activeToolsTabRef.current;
          if (vote && tab === 'vote') {
            setVoteOpen(false);
            if (documentsOpenRef.current) {
              setActiveToolsTabRef.current?.('documents');
            } else if (chatOpenRef.current) {
              setActiveToolsTabRef.current?.('chat');
            }
            return;
          }
          if (!vote) {
            setVoteOpen(true);
          }
          setActiveToolsTabRef.current?.('vote');
        });
        placeVoteButtonInBar(bar, vBtn);
        voteBtnEl = vBtn;
      } else {
        placeVoteButtonInBar(bar, vBtn);
        voteBtnEl = vBtn;
      }

      let tBtn = bar.querySelector('.meeting-transcript-toggle') as HTMLButtonElement | null;
      if (!tBtn) {
        tBtn = document.createElement('button');
        tBtn.type = 'button';
        tBtn.className = 'lk-button meeting-transcript-toggle';
        tBtn.innerHTML = TRANSCRIPT_BUTTON_INNER;
        tBtn.addEventListener('click', () => setTranscriptOpen((x) => !x));
        placeTranscriptButtonInBar(bar, tBtn);
        transcriptBtnEl = tBtn;
      } else {
        placeTranscriptButtonInBar(bar, tBtn);
        transcriptBtnEl = tBtn;
      }

      let dBtn = bar.querySelector('.meeting-documents-toggle') as HTMLButtonElement | null;
      if (!dBtn) {
        dBtn = document.createElement('button');
        dBtn.type = 'button';
        dBtn.className = 'lk-button meeting-documents-toggle';
        dBtn.innerHTML = DOCUMENTS_BUTTON_INNER;
        dBtn.addEventListener('click', () => {
          const docs = documentsOpenRef.current;
          const tab = activeToolsTabRef.current;
          if (docs && tab === 'documents') {
            setDocumentsOpen(false);
            if (voteOpenRef.current) {
              setActiveToolsTabRef.current?.('vote');
            } else if (chatOpenRef.current) {
              setActiveToolsTabRef.current?.('chat');
            }
            return;
          }
          if (!docs) {
            setDocumentsOpen(true);
          }
          setActiveToolsTabRef.current?.('documents');
        });
        placeDocumentsButtonInBar(bar, dBtn);
        documentsBtnEl = dBtn;
      } else {
        placeDocumentsButtonInBar(bar, dBtn);
        documentsBtnEl = dBtn;
      }

      syncVoteActive(vBtn);
      syncTranscriptActive(tBtn);
      if (dBtn) syncDocumentsActive(dBtn);
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

    return () => {
      cancelled = true;
      window.clearInterval(t);
      if (resizeObserver) resizeObserver.disconnect();
      const bar = findControlBar(shell);
      if (bar) delete bar.dataset.meetingBarCompact;
      voteBtnEl?.remove();
      transcriptBtnEl?.remove();
      documentsBtnEl?.remove();
    };
  }, [shellRef, setTranscriptOpen, setVoteOpen, setDocumentsOpen, setActiveToolsTab]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const toolsOpen = voteOpen || documentsOpen || chatOpen;
    const vBtn = shell.querySelector('.meeting-vote-toggle') as HTMLButtonElement | null;
    if (vBtn) {
      if (toolsOpen && activeToolsTab === 'vote') {
        vBtn.setAttribute('data-active', 'true');
        vBtn.classList.add('lk-button-active');
      } else {
        vBtn.removeAttribute('data-active');
        vBtn.classList.remove('lk-button-active');
      }
    }
    const tBtn = shell.querySelector('.meeting-transcript-toggle') as HTMLButtonElement | null;
    if (tBtn) {
      if (transcriptOpen) {
        tBtn.setAttribute('data-active', 'true');
        tBtn.classList.add('lk-button-active');
      } else {
        tBtn.removeAttribute('data-active');
        tBtn.classList.remove('lk-button-active');
      }
    }

    const dBtn = shell.querySelector('.meeting-documents-toggle') as HTMLButtonElement | null;
    if (dBtn) {
      if (toolsOpen && activeToolsTab === 'documents') {
        dBtn.setAttribute('data-active', 'true');
        dBtn.classList.add('lk-button-active');
      } else {
        dBtn.removeAttribute('data-active');
        dBtn.classList.remove('lk-button-active');
      }
    }
  }, [shellRef, voteOpen, transcriptOpen, documentsOpen, chatOpen, activeToolsTab]);

  return null;
}
