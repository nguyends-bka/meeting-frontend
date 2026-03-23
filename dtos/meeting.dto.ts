// Frontend DTOs for Meeting domain

export interface CreateMeetingRequest {
  title: string;
  hostName: string;
  passcode?: string;
}

export interface CreateMeetingResponse {
  meetingId: string;
  meetingCode: string;
  passcode: string;
  roomName: string;
}

export interface JoinMeetingRequest {
  meetingId?: string;
  meetingCode?: string;
  passcode: string;
}

export interface JoinMeetingResponse {
  token: string;
  liveKitUrl: string;
  roomName: string;
  meetingId: string;
  meetingCode: string;
  participantId: string;
  title?: string;
  hostIdentity: string;
}

export interface LeaveMeetingRequest {
  participantId?: string;
  meetingId?: string;
}

export interface LeaveMeetingResponse {
  message: string;
  updatedCount?: number;
}

export interface MeetingListItem {
  id: string;
  title: string;
  hostName: string;
  meetingCode: string;
  passcode: string;
  createdAt: string;
}

export interface MeetingHistoryItem {
  id: string;
  username: string;
  userId: string;
  joinedAt: string;
  leftAt: string | null;
  duration: number | null;
}

export interface MyHistoryItem {
  id: string;
  meetingId: string;
  meetingTitle: string;
  username: string;
  joinedAt: string;
  leftAt: string | null;
  duration: number | null;
  meetingCode: string;
  hostName: string;
}

/** Khớp backend PollCreateRequestDto */
export interface PollCreateRequest {
  pollId?: string | null;
  title: string;
  options: string[];
  createdBy: string;
  createdByName: string;
  createdAt: number;
  selectionMode: string;
  endAt: number | null;
}

export interface PollVoteRequest {
  optionIndices: number[];
  voterIdentity: string;
  voterName: string;
  at: number;
}

export interface PollCloseRequest {
  closedBy: string;
  at: number;
}
