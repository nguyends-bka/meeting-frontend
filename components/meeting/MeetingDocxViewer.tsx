'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from 'antd';
import { CloseOutlined, DownloadOutlined, LoadingOutlined } from '@ant-design/icons';

interface MeetingDocxViewerProps {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
}

export default function MeetingDocxViewer({ fileUrl, fileName, onClose }: MeetingDocxViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const renderDocx = async () => {
      setLoading(true);
      setError(null);

      const container = containerRef.current;
      if (!container) return;
      container.innerHTML = '';

      try {
        // Lấy blob từ blob URL (đã được tạo sẵn từ DocumentsModal)
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}: Không thể tải file`);
        const blob = await res.blob();

        if (cancelled) return;

        const { renderAsync } = await import('docx-preview');

        if (cancelled) return;

        await renderAsync(blob, container, undefined, {
          className: 'docx',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: false,
        });

        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('[MeetingDocxViewer] Render error:', err);
          setError((err as Error)?.message || 'Không thể hiển thị file Word này');
          setLoading(false);
        }
      }
    };

    renderDocx();
    return () => { cancelled = true; };
  }, [fileUrl]);

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
      {/* Toolbar — thiết kế giống MeetingPdfViewer */}
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

        {/* Nút tải xuống */}
        <a href={fileUrl} download={fileName} style={{ textDecoration: 'none' }}>
          <button
            type="button"
            title="Tải xuống"
            aria-label="Tải xuống"
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
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <DownloadOutlined style={{ fontSize: 13 }} />
            Tải xuống
          </button>
        </a>

        <Button
          type="text"
          icon={<CloseOutlined />}
          onClick={onClose}
          aria-label="Đóng"
          style={{ color: '#e2e8f0', flexShrink: 0 }}
        />
      </div>

      {/* Nội dung viewer */}
      <div
        style={{
          flex: '1 1 0%',
          minHeight: 0,
          position: 'relative',
          width: '100%',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'auto',
            background: '#e8eaed',
            padding: loading || error ? 0 : '24px 0',
          }}
        >
          {/* Loading state */}
          {loading && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                gap: 12,
                color: '#64748b',
              }}
            >
              <LoadingOutlined style={{ fontSize: 32, color: '#3b82f6' }} spin />
              <span style={{ fontSize: 14, fontWeight: 500 }}>Đang dựng tài liệu Word...</span>
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                gap: 12,
                padding: 24,
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: 32 }}>⚠️</span>
              <p style={{ color: '#f87171', fontWeight: 600, margin: 0 }}>
                Không thể hiển thị tài liệu
              </p>
              <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{error}</p>
              <a
                href={fileUrl}
                download={fileName}
                style={{
                  marginTop: 8,
                  color: '#93c5fd',
                  fontSize: 14,
                  textDecoration: 'underline',
                }}
              >
                Tải xuống để xem trực tiếp
              </a>
            </div>
          )}

          {/* docx-preview sẽ inject HTML vào đây */}
          <div
            ref={containerRef}
            style={{
              display: loading || error ? 'none' : 'block',
              // CSS tương tự test.html: căn giữa, trang A4 có shadow
            }}
          />

          {/* CSS inline cho docx-preview — inject style giống test.html */}
          <style>{`
            .docx-wrapper {
              background: transparent !important;
              padding: 0 !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
            }
            .docx-wrapper > section.docx {
              box-shadow: 0 10px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.15) !important;
              border-radius: 8px !important;
              margin-bottom: 20px !important;
              background: white !important;
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}
