'use client';

import { useCallback, useEffect, useState } from 'react';

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

/** Thứ tự cố định: … → Transcript → Chat → … → Leave (không append xuống cuối). */
function placeTranscriptButtonInBar(bar: HTMLElement, btn: HTMLButtonElement) {
  const chatToggle = bar.querySelector('.lk-chat-toggle');
  const disconnectBtn = bar.querySelector('.lk-disconnect-button');
  const anchor = (chatToggle ?? disconnectBtn) as HTMLElement | null;
  if (!anchor?.parentNode) return;
  const parent = anchor.parentNode;
  if (btn.nextSibling === anchor && btn.parentNode === parent) return;
  parent.insertBefore(btn, anchor);
}

/** Cùng kiểu với Chat: icon + nhãn */
const TRANSCRIPT_BUTTON_INNER =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>' +
  '<span class="meeting-transcript-btn-label">Transcript</span>';

type MeetingLayout = 'neither' | 'transcript-only' | 'chat-only' | 'both';

/**
 * Đồng bộ layout transcript/chat: nút bật transcript cạnh chat, data-meeting-layout cho CSS.
 */
export default function MeetingShellEnhancements({
  shellRef,
  transcriptOpen,
  setTranscriptOpen,
}: {
  shellRef: React.RefObject<HTMLDivElement | null>;
  transcriptOpen: boolean;
  setTranscriptOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [chatOpen, setChatOpen] = useState(false);

  const updateShellLayout = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;

    let layout: MeetingLayout = 'neither';
    if (transcriptOpen && chatOpen) layout = 'both';
    else if (transcriptOpen) layout = 'transcript-only';
    else if (chatOpen) layout = 'chat-only';

    shell.dataset.meetingLayout = layout;
  }, [shellRef, transcriptOpen, chatOpen]);

  useEffect(() => {
    updateShellLayout();
  }, [updateShellLayout]);

  // Theo dõi panel chat LiveKit (mở/đóng)
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const checkChat = () => {
      const chat = shell.querySelector('.lk-chat') as HTMLElement | null;
      setChatOpen(isElementVisible(chat));
    };

    checkChat();

    const obs = new MutationObserver(checkChat);
    const conference = shell.querySelector('.lk-video-conference');
    if (conference) {
      obs.observe(conference, {
        attributes: true,
        subtree: true,
        attributeFilter: ['style', 'class', 'hidden'],
        childList: true,
      });
    }

    const poll = window.setInterval(checkChat, 350);
    return () => {
      obs.disconnect();
      window.clearInterval(poll);
    };
  }, [shellRef]);

  // Nút Transcript trên control bar (cạnh Chat)
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    let cancelled = false;
    let createdBtn: HTMLButtonElement | null = null;

    const syncActive = (btn: HTMLButtonElement) => {
      if (transcriptOpen) {
        btn.setAttribute('data-active', 'true');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.removeAttribute('data-active');
        btn.setAttribute('aria-pressed', 'false');
      }
    };

    const attach = () => {
      if (cancelled) return;
      const bar = findControlBar(shell);
      if (!bar) return;

      let btn = bar.querySelector('.meeting-transcript-toggle') as HTMLButtonElement | null;
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lk-button meeting-transcript-toggle';
        btn.setAttribute('aria-label', 'Transcript');
        btn.setAttribute('title', 'Transcript');
        btn.innerHTML = TRANSCRIPT_BUTTON_INNER;
        btn.dataset.lkTranscriptLabeled = '1';
        btn.addEventListener('click', () => setTranscriptOpen((v) => !v));
        placeTranscriptButtonInBar(bar, btn);
        createdBtn = btn;
      } else {
        placeTranscriptButtonInBar(bar, btn);
        if (!btn.dataset.lkTranscriptLabeled) {
          btn.innerHTML = TRANSCRIPT_BUTTON_INNER;
          btn.dataset.lkTranscriptLabeled = '1';
        }
      }
      syncActive(btn);
    };

    attach();
    const t = window.setInterval(attach, 350);

    return () => {
      cancelled = true;
      window.clearInterval(t);
      shellRef.current
        ?.querySelector('.lk-control-bar .meeting-transcript-toggle')
        ?.remove();
      createdBtn?.remove();
    };
  }, [shellRef, setTranscriptOpen, transcriptOpen]);

  return null;
}
