export interface HomeMeetingRow {
  id: string;
  title: string;
  hostName: string;
  hostIdentity: string;
  isMeetingHost?: boolean;
  meetingCode: string;
  passcode: string;
  createdAt: string;
  location?: string;
  activeParticipantCount?: number;
  startedAt?: string | null;
  endedAt?: string | null;
  status?: 'upcoming' | 'live' | 'ended' | 'no_show' | 'cancelled';
  estimatedEndAt?: string | null;
}

export interface HistoryEntry {
  id: string;
  username: string;
  fullName?: string | null;
  userId: string;
  joinedAt: string;
  leftAt: string | null;
  duration: number | null;
}
