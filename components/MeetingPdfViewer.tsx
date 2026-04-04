'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Một bản pdfjs-dist (npm overrides khớp react-pdf). Worker CDN đúng version — tránh hai bản pdfjs + lỗi webpack/import.meta.
const pdfjsVersion =
  typeof (pdfjs as unknown as { version?: string }).version === 'string'
    ? (pdfjs as unknown as { version: string }).version
    : '5.3.93';
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 3;
const ZOOM_STEP = 1.15;

const toolbarDivider: React.CSSProperties = {
  width: 1,
  height: 22,
  flexShrink: 0,
  background: 'rgba(148, 163, 184, 0.35)',
};

const toolbarPill: React.CSSProperties = {
  padding: '3px 10px',
  borderRadius: 4,
  background: 'rgba(0, 0, 0, 0.22)',
  border: '1px solid rgba(148, 163, 184, 0.22)',
  fontSize: 13,
  fontWeight: 600,
  color: '#e2e8f0',
  lineHeight: '24px',
  whiteSpace: 'nowrap',
};

const zoomBtn: React.CSSProperties = {
  minWidth: 34,
  height: 30,
  borderRadius: 4,
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background: 'rgba(30, 41, 59, 0.85)',
  color: '#e2e8f0',
  fontSize: 16,
  lineHeight: 1,
  cursor: 'pointer',
};

