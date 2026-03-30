'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { Button, Popconfirm, Space, Tag, Typography, message } from 'antd';
import { CloseOutlined, DeleteOutlined, FileTextOutlined, EyeOutlined, UploadOutlined } from '@ant-design/icons';
import { meetingApi } from '@/services/meeting/meetingApi';

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
}: {
  documentsOpen: boolean;
  meetingId: string;
  canUpload: boolean;
  onClose: () => void;
}) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<any | null>(null);
  const [activeObjectUrl, setActiveObjectUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Overlay viewer (hiển thị PDF/ảnh "chiếm" phần nội dung chính giống demo)
  const [controlBarHeight, setControlBarHeight] = useState<number>(80);
  const [mainAreaRightPx, setMainAreaRightPx] = useState<number>(0);
  const [overlayLeftPx, setOverlayLeftPx] = useState<number>(0);
  const [overlayTopPx, setOverlayTopPx] = useState<number>(0);
  const [overlayBottomPx, setOverlayBottomPx] = useState<number>(80);

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
      setActiveDoc(null);
      setActiveObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    void fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentsOpen, meetingId]);

  useEffect(() => {
    if (!documentsOpen || !activeDoc) return;

    const measure = () => {
      const shell = document.querySelector('.meeting-room-shell') as HTMLElement | null;
      if (!shell) return;

      const shellRect = shell.getBoundingClientRect();

      const bar = shell.querySelector('.lk-control-bar') as HTMLElement | null;
      const h = bar ? Math.ceil(bar.getBoundingClientRect().height) : 80;
      setControlBarHeight(h);

      const focus = shell.querySelector('.lk-focus-layout-wrapper') as HTMLElement | null;
      const grid = shell.querySelector('.lk-grid-layout-wrapper') as HTMLElement | null;
      const target = focus ?? grid;

      const barTopY = bar ? bar.getBoundingClientRect().top : window.innerHeight - h;

      // Default overlay bounds
      let overlayLeft = shellRect.left;
      let overlayTop = shellRect.top;
      let overlayBottomEdgeY = barTopY; // cap at control bar top to keep buttons clickable

      if (target) {
        const t = target.getBoundingClientRect();
        overlayTop = t.top;
        overlayBottomEdgeY = Math.min(t.bottom, barTopY);

        // If focus layout has a left participant rail, keep it visible:
        // compute the right-most boundary of participant tiles on the left half.
        const tiles = Array.from(target.querySelectorAll<HTMLElement>('.lk-participant-tile'));
        if (tiles.length > 0) {
          const midX = t.left + t.width / 2;
          let maxRight = t.left;
          for (const tile of tiles) {
            const r = tile.getBoundingClientRect();
            const centerX = (r.left + r.right) / 2;
            if (centerX < midX) maxRight = Math.max(maxRight, r.right);
          }

          // Clamp so we don't shrink too aggressively if selector catches tiles on stage.
          const clampMax = t.left + t.width * 0.45;
          overlayLeft = Math.min(maxRight, clampMax);
          overlayLeft = Math.max(overlayLeft, t.left); // ensure within target
        } else {
          overlayLeft = t.left;
        }
      }

      setOverlayLeftPx(overlayLeft);
      setOverlayTopPx(overlayTop);
      setOverlayBottomPx(Math.max(0, Math.round(window.innerHeight - overlayBottomEdgeY)));

      // meeting-side-stack nằm bên phải, overlay sẽ chỉ chiếm phần bên trái của nó.
      const sideStack = shell.querySelector('.meeting-side-stack') as HTMLElement | null;
      if (!sideStack) {
        setMainAreaRightPx(window.innerWidth);
        return;
      }
      const r = sideStack.getBoundingClientRect();
      setMainAreaRightPx(Math.max(0, window.innerWidth - r.left));
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
  }, [documentsOpen, activeDoc]);

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

  const viewer = useMemo(() => {
    if (!activeDoc || !activeObjectUrl) return null;

    if (activeDoc.contentType.startsWith('image/')) {
      return <img src={activeObjectUrl} alt={activeDoc.fileName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
    }

    if (activeDoc.contentType === 'application/pdf') {
      return <iframe src={activeObjectUrl} title={activeDoc.fileName} style={{ width: '100%', height: '100%', border: 0, background: '#fff' }} />;
    }

    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Text type="secondary">Trình duyệt không hỗ trợ xem trực tiếp định dạng này.</Text>
        <div style={{ marginTop: 12 }}>
          <a href={activeObjectUrl} download={activeDoc.fileName}>
            Tải xuống: {activeDoc.fileName}
          </a>
        </div>
      </div>
    );
  }, [activeDoc, activeObjectUrl]);

  return (
    <>
      {activeDoc && viewer && (
        <div
          style={{
            position: 'fixed',
            top: overlayTopPx,
            left: overlayLeftPx,
            right: mainAreaRightPx,
            bottom: overlayBottomPx,
            zIndex: 4, // meeting-side-stack z-index: 5, nên panel vẫn nằm trên viewer
            background: '#ffffff',
            overflow: 'auto',
          }}
        >
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Button
              icon={<CloseOutlined />}
              onClick={() => setActiveDoc(null)}
              style={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}
            />
            <div style={{ width: '100%', height: '100%' }}>{viewer}</div>
          </div>
        </div>
      )}

      <aside className="meeting-documents-panel">
        <div className="meeting-documents-header">
          <Space>
            <FileTextOutlined />
            <Text style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Tài liệu</Text>
            {activeDoc ? <Tag color="blue">{activeDoc.fileName}</Tag> : null}
          </Space>

          <Button icon={<CloseOutlined />} onClick={onClose} />
        </div>

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

