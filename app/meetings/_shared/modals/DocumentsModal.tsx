import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Modal, Input, Button, Table, Space, Typography, Tag, Popconfirm, Spin, App, Empty } from 'antd';
import {
  UploadOutlined, SearchOutlined, EyeOutlined, EyeInvisibleOutlined,
  DownloadOutlined, DeleteOutlined, FileWordOutlined, FilePdfOutlined
} from '@ant-design/icons';
import dynamic from 'next/dynamic';
import dayjs from 'dayjs';
import { meetingApi } from '@/services/api';
import type { MeetingListItem, MeetingDocumentDto } from '@/dtos/meeting.dto';
import { isHostForMeeting } from '../helpers';

const MeetingPdfViewer = dynamic(() => import('@/components/meeting/MeetingPdfViewer'), { ssr: false });
const MeetingDocxViewer = dynamic(() => import('@/components/meeting/MeetingDocxViewer'), { ssr: false });

interface DocumentsModalProps {
  meeting: MeetingListItem | null;
  onClose: () => void;
  user: any;
}

export function DocumentsModal({ meeting, onClose, user }: DocumentsModalProps) {
  const { message } = App.useApp();
  const [documents, setDocuments] = useState<MeetingDocumentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [visibilityUpdatingId, setVisibilityUpdatingId] = useState<string | null>(null);
  
  const [searchText, setSearchText] = useState('');
  const [activeDocument, setActiveDocument] = useState<MeetingDocumentDto | null>(null);
  const [activeDocumentUrl, setActiveDocumentUrl] = useState<string | null>(null);
  const [activeDocumentLoading, setActiveDocumentLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(true);
  
  const docFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (meeting) {
      loadDocuments();
      setPreviewVisible(false);
    } else {
      setDocuments([]);
      setActiveDocument(null);
      if (activeDocumentUrl) URL.revokeObjectURL(activeDocumentUrl);
      setActiveDocumentUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting]);

  const loadDocuments = async () => {
    if (!meeting) return;
    setLoading(true);
    const res = await meetingApi.listMeetingDocuments(meeting.id);
    setLoading(false);
    if (res.error || !res.data) {
      message.error(res.error || 'Không tải được danh sách tài liệu');
      setDocuments([]);
      setActiveDocument(null);
      return;
    }
    setDocuments(res.data);
    if (activeDocument) {
      const stillExists = res.data.find(d => d.id === activeDocument.id);
      if (stillExists) {
        setActiveDocument(stillExists);
      } else {
        setActiveDocument(null);
        setPreviewVisible(false);
      }
    }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !meeting) return;
    e.target.value = '';
    setUploading(true);
    try {
      const res = await meetingApi.uploadMeetingDocument(meeting.id, file);
      if ('error' in res && res.error) {
        message.error(res.error);
        return;
      }
      await loadDocuments();
      message.success('Đã tải lên tài liệu');
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (doc: MeetingDocumentDto) => {
    if (!meeting) return;
    setDeletingId(doc.id);
    try {
      const res = await meetingApi.deleteMeetingDocument(meeting.id, doc.id);
      if (res.error) {
        message.error(res.error);
        return;
      }
      await loadDocuments();
      message.success('Đã xóa tài liệu');
    } finally {
      setDeletingId(null);
    }
  };

  const onDownload = async (doc: MeetingDocumentDto) => {
    if (!meeting) return;
    try {
      const blob = await meetingApi.getMeetingDocumentFileBlob(meeting.id, doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      message.error((err as Error)?.message || 'Không tải được tài liệu');
    }
  };

  const loadPreview = async (doc: MeetingDocumentDto) => {
    if (!meeting) return;
    setActiveDocumentLoading(true);
    try {
      const blob = await meetingApi.getMeetingDocumentFileBlob(meeting.id, doc.id);
      const url = URL.createObjectURL(blob);
      setActiveDocumentUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err) {
      message.error((err as Error)?.message || 'Không mở được tài liệu');
    } finally {
      setActiveDocumentLoading(false);
    }
  };

  const onView = async (doc: MeetingDocumentDto) => {
    if (activeDocument?.id === doc.id && previewVisible) {
      setPreviewVisible(false);
      return;
    }
    setActiveDocument(doc);
    setPreviewVisible(true);
    await loadPreview(doc);
  };

  const onToggleVisibility = async (doc: MeetingDocumentDto) => {
    if (!meeting) return;
    setVisibilityUpdatingId(doc.id);
    try {
      const res = await meetingApi.updateMeetingDocumentVisibility(meeting.id, doc.id, !doc.isShared);
      if (res.error || !res.data) {
        message.error(res.error || 'Lỗi cập nhật trạng thái');
        return;
      }
      setDocuments(prev => prev.map(d => d.id === doc.id ? res.data! : d));
      if (activeDocument?.id === doc.id) setActiveDocument(res.data);
    } finally {
      setVisibilityUpdatingId(null);
    }
  };

  const filteredDocs = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const sorted = [...documents].sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf());
    if (!q) return sorted;
    return sorted.filter(d => 
      (d.fileName || '').toLowerCase().includes(q) || 
      (d.uploaderName || '').toLowerCase().includes(q)
    );
  }, [documents, searchText]);

  const isHost = meeting ? isHostForMeeting(meeting, user) : false;

  const isWordFile = (fileName: string) => /\.(doc|docx)$/i.test(fileName);
  const isPdfFile = (fileName: string) => /\.pdf$/i.test(fileName);

  const getFileIcon = (fileName: string) => {
    if (isWordFile(fileName)) return <FileWordOutlined style={{ color: '#1890ff' }} />;
    if (isPdfFile(fileName)) return <FilePdfOutlined style={{ color: '#ff4d4f' }} />;
    return null;
  };

  return (
    <Modal
      title={
        <Space direction="vertical" size={2}>
          <Typography.Text style={{ fontSize: 16 }}>Tài liệu cuộc họp</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 'normal' }}>
            {meeting?.title}
          </Typography.Text>
        </Space>
      }
      open={!!meeting}
      onCancel={onClose}
      footer={null}
      width={1000}
      styles={{ body: { padding: 0 } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '70vh', minHeight: 500 }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Input 
            placeholder="Tìm tài liệu..." 
            prefix={<SearchOutlined />} 
            value={searchText} 
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 250 }} 
          />
          <Button type="primary" icon={<UploadOutlined />} onClick={() => docFileInputRef.current?.click()} loading={uploading}>
            Tải lên tài liệu
          </Button>
          <input type="file" ref={docFileInputRef} style={{ display: 'none' }} onChange={onUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" />
        </div>
        
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: previewVisible ? '0 0 400px' : '1', display: 'flex', flexDirection: 'column', borderRight: previewVisible ? '1px solid #f0f0f0' : 'none' }}>
            <Table
              dataSource={filteredDocs}
              loading={loading}
              rowKey="id"
              pagination={false}
              scroll={{ y: 'calc(70vh - 120px)' }}
              size="small"
              columns={[
                { title: 'Tên file', dataIndex: 'fileName', render: (val, r) => (
                    <Space direction="vertical" size={0}>
                      <Space size={4}>
                        {getFileIcon(val)}
                        <Typography.Text style={{ fontWeight: 500 }}>{val}</Typography.Text>
                      </Space>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {r.uploaderName} • {dayjs(r.createdAt).format('DD/MM/YYYY HH:mm')}
                      </Typography.Text>
                    </Space>
                  )
                },
                { title: 'Trạng thái', width: 100, render: (_, r) => 
                  r.isShared ? <Tag color="green">Đã chia sẻ</Tag> : <Tag color="default">Riêng tư</Tag> 
                },
                { title: 'Thao tác', width: 140, align: 'right', render: (_, r) => {
                    const canEdit = isHost || r.uploaderUserId === user?.id;
                    const isActive = activeDocument?.id === r.id && previewVisible;
                    return (
                      <Space size={4}>
                        {canEdit && (
                          <Button size="small" type="text" onClick={() => onToggleVisibility(r)} loading={visibilityUpdatingId === r.id}
                            icon={r.isShared ? <EyeInvisibleOutlined /> : <EyeOutlined />} />
                        )}
                        <Button size="small" type={isActive ? 'primary' : 'text'} onClick={() => onView(r)}>Xem</Button>
                        <Button size="small" type="text" icon={<DownloadOutlined />} onClick={() => onDownload(r)} />
                        {canEdit && (
                          <Popconfirm title="Xóa tài liệu?" onConfirm={() => onDelete(r)}>
                            <Button size="small" type="text" danger icon={<DeleteOutlined />} loading={deletingId === r.id} />
                          </Popconfirm>
                        )}
                      </Space>
                    );
                  }
                }
              ]}
            />
          </div>

          {previewVisible && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              {activeDocumentLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Spin tip="Đang tải file..." />
                </div>
              ) : activeDocumentUrl ? (
                isWordFile(activeDocument?.fileName || '') ? (
                  <MeetingDocxViewer fileUrl={activeDocumentUrl} fileName={activeDocument?.fileName || ''} onClose={() => setPreviewVisible(false)} />
                ) : isPdfFile(activeDocument?.fileName || '') ? (
                  <MeetingPdfViewer fileUrl={activeDocumentUrl} fileName={activeDocument?.fileName || ''} onClose={() => setPreviewVisible(false)} />
                ) : (
                  <div style={{ padding: 24, color: '#64748b' }}>
                    Định dạng file không hỗ trợ xem trực tiếp.{' '}
                    <a href={activeDocumentUrl} download={activeDocument?.fileName} style={{ color: '#1890ff' }}>Tải xuống</a>
                  </div>
                )
              ) : (
                <Empty description="Chọn tài liệu để xem" style={{ marginTop: '20%' }} />
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