export default function MeetingPdfViewer({
  fileUrl,
  fileName,
  onClose,
}: {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
}) {
  const [numPages, setNumPages] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  /** Chiều rộng khung (fit theo chiều ngang), chưa nhân zoom */
  const [basePageWidth, setBasePageWidth] = useState<number | undefined>(undefined);
  const [zoom, setZoom] = useState(1);
  const [activePage, setActivePage] = useState(1);

  useEffect(() => {
    setNumPages(0);
    setZoom(1);
    setActivePage(1);
  }, [fileUrl]);

  const measureWidth = (el: HTMLDivElement) => {
    const w = el.clientWidth;
    setBasePageWidth(w > 0 ? Math.max(1, w) : undefined);
  };

  const updateActivePageFromScroll = useCallback(() => {
    const root = containerRef.current;
    if (!root || numPages < 1) return;
    const nodes = root.querySelectorAll<HTMLElement>('[data-pdf-page]');
    if (nodes.length === 0) return;
    const rootR = root.getBoundingClientRect();
    let best = 1;
    let maxVisible = 0;
    nodes.forEach((node) => {
      const r = node.getBoundingClientRect();
      const top = Math.max(r.top, rootR.top);
      const bottom = Math.min(r.bottom, rootR.bottom);
      const h = Math.max(0, bottom - top);
      const page = Number(node.dataset.pdfPage);
      if (!Number.isFinite(page)) return;
      if (h > maxVisible) {
        maxVisible = h;
        best = page;
      } else if (h === maxVisible && h > 0 && page < best) {
        best = page;
      }
    });
    if (maxVisible === 0) {
      let closest = 1;
      let minDist = Infinity;
      const midY = rootR.top + rootR.height / 2;
      nodes.forEach((node) => {
        const r = node.getBoundingClientRect();
        const page = Number(node.dataset.pdfPage);
        if (!Number.isFinite(page)) return;
        const c = r.top + r.height / 2;
        const d = Math.abs(c - midY);
        if (d < minDist) {
          minDist = d;
          closest = page;
        }
      });
      best = closest;
    }
    setActivePage(best);
  }, [numPages]);

  const renderPageWidth =
    basePageWidth !== undefined ? Math.max(1, Math.round(basePageWidth * zoom)) : undefined;

  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, Math.round(z * ZOOM_STEP * 100) / 100));
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, Math.round((z / ZOOM_STEP) * 100) / 100));
  const zoomReset = () => setZoom(1);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (el) measureWidth(el);
  }, [fileUrl]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      measureWidth(el);
      requestAnimationFrame(() => updateActivePageFromScroll());
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateActivePageFromScroll]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || numPages < 1) return;
    const onScroll = () => updateActivePageFromScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    const t = requestAnimationFrame(() => updateActivePageFromScroll());
    return () => {
      cancelAnimationFrame(t);
      el.removeEventListener('scroll', onScroll);
    };
  }, [numPages, renderPageWidth, fileUrl, updateActivePageFromScroll]);

  useEffect(() => {
    if (numPages < 1 || !renderPageWidth) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => updateActivePageFromScroll());
    });
    return () => cancelAnimationFrame(id);
  }, [numPages, renderPageWidth, updateActivePageFromScroll]);

  return (
    <div
      style={{
        flex: '1 1 0%',
        minHeight: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#0b1220',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 8px 6px 14px',
          minHeight: 44,
          borderBottom: '1px solid rgba(148, 163, 184, 0.22)',
          background: 'rgba(30, 32, 38, 0.97)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
          <span
            title={fileName}
            style={{
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: '#f1f5f9',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {fileName}
          </span>
        </div>
        {numPages > 0 ? (
          <>
            <span style={{ ...toolbarPill, minWidth: 52, textAlign: 'center' }} aria-live="polite">
              {activePage} / {numPages}
            </span>
            <span style={toolbarDivider} aria-hidden />
          </>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoom <= ZOOM_MIN + 0.001}
            title="Thu nhỏ"
            aria-label="Thu nhỏ"
            style={{
              ...zoomBtn,
              cursor: zoom <= ZOOM_MIN + 0.001 ? 'not-allowed' : 'pointer',
              opacity: zoom <= ZOOM_MIN + 0.001 ? 0.45 : 1,
            }}
          >
            −
          </button>
          <span style={{ ...toolbarPill, minWidth: 48, textAlign: 'center', paddingLeft: 8, paddingRight: 8 }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoom >= ZOOM_MAX - 0.001}
            title="Phóng to"
            aria-label="Phóng to"
            style={{
              ...zoomBtn,
              cursor: zoom >= ZOOM_MAX - 0.001 ? 'not-allowed' : 'pointer',
              opacity: zoom >= ZOOM_MAX - 0.001 ? 0.45 : 1,
            }}
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={zoomReset}
          title="Khớp chiều ngang khung (100%)"
          style={{
            height: 30,
            padding: '0 10px',
            borderRadius: 4,
            border: '1px solid rgba(148, 163, 184, 0.35)',
            background: 'rgba(30, 41, 59, 0.55)',
            color: '#cbd5e1',
            fontSize: 12,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Vừa khung
        </button>
        <span style={toolbarDivider} aria-hidden />
        <Button
          type="text"
          icon={<CloseOutlined />}
          onClick={onClose}
          aria-label="Đóng"
          style={{ color: '#e2e8f0', flexShrink: 0 }}
        />
      </div>
      <div
        style={{
          position: 'relative',
          flex: '1 1 0%',
          minHeight: 0,
          width: '100%',
        }}
      >
        <div
          ref={containerRef}
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'auto',
            background: '#f1f5f9',
          }}
        >
        <Document
          file={fileUrl}
          loading={
            <div style={{ padding: 16, color: '#64748b' }} aria-busy="true">
              Đang tải PDF…
            </div>
          }
          error={
            <div style={{ padding: 16, color: '#f87171' }}>
              Không đọc được PDF. Bạn có thể tải xuống:{' '}
              <a href={fileUrl} download={fileName} style={{ color: '#93c5fd' }}>
                {fileName}
              </a>
            </div>
          }
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
        >
          {renderPageWidth && numPages > 0
            ? Array.from({ length: numPages }, (_, i) => (
                <div
                  key={i + 1}
                  data-pdf-page={i + 1}
                  style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}
                >
                  <Page
                    pageNumber={i + 1}
                    width={renderPageWidth}
                    renderTextLayer
                    renderAnnotationLayer
                  />
                </div>
              ))
            : null}
        </Document>
        </div>
      </div>
    </div>
  );
}
