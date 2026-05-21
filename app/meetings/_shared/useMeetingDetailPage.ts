import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { App } from 'antd';
import { apiService, meetingApi } from '@/services/api';
import type { 
  MeetingListItem, 
  MeetingInvitee, 
  MeetingCoHostItem, 
  MeetingRecordingDto 
} from '@/dtos/meeting.dto';
import { canManageMeetingInvitees } from './helpers';

export function useMeetingDetailPage(meetingId: string, user: any, isAdmin: boolean) {
  const router = useRouter();
  const { message } = App.useApp();

  const [detailMeeting, setDetailMeeting] = useState<MeetingListItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- CHI TIẾT CUỘC HỌP ---
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

  // Load meeting detail
  useEffect(() => {
    if (!meetingId) return;
    let cancelled = false;
    setLoadingDetail(true);
    setError(null);

    void meetingApi.getById(meetingId).then((res) => {
      if (cancelled) return;
      if (res.error) {
        setError(res.error);
        setLoadingDetail(false);
        return;
      }
      if (res.data) {
        setDetailMeeting(res.data);
      } else {
        setError('Không tìm thấy thông tin cuộc họp');
      }
      setLoadingDetail(false);
    });

    return () => {
      cancelled = true;
    };
  }, [meetingId]);

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
      router.push('/meetings');
    }
  };

  // --- MODAL STATES ---
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
    detailMeeting, setDetailMeeting,
    loadingDetail,
    error,
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
