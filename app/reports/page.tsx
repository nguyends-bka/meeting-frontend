'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import MainLayout from '@/components/MainLayout';
import { adminApi } from '@/services/admin/adminApi';
import { meetingApi } from '@/services/meeting/meetingApi';
import type { MeetingMinutes } from '@/dtos/meeting.dto';
import { Button, Card, Empty, Select, Space, Spin, Typography, message } from 'antd';
import { CopyOutlined, FileTextOutlined, FileWordOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
type MeetingOption = { value: string; label: string };

function formatViDateTime(ms: number): string {
  return new Date(ms).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatViTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatVietnamDateLine(ms: number): string {
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `Hà Nội, ngày ${day} tháng ${month} năm ${year}`;
}

function buildMinutesText(m: MeetingMinutes): string {
  const lines: string[] = [];
  const signAt = m.endedAtEstimated ?? m.startedAt;
  lines.push('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM');
  lines.push('Độc lập - Tự do - Hạnh phúc');
  lines.push('--------------------');
  lines.push('');
  lines.push(formatVietnamDateLine(signAt));
  lines.push('');
  lines.push('BIÊN BẢN CUỘC HỌP');
  lines.push(`Biên bản cuộc họp về: ${m.title}`);
  lines.push('');
  lines.push('1. Thời gian, địa điểm');
  lines.push(`- Bắt đầu lúc: ${formatViDateTime(m.startedAt)}`);
  if (m.endedAtEstimated != null) {
    lines.push(`- Kết thúc lúc: ${formatViDateTime(m.endedAtEstimated)} (ước lượng)`);
  } else {
    lines.push('- Kết thúc lúc: ...');
  }
  lines.push(`- Địa điểm: ${m.locationLabel} (${m.locationDetail})`);
  lines.push('');
  lines.push('2. Thành phần tham dự');
  lines.push(`- Chủ trì: ${m.hostName}`);
  lines.push(`- Và ${m.participantCount} thành viên`);
  m.participants.forEach((p) => lines.push(`   • ${p.displayName}`));
  lines.push('');
  lines.push('3. Tiến trình cuộc họp');
  if (m.transcript.length === 0) lines.push('(Không có transcript)');
  m.transcript.forEach((t) => lines.push(`${formatViTime(t.at)} - ${t.speakerName}: "${t.text}"`));
  lines.push('');
  if (m.polls.length > 0) {
    lines.push('4. Kết quả biểu quyết');
    m.polls.forEach((poll, i) => {
      lines.push(`- Biểu quyết ${i + 1}. ${poll.title} (${poll.status})`);
      poll.options.forEach((opt, idx) => {
        const key = String(idx);
        const cnt = poll.optionVoteCounts[key] ?? 0;
        lines.push(`   • ${opt}: ${cnt} phiếu`);
      });
    });
    lines.push('');
  }
  lines.push(`${m.polls.length > 0 ? '5' : '4'}. Kết thúc cuộc họp`);
  lines.push('');
  lines.push('Chủ trì');
  lines.push('(Ký, ghi rõ họ tên)');
  lines.push(m.hostName);
  return lines.join('\n');
}

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

  const buildExportFileName = (m: MeetingMinutes): string => {
    const raw = `bien-ban-${m.title}-${formatViDateTime(m.startedAt)}`;
    return raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  };

  const exportWord = async () => {
    if (!minutes) return;
    setExportingWord(true);
    try {
      const {
        AlignmentType,
        BorderStyle,
        Document,
        Packer,
        Paragraph,
        Table,
        TableCell,
        TableRow,
        TextRun,
        VerticalAlign,
        WidthType,
      } = await import('docx');
      const signAt = minutes.endedAtEstimated ?? minutes.startedAt;
      const run = (text: string, bold = false) =>
        new TextRun({
          text,
          bold,
          font: 'Times New Roman',
          size: 28, // 14pt
        });

      const paragraphs: any[] = [];
      const push = (
        text: string,
        alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
        bold = false,
        after = 140,
      ) => {
        paragraphs.push(
          new Paragraph({
            alignment,
            spacing: { after },
            children: [run(text, bold)],
          }),
        );
      };

      // Quốc hiệu - tiêu ngữ
      push('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', AlignmentType.CENTER, true, 80);
      push('Độc lập - Tự do - Hạnh phúc', AlignmentType.CENTER, true, 80);
      push('--------------------', AlignmentType.CENTER, false, 220);
      push(formatVietnamDateLine(signAt), AlignmentType.RIGHT, false, 220);

      // Tiêu đề
      push('BIÊN BẢN CUỘC HỌP', AlignmentType.CENTER, true, 80);
      push(`Biên bản cuộc họp về: ${minutes.title}`, AlignmentType.CENTER, false, 220);

      // Nội dung
      push('1. Thời gian, địa điểm', AlignmentType.LEFT, true);
      push(`- Bắt đầu lúc: ${formatViDateTime(minutes.startedAt)}`);
      push(`- Kết thúc lúc: ${endedText}`);
      push(`- Địa điểm: ${minutes.locationLabel} (${minutes.locationDetail})`, AlignmentType.LEFT, false, 220);

      push('2. Thành phần tham dự', AlignmentType.LEFT, true);
      push(`- Chủ trì: ${minutes.hostName}`);
      push(`- Và ${minutes.participantCount} thành viên`);
      minutes.participants.forEach((p) => push(`   • ${p.displayName}`));
      push('', AlignmentType.LEFT, false, 100);

      push('3. Tiến trình cuộc họp', AlignmentType.LEFT, true);
      if (minutes.transcript.length === 0) {
        push('(Không có transcript)');
      } else {
        minutes.transcript.forEach((t) =>
          push(`${formatViTime(t.at)} - ${t.speakerName}: "${t.text}"`),
        );
      }
      push('', AlignmentType.LEFT, false, 100);

      if (minutes.polls.length > 0) {
        push('4. Kết quả biểu quyết', AlignmentType.LEFT, true);
        minutes.polls.forEach((poll, i) => {
          push(`- Biểu quyết ${i + 1}. ${poll.title} (${poll.status})`);
          poll.options.forEach((opt, idx) => {
            push(`   • ${opt}: ${poll.optionVoteCounts[String(idx)] ?? 0} phiếu`);
          });
        });
        push('', AlignmentType.LEFT, false, 140);
      }

      push(`${minutes.polls.length > 0 ? '5' : '4'}. Kết thúc cuộc họp`, AlignmentType.LEFT, true, 180);

      const signatureTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            height: { value: 2600, rule: 'exact' },
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.TOP,
                children: [new Paragraph({ children: [run(' ')] })],
                borders: {
                  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                },
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.TOP,
                borders: {
                  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 80 },
                    children: [run('Chủ trì')],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 700 },
                    children: [run('(Ký, ghi rõ họ tên)')],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [run(minutes.hostName)],
                  }),
                ],
              }),
            ],
          }),
        ],
      });
      paragraphs.push(signatureTable);

      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: 1134, // 2 cm
                  right: 1134, // 2 cm
                  bottom: 1134, // 2 cm
                  left: 1701, // 3 cm
                },
              },
            },
            children: paragraphs,
          },
        ],
      });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${buildExportFileName(minutes)}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      message.success('Đã xuất file Word');
    } catch (e) {
      console.error(e);
      message.error('Xuất Word thất bại');
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

  const endedText = useMemo(() => {
    if (!minutes) return '';
    if (minutes.endedAtEstimated == null) return 'Chưa ghi nhận';
    return `${formatViDateTime(minutes.endedAtEstimated)} (ước lượng)`;
  }, [minutes]);

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
                <div
                  ref={reportRef}
                  style={{
                    width: '794px', // A4 width at 96dpi
                    minHeight: '1123px', // A4 height at 96dpi
                    margin: '0 auto',
                    background: '#fff',
                    boxShadow: '0 1px 8px rgba(15,23,42,0.12)',
                    border: '1px solid #d9d9d9',
                    position: 'relative',
                  }}
                >
                  <div style={{
                      paddingTop: '76px',
                      paddingRight: '76px',
                      paddingBottom: '76px',
                      paddingLeft: '113px',
                    }}
                  >
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <Paragraph style={{ marginBottom: 0 }}>
                      <Text strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Text>
                    </Paragraph>
                    <Paragraph style={{ marginBottom: 0 }}>
                      <Text strong>Độc lập - Tự do - Hạnh phúc</Text>
                    </Paragraph>
                    <Paragraph style={{ marginBottom: 0 }}>
                      <Text strong>--------------------</Text>
                    </Paragraph>
                  </div>
                  <Paragraph
                    style={{
                      textAlign: 'right',
                      fontStyle: 'italic',
                      marginBottom: 12,
                      paddingRight: 96,
                    }}
                  >
                    {formatVietnamDateLine(minutes.endedAtEstimated ?? minutes.startedAt)}
                  </Paragraph>
                  <Paragraph style={{ textAlign: 'center', marginBottom: 8 }}>
                    <Text strong>BIÊN BẢN CUỘC HỌP</Text>
                  </Paragraph>
                  <Paragraph style={{ textAlign: 'center' }}>
                    Biên bản cuộc họp về: {minutes.title}
                  </Paragraph>
                  <Title level={5}>1. Thời gian, địa điểm</Title>
                  <Paragraph style={{ marginBottom: 8 }}>
                    - Bắt đầu lúc: {formatViDateTime(minutes.startedAt)}
                  </Paragraph>
                  <Paragraph style={{ marginBottom: 8 }}>
                    - Kết thúc lúc: {endedText}
                  </Paragraph>
                  <Paragraph>
                    - Địa điểm: {minutes.locationLabel} ({minutes.locationDetail})
                  </Paragraph>
                  <Title level={5}>2. Thành phần tham dự</Title>
                  <Paragraph>- Chủ trì: {minutes.hostName}</Paragraph>
                  <Paragraph>- Và {minutes.participantCount} thành viên</Paragraph>
                  <ul>
                    {minutes.participants.map((p) => (
                      <li key={p.userId}>{p.displayName}</li>
                    ))}
                  </ul>
                  <Title level={5}>3. Tiến trình cuộc họp</Title>
                  {minutes.transcript.length === 0 ? (
                    <Paragraph type="secondary">Không có transcript.</Paragraph>
                  ) : (
                    minutes.transcript.map((t, idx) => (
                      <Paragraph key={`${idx}-${t.at}`}>
                        <Text type="secondary">{formatViTime(t.at)}</Text>
                        {' - '}
                        <Text strong>{t.speakerName}</Text>: &quot;{t.text}&quot;
                      </Paragraph>
                    ))
                  )}
                  {minutes.polls.length > 0 && (
                    <>
                      <Title level={5}>4. Kết quả biểu quyết</Title>
                      {
                    minutes.polls.map((poll, pollIndex) => (
                      <div key={poll.pollId} style={{ marginBottom: 8 }}>
                        <Text strong>- Biểu quyết {pollIndex + 1}. {poll.title}</Text>{' '}
                        <Text type="secondary">({poll.status})</Text>
                        <ul>
                          {poll.options.map((opt, idx) => (
                            <li key={idx}>{opt}: {poll.optionVoteCounts[String(idx)] ?? 0} phiếu</li>
                          ))}
                        </ul>
                      </div>
                    ))
                      }
                    </>
                  )}
                  <Title level={5}>{minutes.polls.length > 0 ? '5' : '4'}. Kết thúc cuộc họp</Title>
                  <div
                    style={{
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      minHeight: 220,
                    }}
                  >
                    <div />
                    <div
                      style={{
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        paddingTop: 8,
                      }}
                    >
                      <Paragraph style={{ marginBottom: 0 }}>Chủ trì</Paragraph>
                      <Paragraph style={{ marginBottom: 0 }}>(Ký, ghi rõ họ tên)</Paragraph>
                      <div style={{ height: 90 }} />
                      <Paragraph style={{ marginBottom: 0 }}>{minutes.hostName}</Paragraph>
                    </div>
                  </div>
                  </div>
                </div>
              </>
            )}
          </Space>
        </Card>
      </div>
    </MainLayout>
  );
}
