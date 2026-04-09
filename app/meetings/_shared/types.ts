export type Meeting = {
  id: string;
  title: string;
  hostName: string;
  hostIdentity: string;
  canManagePoll: boolean;
  isMeetingHost?: boolean;
  meetingCode: string;
  passcode: string;
  createdAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  activeParticipantCount?: number;
};

export type HistoryEntry = {
  id: string;
  username: string;
  fullName?: string | null;
  userId: string;
  joinedAt: string;
  leftAt: string | null;
  duration: number | null;
};
