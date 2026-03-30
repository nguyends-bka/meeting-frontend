'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { Button, Modal, Space, Tag, Typography, message } from 'antd';
import { FileTextOutlined, UploadOutlined, EyeOutlined } from '@ant-design/icons';
import type { MeetingDocumentDto } from '@/dtos/meeting.dto';
import { meetingApi } from '@/services/meeting/meetingApi';

const { Title, Text } = Typography;

function getDocIcon(contentType: string) {
  if (contentType.startsWith('image/')) return <span style={{ fontSize: 18 }}>🖼️</span>;
  if (contentType === 'application/pdf') return <span style={{ fontSize: 18 }}>📄</span>;
  return <span style={{ fontSize: 18 }}>📎</span>;
}

export default function MeetingDocumentsModal({
  open,
  onCancel,
  meetingId,
  canUpload,
}: {
  open: boolean;
  onCancel: () => void;
  meetingId: string;
  canUpload: boolean;
}) {
  const [docs, setDocs] = useState<MeetingDocumentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeDoc, setActiveDoc] = useState<MeetingDocumentDto | null>(null);
  const [activeObjectUrl, setActiveObjectUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    if (!activeDoc) return;
    let cancelled = false;
    setActiveObjectUrl(null);

    const run = async () => {
      try {
        const blob = await meetingApi.getMeetingDocumentFileBlob(meetingId, activeDoc.id);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setActiveObjectUrl(url);
      } catch (e) {
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

  const viewNode = useMemo(() => {
    if (!activeDoc || !activeObjectUrl) return null;
    if (activeDoc.contentType.startsWith('image/')) {
      return (
        <img
          src={activeObjectUrl}
          alt={activeDoc.fileName}
          style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
        />
      );
    }
    if (activeDoc.contentType === 'application/pdf') {
      return <iframe src={activeObjectUrl} title={activeDoc.fileName} style={{ width: '100%', height: '70vh' }} />;
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
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      title={
        <Space>
          <FileTextOutlined />
          <Title level={4} style={{ margin: 0 }}>
            Tài liệu cuộc họp
          </Title>
        </Space>
      }
      width={980}
      destroyOnHidden
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16 }}>
        <div>
          <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
            <Text type="secondary">Danh sách tài liệu ({docs.length})</Text>
            {canUpload && (
              <Space>
                <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={onUploadFile} />
                <Button icon={<UploadOutlined />} onClick={onPickFile} loading={uploading}>
                  Tải tài liệu lên
                </Button>
              </Space>
            )}
          </Space>

          <div style={{ border: '1px solid #f0f0f0', borderRadius: 12, padding: 8, maxHeight: '70vh', overflow: 'auto' }}>
            {loading ? (
              <Text>Đang tải...</Text>
            ) : docs.length === 0 ? (
              <Text type="secondary">Chưa có tài liệu nào.</Text>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {docs.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      border: activeDoc?.id === d.id ? '1px solid #1677ff' : '1px solid #f0f0f0',
                      borderRadius: 10,
                      padding: 10,
                      background: activeDoc?.id === d.id ? 'rgba(22,119,255,0.06)' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {getDocIcon(d.contentType)}
                          <Text strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {d.fileName}
                          </Text>
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {d.uploaderName} • {dayjs(d.createdAt).format('HH:mm, DD/MM/YYYY')}
                          </Text>
                        </div>
                      </div>

                      <Space>
                        <Button
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={() => setActiveDoc(d)}
                        >
                          Mở
                        </Button>
                      </Space>
                    </div>
                    {canUpload && activeDoc?.id === d.id && (
                      <div style={{ marginTop: 8 }}>
                        <Tag color="blue">Bạn đã chọn</Tag>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div style={{ border: '1px solid #f0f0f0', borderRadius: 12, padding: 12 }}>
            {!activeDoc ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <Text type="secondary">Chọn tài liệu để xem.</Text>
              </div>
            ) : (
              <div>
                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <Title level={5} style={{ margin: 0 }}>
                      {activeDoc.fileName}
                    </Title>
                    <Text type="secondary">({activeDoc.contentType})</Text>
                  </div>
                </Space>
                {viewNode}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

