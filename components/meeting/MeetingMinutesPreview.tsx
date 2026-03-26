'use client';

import React from 'react';
import { Typography } from 'antd';
import type { MeetingMinutes } from '@/dtos/meeting.dto';
import {
  formatViDateTime,
  formatViTime,
  formatVietnamDateLine,
  getEndedDisplayText,
} from '@/lib/meetingMinutesFormat';

const { Title, Paragraph, Text } = Typography;

export type MeetingMinutesPreviewProps = {
  minutes: MeetingMinutes;
  /** Ref tới khung xem trước (copy / in). */
  reportRef: React.RefObject<HTMLDivElement | null>;
};

export function MeetingMinutesPreview({ minutes, reportRef }: MeetingMinutesPreviewProps) {
  const endedText = getEndedDisplayText(minutes);

  return (
    <div
      ref={reportRef as React.LegacyRef<HTMLDivElement>}
      style={{
        width: '794px',
        minHeight: '1123px',
        margin: '0 auto',
        background: '#fff',
        boxShadow: '0 1px 8px rgba(15,23,42,0.12)',
        border: '1px solid #d9d9d9',
        position: 'relative',
      }}
    >
      <div
        style={{
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
        <Paragraph style={{ marginBottom: 8 }}>- Bắt đầu lúc: {formatViDateTime(minutes.startedAt)}</Paragraph>
        <Paragraph style={{ marginBottom: 8 }}>- Kết thúc lúc: {endedText}</Paragraph>
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
            {minutes.polls.map((poll, pollIndex) => (
              <div key={poll.pollId} style={{ marginBottom: 8 }}>
                <Text strong>
                  - Biểu quyết {pollIndex + 1}. {poll.title}
                </Text>{' '}
                <Text type="secondary">({poll.status})</Text>
                <ul>
                  {poll.options.map((opt, idx) => (
                    <li key={idx}>
                      {opt}: {poll.optionVoteCounts[String(idx)] ?? 0} phiếu
                    </li>
                  ))}
                </ul>
              </div>
            ))}
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
  );
}
