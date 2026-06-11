import dayjs from 'dayjs';
import type { MeetingListItem, MeetingHistoryItem, MeetingRecordingDto } from '@/dtos/meeting.dto';

/** Alias giữ backward compat với code cũ dùng tên HistoryEntry */
export type HistoryEntry = MeetingHistoryItem;

// ---------------------------------------------------------------------------
// Duration formatters
// ---------------------------------------------------------------------------

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
export function formatHistoryParticipationDuration(r: MeetingHistoryItem): string {
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

/** Định dạng thời lượng bản ghi từ startedAtUtc → endedAtUtc. */
export function formatRecordingDuration(r: MeetingRecordingDto): string {
  if (!r.endedAtUtc) return 'Đang ghi';
  const start = dayjs(r.startedAtUtc);
  const end = dayjs(r.endedAtUtc);
  if (!start.isValid() || !end.isValid()) return '—';
  const totalSec = Math.max(0, end.diff(start, 'second'));
  return formatSecondsToDurationVietnamese(totalSec);
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export function participantInitials(displayName: string, username: string): string {
  const s = (displayName || username || '?').trim();
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  return (s.slice(0, 2) || '?').toUpperCase();
}

// ---------------------------------------------------------------------------
// Meeting status & permissions
// ---------------------------------------------------------------------------

export type MeetingStatus = 'live' | 'done' | 'upcoming' | 'no_show' | 'cancelled';

/**
 * Tính trạng thái hiển thị của cuộc họp.
 * - live     : chưa kết thúc, có người đang tham gia
 * - upcoming : chưa kết thúc, chưa có ai tham gia
 * - done     : đã kết thúc, có người đã tham gia
 * - no_show  : đã kết thúc (hoặc quá lâu), không có ai tham gia
 * - cancelled: cuộc họp bị hủy bởi host
 */
export function getMeetingStatus(m: MeetingListItem): MeetingStatus {
  if (m.status) {
    if (m.status === 'ended') return 'done';
    return m.status;
  }
  const ended = !!m.endedAt;
  const hasParticipants = (m.activeParticipantCount ?? 0) > 0;

  if (!ended) {
    return hasParticipants ? 'live' : 'upcoming';
  }
  // Đã kết thúc – kiểm tra xem có ai tham gia không (dựa vào startedAt)
  return m.startedAt ? 'done' : 'no_show';
}

type UserLike = { id?: string | null; username?: string | null } | null | undefined;

/** Kiểm tra user hiện tại có phải host (gốc hoặc co-host) của cuộc họp không. */
export function isHostForMeeting(m: MeetingListItem, user: UserLike): boolean {
  if (!user) return false;
  if (m.isMeetingHost) return true;
  if (user.username && m.hostIdentity === user.username) return true;
  return false;
}

/** Host (gốc/co-host) hoặc admin mới được sửa thông tin cuộc họp. */
export function canEditMeeting(
  m: MeetingListItem,
  user: UserLike,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  return isHostForMeeting(m, user);
}

/** Chỉ host gốc hoặc admin mới được quản lý danh sách mời. */
export function canManageMeetingInvitees(
  m: MeetingListItem | null | undefined,
  user: UserLike,
  isAdmin: boolean,
): boolean {
  if (!m) return false;
  if (isAdmin) return true;
  if (!user) return false;
  
  if (isHostForMeeting(m, user)) return true;
  if (user.username && m.hostIdentity) {
    return user.username.toLowerCase() === m.hostIdentity.toLowerCase();
  }
  return false;
}

/** Tạo link tham gia cuộc họp từ meetingId. */
export function buildMeetingLink(meetingId: string): string {
  if (typeof window === 'undefined') return `/join?meetingId=${meetingId}`;
  return `${window.location.origin}/join?meetingId=${meetingId}`;
}

