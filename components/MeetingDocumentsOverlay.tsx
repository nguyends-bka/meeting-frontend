'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { Button, Popconfirm, Space, Tag, Typography, message } from 'antd';
import { CloseOutlined, DeleteOutlined, FileTextOutlined, EyeOutlined, UploadOutlined } from '@ant-design/icons';
import type { MeetingDocumentDto } from '@/dtos/meeting.dto';
import { meetingApi } from '@/services/meeting/meetingApi';

const { Text } = Typography;

function getDocIcon(contentType: string) {
  if (contentType.startsWith('image/')) return <span style={{ fontSize: 18 }}>🖼️</span>;
  if (contentType === 'application/pdf') return <span style={{ fontSize: 18 }}>📄</span>;
  return <span style={{ fontSize: 18 }}>📎</span>;
}

export default function MeetingDocumentsOverlay({
  open,
  onClose,
  meetingId,
  canUpload,
}: {
  open: boolean;
  onClose: () => void;
  meetingId: string;
  canUpload: boolean;
}) {
  const [docs, setDocs] = useState<MeetingDocumentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<MeetingDocumentDto | null>(null);
  const [activeObjectUrl, setActiveObjectUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Tránh overlay che mất control bar ở dưới (mute/camera/leave…)
  const [controlBarHeight, setControlBarHeight] = useState<number>(80);

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
    if (!open) return;
    void fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meetingId]);

  useEffect(() => {
    if (activeDoc == null) {
      setActiveObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    let cancelled = false;
    setActiveObjectUrl(null);

    const run = async () => {
      try {
        const blob = await meetingApi.getMeetingDocumentFileBlob(meetingId, activeDoc.id);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setActiveObjectUrl(url);
      } catch {
        if (!cancelled) message.error('Không thể tải file tài liệu');
      }
    };

    void run();
    return () => {
      cancelled = true;
      setActiveObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [activeDoc, meetingId]);

  const viewNode = useMemo(() => {
    if (!activeDoc || !activeObjectUrl) return null;

    if (activeDoc.contentType.startsWith('image/')) {
      return (
        <img
          src={activeObjectUrl}
          alt={activeDoc.fileName}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      );
    }

    if (activeDoc.contentType === 'application/pdf') {
      return (
        <iframe
          src={activeObjectUrl}
          title={activeDoc.fileName}
          style={{
            width: '100%',
            height: '100%',
            border: 0,
            background: '#ffffff',
          }}
        />
      );
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
      await fetchDocs();
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setActiveDoc(null);
      setActiveObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
    // Khi mở panel mới, luôn bắt đầu ở trạng thái "chưa xem" để
    // phần cuộc họp (video) vẫn hiển thị như yêu cầu.
    if (open) {
      setActiveDoc(null);
      setActiveObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const update = () => {
      const el = document.querySelector('.meeting-room-shell .lk-control-bar') as HTMLElement | null;
      if (!el) return;
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) setControlBarHeight(h);
    };

    update();
    window.addEventListener('resize', update);
    const t = window.setTimeout(update, 250);
    return () => {
      window.removeEventListener('resize', update);
      window.clearTimeout(t);
    };
  }, [open]);

  const clearActiveDoc = () => {
    setActiveObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setActiveDoc(null);
  };

  const onDeleteDoc = async (doc: MeetingDocumentDto) => {
    if (!canUpload) return;
    setDeletingId(doc.id);
    try {
      const res = await meetingApi.deleteMeetingDocument(meetingId, doc.id);
      if (res.error) {
        message.error(res.error);
        return;
      }

      message.success((res.data as any)?.message ?? 'Đã xóa tài liệu');
      if (activeDoc?.id === doc.id) clearActiveDoc();
      await fetchDocs();
    } finally {
      setDeletingId(null);
    }
  };

  if (!open) return null;

  const sidebar = (
    <div
      style={{
        width: 360,
        background: '#111827',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 320,
        height: '100%',
      }}
    >
      <div style={{ padding: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Space>
            <FileTextOutlined />
            <Text style={{ color: 'white', fontWeight: 600 }}>Tài liệu</Text>
            {activeDoc && <Tag color="blue">{activeDoc.fileName}</Tag>}
          </Space>
          <Button icon={<CloseOutlined />} onClick={onClose} />
        </div>

        {canUpload && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
              onChange={onUploadFile}
            />
            <Button icon={<UploadOutlined />} onClick={onPickFile} loading={uploading} type="primary" style={{ width: '100%', marginTop: 12 }}>
              Tải tài liệu lên
            </Button>
            <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12, color: '#9ca3af' }}>
              Hỗ trợ PDF, Ảnh, Word, Excel (Tối đa 100MB)
            </Text>
          </>
        )}

        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: 'white', fontWeight: 600 }}>Danh sách</Text>
          <Tag color="blue">{docs.length}</Tag>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 12 }}>
        {loading ? (
          <Text type="secondary">Đang tải...</Text>
        ) : docs.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: 16 }}>
            <div style={{ fontSize: 32, opacity: 0.3 }}>📄</div>
            <div>Chưa có tài liệu nào.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {docs.map((d) => (
              <div
                key={d.id}
                style={{
                  border: activeDoc?.id === d.id ? '1px solid rgba(59,130,246,0.9)' : '1px solid rgba(255,255,255,0.12)',
                  background: activeDoc?.id === d.id ? 'rgba(59,130,246,0.10)' : 'rgba(255,255,255,0.03)',
                  borderRadius: 12,
                  padding: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ marginTop: 2 }}>{getDocIcon(d.contentType)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        color: 'white',
                        fontWeight: 600,
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {d.fileName}
                    </Text>
                    <div style={{ marginTop: 6, color: '#9ca3af', fontSize: 12 }}>
                      {d.uploaderName} • {dayjs(d.createdAt).format('HH:mm, DD/MM/YYYY')}
                    </div>
                  </div>
                  <div>
                    {activeDoc?.id === d.id ? (
                      <Tag color="blue">Đang xem</Tag>
                    ) : (
                      <Tag
                        color="default"
                        style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.18)', color: '#d1d5db' }}
                      >
                        {d.contentType.split('/')[0].toUpperCase()}
                      </Tag>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <Button size="small" icon={<EyeOutlined />} onClick={() => setActiveDoc(d)} style={{ flex: 1 }}>
                    {activeDoc?.id === d.id ? 'Đang mở' : 'Mở xem'}
                  </Button>

                  {canUpload && (
                    <Popconfirm
                      title="Xóa tài liệu này?"
                      okText="Xóa"
                      cancelText="Hủy"
                      onConfirm={() => void onDeleteDoc(d)}
                    >
                      <Button
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        loading={deletingId === d.id}
                        style={{ width: 44 }}
                      />
                    </Popconfirm>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Trạng thái "bạn vừa bấm Tài liệu, nhưng chưa xem file":
  // chỉ hiển thị sidebar bên phải, không che phần video/cuộc họp.
  if (!activeDoc) {
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: controlBarHeight,
          zIndex: 6,
        }}
      >
        {sidebar}
      </div>
    );
  }

  // Trạng thái "đã chọn file để xem": hiển thị vùng xem ở phần còn lại.
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: controlBarHeight,
        zIndex: 6,
        background: 'transparent',
        display: 'flex',
        flexDirection: 'row',
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Space>
            <FileTextOutlined />
            <Text style={{ color: 'white', fontWeight: 600 }}>Xem tài liệu</Text>
            {activeDoc && <Tag color="blue">{activeDoc.fileName}</Tag>}
          </Space>
          <Button icon={<CloseOutlined />} onClick={onClose} />
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <div style={{ height: '100%', minHeight: 0, background: '#ffffff' }}>{viewNode}</div>
        </div>
      </div>

      {sidebar}
    </div>
  );
}

