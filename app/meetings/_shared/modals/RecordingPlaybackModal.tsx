import React from 'react';
import { Modal } from 'antd';

interface RecordingPlaybackModalProps {
  open: boolean;
  onClose: () => void;
  url: string | null;
  title: string;
}

export function RecordingPlaybackModal({ open, onClose, url, title }: RecordingPlaybackModalProps) {
  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnClose
    >
      {url ? (
        <video controls style={{ width: '100%', borderRadius: 8, outline: 'none' }} autoPlay>
          <source src={url} type="video/webm" />
          <source src={url} type="video/mp4" />
          Trình duyệt của bạn không hỗ trợ thẻ video.
        </video>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          Đang tải dữ liệu bản ghi...
        </div>
      )}
    </Modal>
  );
}
