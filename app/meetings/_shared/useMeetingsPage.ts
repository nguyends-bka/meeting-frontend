import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { App, Form } from 'antd';
import dayjs from 'dayjs';
import { apiService, meetingApi } from '@/services/api';
import type { 
  MeetingListItem, 
  MeetingMinutes, 
  PollResponse, 
  PollManagerItem, 
  MeetingDocumentDto, 
  MeetingInvitee, 
  MeetingCoHostItem, 
  MeetingRecordingDto 
} from '@/dtos/meeting.dto';
import type { HistoryEntry } from './helpers';
import { getMeetingStatus, isHostForMeeting, canManageMeetingInvitees, canEditMeeting } from './helpers';

// Helper hook để đóng gói toàn bộ state và logic của trang Meetings
export function useMeetingsPage(user: any, isAdmin: boolean) {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const searchParams = useSearchParams();
  const { message } = App.useApp();

  const forcedDetailMeetingId = typeof params?.id === 'string'
    ? params.id
    : (searchParams.get('detailId') || undefined);

  // --- STATE CƠ BẢN ---
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(10);
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'live' | 'done' | 'no_show'>('all');

  const [detailMeeting, setDetailMeeting] = useState<MeetingListItem | null>(null);

  // --- TẢI DANH SÁCH CUỘC HỌP ---
  const loadMeetings = async () => {
    setLoadingMeetings(true);
    const result = await apiService.getMeetings();
    if (result.data) setMeetings(result.data as MeetingListItem[]);
    if (result.error) message.error(result.error);
    setLoadingMeetings(false);
  };

  useEffect(() => {
    void loadMeetings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Xử lý auto-open detail
  useEffect(() => {
    if (!forcedDetailMeetingId) return;
    if (loadingMeetings) return;
    if (meetings.length === 0) return;
    const target = meetings.find((m) => m.id === forcedDetailMeetingId);
    if (target) {
      setDetailMeeting(target);
      return;
    }
    message.warning('Không tìm thấy cuộc họp');
    router.replace('/meetings');
  }, [forcedDetailMeetingId, meetings, loadingMeetings, message, router]);

  // --- CÁC STATE & HANDLERS CHO TỪNG PHẦN ---
  // (Sẽ được tách dần ra các file hoặc trả về từ hook này)
  
  // Lọc và phân trang
  const meetingsWithStatus = useMemo(() => {
    return meetings.map(m => ({ ...m, computedStatus: getMeetingStatus(m) }));
  }, [meetings]);

  const filteredMeetings = useMemo(() => {
    let result = meetingsWithStatus;
    if (filterStatus !== 'all') {
      result = result.filter(m => m.computedStatus === filterStatus);
    }
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(m => 
        m.title.toLowerCase().includes(lower) || 
        m.meetingCode.toLowerCase().includes(lower) || 
        m.hostName.toLowerCase().includes(lower)
      );
    }
    return result;
  }, [meetingsWithStatus, filterStatus, searchText]);

  const paginatedMeetings = useMemo(() => {
    const start = (tablePage - 1) * tablePageSize;
    return filteredMeetings.slice(start, start + tablePageSize);
  }, [filteredMeetings, tablePage, tablePageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredMeetings.length / tablePageSize));

  // --- CHI TIẾT CUỘC HỌP (Invitees, Co-hosts, Recordings) ---
  const [meetingInvitees, setMeetingInvitees] = useState<MeetingInvitee[]>([]);
  const [meetingCoHosts, setMeetingCoHosts] = useState<MeetingCoHostItem[]>([]);
  const [meetingInviteesLoading, setMeetingInviteesLoading] = useState(false);
  const [inviteUsernameInput, setInviteUsernameInput] = useState('');
  const [addingInvitee, setAddingInvitee] = useState(false);
  const [removingInviteeUsername, setRemovingInviteeUsername] = useState<string | null>(null);
  const [promotingInviteeUsername, setPromotingInviteeUsername] = useState<string | null>(null);
  const [demotingCoHostUsername, setDemotingCoHostUsername] = useState<string | null>(null);
  const [removingCoHostUserId, setRemovingCoHostUserId] = useState<string | null>(null);

  const [meetingRecordings, setMeetingRecordings] = useState<MeetingRecordingDto[]>([]);
  const [meetingRecordingsLoading, setMeetingRecordingsLoading] = useState(false);
  const [recordingDeletingId, setRecordingDeletingId] = useState<string | null>(null);

  // Effect load invitees & co-hosts
  useEffect(() => {
    if (!detailMeeting || !canManageMeetingInvitees(detailMeeting, user, isAdmin)) {
      setMeetingInvitees([]);
      setMeetingCoHosts([]);
      setInviteUsernameInput('');
      return;
    }
    let cancelled = false;
    setMeetingInviteesLoading(true);
    void Promise.all([
      meetingApi.listInvitees(detailMeeting.id),
      meetingApi.listCoHosts(detailMeeting.id),
    ]).then(([inv, co]) => {
      if (cancelled) return;
      setMeetingInviteesLoading(false);
      if (inv.data) setMeetingInvitees(inv.data);
      if (co.data) setMeetingCoHosts(co.data);
    });
    return () => { cancelled = true; };
  }, [detailMeeting, isAdmin, user?.id, user?.username]);

  // Effect load recordings
  useEffect(() => {
    if (!detailMeeting) {
      setMeetingRecordings([]);
      setMeetingRecordingsLoading(false);
      return;
    }
    let cancelled = false;
    setMeetingRecordingsLoading(true);
    void meetingApi.listRecordings(detailMeeting.id).then(res => {
      if (cancelled) return;
      setMeetingRecordingsLoading(false);
      if (res.data) setMeetingRecordings(res.data);
    });
    return () => { cancelled = true; };
  }, [detailMeeting]);

  // Handlers
  const submitAddInvitee = async () => {
    if (!detailMeeting || !inviteUsernameInput.trim()) return;
    setAddingInvitee(true);
    const r = await meetingApi.addInvitee(detailMeeting.id, inviteUsernameInput.trim());
    setAddingInvitee(false);
    if (r.data) {
      setMeetingInvitees(prev => {
        if (prev.some(x => x.username.toLowerCase() === r.data!.username.toLowerCase())) return prev;
        return [...prev, r.data!];
      });
      setInviteUsernameInput('');
    }
    if (r.error) message.error(r.error);
  };

  const removeInviteeRow = async (invUsername: string) => {
    if (!detailMeeting) return;
    setRemovingInviteeUsername(invUsername);
    const r = await meetingApi.removeInvitee(detailMeeting.id, invUsername);
    setRemovingInviteeUsername(null);
    if (!r.error) setMeetingInvitees(prev => prev.filter(x => x.username.toLowerCase() !== invUsername.toLowerCase()));
    if (r.error) message.error(r.error);
  };

  const promoteInviteeToCoHost = async (invUsername: string) => {
    if (!detailMeeting) return;
    setPromotingInviteeUsername(invUsername);
    const r = await meetingApi.promoteInviteeToCoHost(detailMeeting.id, invUsername);
    setPromotingInviteeUsername(null);
    if (r.data) {
      setMeetingInvitees(prev => prev.filter(x => x.username.toLowerCase() !== invUsername.toLowerCase()));
      setMeetingCoHosts(prev => {
        if (prev.some(x => x.hostUserId === r.data!.hostUserId)) return prev;
        return [...prev, r.data!];
      });
    }
    if (r.error) message.error(r.error);
  };

  const demoteCoHostToInvitee = async (coHostUsername: string) => {
    if (!detailMeeting) return;
    setDemotingCoHostUsername(coHostUsername);
    const r = await meetingApi.demoteCoHostToInvitee(detailMeeting.id, coHostUsername);
    setDemotingCoHostUsername(null);
    if (!r.error) {
      setMeetingCoHosts(prev => prev.filter(x => x.username.toLowerCase() !== coHostUsername.toLowerCase()));
      const inv = await meetingApi.listInvitees(detailMeeting.id);
      if (inv.data) setMeetingInvitees(inv.data);
    }
    if (r.error) message.error(r.error);
  };

  const removeCoHostRow = async (hostUserId: string) => {
    if (!detailMeeting) return;
    setRemovingCoHostUserId(hostUserId);
    const r = await meetingApi.removeCoHost(detailMeeting.id, hostUserId);
    setRemovingCoHostUserId(null);
    if (!r.error) setMeetingCoHosts(prev => prev.filter(x => x.hostUserId !== hostUserId));
    if (r.error) message.error(r.error);
  };

  const onDeleteMeetingRecording = async (recording: MeetingRecordingDto) => {
    if (!detailMeeting) return;
    setRecordingDeletingId(recording.id);
    const res = await meetingApi.deleteRecording(detailMeeting.id, recording.id);
    setRecordingDeletingId(null);
    if (res.error) {
      message.error(res.error);
      return;
    }
    setMeetingRecordings(prev => prev.filter(x => x.id !== recording.id));
    message.success('Đã xóa bản ghi');
  };

  const handleDeleteMeeting = async (id: string) => {
    const result = await apiService.deleteMeeting(id);
    if (result.error) {
      message.error(result.error);
    } else {
      message.success('Đã xóa cuộc họp');
      setMeetings(prev => prev.filter(m => m.id !== id));
      if (detailMeeting?.id === id) setDetailMeeting(null);
    }
  };

  const handleCancelMeeting = async (id: string) => {
    const result = await meetingApi.cancelMeeting(id);
    if (result.error) {
      message.error(result.error);
    } else {
      message.success('Đã hủy cuộc họp');
      void loadMeetings();
      if (detailMeeting?.id === id) {
        setDetailMeeting(prev => prev ? { ...prev, status: 'cancelled' } : null);
      }
    }
  };


  // --- MODAL STATES (Chỉ lưu trữ việc mở modal đối với meeting nào) ---
  const [pollModalMeeting, setPollModalMeeting] = useState<MeetingListItem | null>(null);
  const [viewPollMeeting, setViewPollMeeting] = useState<MeetingListItem | null>(null);
  const [historyMeeting, setHistoryMeeting] = useState<MeetingListItem | null>(null);
  const [editMeetingModal, setEditMeetingModal] = useState<MeetingListItem | null>(null);
  const [reportMeeting, setReportMeeting] = useState<MeetingListItem | null>(null);
  const [documentsMeeting, setDocumentsMeeting] = useState<MeetingListItem | null>(null);
  
  const [recordingPlaybackModalOpen, setRecordingPlaybackModalOpen] = useState(false);
  const [recordingPlaybackUrl, setRecordingPlaybackUrl] = useState<string | null>(null);
  const [recordingPlaybackTitle, setRecordingPlaybackTitle] = useState('');

  return {
    meetings, setMeetings,
    loadingMeetings, loadMeetings,
    tablePage, setTablePage,
    tablePageSize, setTablePageSize,
    searchText, setSearchText,
    filterStatus, setFilterStatus,
    detailMeeting, setDetailMeeting,
    meetingsWithStatus,
    filteredMeetings,
    paginatedMeetings,
    totalPages,
    router,

    // --- DETAIL STATES ---
    meetingInvitees, setMeetingInvitees,
    meetingCoHosts, setMeetingCoHosts,
    meetingInviteesLoading,
    inviteUsernameInput, setInviteUsernameInput,
    addingInvitee,
    removingInviteeUsername,
    promotingInviteeUsername,
    demotingCoHostUsername,
    removingCoHostUserId,
    meetingRecordings, setMeetingRecordings,
    meetingRecordingsLoading,
    recordingDeletingId,
    submitAddInvitee,
    removeInviteeRow,
    promoteInviteeToCoHost,
    demoteCoHostToInvitee,
    removeCoHostRow,
    onDeleteMeetingRecording,
    handleDeleteMeeting,
    handleCancelMeeting,
    // --- MODAL STATES ---
    pollModalMeeting, setPollModalMeeting,
    viewPollMeeting, setViewPollMeeting,
    historyMeeting, setHistoryMeeting,
    editMeetingModal, setEditMeetingModal,
    reportMeeting, setReportMeeting,
    documentsMeeting, setDocumentsMeeting,
    recordingPlaybackModalOpen, setRecordingPlaybackModalOpen,
    recordingPlaybackUrl, setRecordingPlaybackUrl,
    recordingPlaybackTitle, setRecordingPlaybackTitle,
  };
}
