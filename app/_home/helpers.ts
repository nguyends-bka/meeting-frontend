import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import 'dayjs/locale/vi';
import { HomeMeetingRow, HistoryEntry } from './types';

dayjs.extend(isoWeek);
dayjs.locale('vi');

export function isMeetingLive(r: HomeMeetingRow): boolean {
  if (r.endedAt) return false;
  const now = dayjs();
  const start = dayjs(r.createdAt);
  if (!start.isValid()) return false;
  if (now.isBefore(start)) return false;
  const estimatedEnd = r.startedAt ? dayjs(r.startedAt) : null;
  if (estimatedEnd && estimatedEnd.isValid()) {
    return now.isBefore(estimatedEnd) || now.isSame(estimatedEnd);
  }
  return true;
}

export function meetingRowStatus(r: HomeMeetingRow): 'live' | 'ended' | 'upcoming' | 'no_show' {
  if (r.endedAt) return 'ended';
  const now = dayjs();
  const estimatedEnd = r.startedAt ? dayjs(r.startedAt) : null;
  if (
    estimatedEnd &&
    estimatedEnd.isValid() &&
    now.isAfter(estimatedEnd) &&
    (r.activeParticipantCount ?? 0) === 0
  ) {
    return 'no_show';
  }
  if (isMeetingLive(r)) return 'live';
  return 'upcoming';
}

export function pickHeroMeeting(rows: HomeMeetingRow[]): HomeMeetingRow | null {
  const live = rows.find((r) => meetingRowStatus(r) === 'live');
  if (live) return live;
  const upcoming = rows
    .filter((r) => meetingRowStatus(r) === 'upcoming')
    .sort((a, b) => +dayjs(a.createdAt) - +dayjs(b.createdAt));
  return upcoming[0] ?? null;
}

/** Thời lượng = kết thúc − bắt đầu (chỉ hiển thị, không có nút gợi ý). */
export function formatDurationFromScheduleRange(
  range: [dayjs.Dayjs, dayjs.Dayjs] | undefined | null,
): string {
  if (!range?.[0] || !range?.[1]) return '—';
  const minutes = Math.max(0, range[1].diff(range[0], 'minute'));
  if (minutes === 0) return '0 phút';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h} giờ ${m} phút`;
  if (h > 0) return `${h} giờ`;
  return `${m} phút`;
}

export function formatHistoryParticipationDuration(r: HistoryEntry): string {
  if (!r.leftAt) return 'Đang tham gia';
  const start = dayjs(r.joinedAt);
  const end = dayjs(r.leftAt);
  if (start.isValid() && end.isValid()) {
    const totalSec = Math.max(0, end.diff(start, 'second'));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return m > 0 ? `${h} giờ ${m} phút ${s} giây` : `${h} giờ ${s} giây`;
    if (m > 0) return s > 0 ? `${m} phút ${s} giây` : `${m} phút`;
    return `${s} giây`;
  }
  if (r.duration != null && r.duration !== undefined) {
    const totalSec = Math.max(0, Math.round(Number(r.duration) * 60));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return m > 0 ? `${h} giờ ${m} phút ${s} giây` : `${h} giờ ${s} giây`;
    if (m > 0) return s > 0 ? `${m} phút ${s} giây` : `${m} phút`;
    return `${s} giây`;
  }
  return '—';
}

export function getHostNameOnly(hostName: string): string {
  if (!hostName) return '';
  if (hostName.includes(' | ')) {
    return hostName.split(' | ')[0];
  }
  return hostName;
}

export function getVirtualRoom(hostName: string, id: string): string {
  if (!hostName) return 'Phòng Họp Trực Tuyến';
  if (hostName.includes(' | ')) {
    return hostName.split(' | ')[1];
  }
  if (hostName.includes('Phạm Minh T')) return 'Phòng Kỹ thuật 1';
  if (hostName.includes('Nguyễn Văn A')) return 'Phòng họp trực tuyến 3';
  if (hostName.includes('Trần Thị B')) return 'Phòng Kỹ thuật 2';
  if (hostName.includes('Nguyên') || hostName.includes('Nguyễn')) {
    let sum = 0;
    for (let i = 0; i < (id || '').length; i++) sum += id.charCodeAt(i);
    return sum % 2 === 0 ? 'Phòng họp VIP 1' : 'Phòng Hội Nghị Trực Tuyến';
  }
  return 'Phòng Họp Trực Tuyến';
}
