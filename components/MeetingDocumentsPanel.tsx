'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import dayjs from 'dayjs';
import { Button, Popconfirm, Space, Tag, Typography, message } from 'antd';
import { CloseOutlined, DeleteOutlined, FileTextOutlined, EyeOutlined, UploadOutlined } from '@ant-design/icons';
import { meetingApi } from '@/services/meeting/meetingApi';

const MeetingPdfViewer = dynamic(() => import('@/components/MeetingPdfViewer'), { ssr: false });

const { Text } = Typography;

function getDocIcon(contentType: string) {
  if (contentType.startsWith('image/')) return <span style={{ fontSize: 18 }}>🖼️</span>;
  if (contentType === 'application/pdf') return <span style={{ fontSize: 18 }}>📄</span>;
  return <span style={{ fontSize: 18 }}>📎</span>;
}

export default function MeetingDocumentsPanel({
  documentsOpen,
  meetingId,
  canUpload,
  onClose,
  embedded = false,
}: {
  documentsOpen: boolean;
  meetingId: string;
  canUpload: boolean;
  onClose: () => void;
  /** Ẩn header riêng — dùng trong panel tab thống nhất */
  embedded?: boolean;
}) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<any | null>(null);
  const [activeObjectUrl, setActiveObjectUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Overlay viewer (hiển thị PDF/ảnh "chiếm" phần nội dung chính giống demo)
  const [overlayLeftPx, setOverlayLeftPx] = useState<number>(0);
  const [overlayWidthPx, setOverlayWidthPx] = useState<number>(0);
  const [overlayTopPx, setOverlayTopPx] = useState<number>(0);
  const [overlayHeightPx, setOverlayHeightPx] = useState<number>(0);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await meetingApi.listMeetingDocuments(meetingId);
      if (res.error) {
        message.error(res.error);
        setDocs([]);
        return;
      }
      setDocs(res.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!documentsOpen) {
      return;
    }

    void fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentsOpen, meetingId]);

  useEffect(() => {
    if (!activeDoc) return;

    const measure = () => {
      const shell = document.querySelector('.meeting-room-shell') as HTMLElement | null;
      if (!shell) return;

      const shellRect = shell.getBoundingClientRect();

      const bar = shell.querySelector('.lk-control-bar') as HTMLElement | null;
      const h = bar ? Math.ceil(bar.getBoundingClientRect().height) : 80;

      const focus = shell.querySelector('.lk-focus-layout-wrapper') as HTMLElement | null;
      const grid = shell.querySelector('.lk-grid-layout-wrapper') as HTMLElement | null;
      const target = focus ?? grid;

      const barTopY = bar ? bar.getBoundingClientRect().top : window.innerHeight - h;

      // Default overlay bounds (full shell)
      let overlayLeft = shellRect.left;
      let overlayRight = shellRect.right;
      let overlayTop = shellRect.top;
      let overlayBottomEdgeY = barTopY;

      // Side stack: đo trước để dùng cho cả ngang lẫn dọc.
      const sideStack = shell.querySelector('.meeting-side-stack') as HTMLElement | null;
      const stackDisplayed =
        sideStack &&
        getComputedStyle(sideStack).display !== 'none' &&
        getComputedStyle(sideStack).visibility !== 'hidden';
      const ss = (stackDisplayed && sideStack) ? sideStack.getBoundingClientRect() : null;

      // Ngang: mép phải overlay = mép trái side panel (không đè lên panel công cụ).
      const vcInner = shell.querySelector('.lk-video-conference-inner') as HTMLElement | null;
      if (vcInner) {
        const ir = vcInner.getBoundingClientRect();
        overlayLeft = ir.left;
        overlayRight = ss ? ss.left : ir.right;
      } else if (target) {
        const t = target.getBoundingClientRect();
        overlayLeft = t.left;
        overlayRight = ss ? ss.left : t.right;
      } else if (ss) {
        overlayRight = ss.left;
      }

      // Dọc: top & bottom khớp chính xác với side panel → thẳng hàng với panel công cụ bên phải.
      if (ss) {
        overlayTop = ss.top;
        overlayBottomEdgeY = ss.bottom;
      } else if (target) {
        const t = target.getBoundingClientRect();
        overlayTop = t.top;
        overlayBottomEdgeY = barTopY;
      }

      overlayBottomEdgeY = Math.min(overlayBottomEdgeY, window.innerHeight);

      const width = Math.max(0, Math.round(overlayRight - overlayLeft));
      const height = Math.max(0, Math.round(overlayBottomEdgeY - overlayTop));
      setOverlayLeftPx(Math.round(overlayLeft));
      setOverlayWidthPx(width);
      setOverlayTopPx(Math.round(overlayTop));
      setOverlayHeightPx(height);

    };

    measure();
    window.addEventListener('resize', measure);
    // Layout có thể đổi kích thước theo data-meeting-layout mà không bắn resize.
    const shellEl = document.querySelector('.meeting-room-shell') as HTMLElement | null;
    const observer = shellEl
      ? new MutationObserver(() => {
          measure();
        })
      : null;

    if (observer && shellEl) {
      observer.observe(shellEl, { attributes: true, attributeFilter: ['data-meeting-layout'] });
    }

    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [activeDoc]);

  useEffect(() => {
    if (!activeDoc) {
      setActiveObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const blob = await meetingApi.getMeetingDocumentFileBlob(meetingId, activeDoc.id);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setActiveObjectUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch {
        message.error('Không thể tải file tài liệu');
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [activeDoc, meetingId]);

  const onPickFile = () => fileInputRef.current?.click();

  const onUploadFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploading(true);
    try {
      const res = await meetingApi.uploadMeetingDocument(meetingId, file);
      if ('error' in res && res.error) {
        message.error(res.error);
        return;
      }

      message.success('Đã lưu tài liệu');
      setActiveDoc(null);
      await fetchDocs();
    } finally {
      setUploading(false);
    }
  };

  const onDeleteDoc = async (doc: any) => {
    if (!canUpload) return;
    setDeletingId(doc.id);
    try {
      const res = await meetingApi.deleteMeetingDocument(meetingId, doc.id);
      if (res.error) {
        message.error(res.error);
        return;
      }

      message.success((res.data as any)?.message ?? 'Đã xóa tài liệu');
      if (activeDoc?.id === doc.id) setActiveDoc(null);
      await fetchDocs();
    } finally {
      setDeletingId(null);
    }
  };

  const documentOverlay =
    activeDoc && activeObjectUrl ? (
      <div
        style={{
          position: 'fixed',
          top: overlayTopPx,
          left: overlayLeftPx,
          width: overlayWidthPx,
          height: overlayHeightPx,
          zIndex: 20,
          background: '#0b1220',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            flex: '1 1 0%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {activeDoc.contentType === 'application/pdf' ? (
            <MeetingPdfViewer
              fileUrl={activeObjectUrl}
              fileName={activeDoc.fileName}
              onClose={() => setActiveDoc(null)}
            />
          ) : (
            <>
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 12px 0 16px',
                  minHeight: 48,
                  background: 'rgba(15, 23, 42, 0.95)',
                  borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
                }}
              >
                <Text style={{ color: '#e2e8f0', fontWeight: 600 }} ellipsis>
                  {activeDoc.fileName}
                </Text>
                <Button
                  icon={<CloseOutlined />}
                  onClick={() => setActiveDoc(null)}
                  type="text"
                  style={{ color: '#e2e8f0' }}
                />
              </div>
              <div
                style={{
                  width: '100%',
                  flex: 1,
                  minHeight: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {activeDoc.contentType.startsWith('image/') ? (
                  <img
                    src={activeObjectUrl}
                    alt={activeDoc.fileName}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Text type="secondary">Trình duyệt không hỗ trợ xem trực tiếp định dạng này.</Text>
                    <div style={{ marginTop: 12 }}>
                      <a href={activeObjectUrl} download={activeDoc.fileName}>
                        Tải xuống: {activeDoc.fileName}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    ) : null;

  return (
    <>
      {typeof document !== 'undefined' && documentOverlay
        ? createPortal(documentOverlay, document.body)
        : null}

      <aside
        className={`meeting-documents-panel${embedded ? ' meeting-documents-panel--embedded' : ''}`}
      >
        {!embedded && (
          <div className="meeting-documents-header">
            <Space>
              <FileTextOutlined />
              <Text style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Tài liệu</Text>
              {activeDoc ? <Tag color="blue">{activeDoc.fileName}</Tag> : null}
            </Space>

            <Button icon={<CloseOutlined />} onClick={onClose} />
          </div>
        )}

        <div className="meeting-documents-content">
          {canUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                onChange={onUploadFile}
              />
              <Button
                icon={<UploadOutlined />}
                onClick={onPickFile}
                loading={uploading}
                type="primary"
                style={{ width: '100%', marginBottom: 12 }}
              >
                Tải tài liệu lên
              </Button>
              <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
                Hỗ trợ PDF, Ảnh, Word, Excel (Tối đa 100MB)
              </Text>
            </>
          )}

          <div style={{ marginTop: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontWeight: 700, color: '#111827' }}>Danh sách</Text>
            <Tag color="blue">{docs.length}</Tag>
          </div>

          <div className="meeting-documents-list">
            {loading ? (
              <Text type="secondary">Đang tải...</Text>
            ) : docs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 16 }}>
                <div style={{ fontSize: 32, opacity: 0.3 }}>📄</div>
                <div>Chưa có tài liệu nào.</div>
              </div>
            ) : (
              (docs as any[]).map((doc: any) => (
                <div
                  key={String(doc.id)}
                  className={`meeting-documents-item${activeDoc?.id === doc.id ? ' is-active' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ marginTop: 2 }}>{getDocIcon(doc.contentType)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={{
                          fontWeight: 700,
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {doc.fileName}
                      </Text>
                      <div style={{ marginTop: 6, color: '#6b7280', fontSize: 12 }}>
                        {doc.uploaderName} • {dayjs(doc.createdAt).format('HH:mm, DD/MM/YYYY')}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => setActiveDoc(doc)}
                      style={{ flex: 1 }}
                    >
                      {activeDoc?.id === doc.id ? 'Đang xem' : 'Mở xem'}
                    </Button>

                    {canUpload && (
                      <Popconfirm
                        title="Xóa tài liệu này?"
                        okText="Xóa"
                        cancelText="Hủy"
                        onConfirm={() => void onDeleteDoc(doc)}
                      >
                        <Button
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          loading={deletingId === doc.id}
                          style={{ width: 44 }}
                        />
                      </Popconfirm>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </>
  );
}