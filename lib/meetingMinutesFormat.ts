import type { MeetingMinutes } from '@/dtos/meeting.dto';

export function formatViDateTime(ms: number): string {
  return new Date(ms).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatViTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatVietnamDateLine(ms: number): string {
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `Hà Nội, ngày ${day} tháng ${month} năm ${year}`;
}

/** Hiển thị dòng "Kết thúc lúc" (HTML / Word / copy). */
export function getEndedDisplayText(m: MeetingMinutes): string {
  if (m.endedAtEstimated == null) return 'Chưa ghi nhận';
  return `${formatViDateTime(m.endedAtEstimated)} (ước lượng)`;
}

export function buildMinutesText(m: MeetingMinutes): string {
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
  lines.push(`- Kết thúc lúc: ${getEndedDisplayText(m)}`);
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

export function buildExportFileName(m: MeetingMinutes): string {
  const raw = `bien-ban-${m.title}-${formatViDateTime(m.startedAt)}`;
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
