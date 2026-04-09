import dayjs from 'dayjs';
import type { HistoryEntry } from './types';

/** Đổi tổng giây sang chuỗi: giờ / phút / giây (chỉ hiện phần cần thiết). */
export function formatSecondsToDurationVietnamese(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (h > 0) {
    if (m > 0 && s > 0) return `${h} giờ ${m} phút ${s} giây`;
    if (m > 0 && s === 0) return `${h} giờ ${m} phút`;
    if (m === 0 && s > 0) return `${h} giờ ${s} giây`;
    return `${h} giờ`;
  }
  if (m > 0) {
    return s > 0 ? `${m} phút ${s} giây` : `${m} phút`;
  }
  return `${s} giây`;
}

/** Thời lượng: ưu tiên chênh lệch Vào/Rời; fallback `duration` (phút, có thể lẻ). */
export function formatHistoryParticipationDuration(r: HistoryEntry): string {
  if (!r.leftAt) return 'Đang tham gia';
  const start = dayjs(r.joinedAt);
  const end = dayjs(r.leftAt);
  if (start.isValid() && end.isValid()) {
    const totalSec = Math.max(0, end.diff(start, 'second'));
    return formatSecondsToDurationVietnamese(totalSec);
  }
  if (r.duration != null && r.duration !== undefined) {
    const totalSec = Math.max(0, Math.round(Number(r.duration) * 60));
    return formatSecondsToDurationVietnamese(totalSec);
  }
  return '—';
}

export function participantInitials(displayName: string, username: string): string {
  const s = (displayName || username || '?').trim();
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  return (s.slice(0, 2) || '?').toUpperCase();
}
