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
  hostIdentity: string;
  canManagePoll: boolean;
  meetingCode: string;
  passcode: string;
  createdAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  activeParticipantCount?: number;
}

export interface EndMeetingResponse {
  message: string;
  endedAt?: string | null;
}

export interface MeetingDocumentDto {
  id: string;
  meetingId: string;
  fileName: string;
  contentType: string;
  size: number;
  uploaderUserId: string;
  uploaderName: string;
  createdAt: string; // ISO string
  fileEndpoint: string;
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
  status?: 'draft' | 'open';
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

export interface PollPublishRequest {
  publishedBy: string;
  at: number;
}

export interface AddPollManagerRequest {
  username: string;
}

export interface PollManagerItem {
  username: string;
  fullName: string;
  addedBy: string;
  addedByFullName: string;
  addedAt: number;
}

export interface RoomChatCreateRequest {
  clientMessageId?: string | null;
  senderIdentity: string;
  message: string;
  at: number;
}

export interface RoomTranscriptCreateRequest {
  speakerIdentity: string;
  text: string;
  at: number;
}

export interface RoomChatItem {
  clientMessageId?: string | null;
  senderIdentity: string;
  senderName: string;
  message: string;
  at: number;
}

export interface RoomTranscriptItem {
  speakerIdentity?: string | null;
  speakerName: string;
  text: string;
  at: number;
}

export interface RoomLogResponse {
  chatMessages: RoomChatItem[];
  transcriptEntries: RoomTranscriptItem[];
}

export interface PollVoteEntry {
  voterIdentity: string;
  voterName: string;
  optionIndices: number[];
  at: number;
}

export interface PollResponse {
  pollId: string;
  title: string;
  options: string[];
  createdBy: string;
  createdByName: string;
  createdAt: number;
  selectionMode: 'single' | 'multiple';
  endAt: number | null;
  status: 'draft' | 'open' | 'closed';
  closedAt: number | null;
  closedBy: string | null;
  votes: PollVoteEntry[];
}

export interface MeetingMinutesParticipant {
  displayName: string;
  userId: string;
}

export interface MeetingMinutesTranscriptLine {
  speakerName: string;
  text: string;
  at: number;
}

export interface MeetingMinutesPoll {
  pollId: string;
  title: string;
  status: string;
  options: string[];
  optionVoteCounts: Record<string, number>;
}

export interface MeetingMinutes {
  meetingId: string;
  title: string;
  hostName: string;
  hostIdentity: string;
  locationLabel: string;
  locationDetail: string;
  startedAt: number;
  endedAtEstimated: number | null;
  participantCount: number;
  participants: MeetingMinutesParticipant[];
  transcript: MeetingMinutesTranscriptLine[];
  polls: MeetingMinutesPoll[];
}
