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
  // Tìm nút Chat thật (loại trừ nút transcript nếu có lỡ trùng class) hoặc nút Leave
  const chatToggle = bar.querySelector('.lk-chat-toggle:not(.meeting-transcript-toggle)');
  const disconnectBtn = bar.querySelector('.lk-disconnect-button');
  const anchor = (chatToggle ?? disconnectBtn) as HTMLElement | null;
  if (!anchor?.parentNode) return;
  const parent = anchor.parentNode;
  if (btn.nextSibling === anchor && btn.parentNode === parent) return;
  parent.insertBefore(btn, anchor);
}

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
    let resizeObserver: ResizeObserver | null = null;

    const syncActive = (btn: HTMLButtonElement) => {
      if (transcriptOpenRef.current) {
        btn.setAttribute('data-active', 'true');
        btn.classList.add('lk-button-active');
      } else {
        btn.removeAttribute('data-active');
        btn.classList.remove('lk-button-active');
      }
    };

    // Hàm đồng bộ UI của nút Transcript với các nút khác (VD: Chat/Leave)
    const syncButtonUI = () => {
      if (cancelled || !createdBtn) return;
      const bar = findControlBar(shell);
      if (!bar) return;

      // Lấy nút Chat hoặc Leave làm nút chuẩn để so sánh
      const refBtn = bar.querySelector('.lk-chat-toggle:not(.meeting-transcript-toggle), .lk-disconnect-button') as HTMLElement;
      if (!refBtn) return;

      const textSpan = createdBtn.querySelector('.lk-button-text') as HTMLElement;
      if (textSpan) {
        const refRect = refBtn.getBoundingClientRect();
        
        // LiveKit tự thu các nút thành hình vuông (thường có width khoảng 40px-48px)
        // Nếu width của nút chuẩn < 60px, chứng tỏ nó đang ở dạng Icon Only
        const isIconOnly = refRect.width < 60;
        
        // Ẩn/Hiện chữ
        textSpan.style.display = isIconOnly ? 'none' : 'inline-block';

        // Copy y hệt padding và khoảng cách (gap) từ nút chuẩn sang
        const refStyle = window.getComputedStyle(refBtn);
        createdBtn.style.padding = refStyle.padding;
        createdBtn.style.gap = isIconOnly ? '0px' : refStyle.gap;
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
        // Chỉ dùng lk-button để kế thừa nền/hover của LiveKit
        btn.className = 'lk-button meeting-transcript-toggle';
        btn.innerHTML = TRANSCRIPT_BUTTON_INNER;
        btn.addEventListener('click', () => setTranscriptOpen((v) => !v));
        placeTranscriptButtonInBar(bar, btn);
        createdBtn = btn;
      } else {
        placeTranscriptButtonInBar(bar, btn);
        createdBtn = btn;
      }
      
      syncActive(btn);
      syncButtonUI(); // Cập nhật UI ngay khi attach

      // Theo dõi mọi thay đổi kích thước của thanh Control Bar
      if (!resizeObserver) {
        resizeObserver = new ResizeObserver(() => {
          // Khi thanh này co lại/phóng to, lập tức tính toán lại
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