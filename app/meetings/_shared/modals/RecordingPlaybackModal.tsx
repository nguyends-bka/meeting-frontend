import React, { useState, useEffect, useRef } from 'react';
import { Modal, Input, List, Typography, Spin, Button, Slider } from 'antd';
import { SearchOutlined, UserOutlined, PlayCircleOutlined, PauseCircleOutlined, SoundOutlined } from '@ant-design/icons';
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Reset states when modal closes or opens
  useEffect(() => {
    if (!open) {
      setTranscripts([]);
      setCurrentTime(0);
      setSearchText('');
      setIsPlaying(false);
      setDuration(0);
      setIsMuted(false);
    }
  }, [open]);

  // Fetch room logs (transcript) when open
  useEffect(() => {
    if (!open || !meetingId || !recording) {
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

  // Sync player events with custom state
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleSliderChange = (value: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value;
      setCurrentTime(value);
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
      width={700}
      destroyOnClose
      style={{ top: 40 }}
      styles={{ body: { padding: '12px 20px 20px 20px' } }}
    >
      {url ? (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '480px' }}>
          
          {/* Hidden video tag for audio processing */}
          <video
            ref={videoRef}
            style={{ width: 0, height: 0, position: 'absolute' }}
            autoPlay
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={handlePlay}
            onPause={handlePause}
          >
            <source src={url} type="video/webm" />
            <source src={url} type="video/mp4" />
          </video>

          {/* Custom Audio Control Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, backgroundColor: '#f8fafc', padding: '10px 16px', borderRadius: 8, marginBottom: 16, border: '1px solid #e2e8f0' }}>
            <Button
              type="primary"
              shape="circle"
              icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={togglePlay}
              size="middle"
            />
            <Button
              type="text"
              shape="circle"
              icon={<SoundOutlined style={{ color: isMuted ? '#ff4d4f' : 'inherit' }} />}
              onClick={toggleMute}
            />
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569', minWidth: 80 }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <Slider
              value={currentTime}
              max={duration || 100}
              onChange={handleSliderChange}
              tooltip={{ formatter: (val) => val !== undefined ? formatTime(val) : '' }}
              style={{ flex: 1, margin: 0 }}
            />
          </div>

          {/* Full-width Transcript List */}
          <div style={{ marginBottom: 12 }}>
            <Input
              placeholder="Tìm kiếm trong bản chép lời..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <Spin tip="Đang tải..." />
            </div>
          ) : filteredTranscripts.length > 0 ? (
            <div
              ref={listContainerRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                paddingRight: 4,
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
                        padding: '12px 16px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        marginBottom: 8,
                        backgroundColor: isActive ? '#e6f7ff' : 'transparent',
                        borderLeft: isActive ? '3px solid #1890ff' : '3px solid transparent',
                        transition: 'all 0.2s',
                        borderBottom: '1px solid #f0f0f0'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: isActive ? '#1890ff' : '#262626' }}>
                          <UserOutlined style={{ marginRight: 6 }} />
                          {item.speakerName}
                        </span>
                        <span style={{ fontSize: '11px', color: '#1890ff', backgroundColor: '#e6f7ff', padding: '1px 6px', borderRadius: 4, fontWeight: 500 }}>
                          {formatTime(item.offsetSeconds)}
                        </span>
                      </div>
                      <Typography.Text style={{ fontSize: '13px', color: isActive ? '#000' : '#434343' }}>
                        {item.text}
                      </Typography.Text>
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
      ) : (
        <div style={{ textAlign: 'center', padding: 80, color: '#94a3b8' }}>
          <Spin size="large" tip="Đang tải dữ liệu bản ghi..." />
        </div>
      )}
    </Modal>
  );
}
