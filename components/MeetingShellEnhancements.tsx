'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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

/** Thứ tự cố định: … → Transcript → Chat → … → Leave */
function placeTranscriptButtonInBar(bar: HTMLElement, btn: HTMLButtonElement) {
  const chatToggle = bar.querySelector('.lk-chat-toggle');
  const disconnectBtn = bar.querySelector('.lk-disconnect-button');
  const anchor = (chatToggle ?? disconnectBtn) as HTMLElement | null;
  if (!anchor?.parentNode) return;
  const parent = anchor.parentNode;
  if (btn.nextSibling === anchor && btn.parentNode === parent) return;
  parent.insertBefore(btn, anchor);
}

/** * Cấu trúc này cực kỳ quan trọng:
 * Thẻ span phải có class lk-button-text để LiveKit tự động ẩn bằng Container Queries
 */
const TRANSCRIPT_BUTTON_INNER =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>' +
  '<span class="lk-button-text">Transcript</span>';

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
  /** Tránh đưa transcriptOpen vào deps của effect gắn nút — mỗi lần đổi state cleanup sẽ remove nút và gây nhảy layout */
  const transcriptOpenRef = useRef(transcriptOpen);
  transcriptOpenRef.current = transcriptOpen;

  const updateShellLayout = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    let layout: 'neither' | 'transcript-only' | 'chat-only' | 'both' = 'neither';
    if (transcriptOpen && chatOpen) layout = 'both';
    else if (transcriptOpen) layout = 'transcript-only';
    else if (chatOpen) layout = 'chat-only';
    shell.dataset.meetingLayout = layout;
  }, [shellRef, transcriptOpen, chatOpen]);

  useEffect(() => {
    updateShellLayout();
  }, [updateShellLayout]);

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
      obs.observe(conference, { attributes: true, subtree: true, childList: true });
    }
    const poll = window.setInterval(checkChat, 350);
    return () => { obs.disconnect(); window.clearInterval(poll); };
  }, [shellRef]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    let cancelled = false;
    let createdBtn: HTMLButtonElement | null = null;

    const syncActive = (btn: HTMLButtonElement) => {
      if (transcriptOpenRef.current) {
        btn.setAttribute('data-active', 'true');
        btn.classList.add('lk-button-active'); // Thêm class active của LiveKit
      } else {
        btn.removeAttribute('data-active');
        btn.classList.remove('lk-button-active');
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
        // lk-chat-toggle là class mấu chốt để hưởng CSS ẩn text của LiveKit
        btn.className = 'lk-button lk-chat-toggle meeting-transcript-toggle';
        btn.innerHTML = TRANSCRIPT_BUTTON_INNER;
        btn.addEventListener('click', () => setTranscriptOpen((v) => !v));
        placeTranscriptButtonInBar(bar, btn);
        createdBtn = btn;
      } else {
        placeTranscriptButtonInBar(bar, btn);
        if (!btn.classList.contains('lk-chat-toggle')) {
          btn.classList.add('lk-chat-toggle');
        }
      }
      syncActive(btn);
    };

    attach();
    const t = window.setInterval(attach, 350);
    return () => {
      cancelled = true;
      window.clearInterval(t);
      createdBtn?.remove();
    };
  }, [shellRef, setTranscriptOpen]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const btn = shell.querySelector('.meeting-transcript-toggle') as HTMLButtonElement | null;
    if (!btn) return;
    if (transcriptOpen) {
      btn.setAttribute('data-active', 'true');
      btn.classList.add('lk-button-active');
    } else {
      btn.removeAttribute('data-active');
      btn.classList.remove('lk-button-active');
    }
  }, [shellRef, transcriptOpen]);

  return null;
}