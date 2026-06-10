import React, { useEffect, useState } from 'react';
import { Modal, Button, Spin, Space, Typography, App } from 'antd';
import { CopyOutlined, ReloadOutlined, RobotOutlined, CloseOutlined } from '@ant-design/icons';
import { meetingApi } from '@/services/api';
import type { MeetingListItem } from '@/dtos/meeting.dto';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SummaryReportModalProps {
  meeting: MeetingListItem | null;
  onClose: () => void;
}

export function SummaryReportModal({ meeting, onClose }: SummaryReportModalProps) {
  const { message } = App.useApp();
  const [status, setStatus] = useState<string>('NotGenerated'); // 'NotGenerated', 'Pending', 'Processing', 'Success', 'Failed'
  const [summaryText, setSummaryText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [triggering, setTriggering] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    let timerId: NodeJS.Timeout | null = null;

    const fetchStatus = async (showLoading = false) => {
      if (!meeting) return;
      if (showLoading) setLoading(true);

      const res = await meetingApi.getMinutesSummaryStatus(meeting.id);
      
      if (!active) return;
      if (showLoading) setLoading(false);

      if (res.error) {
        message.error(res.error || 'Không thể lấy trạng thái tóm tắt AI');
        return;
      }

      if (res.data) {
        setStatus(res.data.status);
        setSummaryText(res.data.summaryText || '');
        setErrorMessage(res.data.errorMessage);

        // Nếu trạng thái là Pending hoặc Processing, tiến hành poll tiếp
        if (res.data.status === 'Pending' || res.data.status === 'Processing') {
          timerId = setTimeout(() => fetchStatus(false), 10000); // Poll mỗi 10 giây
        }
      }
    };

    if (meeting) {
      fetchStatus(true);
    } else {
      setStatus('NotGenerated');
      setSummaryText('');
      setErrorMessage(null);
    }

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting]);

  const handleTrigger = async () => {
    if (!meeting) return;
    setTriggering(true);
    const res = await meetingApi.triggerMinutesSummary(meeting.id);
    setTriggering(false);

    if (res.error) {
      message.error(res.error || 'Không thể yêu cầu tóm tắt AI');
      return;
    }

    message.success('Đã gửi yêu cầu tóm tắt AI thành công!');
    setStatus('Processing');
    setSummaryText('');
    setErrorMessage(null);

    // Kích hoạt chu kỳ Polling ngay lập tức
    const pollInterval = setInterval(async () => {
      if (!meeting) {
        clearInterval(pollInterval);
        return;
      }
      const statusRes = await meetingApi.getMinutesSummaryStatus(meeting.id);
      if (statusRes.data) {
        setStatus(statusRes.data.status);
        setSummaryText(statusRes.data.summaryText || '');
        setErrorMessage(statusRes.data.errorMessage);
        if (statusRes.data.status !== 'Pending' && statusRes.data.status !== 'Processing') {
          clearInterval(pollInterval);
        }
      } else {
        clearInterval(pollInterval);
      }
    }, 10000);
  };

  const handleCopy = async () => {
    if (!summaryText) return;
    try {
      await navigator.clipboard.writeText(summaryText);
      message.success('Đã sao chép báo cáo tóm tắt vào bộ nhớ tạm!');
    } catch {
      message.error('Không sao chép được văn bản');
    }
  };

  const getBodyContent = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 250 }}>
          <Spin size="large" />
          <Typography.Text style={{ marginTop: 16, color: '#64748b' }}>Đang tải trạng thái báo cáo...</Typography.Text>
        </div>
      );
    }

    if (status === 'Pending' || status === 'Processing') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 250, textAlign: 'center', padding: '0 24px' }}>
          <Spin size="large" indicator={<RobotOutlined style={{ fontSize: 40, color: '#0284c7' }} spin />} />
          <Typography.Title level={5} style={{ marginTop: 20, marginBottom: 8, color: '#0f172a' }}>
            Đang biên soạn báo cáo tóm tắt bằng AI...
          </Typography.Title>
          <Typography.Text type="secondary" style={{ maxWidth: 450, fontSize: 13 }}>
            Tiến trình này có thể mất vài phút. Bạn hoàn toàn có thể đóng cửa sổ này và tắt trình duyệt, hệ thống vẫn tiếp tục chạy ngầm trên máy chủ. Kết quả sẽ tự động lưu lại khi hoàn thành.
          </Typography.Text>
        </div>
      );
    }

    if (status === 'Failed') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 250, textAlign: 'center', padding: '0 24px' }}>
          <Typography.Title level={5} type="danger" style={{ marginBottom: 8 }}>
            Sinh báo cáo tóm tắt thất bại
          </Typography.Title>
          <Typography.Text type="secondary" style={{ marginBottom: 20, maxWidth: 400, fontSize: 13 }}>
            {errorMessage || 'Đã có lỗi xảy ra trong quá trình LLM xử lý thông tin cuộc họp.'}
          </Typography.Text>
          <Button type="primary" icon={<ReloadOutlined />} onClick={handleTrigger} loading={triggering}>
            Thử lại
          </Button>
        </div>
      );
    }

    if (status === 'Success' && summaryText) {
      return (
        <div className="ai-markdown-content" style={{ background: '#ffffff', padding: '24px 32px', borderRadius: 8, border: '1px solid #e2e8f0', color: '#1e293b' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaryText}</ReactMarkdown>
        </div>
      );
    }

    // Trạng thái mặc định: NotGenerated
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 250, textAlign: 'center', padding: '0 24px' }}>
        <RobotOutlined style={{ fontSize: 48, color: '#94a3b8', marginBottom: 16 }} />
        <Typography.Title level={5} style={{ color: '#475569', marginBottom: 8 }}>
          Chưa có báo cáo tóm tắt AI cho cuộc họp này
        </Typography.Title>
        <Typography.Text type="secondary" style={{ marginBottom: 20, maxWidth: 450, fontSize: 13 }}>
          Khi cuộc họp kết thúc, AI sẽ tự động lập báo cáo. Bạn cũng có thể chủ động kích hoạt biên soạn báo cáo tóm tắt cuộc họp bằng AI ngay bây giờ.
        </Typography.Text>
        <Button type="primary" icon={<RobotOutlined />} onClick={handleTrigger} loading={triggering}>
          Biên soạn bằng AI
        </Button>
      </div>
    );
  };

  return (
    <Modal
      title={
        <Space direction="vertical" size={2}>
          <Typography.Text style={{ fontSize: 16, fontWeight: 600 }}>Báo cáo tóm tắt AI (Summary Report)</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 'normal' }}>
            {meeting?.title}
          </Typography.Text>
        </Space>
      }
      open={!!meeting}
      onCancel={onClose}
      width={850}
      styles={{ body: { padding: '16px 0 0 0' } }}
      footer={[
        status === 'Success' && summaryText && (
          <Button key="copy" icon={<CopyOutlined />} onClick={handleCopy}>
            Sao chép
          </Button>
        ),
        status === 'Success' && summaryText && (
          <Button key="regenerate" icon={<ReloadOutlined />} onClick={handleTrigger} loading={triggering}>
            Biên soạn lại
          </Button>
        ),
        <Button key="close" onClick={onClose} type="primary">
          Đóng
        </Button>,
      ]}
    >
      <div style={{ minHeight: 320, background: '#f8fafc', padding: '16px 20px', borderRadius: 8, maxHeight: '65vh', overflowY: 'auto' }}>
        {getBodyContent()}
      </div>
    </Modal>
  );
}
