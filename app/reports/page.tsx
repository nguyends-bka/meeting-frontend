'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import MainLayout from '@/components/MainLayout';
import { adminApi } from '@/services/admin/adminApi';
import { meetingApi } from '@/services/meeting/meetingApi';
import type { MeetingMinutes } from '@/dtos/meeting.dto';
import { MeetingMinutesPreview } from '@/components/meeting/MeetingMinutesPreview';
import { buildMinutesText } from '@/lib/meetingMinutesFormat';
import { exportMeetingMinutesWord } from '@/lib/exportMeetingMinutesWord';
import { Button, Card, Empty, Select, Space, Spin, Typography, message } from 'antd';
import { CopyOutlined, FileTextOutlined, FileWordOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
type MeetingOption = { value: string; label: string };

export default function ReportsPage() {
  const router = useRouter();
  const { isAuthenticated, loading, isAdmin } = useAuth();
  const [meetingOptions, setMeetingOptions] = useState<MeetingOption[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>();
  const [minutesLoading, setMinutesLoading] = useState(false);
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);
  const [exportingWord, setExportingWord] = useState(false);
  const reportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    let cancelled = false;
    void (async () => {
      setListLoading(true);
      try {
        if (isAdmin) {
          const res = await adminApi.getAllMeetings();
          if (cancelled || res.error || !res.data) {
            setMeetingOptions([]);
            return;
          }
          setMeetingOptions(
            res.data.map((x) => ({
              value: x.id,
              label: `${x.title} (${x.meetingCode})`,
            })),
          );
        } else {
          const [listRes, histRes] = await Promise.all([
            meetingApi.getList(),
            meetingApi.getMyHistory(),
          ]);
          const map = new Map<string, string>();
          listRes.data?.forEach((m) => {
            map.set(m.id, `${m.title} (${m.meetingCode}) - Chủ trì`);
          });
          histRes.data?.forEach((h) => {
            if (!map.has(h.meetingId)) {
              map.set(h.meetingId, `${h.meetingTitle} (${h.meetingCode}) - Đã tham gia`);
            }
          });
          setMeetingOptions([...map.entries()].map(([value, label]) => ({ value, label })));
        }
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, loading, isAdmin]);

  const copyText = async () => {
    if (!minutes) return;
    try {
      await navigator.clipboard.writeText(buildMinutesText(minutes));
      message.success('Đã sao chép biên bản');
    } catch {
      message.error('Không sao chép được');
    }
  };

  const exportWord = async () => {
    if (!minutes) return;
    setExportingWord(true);
    try {
      await exportMeetingMinutesWord(minutes);
    } finally {
      setExportingWord(false);
    }
  };

  const loadMinutes = async (meetingId: string) => {
    setSelectedId(meetingId);
    setMinutes(null);
    setMinutesLoading(true);
    const res = await meetingApi.getMinutes(meetingId);
    if (res.error || !res.data) {
      message.error(res.error || 'Không tải được biên bản');
      setMinutesLoading(false);
      return;
    }
    setMinutes(res.data);
    setMinutesLoading(false);
  };

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;
  if (!isAuthenticated) return null;

  return (
    <MainLayout>
      <div style={{ padding: 24, maxWidth: 900 }}>
        <Card
          title={
            <Space>
              <FileTextOutlined />
              <Title level={4} style={{ margin: 0 }}>Biên bản cuộc họp</Title>
            </Space>
          }
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Text type="secondary">Chọn cuộc họp để tổng hợp biên bản.</Text>
            <Select
              showSearch
              placeholder="Chọn cuộc họp"
              options={meetingOptions}
              loading={listLoading}
              value={selectedId}
              style={{ width: '100%' }}
              optionFilterProp="label"
              onChange={(v) => void loadMinutes(v)}
            />
            {minutesLoading && (
              <div style={{ textAlign: 'center', padding: 16 }}>
                <Spin />
              </div>
            )}
            {!minutesLoading && selectedId && !minutes && (
              <Empty description="Không có dữ liệu biên bản" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
            {!minutesLoading && minutes && (
              <>
                <Space>
                  <Button type="primary" icon={<CopyOutlined />} onClick={() => void copyText()}>
                    Sao chép văn bản
                  </Button>
                  <Button icon={<FileWordOutlined />} loading={exportingWord} onClick={() => void exportWord()}>
                    Xuất Word
                  </Button>
                </Space>
                <MeetingMinutesPreview minutes={minutes} reportRef={reportRef} />
              </>
            )}
          </Space>
        </Card>
      </div>
    </MainLayout>
  );
}
