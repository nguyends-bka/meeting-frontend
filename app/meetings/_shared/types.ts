/**
 * Re-exports từ DTOs – nguồn sự thật duy nhất cho Meeting domain types.
 * Dùng MeetingListItem thay cho Meeting, MeetingHistoryItem thay cho HistoryEntry.
 */
export type { MeetingListItem as Meeting } from '@/dtos/meeting.dto';
export type { MeetingHistoryItem as HistoryEntry } from '@/dtos/meeting.dto';
