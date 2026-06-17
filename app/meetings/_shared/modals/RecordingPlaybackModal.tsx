import React, { useState, useEffect, useRef } from 'react';
import { Modal, Input, List, Typography, Space, Spin } from 'antd';
import { SearchOutlined, UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { meetingApi } from '@/services/api';
import type { MeetingRecordingDto, RoomTranscriptItem } from '@/dtos/meeting.dto';

interface RecordingPlaybackModalProps {
  open: boolean;
  onClose: () => void;
  url: string | null;
  title: string;
  meetingId?: string;
  recording?: MeetingRecordingDto | null;
}

interface TranscriptWithOffset extends RoomTranscriptItem {
  offsetSeconds: number;
}

export function RecordingPlaybackModal({
  open,
  onClose,
  url,
  title,
  meetingId,
  recording
}: RecordingPlaybackModalProps) {
  const [transcripts, setTranscripts] = useState<TranscriptWithOffset[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Fetch room logs (transcript) when open
  useEffect(() => {
    if (!open || !meetingId || !recording) {
      setTranscripts([]);
      setCurrentTime(0);
      setSearchText('');
      return;
    }

    const loadTranscripts = async () => {
      setLoading(true);
      try {
        const res = await meetingApi.getRoomLog(meetingId);
        if (res?.data?.transcriptEntries) {
          const startMs = new Date(recording.startedAtUtc).getTime();
          const endMs = recording.endedAtUtc ? new Date(recording.endedAtUtc).getTime() : Infinity;

          const mapped = res.data.transcriptEntries
            .filter((item: RoomTranscriptItem) => item.at >= startMs && item.at <= endMs)
            .map((item: RoomTranscriptItem) => {
              const words = item.text.trim().split(/\s+/).filter(Boolean).length;
              // Tốc độ nói trung bình khoảng 3 từ/giây (180 từ/phút)
              const durationSeconds = Math.max(1.5, words / 3);
              const endOffset = (item.at - startMs) / 1000;
              const startOffset = Math.max(0, endOffset - durationSeconds - 2.0);

              return {
                ...item,
                offsetSeconds: startOffset,
              };
            })
            .sort((a: TranscriptWithOffset, b: TranscriptWithOffset) => a.offsetSeconds - b.offsetSeconds);

          setTranscripts(mapped);
        }
      } catch (err) {
        console.error('Failed to load transcripts', err);
      } finally {
        setLoading(false);
      }
    };

    loadTranscripts();
  }, [open, meetingId, recording]);

  // Track video current time
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Find active transcript index based on current playback time
  let activeIndex = -1;
  for (let i = 0; i < transcripts.length; i++) {
    if (transcripts[i].offsetSeconds <= currentTime) {
      activeIndex = i;
    } else {
      break;
    }
  }

  // Auto scroll to active transcript item
  useEffect(() => {
    if (activeIndex >= 0 && open) {
      const activeElement = document.getElementById(`transcript-item-${activeIndex}`);
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [activeIndex, open]);

  const handleSeek = (offset: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = offset;
      videoRef.current.play().catch(() => {});
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const filteredTranscripts = transcripts.filter((t) =>
    t.text.toLowerCase().includes(searchText.toLowerCase()) ||
    t.speakerName.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      footer={null}
      width={1100}
      destroyOnClose
      style={{ top: 40 }}
      styles={{ body: { padding: '12px 0 0 0' } }}
    >
      {url ? (
        <div style={{ display: 'flex', flexDirection: 'row', gap: 24, flexWrap: 'wrap' }}>
          {/* Left Column: Video Player */}
          <div style={{ flex: '2 1 0%', minWidth: 320 }}>
            <video
              ref={videoRef}
              controls
              style={{ width: '100%', borderRadius: 8, outline: 'none', backgroundColor: '#000', maxHeight: '500px' }}
              autoPlay
              onTimeUpdate={handleTimeUpdate}
            >
              <source src={url} type="video/webm" />
              <source src={url} type="video/mp4" />
              Trình duyệt của bạn không hỗ trợ thẻ video.
            </video>
          </div>

          {/* Right Column: Transcript Panel */}
          <div style={{ flex: '1 1 0%', minWidth: 320, display: 'flex', flexDirection: 'column', height: '500px', borderLeft: '1px solid #f0f0f0', paddingLeft: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <Typography.Title level={5} style={{ margin: 0, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClockCircleOutlined /> Bản chép lời cuộc họp
              </Typography.Title>
              <Input
                placeholder="Tìm kiếm trong video..."
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                <Spin tip="Đang tải bản chép lời..." />
              </div>
            ) : filteredTranscripts.length > 0 ? (
              <div
                ref={listContainerRef}
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  paddingRight: 8,
                  scrollBehavior: 'smooth',
                }}
              >
                <List
                  itemLayout="horizontal"
                  dataSource={filteredTranscripts}
                  renderItem={(item) => {
                    const originalIndex = transcripts.findIndex(t => t.at === item.at && t.text === item.text);
                    const isActive = originalIndex === activeIndex;

                    return (
                      <div
                        id={`transcript-item-${originalIndex}`}
                        onClick={() => handleSeek(item.offsetSeconds)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          marginBottom: 8,
                          backgroundColor: isActive ? '#e6f7ff' : 'transparent',
                          borderLeft: isActive ? '3px solid #1890ff' : '3px solid transparent',
                          transition: 'all 0.2s',
                        }}
                      >
                        <Space direction="vertical" size={2} style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: isActive ? '#1890ff' : '#595959' }}>
                              <UserOutlined style={{ marginRight: 4 }} />
                              {item.speakerName}
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                color: '#1890ff',
                                backgroundColor: '#e6f7ff',
                                padding: '1px 6px',
                                borderRadius: 4,
                                fontWeight: 500
                              }}
                            >
                              {formatTime(item.offsetSeconds)}
                            </span>
                          </div>
                          <Typography.Text
                            style={{
                              fontSize: '13px',
                              color: isActive ? '#262626' : '#595959',
                              fontWeight: isActive ? 500 : 'normal'
                            }}
                          >
                            {item.text}
                          </Typography.Text>
                        </Space>
                      </div>
                    );
                  }}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, color: '#bfbfbf' }}>
                Không có bản chép lời nào phù hợp
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 80, color: '#94a3b8' }}>
          <Spin size="large" tip="Đang tải dữ liệu bản ghi..." />
        </div>
      )}
    </Modal>
  );
}
