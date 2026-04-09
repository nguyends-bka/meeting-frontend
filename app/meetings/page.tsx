'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiService, meetingApi } from '@/services/api';
import type { MeetingMinutes, PollResponse, PollManagerItem, MeetingDocumentDto, MeetingInvitee, MeetingCoHostItem } from '@/dtos/meeting.dto';
import { MeetingMinutesPreview } from '@/components/meeting/MeetingMinutesPreview';
import { buildMinutesText } from '@/lib/meetingMinutesFormat';
import { exportMeetingMinutesWord } from '@/lib/exportMeetingMinutesWord';
import MainLayout from '@/components/MainLayout';
import dayjs from 'dayjs';
import {
  App,
  Avatar,
  Button,
  Card,
  Grid,
  Form,
  Input,
  InputNumber,
  DatePicker,
  List,
  Modal,
  Empty,
  Radio,
  Select,
  Progress,
  Segmented,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  Popconfirm,
  Dropdown,
  Pagination,
  Row,
  Col,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  CopyOutlined,
  HistoryOutlined,
  ReloadOutlined,
  CalendarOutlined,
  UserOutlined,
  CloseOutlined,
  MoreOutlined,
  CaretRightOutlined,
  FormOutlined,
  SettingOutlined,
  VideoCameraOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  UploadOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileWordOutlined,
  SearchOutlined,
  HourglassOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  LinkOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';

type Meeting = {
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

type HistoryEntry = {
  id: string;
  username: string;
  fullName?: string | null;
  userId: string;
  joinedAt: string;
  leftAt: string | null;
  duration: number | null;
};

/** Đổi tổng giây sang chuỗi: giờ / phút / giây (chỉ hiện phần cần thiết). */
function formatSecondsToDurationVietnamese(totalSec: number): string {
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
function formatHistoryParticipationDuration(r: HistoryEntry): string {
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

function participantInitials(displayName: string, username: string): string {
  const s = (displayName || username || '?').trim();
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  return (s.slice(0, 2) || '?').toUpperCase();
}

export default function MeetingsPage() {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  
  // Xác định màn hình mobile để tinh chỉnh font-size trực tiếp trên thẻ
  const isMobile = screens.md === false; 
  const isCompactPagination = screens.lg === false;
  const reportPreviewScale = isMobile ? 0.68 : screens.xl === false ? 0.82 : 1;

  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const forcedDetailMeetingId = typeof params?.id === 'string' ? params.id : undefined;
  const { user, isAuthenticated, loading, isAdmin } = useAuth();
  const { message } = App.useApp();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(10);
  
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'live' | 'done'>('all');

  const [pollModalMeeting, setPollModalMeeting] = useState<Meeting | null>(null);
  const [savingPoll, setSavingPoll] = useState(false);
  const [editingDraftPollId, setEditingDraftPollId] = useState<string | null>(null);
  const [pollForm] = Form.useForm();
  const [viewPollMeeting, setViewPollMeeting] = useState<Meeting | null>(null);
  const [viewPolls, setViewPolls] = useState<PollResponse[]>([]);
  const [viewPollsLoading, setViewPollsLoading] = useState(false);
  const [manageTab, setManageTab] = useState<'waiting' | 'published' | 'managers'>('waiting');
  const [managerUsername, setManagerUsername] = useState('');
  const [managers, setManagers] = useState<PollManagerItem[]>([]);
  const [managerLoading, setManagerLoading] = useState(false);
  const [addingManager, setAddingManager] = useState(false);
  const [historyMeeting, setHistoryMeeting] = useState<Meeting | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);
  const [historyTablePage, setHistoryTablePage] = useState(1);
  const [historyTablePageSize, setHistoryTablePageSize] = useState(10);
  const [exportingHistoryExcel, setExportingHistoryExcel] = useState(false);
  
  const [detailMeeting, setDetailMeeting] = useState<Meeting | null>(null);
  const [meetingInvitees, setMeetingInvitees] = useState<MeetingInvitee[]>([]);
  const [meetingCoHosts, setMeetingCoHosts] = useState<MeetingCoHostItem[]>([]);
  const [meetingInviteesLoading, setMeetingInviteesLoading] = useState(false);
  const [promotingInviteeUsername, setPromotingInviteeUsername] = useState<string | null>(null);
  const [demotingCoHostUsername, setDemotingCoHostUsername] = useState<string | null>(null);
  const [removingCoHostUserId, setRemovingCoHostUserId] = useState<string | null>(null);
  const [inviteUsernameInput, setInviteUsernameInput] = useState('');
  const [addingInvitee, setAddingInvitee] = useState(false);
  const [removingInviteeUsername, setRemovingInviteeUsername] = useState<string | null>(null);
  const [editMeetingModal, setEditMeetingModal] = useState<Meeting | null>(null);
  const [updatingMeeting, setUpdatingMeeting] = useState(false);
  const [editMeetingForm] = Form.useForm();

  const [reportMeeting, setReportMeeting] = useState<Meeting | null>(null);
  const [reportMinutes, setReportMinutes] = useState<MeetingMinutes | null>(null);
  const [reportMinutesLoading, setReportMinutesLoading] = useState(false);
  const [exportingReportWord, setExportingReportWord] = useState(false);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [documentsMeeting, setDocumentsMeeting] = useState<Meeting | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsUploading, setDocumentsUploading] = useState(false);
  const [documentsDeletingId, setDocumentsDeletingId] = useState<string | null>(null);
  const [meetingDocuments, setMeetingDocuments] = useState<MeetingDocumentDto[]>([]);
  const docFileInputRef = useRef<HTMLInputElement | null>(null);

  const canManagePollForMeeting = (m: Meeting): boolean => {
    return Boolean(m.canManagePoll);
  };

  const isHostForMeeting = (m: Meeting): boolean => {
    if (m.isMeetingHost) return true;
    const hostIdentity = String(m.hostIdentity || '').trim().toLowerCase();
    if (!hostIdentity) return false;
    const userId = String(user?.id || '').trim().toLowerCase();
    const username = String(user?.username || '').trim().toLowerCase();
    return hostIdentity === userId || hostIdentity === username;
  };

  const isUpcomingMeeting = (m: Meeting): boolean => {
    return !m.endedAt && (m.activeParticipantCount ?? 0) === 0;
  };

  const canEditMeeting = (m: Meeting): boolean => {
    return isHostForMeeting(m) && isUpcomingMeeting(m);
  };

  const canManageMeetingInvitees = (m: Meeting | null): boolean => {
    if (!m) return false;
    return isHostForMeeting(m) || Boolean(isAdmin);
  };

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!detailMeeting) {
      setMeetingInvitees([]);
      setMeetingCoHosts([]);
      setInviteUsernameInput('');
      return;
    }
    if (!canManageMeetingInvitees(detailMeeting)) {
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
      if (inv.error) message.error(inv.error);
      if (co.data) setMeetingCoHosts(co.data);
      if (co.error) message.error(co.error);
    });
    return () => {
      cancelled = true;
    };
  }, [detailMeeting, isAdmin, user?.id, user?.username]);

  const submitAddInvitee = async () => {
    if (!detailMeeting) return;
    const u = inviteUsernameInput.trim();
    if (!u) {
      message.warning('Nhập username');
      return;
    }
    setAddingInvitee(true);
    const r = await meetingApi.addInvitee(detailMeeting.id, u);
    setAddingInvitee(false);
    if (r.data) {
      setMeetingInvitees((prev) => {
        const un = r.data!.username.toLowerCase();
        if (prev.some((x) => x.username.toLowerCase() === un)) return prev;
        return [...prev, r.data!];
      });
      message.success('Đã thêm vào danh sách mời');
      setInviteUsernameInput('');
    }
    if (r.error) message.error(r.error);
  };

  const removeInviteeRow = async (invUsername: string) => {
    if (!detailMeeting) return;
    setRemovingInviteeUsername(invUsername);
    const r = await meetingApi.removeInvitee(detailMeeting.id, invUsername);
    setRemovingInviteeUsername(null);
    if (!r.error) {
      const key = invUsername.toLowerCase();
      setMeetingInvitees((prev) => prev.filter((x) => x.username.toLowerCase() !== key));
      message.success('Đã xóa khỏi danh sách mời');
    }
    if (r.error) message.error(r.error);
  };

  const promoteInviteeToCoHost = async (invUsername: string) => {
    if (!detailMeeting) return;
    setPromotingInviteeUsername(invUsername);
    const r = await meetingApi.promoteInviteeToCoHost(detailMeeting.id, invUsername);
    setPromotingInviteeUsername(null);
    if (r.data) {
      const key = invUsername.toLowerCase();
      setMeetingInvitees((prev) => prev.filter((x) => x.username.toLowerCase() !== key));
      setMeetingCoHosts((prev) => {
        if (prev.some((x) => x.hostUserId === r.data!.hostUserId)) return prev;
        return [...prev, r.data!];
      });
      message.success('Đã chỉ định làm đồng chủ trì');
    }
    if (r.error) message.error(r.error);
  };

  const demoteCoHostToInvitee = async (coHostUsername: string) => {
    if (!detailMeeting) return;
    setDemotingCoHostUsername(coHostUsername);
    const r = await meetingApi.demoteCoHostToInvitee(detailMeeting.id, coHostUsername);
    setDemotingCoHostUsername(null);
    if (!r.error) {
      const key = coHostUsername.toLowerCase();
      setMeetingCoHosts((prev) => prev.filter((x) => x.username.toLowerCase() !== key));
      // Load lại để đảm bảo đồng bộ danh sách từ server
      const inv = await meetingApi.listInvitees(detailMeeting.id);
      if (inv.data) setMeetingInvitees(inv.data);
      message.success('Đã chuyển vai trò thành Thành viên');
    }
    if (r.error) message.error(r.error);
  };

  const removeCoHostRow = async (hostUserId: string) => {
    if (!detailMeeting) return;
    setRemovingCoHostUserId(hostUserId);
    const r = await meetingApi.removeCoHost(detailMeeting.id, hostUserId);
    setRemovingCoHostUserId(null);
    if (!r.error) {
      setMeetingCoHosts((prev) => prev.filter((x) => x.hostUserId !== hostUserId));
      message.success('Đã gỡ đồng chủ trì');
    }
    if (r.error) message.error(r.error);
  };

  useEffect(() => {
    if (isAuthenticated) {
      void loadMeetings();
    }
  }, [isAuthenticated]);

  const loadMeetings = async () => {
    setLoadingMeetings(true);
    const result = await apiService.getMeetings();
    if (result.data) setMeetings(result.data as Meeting[]);
    if (result.error) message.error(result.error);
    setLoadingMeetings(false);
  };

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

  const copyText = async (text: string, typeName?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(`Đã sao chép ${typeName ? typeName : ''}`);
    } catch {
      message.error('Không thể copy. Vui lòng thử lại.');
    }
  };

  const buildMeetingLink = (meetingId: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/meeting/${meetingId}`;
  };

  // --- Các hàm xử lý Biểu quyết, Tài liệu, Biên bản giữ nguyên ---
  const submitPollForMeeting = async () => {
    if (!pollModalMeeting) return;
    const values = await pollForm.validateFields();
    const title = String(values.title || '').trim();
    const options = (values.options as string[]).map((x) => String(x || '').trim()).filter(Boolean);
    const selectionMode = values.selectionMode === 'multiple' ? 'multiple' : 'single';
    const durationKind = values.durationKind === 'timed' ? 'timed' : 'none';
    const durationMinutes = Math.max(1, Math.min(10080, Number(values.durationMinutes) || 5));
    const createdAt = Date.now();
    const endAt = durationKind === 'timed' ? createdAt + durationMinutes * 60 * 1000 : null;

    setSavingPoll(true);
    const result = editingDraftPollId
      ? await meetingApi.updateDraftPoll(pollModalMeeting.id, editingDraftPollId, {
          pollId: editingDraftPollId,
          title,
          options,
          createdBy: user?.id ?? '',
          createdByName: user?.fullName?.trim() || user?.username || 'Host',
          createdAt,
          selectionMode,
          endAt,
          status: 'draft',
        })
      : await meetingApi.createPoll(pollModalMeeting.id, {
          title,
          options,
          createdBy: user?.id ?? '',
          createdByName: user?.fullName?.trim() || user?.username || 'Host',
          createdAt,
          selectionMode,
          endAt,
          status: 'draft',
        });
    setSavingPoll(false);

    if (result.error) {
      message.error(result.error);
      return;
    }
    message.success(editingDraftPollId ? 'Đã cập nhật biểu quyết nháp' : 'Đã lưu biểu quyết nháp');
    setPollModalMeeting(null);
    setEditingDraftPollId(null);
    pollForm.resetFields();
    if (viewPollMeeting) {
      const pollsRes = await meetingApi.listPolls(viewPollMeeting.id);
      if (pollsRes.data) setViewPolls(pollsRes.data);
    }
  };

  const openPollListModal = async (meeting: Meeting) => {
    setViewPollMeeting(meeting);
    setManageTab('waiting');
    setViewPollsLoading(true);
    const pollsRes = await meetingApi.listPolls(meeting.id);
    setViewPollsLoading(false);
    if (pollsRes.error || !pollsRes.data) {
      message.error(pollsRes.error || 'Không tải được danh sách biểu quyết');
      return;
    }
    setViewPolls(pollsRes.data);

    if (canManagePollForMeeting(meeting)) {
      setManagerLoading(true);
      const mgrRes = await meetingApi.listPollManagers(meeting.id);
      setManagerLoading(false);
      if (mgrRes.data) setManagers(mgrRes.data);
      else setManagers([]);
    } else {
      setManagers([]);
    }
  };

  const submitAddManager = async () => {
    if (!viewPollMeeting) return;
    const username = managerUsername.trim();
    if (!username) return;
    setAddingManager(true);
    const res = await meetingApi.addPollManager(viewPollMeeting.id, { username });
    setAddingManager(false);
    if (res.error) {
      message.error(res.error);
      return;
    }
    message.success('Đã thêm quản lý biểu quyết');
    setManagerUsername('');
    const mgrRes = await meetingApi.listPollManagers(viewPollMeeting.id);
    if (mgrRes.data) setManagers(mgrRes.data);
  };

  const removeManager = async (username: string) => {
    if (!viewPollMeeting) return;
    const res = await meetingApi.removePollManager(viewPollMeeting.id, username);
    if (res.error) {
      message.error(res.error);
      return;
    }
    message.success('Đã xóa quản lý biểu quyết');
    const mgrRes = await meetingApi.listPollManagers(viewPollMeeting.id);
    if (mgrRes.data) setManagers(mgrRes.data);
  };

  const closePublishedPoll = async (pollId: string) => {
    if (!viewPollMeeting) return;
    const res = await meetingApi.closePoll(viewPollMeeting.id, pollId, {
      closedBy: user?.id ?? '',
      at: Date.now(),
    });
    if (res.error) {
      message.error(res.error);
      return;
    }
    message.success('Đã kết thúc biểu quyết');
    const pollsRes = await meetingApi.listPolls(viewPollMeeting.id);
    if (pollsRes.data) setViewPolls(pollsRes.data);
  };

  const pollOptionCounts = (poll: PollResponse): number[] => {
    const counts = poll.options.map(() => 0);
    for (const vote of poll.votes ?? []) {
      for (const idx of vote.optionIndices ?? []) {
        if (idx >= 0 && idx < counts.length) counts[idx] += 1;
      }
    }
    return counts;
  };

  const editDraftPoll = (poll: PollResponse) => {
    if (!viewPollMeeting) return;
    setPollModalMeeting(viewPollMeeting);
    setEditingDraftPollId(poll.pollId);
    pollForm.setFieldsValue({
      title: poll.title,
      selectionMode: poll.selectionMode,
      durationKind: poll.endAt ? 'timed' : 'none',
      durationMinutes: poll.endAt ? Math.max(1, Math.ceil((poll.endAt - Date.now()) / 60000)) : 5,
      options: poll.options?.length ? poll.options : ['', ''],
    });
  };

  const deleteDraftPoll = async (pollId: string) => {
    if (!viewPollMeeting) return;
    const res = await meetingApi.deleteDraftPoll(viewPollMeeting.id, pollId);
    if (res.error) {
      message.error(res.error);
      return;
    }
    message.success('Đã xóa biểu quyết chờ');
    const pollsRes = await meetingApi.listPolls(viewPollMeeting.id);
    if (pollsRes.data) setViewPolls(pollsRes.data);
  };

  const openHistoryModal = async (meeting: Meeting) => {
    setHistoryTablePage(1);
    setHistoryMeeting(meeting);
    setHistoryLoading(true);
    const res = await apiService.getMeetingHistory(meeting.id);
    if (res.error || !res.data) {
      setHistoryLoading(false);
      message.error(res.error || 'Không tải được lịch sử cuộc họp');
      setHistoryItems([]);
      return;
    }
    const items = (res.data as HistoryEntry[]) ?? [];

    if (isAdmin && items.length > 0) {
      const usersRes = await apiService.getAllUsers();
      if (usersRes.data && Array.isArray(usersRes.data)) {
        const byId = new Map<string, string>();
        for (const u of usersRes.data as any[]) {
          const id = String(u?.id ?? '');
          const fullName = String(u?.fullName ?? '').trim();
          if (id && fullName) byId.set(id, fullName);
        }
        setHistoryItems(items.map((h) => ({ ...h, fullName: byId.get(h.userId) ?? null })));
        setHistoryLoading(false);
        return;
      }
    }

    setHistoryItems(items);
    setHistoryLoading(false);
  };

  const openReportModal = async (meeting: Meeting) => {
    setReportMeeting(meeting);
    setReportMinutes(null);
    setReportMinutesLoading(true);
    const res = await meetingApi.getMinutes(meeting.id);
    if (res.error || !res.data) {
      message.error(res.error || 'Không tải được biên bản');
      setReportMinutesLoading(false);
      setReportMeeting(null);
      return;
    }
    setReportMinutes(res.data);
    setReportMinutesLoading(false);
  };

  const loadDocumentsForMeeting = async (meetingId: string) => {
    setDocumentsLoading(true);
    const res = await meetingApi.listMeetingDocuments(meetingId);
    setDocumentsLoading(false);
    if (res.error || !res.data) {
      message.error(res.error || 'Không tải được danh sách tài liệu');
      setMeetingDocuments([]);
      return;
    }
    setMeetingDocuments(res.data);
  };

  const openDocumentsModal = async (meeting: Meeting) => {
    setDocumentsMeeting(meeting);
    setMeetingDocuments([]);
    await loadDocumentsForMeeting(meeting.id);
  };

  const onPickDocumentFile = () => docFileInputRef.current?.click();

  const onUploadMeetingDocument: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !documentsMeeting) return;
    e.target.value = '';
    setDocumentsUploading(true);
    try {
      const res = await meetingApi.uploadMeetingDocument(documentsMeeting.id, file);
      if ('error' in res && res.error) {
        message.error(res.error);
        return;
      }
      message.success('Đã tải tài liệu lên');
      await loadDocumentsForMeeting(documentsMeeting.id);
    } finally {
      setDocumentsUploading(false);
    }
  };

  const onDeleteMeetingDocument = async (doc: MeetingDocumentDto) => {
    if (!documentsMeeting) return;
    setDocumentsDeletingId(doc.id);
    try {
      const res = await meetingApi.deleteMeetingDocument(documentsMeeting.id, doc.id);
      if (res.error) {
        message.error(res.error);
        return;
      }
      message.success('Đã xóa tài liệu');
      await loadDocumentsForMeeting(documentsMeeting.id);
    } finally {
      setDocumentsDeletingId(null);
    }
  };

  const onViewMeetingDocument = async (doc: MeetingDocumentDto) => {
    if (!documentsMeeting) return;
    try {
      const blob = await meetingApi.getMeetingDocumentFileBlob(documentsMeeting.id, doc.id);
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    } catch (err) {
      message.error((err as Error)?.message || 'Không mở được tài liệu');
    }
  };

  const copyReportMinutesText = async () => {
    if (!reportMinutes) return;
    try {
      await navigator.clipboard.writeText(buildMinutesText(reportMinutes));
      message.success('Đã sao chép biên bản');
    } catch {
      message.error('Không sao chép được');
    }
  };

  const exportReportWord = async () => {
    if (!reportMinutes) return;
    setExportingReportWord(true);
    try {
      await exportMeetingMinutesWord(reportMinutes);
    } finally {
      setExportingReportWord(false);
    }
  };

  const exportHistoryToExcel = () => {
    if (!historyMeeting) return;
    if (historyItems.length === 0) {
      message.warning('Không có dữ liệu để xuất');
      return;
    }
    setExportingHistoryExcel(true);
    try {
      const rows = historyItems.map((r, i) => ({
        STT: i + 1,
        'Người dùng': r.fullName?.trim() || r.username,
        Username: r.username,
        'Vào lúc': r.joinedAt ? dayjs(r.joinedAt).format('DD/MM/YYYY HH:mm:ss') : '',
        'Rời lúc': r.leftAt ? dayjs(r.leftAt).format('DD/MM/YYYY HH:mm:ss') : 'Đang tham gia',
        'Thời lượng tham gia': formatHistoryParticipationDuration(r),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Lịch sử');
      const safeTitle = historyMeeting.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
      const stamp = dayjs().format('YYYYMMDD-HHmm');
      XLSX.writeFile(wb, `lich-su-cuoc-hoc-${safeTitle}-${stamp}.xlsx`);
    } catch {
      message.error('Xuất Excel thất bại');
    } finally {
      setExportingHistoryExcel(false);
    }
  };

  const openDetailModal = (meeting: Meeting) => {
    router.push(`/meetings/${meeting.id}`);
  };

  const openEditMeetingModal = (meeting: Meeting) => {
    if (!canEditMeeting(meeting)) {
      message.warning('Chỉ host mới được chỉnh sửa cuộc họp chưa diễn ra');
      return;
    }
    setEditMeetingModal(meeting);
    editMeetingForm.setFieldsValue({
      title: meeting.title,
      startAt: dayjs(meeting.createdAt),
      estimatedEndAt: meeting.startedAt ? dayjs(meeting.startedAt) : null,
    });
  };

  const submitEditMeeting = async () => {
    if (!editMeetingModal) return;
    const values = await editMeetingForm.validateFields();
    const title = String(values.title || '').trim();
    const startAt = values.startAt?.valueOf?.();
    const estimatedEndAt = values.estimatedEndAt?.valueOf?.() ?? null;

    if (!title) {
      message.error('Vui lòng nhập tiêu đề cuộc họp');
      return;
    }
    if (!startAt || Number.isNaN(startAt)) {
      message.error('Vui lòng chọn thời gian bắt đầu');
      return;
    }
    if (estimatedEndAt != null && estimatedEndAt <= startAt) {
      message.error('Thời gian kết thúc dự kiến phải sau thời gian bắt đầu');
      return;
    }

    setUpdatingMeeting(true);
    const res = await meetingApi.updateMeeting(editMeetingModal.id, {
      title,
      startAt,
      estimatedEndAt,
    });
    setUpdatingMeeting(false);
    if (res.error || !res.data) {
      message.error(res.error || 'Không thể cập nhật cuộc họp');
      return;
    }

    const updated = res.data as Meeting;
    setMeetings((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
    setDetailMeeting((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
    setEditMeetingModal(null);
    message.success('Đã cập nhật cuộc họp');
  };

  // --- LOGIC TÍNH TOÁN STATS VÀ LỌC ---
  const meetingsWithStatus = useMemo(() => {
    return meetings.map(m => {
      const isEnded = Boolean(m.endedAt);
      const isLive = !isEnded && (m.activeParticipantCount ?? 0) > 0;
      const statusObj = isLive ? 'live' : isEnded ? 'done' : 'upcoming';
      return { ...m, computedStatus: statusObj };
    });
  }, [meetings]);

  const statTotal = meetings.length;
  const statUpcoming = meetingsWithStatus.filter(m => m.computedStatus === 'upcoming').length;
  const statLive = meetingsWithStatus.filter(m => m.computedStatus === 'live').length;
  const statDone = meetingsWithStatus.filter(m => m.computedStatus === 'done').length;

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

  const TABLE_COL = {
    stt: { xs: 2, md: 1 },
    info: { xs: 10, md: 13 },
    status: { xs: 6, md: 5 },
    action: { xs: 6, md: 4 },
  } as const;
  const TABLE_PADDING = {
    header: isMobile ? '10px 6px' : '14px 20px',
    body: isMobile ? '10px 6px' : '16px 20px',
    headerTight: isMobile ? '10px 1px' : '14px 20px',
    bodyTight: isMobile ? '10px 1px' : '16px 20px',
  } as const;
  const ROLE_TABLE_LAYOUT = {
    scrollX: isMobile ? 500 : 620,
    stt: isMobile ? 42 : 50,
    username: isMobile ? 60 : 80,
    fullName: isMobile ? 120 : 150,
    role: isMobile ? 88 : 120,
    roleSelect: isMobile ? 96 : 120,
    remove: isMobile ? 56 : 72,
  } as const;


  if (loading) return <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}><Spin size="large" /></div>;
  if (!isAuthenticated) return null;

  return (
    <MainLayout>
      {/* CSS Tuỳ chỉnh: Đã lược bỏ toàn bộ Media Queries của Grid vì chúng ta dùng Row/Col */}
      <style dangerouslySetInnerHTML={{__html: `
        .dashboard-container { padding: 24px; width: 100%; animation: fadeIn 0.2s ease-out;}
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        
        .filter-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .search-input-wrapper { flex: 1; min-width: 250px; }
        .filter-chip-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .filter-chip { height: 38px; padding: 0 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: white; color: #64748b; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; flex: 0 0 auto; }
        .filter-chip:hover { border-color: #2563eb; color: #2563eb; }
        .filter-chip.active { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; font-weight: 600; }
        
        .table-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: visible; box-shadow: 0 2px 6px rgba(0,0,0,0.02); }
        .meetings-pagination { display: flex; align-items: center; flex-wrap: nowrap; white-space: nowrap; margin: 0; }
        .meetings-pagination .ant-pagination-options { margin-inline-start: 6px; }
        .meetings-pagination .ant-select-selector { min-width: 72px; }
        
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

        .page-detail { animation: fadeIn 0.2s ease-out; }
        .detail-back { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #64748b; cursor: pointer; margin-bottom: 18px; background: none; border: none; padding: 6px 10px; border-radius: 6px; transition: all 0.15s; font-weight: 500;}
        .detail-back:hover { background: #fff; color: #2563eb; }
        .detail-header { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .detail-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
        .detail-title { font-size: 20px; font-weight: 600; color: #1e293b; }
        .detail-sub { font-size: 12px; color: #94a3b8; margin-top: 3px; }
        
        .info-block { background: #f8fafc; border-radius: 6px; padding: 12px 14px; height: 100%; }
        .ib-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; font-weight: 600; }
        .ib-value { font-size: 15px; font-weight: 600; color: #1e293b; }
        .ib-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
        
        .detail-divider { border: none; border-top: 1px solid #e2e8f0; margin: 14px 0; }
        
        .access-card { background: #f8fafc; border-radius: 6px; padding: 10px 14px; height: 100%; }
        .ac-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; font-weight: 600; }
        .ac-val-row { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
        .ac-val { font-family: 'Courier New', monospace; font-size: 16px; font-weight: 700; color: #1e293b; letter-spacing: 0.05em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
        .btn-copy { font-size: 11px; padding: 3px 8px; border: 1px solid #cbd5e1; border-radius: 4px; background: white; color: #64748b; cursor: pointer; transition: all 0.15s; white-space: nowrap; flex-shrink: 0;}
        .btn-copy:hover { border-color: #2563eb; color: #2563eb; background: #eff6ff; }
        
        .section-title-sm { font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin: 18px 0 10px; }
        
        .qa-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; cursor: pointer; transition: all 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 6px; height: 100%; }
        .qa-card:hover { border-color: #2563eb; box-shadow: 0 0 0 3px #eff6ff; }
        .qa-icon { width: 34px; height: 34px; background: #eff6ff; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; margin-bottom: 2px; }
        .qa-name { font-size: 13px; font-weight: 600; color: #1e293b; }
        .qa-desc { font-size: 11px; color: #94a3b8; }
        
        .participants-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .p-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; }
        .p-row:last-child { border-bottom: none; }
        .p-avatar { width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; }
        .av-blue { background: #dbeafe; color: #1d4ed8; }
        .av-amber { background: #fef3c7; color: #92400e; }
        .p-name-col { flex: 1; min-width: 0; }
        .p-name { font-size: 13px; font-weight: 500; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .p-role { font-size: 11px; color: #94a3b8; }
        .p-status-badge { font-size: 11px; padding: 2px 9px; border-radius: 99px; font-weight: 500; white-space: nowrap; }
        .psb-host { background: #dbeafe; color: #1d4ed8; }
        .psb-invited { background: #f1f5f9; color: #64748b; }
        .p-invite-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px; border-top: 1px solid #e2e8f0; background: #f8fafc; }
        
        .bottom-btns { display: flex; gap: 8px; margin-top: 20px; flex-wrap: wrap; }
        .btn-join { flex: 1; padding: 10px; border-radius: 6px; background: #2563eb; color: white; border: none; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.15s; white-space: nowrap; min-width: 150px; }
        .btn-join:hover { background: #1d4ed8; }
        .btn-edit { padding: 10px 18px; border-radius: 6px; border: 1px solid #cbd5e1; background: white; color: #1e293b; font-size: 13px; cursor: pointer; transition: background 0.15s; font-weight: 500; white-space: nowrap;}
        .btn-edit:hover { background: #f8fafc; }
        .btn-delete { padding: 10px 18px; border-radius: 6px; border: 1px solid #fecaca; background: white; color: #ef4444; font-size: 13px; cursor: pointer; transition: background 0.15s; font-weight: 500; white-space: nowrap;}
        .btn-delete:hover { background: #fef2f2; }

        @media (max-width: 992px) {
          .participants-card .ant-table { font-size: 12px; }
          .participants-card .ant-table-thead > tr > th,
          .participants-card .ant-table-tbody > tr > td {
            padding: 6px 4px !important;
            white-space: nowrap;
          }
          .participants-card .ant-btn-sm {
            height: 26px;
            padding: 0 8px;
            font-size: 12px;
          }
          .participants-card .ant-select-selector {
            height: 28px !important;
            font-size: 12px;
            padding-inline: 2px !important;
          }
          .participants-card .ant-select-selection-item {
            line-height: 26px !important;
          }
          .p-invite-bar {
            padding: 8px 10px;
            gap: 6px;
          }
          .p-invite-bar .ant-input {
            height: 32px;
            font-size: 13px;
          }
          .p-invite-bar .ant-btn {
            height: 32px;
            font-size: 12px;
            padding: 0 10px;
          }
        }

        @media (max-width: 768px) {
          .search-input-wrapper { min-width: 100%; }
          .filter-chip-row {
            width: 100%;
            flex-wrap: nowrap;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            padding-bottom: 2px;
          }
          .filter-chip-row::-webkit-scrollbar { display: none; }
          .section-title-sm { font-size: 11px; margin: 12px 0 8px; }
        }
      `}}/>

      <div className="dashboard-container">
        
        {/* Header Section */}
        {!detailMeeting && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <Space align="center" size="middle">
              <div style={{
                background: '#2563eb',
                color: 'white',
                width: 44,
                height: 44,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                boxShadow: '0 4px 10px rgba(37, 99, 235, 0.2)'
              }}>
                <VideoCameraOutlined />
              </div>
              <div>
                <Typography.Title level={4} style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>
                  {isAdmin ? 'Quản lý tất cả cuộc họp' : 'Quản lý cuộc họp'}
                </Typography.Title>
                <Typography.Text style={{ color: '#64748b', fontSize: 13, fontWeight: 500 }}>
                  <>Tổng cộng <span style={{ color: '#2563eb', fontWeight: 700 }}>{meetings.length}</span> cuộc họp đã tạo</>
                </Typography.Text>
              </div>
            </Space>

            <Button icon={<ReloadOutlined />} onClick={() => void loadMeetings()} loading={loadingMeetings} size="large" style={{ borderRadius: 8, fontWeight: 500 }}>
              {isMobile ? '' : 'Làm mới'}
            </Button>
          </div>
        )}

        {/* --- VIEW: DANH SÁCH CUỘC HỌP --- */}
        {!detailMeeting ? (
          <>
            {/* Stats Section sử dụng Row Col với 2 thông số */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }} align="stretch">
              <Col xs={24} sm={12} md={6}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8, fontWeight: 500, minHeight: 38 }}>Tổng cuộc họp</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#1e293b', lineHeight: 1 }}>{statTotal}</div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8, fontWeight: 500, minHeight: 38 }}>Chưa diễn ra</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#2563eb', lineHeight: 1 }}>{statUpcoming}</div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8, fontWeight: 500, minHeight: 38 }}>Đang diễn ra</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a', lineHeight: 1 }}>{statLive}</div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8, fontWeight: 500, minHeight: 38 }}>Đã kết thúc</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#1e293b', lineHeight: 1 }}>{statDone}</div>
                </div>
              </Col>
            </Row>

            {/* Filter Section */}
            <div className="filter-bar">
              <div className="search-input-wrapper">
                <Input 
                  prefix={<SearchOutlined style={{ color: '#94a3b8' }} />} 
                  placeholder="Tìm tên cuộc họp, mã, host..." 
                  size="large"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ borderRadius: 8 }}
                  allowClear
                />
              </div>
              <div className="filter-chip-row">
                <button className={`filter-chip ${filterStatus === 'all' ? 'active' : ''}`} onClick={() => setFilterStatus('all')}>
                  Tất cả
                </button>
                <button className={`filter-chip ${filterStatus === 'upcoming' ? 'active' : ''}`} onClick={() => setFilterStatus('upcoming')}>
                  <HourglassOutlined /> Chưa diễn ra
                </button>
                <button className={`filter-chip ${filterStatus === 'live' ? 'active' : ''}`} onClick={() => setFilterStatus('live')}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }}></div> Đang diễn ra
                </button>
                <button className={`filter-chip ${filterStatus === 'done' ? 'active' : ''}`} onClick={() => setFilterStatus('done')}>
                  <CheckCircleOutlined /> Đã kết thúc
                </button>
              </div>
            </div>

            {/* Custom Table Component */}
            <div className="table-card">
              
              {/* TABLE HEADER - Dùng thẻ Row/Col */}
              <Row 
                align="stretch" 
                style={{ 
                  borderBottom: '1px solid #e2e8f0', 
                  background: '#f8fafc', 
                  flexWrap: 'nowrap',
                  position: 'sticky',
                  top: 0,
                  zIndex: 15
                }}
              >
                <Col {...TABLE_COL.stt} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: TABLE_PADDING.header, fontSize: isMobile ? 10 : 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap', borderRight: '1px solid #e2e8f0' }}>STT</Col>
                <Col {...TABLE_COL.info} style={{ display: 'flex', alignItems: 'center',justifyContent: 'center', padding: TABLE_PADDING.header, fontSize: isMobile ? 10 : 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap', borderRight: '1px solid #e2e8f0' }}>THÔNG TIN CUỘC HỌP</Col>
                <Col {...TABLE_COL.status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: TABLE_PADDING.headerTight, fontSize: isMobile ? 10 : 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap', borderRight: '1px solid #e2e8f0' }}>TRẠNG THÁI</Col>
                <Col {...TABLE_COL.action} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 0, fontSize: isMobile ? 10 : 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>THAO TÁC</Col>
              </Row>

              <div>
                {loadingMeetings ? (
                  <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
                ) : paginatedMeetings.length === 0 ? (
                  <Empty description="Không tìm thấy cuộc họp" style={{ padding: 40 }} />
                ) : (
                  paginatedMeetings.map((m, index) => {
                    const isLive = m.computedStatus === 'live';
                    const isDone = m.computedStatus === 'done';
                    const isUpcoming = m.computedStatus === 'upcoming';
                    const actionLabel = isLive ? 'Tham gia' : isDone ? 'Xem lịch sử' : 'Chi tiết';

                    return (
                      /* TABLE BODY - Dùng thẻ Row/Col (Có 2 tham số xs và md) */
                      <Row 
                        key={m.id}
                        align="stretch" 
                        style={{ 
                          borderBottom: '1px solid #e2e8f0', 
                          cursor: 'pointer', 
                          flexWrap: 'nowrap', 
                          transition: 'background 0.2s' 
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        onClick={() => openDetailModal(m)}
                      >
                        {/* Cột 1: STT */}
                        <Col {...TABLE_COL.stt} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: TABLE_PADDING.body, fontSize: isMobile ? 11 : 14, color: '#94a3b8', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>
                           {(tablePage - 1) * tablePageSize + index + 1}
                        </Col>

                        {/* Cột 2: Thông tin */}
                        <Col {...TABLE_COL.info} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 14, minWidth: 0, padding: TABLE_PADDING.body, borderRight: '1px solid #e2e8f0' }}>
                           <div style={{ width: isMobile ? 28 : 42, height: isMobile ? 28 : 42, flexShrink: 0, background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: isMobile ? 6 : 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', fontSize: isMobile ? 12 : 18 }}>
                              <CalendarOutlined />
                           </div>
                           <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: isMobile ? 12 : 15, fontWeight: 600, color: '#1e293b', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.title}>
                                {m.title}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, fontSize: isMobile ? 10 : 13, color: '#64748b' }}>
                                  <span style={{ whiteSpace: 'nowrap' }}>{dayjs(m.createdAt).format(isMobile ? 'HH:mm DD/MM/YY' : 'HH:mm · DD/MM/YYYY')}</span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500, minWidth: 0 }}>
                                    {!isMobile && <Avatar size={18} style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', fontSize: 10, flexShrink: 0 }}>{m.hostName.charAt(0).toUpperCase()}</Avatar>}
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: isMobile ? 100 : 180 }}>{isMobile ? `A ${m.hostName}` : m.hostName}</span>
                                  </span>
                              </div>
                           </div>
                        </Col>

                        {/* Cột 3: Trạng thái */}
                        <Col {...TABLE_COL.status} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 4, minWidth: 0, padding: TABLE_PADDING.bodyTight, borderRight: '1px solid #e2e8f0' }}>
                           <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                              {isUpcoming && <span style={{ display: 'inline-flex', alignItems: 'center', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: isMobile ? '2px 4px' : '4px 10px', borderRadius: 99, fontSize: isMobile ? 9 : 11, fontWeight: 600, whiteSpace: 'nowrap' }}>Chưa diễn ra</span>}
                              {isLive && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: isMobile ? '2px 4px' : '4px 10px', borderRadius: 99, fontSize: isMobile ? 9 : 11, fontWeight: 600, whiteSpace: 'nowrap' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: 'blink 1.5s ease-in-out infinite' }}></span> Đang diễn ra</span>}
                              {isDone && <span style={{ display: 'inline-flex', alignItems: 'center', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', padding: isMobile ? '2px 4px' : '4px 10px', borderRadius: 99, fontSize: isMobile ? 9 : 11, fontWeight: 600, whiteSpace: 'nowrap' }}>Đã kết thúc</span>}
                           </div>
                        </Col>

                        {/* Cột 4: Thao tác */}
                        <Col {...TABLE_COL.action} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minWidth: 0, padding: 0 }} onClick={(e) => e.stopPropagation()}>
                           {isLive ? (
                              <button 
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: isMobile ? '2px 6px' : '4px 10px', borderRadius: 99, border: '1px solid #10b981', background: '#10b981', color: 'white', fontSize: isMobile ? 9 : 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', width: 'auto', minWidth: 0, margin: '0 auto', lineHeight: 1.3 }}
                                onClick={(e) => { e.stopPropagation(); router.push(`/meeting/${m.id}`); }}
                              >
                                <PlayCircleOutlined /> {!isMobile && <span>Tham gia</span>}
                                {isMobile && <span>Vào</span>}
                              </button>
                           ) : (
                              <button 
                                style={{ padding: isMobile ? '2px 6px' : '4px 10px', borderRadius: 99, border: '1px solid #bfdbfe', background: '#fff', color: '#1d4ed8', fontSize: isMobile ? 9 : 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', width: 'auto', textAlign: 'center', minWidth: 0, margin: '0 auto', lineHeight: 1.3 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isDone) openHistoryModal(m);
                                  else openDetailModal(m);
                                }}
                              >
                                {isMobile && isDone ? 'Lịch sử' : actionLabel}
                              </button>
                           )}
                        </Col>
                      </Row>
                    );
                  })
                )}
              </div>
              
              <div
                style={{
                  padding: isMobile ? '10px 12px' : '16px 24px',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: isMobile ? 'center' : 'flex-end',
                  overflowX: 'auto',
                }}
              >
                <Pagination 
                    className="meetings-pagination"
                    size={isCompactPagination ? 'small' : 'default'}
                    current={tablePage}
                    pageSize={tablePageSize}
                    total={filteredMeetings.length}
                    showSizeChanger
                    pageSizeOptions={['10', '20', '50', '100']}
                    onChange={(p, ps) => { setTablePage(p); setTablePageSize(ps); }}
                    showTotal={isCompactPagination ? undefined : (total, range) => `Hiển thị ${range[0]}-${range[1]} / ${total}`}
                    showLessItems={isCompactPagination}
                    itemRender={(page, type, originalElement) => {
                      if (!isCompactPagination) return originalElement;
                      if (type === 'prev' || type === 'next') return null;
                      if (type === 'jump-prev' || type === 'jump-next') return originalElement;
                      if (type !== 'page' || totalPages <= 5) return originalElement;
                      const isEdgePage = page <= 2 || page > totalPages - 2;
                      const isCurrentPage = page === tablePage;
                      return isEdgePage || isCurrentPage ? originalElement : null;
                    }}
                />
              </div>
            </div>
          </>
        ) : (
          /* --- VIEW: TRANG CHI TIẾT --- */
          <div className="page-detail">
            <button
              className="detail-back"
              onClick={() => {
                if (forcedDetailMeetingId) {
                  router.push('/meetings');
                } else {
                  setDetailMeeting(null);
                }
              }}
            >
              <ArrowLeftOutlined /> Quay lại danh sách
            </button>

            <div className="detail-header">
              <div className="detail-title-row">
                <div>
                  <div className="detail-title">{detailMeeting.title}</div>
                  <div className="detail-sub">Tạo bởi {detailMeeting.hostName} · {dayjs(detailMeeting.createdAt).format('DD/MM/YYYY')}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  {(() => {
                    const isEnded = Boolean(detailMeeting.endedAt);
                    const isLive = !isEnded && (detailMeeting.activeParticipantCount ?? 0) > 0;
                    if (isLive) return <span className="status-badge status-live"><span className="dot dot-blink"></span> Đang diễn ra</span>;
                    if (isEnded) return <span className="status-badge status-done">Đã kết thúc</span>;
                    return <span className="status-badge status-upcoming">Chưa diễn ra</span>;
                  })()}
                  {detailMeeting.endedAt && (
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                      {dayjs(detailMeeting.endedAt).format('HH:mm - DD/MM/YYYY')}
                    </div>
                  )}
                </div>
              </div>
              
              <Row gutter={[10, 10]} style={{ marginBottom: 16 }}>
                <Col xs={24} md={8}>
                  <div className="info-block">
                    <div className="ib-label">Thời gian bắt đầu</div>
                    <div className="ib-value">{dayjs(detailMeeting.createdAt).format('HH:mm')}</div>
                    <div className="ib-sub">{dayjs(detailMeeting.createdAt).format('DD/MM/YYYY')}</div>
                  </div>
                </Col>
                <Col xs={24} md={8}>
                  <div className="info-block">
                    <div className="ib-label">Kết thúc dự kiến</div>
                    {detailMeeting.startedAt ? (
                      <>
                        <div className="ib-value">{dayjs(detailMeeting.startedAt).format('HH:mm')}</div>
                        <div className="ib-sub">{dayjs(detailMeeting.startedAt).format('DD/MM/YYYY')}</div>
                      </>
                    ) : (
                      <>
                        <div className="ib-value">—</div>
                        <div className="ib-sub">Chưa đặt thời gian</div>
                      </>
                    )}
                  </div>
                </Col>
                <Col xs={24} md={8}>
                  <div className="info-block">
                    <div className="ib-label">Host</div>
                    <div className="ib-value">{detailMeeting.hostName}</div>
                    <div className="ib-sub">Quản trị viên</div>
                  </div>
                </Col>
              </Row>
              
              <hr className="detail-divider" />
              
              <Row gutter={[10, 10]}>
                <Col xs={24} sm={12} lg={6}>
                  <div className="access-card">
                    <div className="ac-label">Mã phòng</div>
                    <div className="ac-val-row">
                      <span className="ac-val">{detailMeeting.meetingCode}</span>
                      <button className="btn-copy" onClick={() => copyText(detailMeeting.meetingCode, 'Mã phòng')}>Sao chép</button>
                    </div>
                  </div>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <div className="access-card">
                    <div className="ac-label">Mật khẩu</div>
                    <div className="ac-val-row">
                      <span className="ac-val">{detailMeeting.passcode}</span>
                      <button className="btn-copy" onClick={() => copyText(detailMeeting.passcode, 'Mật khẩu')}>Sao chép</button>
                    </div>
                  </div>
                </Col>
                <Col xs={24} lg={12}>
                  <div className="access-card">
                    <div className="ac-label">Đường dẫn tham gia</div>
                    <div className="ac-val-row">
                      <span className="ac-val" style={{ fontSize: 13, letterSpacing: 0 }}>{buildMeetingLink(detailMeeting.id)}</span>
                      <button className="btn-copy" onClick={() => copyText(buildMeetingLink(detailMeeting.id), 'Đường dẫn')}>Sao chép</button>
                    </div>
                  </div>
                </Col>
              </Row>
            </div>

            <div className="section-title-sm">Thao tác nhanh</div>
            <Row gutter={[10, 10]}>
              <Col xs={24} sm={8}>
                <div className="qa-card" onClick={() => openReportModal(detailMeeting)}>
                  <div className="qa-icon">📄</div>
                  <div className="qa-name">Biên bản & báo cáo</div>
                  <div className="qa-desc">Xem và tạo biên bản họp</div>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div className="qa-card" onClick={() => openDocumentsModal(detailMeeting)}>
                  <div className="qa-icon">📁</div>
                  <div className="qa-name">Quản lý tài liệu</div>
                  <div className="qa-desc">Upload và chia sẻ file</div>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div className="qa-card" onClick={() => openPollListModal(detailMeeting)}>
                  <div className="qa-icon">🗳️</div>
                  <div className="qa-name">Quản lý biểu quyết</div>
                  <div className="qa-desc">Tạo và theo dõi vote</div>
                </div>
              </Col>
            </Row>

            <div className="section-title-sm" style={{ marginTop: 18 }}>Người tham gia</div>
            <div className="participants-card">
              <div className="p-row">
                <div className="p-avatar av-blue">{participantInitials(detailMeeting.hostName, detailMeeting.hostName)}</div>
                <div className="p-name-col">
                  <div className="p-name">{detailMeeting.hostName}</div>
                  <div className="p-role">Chủ trì (tạo phòng)</div>
                </div>
                <span className="p-status-badge psb-host">Chủ trì</span>
              </div>
              <div className="p-invitees-section">
                <div className="section-title-sm" style={{ margin: '12px 16px 8px' }}>Đồng chủ trì</div>
                <div style={{ padding: '0 12px 12px' }}>
                  <Table<MeetingCoHostItem>
                    loading={meetingInviteesLoading}
                    rowKey={(r) => r.hostUserId}
                    dataSource={meetingCoHosts}
                    pagination={false}
                    scroll={{ x: ROLE_TABLE_LAYOUT.scrollX }}
                    size="small"
                    locale={{ emptyText: 'Chưa có đồng chủ trì' }}
                    columns={[
                      {
                        title: 'STT',
                        key: 'stt',
                        width: ROLE_TABLE_LAYOUT.stt,
                        align: 'center',
                        render: (_v, _r, index) => index + 1,
                      },
                      {
                        title: 'Username',
                        dataIndex: 'username',
                        key: 'username',
                        width: ROLE_TABLE_LAYOUT.username,
                        ellipsis: true,
                      },
                      {
                        title: 'Họ và tên',
                        dataIndex: 'fullName',
                        key: 'fullName',
                        width: ROLE_TABLE_LAYOUT.fullName,
                        ellipsis: true,
                      },
                      ...(canManageMeetingInvitees(detailMeeting)
                        ? [
                            {
                              title: 'Vai trò',
                              key: 'role',
                              width: ROLE_TABLE_LAYOUT.role,
                              align: 'center' as const,
                              render: (_v: unknown, r: MeetingCoHostItem) => (
                                <Select
                                  size="small"
                                  style={{ width: ROLE_TABLE_LAYOUT.roleSelect }}
                                  value="host"
                                  loading={demotingCoHostUsername === r.username}
                                  options={[
                                    { value: 'host', label: 'Chủ trì' },
                                    { value: 'member', label: 'Thành viên' },
                                  ]}
                                  onChange={(value) => {
                                    if (value === 'member') void demoteCoHostToInvitee(r.username);
                                  }}
                                />
                              ),
                            },
                          ]
                        : []),
                      ...(canManageMeetingInvitees(detailMeeting)
                        ? [
                            {
                              title: 'Xóa',
                              key: 'delCo',
                              width: ROLE_TABLE_LAYOUT.remove,
                              align: 'center' as const,
                              render: (_v: unknown, r: MeetingCoHostItem) => (
                                <Popconfirm
                                  title={`Gỡ quyền đồng chủ trì của ${r.username}?`}
                                  okText="Xóa"
                                  cancelText="Hủy"
                                  onConfirm={() => void removeCoHostRow(r.hostUserId)}
                                >
                                  <Button
                                    danger
                                    size="small"
                                    loading={removingCoHostUserId === r.hostUserId}
                                  >
                                    Xóa
                                  </Button>
                                </Popconfirm>
                              ),
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
                <div className="section-title-sm" style={{ margin: '12px 16px 8px' }}>Người được mời</div>
                {canManageMeetingInvitees(detailMeeting) && (
                  <div className="p-invite-bar" style={{ borderTop: 'none' }}>
                    <Input
                      placeholder="Nhập username cần mời tham gia"
                      value={inviteUsernameInput}
                      onChange={(e) => setInviteUsernameInput(e.target.value)}
                      onPressEnter={() => void submitAddInvitee()}
                      style={{ flex: 1, minWidth: 200 }}
                      allowClear
                    />
                    <Button type="primary" onClick={() => void submitAddInvitee()} loading={addingInvitee}>
                      Thêm mời
                    </Button>
                  </div>
                )}
                <div style={{ padding: '0 12px 12px' }}>
                  <Table<MeetingInvitee>
                    loading={meetingInviteesLoading}
                    rowKey={(r) => r.username.toLowerCase()}
                    dataSource={meetingInvitees}
                    pagination={false}
                    scroll={{ x: ROLE_TABLE_LAYOUT.scrollX }}
                    size="small"
                    locale={{ emptyText: 'Chưa có người được mời' }}
                    columns={[
                      {
                        title: 'STT',
                        key: 'stt',
                        width: ROLE_TABLE_LAYOUT.stt,
                        align: 'center',
                        render: (_v, _r, index) => index + 1,
                      },
                      {
                        title: 'Username',
                        dataIndex: 'username',
                        key: 'username',
                        width: ROLE_TABLE_LAYOUT.username,
                        ellipsis: true,
                      },
                      {
                        title: 'Họ và tên',
                        dataIndex: 'fullName',
                        key: 'fullName',
                        width: ROLE_TABLE_LAYOUT.fullName,
                        ellipsis: true,
                      },
                      ...(canManageMeetingInvitees(detailMeeting)
                        ? [
                            {
                              title: 'Vai trò',
                              key: 'role',
                              width: ROLE_TABLE_LAYOUT.role,
                              align: 'center' as const,
                              render: (_v: unknown, r: MeetingInvitee) => (
                                <Select
                                  size="small"
                                  style={{ width: ROLE_TABLE_LAYOUT.roleSelect }}
                                  value="member"
                                  loading={promotingInviteeUsername === r.username}
                                  options={[
                                    { value: 'host', label: 'Chủ trì' },
                                    { value: 'member', label: 'Thành viên' },
                                  ]}
                                  onChange={(value) => {
                                    if (value === 'host') void promoteInviteeToCoHost(r.username);
                                  }}
                                />
                              ),
                            },
                            {
                              title: 'Xóa',
                              key: 'delete',
                              width: ROLE_TABLE_LAYOUT.remove,
                              align: 'center' as const,
                              render: (_v: unknown, r: MeetingInvitee) => (
                                <Popconfirm
                                  title={`Xóa ${r.username} khỏi danh sách mời?`}
                                  okText="Xóa"
                                  cancelText="Hủy"
                                  onConfirm={() => void removeInviteeRow(r.username)}
                                >
                                  <Button
                                    danger
                                    size="small"
                                    loading={removingInviteeUsername === r.username}
                                  >
                                    Xóa
                                  </Button>
                                </Popconfirm>
                              ),
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="bottom-btns">
              <button className="btn-join" onClick={() => router.push(`/meeting/${detailMeeting.id}`)}>Tham gia cuộc họp →</button>
              {canEditMeeting(detailMeeting) && (
                <button className="btn-edit" onClick={() => openEditMeetingModal(detailMeeting)}>Chỉnh sửa</button>
              )}
              <button className="btn-delete" onClick={() => message.info('Chức năng xóa cuộc họp')}>Xóa</button>
            </div>
          </div>
        )}
      </div>

      <Modal
        title={editMeetingModal ? `Chỉnh sửa cuộc họp - ${editMeetingModal.title}` : 'Chỉnh sửa cuộc họp'}
        open={Boolean(editMeetingModal)}
        onCancel={() => {
          setEditMeetingModal(null);
          editMeetingForm.resetFields();
        }}
        onOk={() => void submitEditMeeting()}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={updatingMeeting}
        destroyOnHidden
      >
        <Form
          form={editMeetingForm}
          layout="vertical"
          initialValues={{
            title: '',
            startAt: null,
            estimatedEndAt: null,
          }}
        >
          <Form.Item
            label="Tiêu đề cuộc họp"
            name="title"
            rules={[
              { required: true, message: 'Vui lòng nhập tiêu đề cuộc họp' },
              { max: 200, message: 'Tiêu đề không được quá 200 ký tự' },
            ]}
          >
            <Input placeholder="Nhập tiêu đề cuộc họp" />
          </Form.Item>
          <Form.Item
            label="Thời gian bắt đầu"
            name="startAt"
            rules={[{ required: true, message: 'Vui lòng chọn thời gian bắt đầu' }]}
          >
            <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="Kết thúc dự kiến"
            name="estimatedEndAt"
            rules={[
              ({ getFieldValue }) => ({
                validator(_rule: any, value: any) {
                  const startAt = getFieldValue('startAt');
                  if (!value || !startAt) return Promise.resolve();
                  return value.valueOf() > startAt.valueOf()
                    ? Promise.resolve()
                    : Promise.reject(new Error('Thời gian kết thúc dự kiến phải sau thời gian bắt đầu'));
                },
              }),
            ]}
          >
            <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} allowClear />
          </Form.Item>
        </Form>
      </Modal>

      {/* --- CÁC MODALS GIỮ NGUYÊN HOÀN TOÀN NHƯ CŨ --- */}
      <Modal
        title={
          pollModalMeeting
            ? `${editingDraftPollId ? 'Sửa biểu quyết chờ' : 'Tạo biểu quyết trước'} - ${pollModalMeeting.title}`
            : (editingDraftPollId ? 'Sửa biểu quyết chờ' : 'Tạo biểu quyết trước')
        }
        open={Boolean(pollModalMeeting)}
        onCancel={() => {
          setPollModalMeeting(null);
          setEditingDraftPollId(null);
          pollForm.resetFields();
        }}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={pollForm}
          layout="vertical"
          initialValues={{
            title: '',
            selectionMode: 'single',
            durationKind: 'none',
            durationMinutes: 5,
            options: ['', ''],
          }}
        >
          <Form.Item
            label="Nội dung"
            name="title"
            rules={[{ required: true, message: 'Vui lòng nhập nội dung biểu quyết' }]}
          >
            <Input maxLength={500} placeholder="Ví dụ: Thông qua kế hoạch Q2?" />
          </Form.Item>

          <Form.Item label="Kiểu phiếu" name="selectionMode">
            <Radio.Group>
              <Space direction="vertical">
                <Radio value="single">Một lựa chọn</Radio>
                <Radio value="multiple">Nhiều lựa chọn</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          <Form.Item label="Thời hạn" name="durationKind">
            <Radio.Group>
              <Space direction="vertical">
                <Radio value="none">Không giới hạn thời gian</Radio>
                <Radio value="timed">Có thời hạn (phút)</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) =>
              getFieldValue('durationKind') === 'timed' ? (
                <Form.Item
                  label="Số phút"
                  name="durationMinutes"
                  rules={[{ required: true, message: 'Nhập số phút' }]}
                >
                  <InputNumber min={1} max={10080} style={{ width: '100%' }} />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Form.List
            name="options"
            rules={[
              {
                validator: async (_, value) => {
                  const valid = Array.isArray(value)
                    ? value.map((x) => String(x || '').trim()).filter(Boolean)
                    : [];
                  if (valid.length < 2) throw new Error('Cần tối thiểu 2 lựa chọn');
                  if (valid.length > 8) throw new Error('Tối đa 8 lựa chọn');
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                <Typography.Text strong>Lựa chọn</Typography.Text>
                {fields.map((field) => (
                  <Form.Item
                    key={field.key}
                    name={field.name}
                    style={{ marginTop: 8, marginBottom: 8 }}
                    rules={[{ required: true, whitespace: true, message: 'Không để trống' }]}
                  >
                    <Input
                      placeholder={`Phương án ${field.name + 1}`}
                      addonAfter={
                        fields.length > 2 ? (
                          <Button type="link" danger size="small" onClick={() => remove(field.name)}>
                            Xóa
                          </Button>
                        ) : undefined
                      }
                    />
                  </Form.Item>
                ))}
                <Form.ErrorList errors={errors} />
                <Button
                  type="link"
                  onClick={() => {
                    if (fields.length < 8) add('');
                  }}
                >
                  + Thêm phương án
                </Button>
              </>
            )}
          </Form.List>

          <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 12 }}>
            <Button onClick={() => { setPollModalMeeting(null); setEditingDraftPollId(null); pollForm.resetFields(); }}>
              Hủy
            </Button>
            <Button type="primary" loading={savingPoll} onClick={() => void submitPollForMeeting()}>
              {editingDraftPollId ? 'Lưu chỉnh sửa' : 'Lưu nháp'}
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={
          <div style={{ minWidth: 0 }}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              Quản lý tài liệu cuộc họp
            </Typography.Title>
            <Typography.Text type="secondary" style={{ display: 'block' }}>
              {documentsMeeting?.title ?? ''}
            </Typography.Text>
          </div>
        }
        open={Boolean(documentsMeeting)}
        onCancel={() => {
          setDocumentsMeeting(null);
          setMeetingDocuments([]);
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <Space>
              <input
                ref={docFileInputRef}
                type="file"
                style={{ display: 'none' }}
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                onChange={onUploadMeetingDocument}
              />
              <Button
                type="primary"
                icon={<UploadOutlined />}
                loading={documentsUploading}
                onClick={onPickDocumentFile}
                disabled={!documentsMeeting || Boolean(documentsMeeting.endedAt)}
              >
                Tải tài liệu lên
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => documentsMeeting && void loadDocumentsForMeeting(documentsMeeting.id)}
                loading={documentsLoading}
                disabled={!documentsMeeting}
              >
                Làm mới
              </Button>
            </Space>
            <Button
              onClick={() => {
                setDocumentsMeeting(null);
                setMeetingDocuments([]);
              }}
            >
              Đóng
            </Button>
          </div>
        }
        destroyOnHidden
        width={760}
      >
        <Table<MeetingDocumentDto>
          rowKey="id"
          loading={documentsLoading}
          dataSource={meetingDocuments}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          locale={{
            emptyText: documentsLoading ? 'Đang tải...' : <Empty description="Chưa có tài liệu" />,
          }}
          columns={[
            {
              title: 'Tài liệu',
              key: 'file',
              render: (_v, r) => (
                <Space direction="vertical" size={0}>
                  <Typography.Text strong>{r.fileName}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {r.uploaderName} • {dayjs(r.createdAt).format('HH:mm, DD/MM/YYYY')}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              title: 'Kích thước',
              dataIndex: 'size',
              width: 120,
              render: (v: number) => `${Math.max(1, Math.round(v / 1024))} KB`,
            },
            {
              title: 'Thao tác',
              key: 'actions',
              width: 190,
              render: (_v, r) => (
                <Space>
                  <Button size="small" icon={<EyeOutlined />} onClick={() => void onViewMeetingDocument(r)}>
                    Xem
                  </Button>
                  <Popconfirm
                    title="Xóa tài liệu này?"
                    okText="Xóa"
                    cancelText="Hủy"
                    onConfirm={() => void onDeleteMeetingDocument(r)}
                  >
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      loading={documentsDeletingId === r.id}
                      disabled={Boolean(documentsMeeting?.endedAt)}
                    />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Modal>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <Typography.Title level={5} style={{ margin: 0 }}>
                Quản lý biểu quyết
              </Typography.Title>
              <Typography.Text type="secondary" style={{ display: 'block' }}>
                Xem và quản lý các cuộc khảo sát ý kiến
              </Typography.Text>
            </div>
            <Space>
              {viewPollMeeting && canManagePollForMeeting(viewPollMeeting) && (
                <Button
                  type="primary"
                  icon={<FormOutlined />}
                  onClick={() => {
                    setPollModalMeeting(viewPollMeeting);
                    setEditingDraftPollId(null);
                    pollForm.setFieldsValue({
                      title: '',
                      selectionMode: 'single',
                      durationKind: 'none',
                      durationMinutes: 5,
                      options: ['', ''],
                    });
                  }}
                >
                  Tạo biểu quyết
                </Button>
              )}
              <Button
                type="text"
                icon={<SettingOutlined />}
                onClick={() => setManageTab('managers')}
                disabled={!viewPollMeeting || !canManagePollForMeeting(viewPollMeeting)}
              />
            </Space>
          </div>
        }
        open={Boolean(viewPollMeeting)}
        onCancel={() => {
          setViewPollMeeting(null);
          setViewPolls([]);
          setManageTab('waiting');
          setManagerUsername('');
          setManagers([]);
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => setViewPollMeeting(null)}>Đóng</Button>
          </div>
        }
        destroyOnHidden
        width={720}
        styles={{ body: { background: '#f5f7fb' } }}
      >
        <div style={{ marginBottom: 14 }}>
          <Segmented
            block
            value={manageTab}
            onChange={(v) => setManageTab(v as any)}
            options={[
              { label: 'Đang chờ', value: 'waiting' },
              { label: 'Đã công bố', value: 'published' },
              {
                label: 'Người quản lý',
                value: 'managers',
                disabled: !viewPollMeeting || !canManagePollForMeeting(viewPollMeeting),
              },
            ]}
          />
        </div>

        {manageTab === 'waiting' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '65vh', overflow: 'auto', paddingRight: 6 }}>
            {viewPollsLoading ? (
              <Card loading bordered={false} style={{ borderRadius: 14 }} />
            ) : viewPolls.filter((p) => p.status === 'draft').length === 0 ? (
              <Card bordered={false} style={{ borderRadius: 14 }}>
                <Typography.Text type="secondary">Chưa có biểu quyết chờ công bố</Typography.Text>
              </Card>
            ) : (
              viewPolls
                .filter((p) => p.status === 'draft')
                .map((p) => {
                  const counts = pollOptionCounts(p);
                  const totalSelections = counts.reduce((a, b) => a + b, 0);
                  const canManage = Boolean(viewPollMeeting && canManagePollForMeeting(viewPollMeeting));

                  return (
                    <Card
                      key={p.pollId}
                      bordered={false}
                      style={{ borderRadius: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                      styles={{ body: { padding: 16 } }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <Space size={8} wrap>
                            <Tag color="default" style={{ borderRadius: 999 }}>
                              ĐANG CHỜ
                            </Tag>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              · {p.selectionMode === 'multiple' ? 'Nhiều lựa chọn' : 'Một lựa chọn'}
                            </Typography.Text>
                          </Space>
                          <Typography.Text strong style={{ display: 'block', marginTop: 6, fontSize: 14 }}>
                            {p.title}
                          </Typography.Text>
                        </div>
                        {canManage && (
                          <Space>
                            <Button size="small" onClick={() => editDraftPoll(p)}>
                              Sửa
                            </Button>
                            <Popconfirm
                              title="Xóa biểu quyết chờ này?"
                              okText="Xóa"
                              cancelText="Hủy"
                              onConfirm={() => void deleteDraftPoll(p.pollId)}
                            >
                              <Button danger size="small">
                                Xóa
                              </Button>
                            </Popconfirm>
                          </Space>
                        )}
                      </div>

                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {p.options.map((opt, idx) => {
                          const pct = totalSelections > 0 ? Math.round((counts[idx] / totalSelections) * 100) : 0;
                          return (
                            <div key={idx}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                <Typography.Text style={{ fontSize: 13 }}>{opt}</Typography.Text>
                                <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                                  {pct}% ({counts[idx]})
                                </Typography.Text>
                              </div>
                              <Progress percent={pct} showInfo={false} strokeColor="#3b82f6" trailColor="#eaf0ff" />
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          Tạo bởi {p.createdByName}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {p.endAt ? `Hết hạn: ${dayjs(p.endAt).format('DD/MM/YYYY HH:mm')}` : 'Hết hạn: Không giới hạn'}
                        </Typography.Text>
                      </div>
                    </Card>
                  );
                })
            )}
          </div>
        )}

        {manageTab === 'published' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '65vh', overflow: 'auto', paddingRight: 6 }}>
            {viewPollsLoading ? (
              <Card loading bordered={false} style={{ borderRadius: 14 }} />
            ) : viewPolls.filter((p) => p.status !== 'draft').length === 0 ? (
              <Card bordered={false} style={{ borderRadius: 14 }}>
                <Typography.Text type="secondary">Chưa có biểu quyết đã công bố</Typography.Text>
              </Card>
            ) : (
              viewPolls
                .filter((p) => p.status !== 'draft')
                .map((p) => {
                  const counts = pollOptionCounts(p);
                  const totalSelections = counts.reduce((a, b) => a + b, 0);
                  const canManage = Boolean(viewPollMeeting && canManagePollForMeeting(viewPollMeeting));
                  const isOpen = p.status === 'open';

                  return (
                    <Card
                      key={p.pollId}
                      bordered={false}
                      style={{ borderRadius: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                      styles={{ body: { padding: 16 } }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <Space size={8} wrap>
                            <Tag color={isOpen ? 'success' : 'default'} style={{ borderRadius: 999 }}>
                              {isOpen ? 'ĐANG MỞ' : 'ĐÃ ĐÓNG'}
                            </Tag>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              · {p.selectionMode === 'multiple' ? 'Nhiều lựa chọn' : 'Một lựa chọn'}
                            </Typography.Text>
                          </Space>
                          <Typography.Text strong style={{ display: 'block', marginTop: 6, fontSize: 14 }}>
                            {p.title}
                          </Typography.Text>
                        </div>
                        {canManage && isOpen && (
                          <Popconfirm
                            title="Kết thúc biểu quyết này?"
                            okText="Kết thúc"
                            cancelText="Hủy"
                            onConfirm={() => void closePublishedPoll(p.pollId)}
                          >
                            <Button danger size="small">
                              Kết thúc
                            </Button>
                          </Popconfirm>
                        )}
                      </div>

                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {p.options.map((opt, idx) => {
                          const pct = totalSelections > 0 ? Math.round((counts[idx] / totalSelections) * 100) : 0;
                          return (
                            <div key={idx}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                <Typography.Text style={{ fontSize: 13 }}>{opt}</Typography.Text>
                                <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                                  {pct}% ({counts[idx]})
                                </Typography.Text>
                              </div>
                              <Progress percent={pct} showInfo={false} strokeColor="#3b82f6" trailColor="#eaf0ff" />
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          Tạo bởi {p.createdByName}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {p.endAt ? `Hết hạn: ${dayjs(p.endAt).format('DD/MM/YYYY HH:mm')}` : 'Hết hạn: Không giới hạn'}
                        </Typography.Text>
                      </div>
                    </Card>
                  );
                })
            )}
          </div>
        )}

        {manageTab === 'managers' && viewPollMeeting && canManagePollForMeeting(viewPollMeeting) && (
          <Card size="small" title="Người quản lý">
            <Space style={{ width: '100%' }} wrap>
              <Input
                placeholder="Nhập username cần cấp quyền"
                value={managerUsername}
                onChange={(e) => setManagerUsername(e.target.value)}
                style={{ minWidth: 260 }}
              />
              <Button type="primary" loading={addingManager} onClick={() => void submitAddManager()}>
                Thêm quản lý
              </Button>
            </Space>
            <Table<PollManagerItem>
              loading={managerLoading}
              style={{ marginTop: 12 }}
              rowKey={(r) => r.username.toLowerCase()}
              dataSource={managers}
              pagination={false}
              locale={{ emptyText: 'Chưa có quản lý biểu quyết' }}
              columns={[
                {
                  title: 'STT',
                  key: 'stt',
                  width: 70,
                  align: 'center',
                  render: (_v, _r, index) => index + 1,
                },
                {
                  title: 'Username',
                  dataIndex: 'username',
                  key: 'username',
                },
                {
                  title: 'Họ và tên',
                  dataIndex: 'fullName',
                  key: 'fullName',
                },
                {
                  title: 'Thêm bởi',
                  key: 'addedBy',
                  render: (_v, r) => `${r.addedBy} (${r.addedByFullName})`,
                },
                {
                  title: 'Thời gian thêm',
                  dataIndex: 'addedAt',
                  key: 'addedAt',
                  render: (v: number) => dayjs(v).format('DD/MM/YYYY HH:mm:ss'),
                },
                {
                  title: 'Xóa',
                  key: 'delete',
                  width: 90,
                  align: 'center',
                  render: (_v, r) => (
                    <Popconfirm
                      title={`Xóa quyền quản lý của ${r.username}?`}
                      okText="Xóa"
                      cancelText="Hủy"
                      onConfirm={() => void removeManager(r.username)}
                    >
                      <Button danger size="small">Xóa</Button>
                    </Popconfirm>
                  ),
                },
              ]}
            />
          </Card>
        )}
      </Modal>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <Typography.Title level={5} style={{ margin: 0 }}>
                Lịch sử cuộc họp
              </Typography.Title>
              <Typography.Text type="secondary" style={{ display: 'block' }}>
                {historyMeeting ? historyMeeting.title : 'Xem lịch sử tham gia'}
              </Typography.Text>
            </div>
            <Space>
              <Button
                icon={<FileExcelOutlined />}
                onClick={() => exportHistoryToExcel()}
                loading={exportingHistoryExcel}
                disabled={historyLoading || historyItems.length === 0}
              >
                Xuất Excel
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => historyMeeting && openHistoryModal(historyMeeting)}
                loading={historyLoading}
              >
                Làm mới
              </Button>
            </Space>
          </div>
        }
        open={Boolean(historyMeeting)}
        onCancel={() => {
          setHistoryMeeting(null);
          setHistoryItems([]);
          setHistoryTablePage(1);
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              onClick={() => {
                setHistoryMeeting(null);
                setHistoryItems([]);
                setHistoryTablePage(1);
              }}
            >
              Đóng
            </Button>
          </div>
        }
        destroyOnHidden
        width={1200}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
        styles={{ body: { background: '#f5f7fb' } }}
      >
        <Card bordered={false} style={{ borderRadius: 14 }}>
          <Table<HistoryEntry>
            rowKey="id"
            loading={historyLoading}
            dataSource={historyItems}
            tableLayout="fixed"
            pagination={{
              current: historyTablePage,
              pageSize: historyTablePageSize,
              total: historyItems.length,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50],
              onChange: (page, pageSize) => {
                setHistoryTablePage(page);
                setHistoryTablePageSize(pageSize);
              },
            }}
            locale={{
              emptyText: historyLoading ? 'Đang tải...' : <Empty description="Chưa có lịch sử cuộc họp" />,
            }}
            columns={[
              {
                title: 'STT',
                key: 'stt',
                width: 70,
                align: 'center',
                render: (_v, _r, index) =>
                  (historyTablePage - 1) * historyTablePageSize + index + 1,
              },
              {
                title: 'Người dùng',
                dataIndex: 'username',
                key: 'username',
                render: (_v: string, r: HistoryEntry) => r.fullName?.trim() || r.username,
              },
              {
                title: 'Vào lúc',
                dataIndex: 'joinedAt',
                key: 'joinedAt',
                width: 170,
                render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm:ss') : '-'),
              },
              {
                title: 'Rời lúc',
                dataIndex: 'leftAt',
                key: 'leftAt',
                width: 170,
                render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm:ss') : 'Đang tham gia'),
              },
              {
                title: 'Thời lượng',
                dataIndex: 'duration',
                key: 'duration',
                width: 240,
                align: 'right',
                ellipsis: false,
                render: (_v: number | null, r: HistoryEntry) => (
                  <span style={{ whiteSpace: 'nowrap' }}>{formatHistoryParticipationDuration(r)}</span>
                ),
              },
            ]}
          />
        </Card>
      </Modal>

      <Modal
        title={
          <div style={{ minWidth: 0 }}>
            <Space size={8} style={{ marginBottom: 8, flexWrap: 'wrap' }}>
              <Button
                type="primary"
                icon={<CopyOutlined />}
                size={isMobile ? 'small' : 'middle'}
                onClick={() => void copyReportMinutesText()}
                disabled={!reportMinutes || reportMinutesLoading}
              >
                Sao chép văn bản
              </Button>
              <Button
                icon={<FileWordOutlined />}
                size={isMobile ? 'small' : 'middle'}
                loading={exportingReportWord}
                onClick={() => void exportReportWord()}
                disabled={!reportMinutes || reportMinutesLoading}
              >
                Xuất Word
              </Button>
            </Space>
            <Typography.Title level={5} style={{ margin: 0 }}>
              Biên bản / báo cáo cuộc họp
            </Typography.Title>
            <Typography.Text type="secondary" style={{ display: 'block' }}>
              {reportMeeting?.title ?? ''}
            </Typography.Text>
          </div>
        }
        open={Boolean(reportMeeting)}
        onCancel={() => {
          setReportMeeting(null);
          setReportMinutes(null);
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              onClick={() => {
                setReportMeeting(null);
                setReportMinutes(null);
              }}
            >
              Đóng
            </Button>
          </div>
        }
        destroyOnHidden
        centered={!isMobile}
        width={isMobile ? '96vw' : 900}
        style={{ maxWidth: '96vw', top: isMobile ? 8 : undefined }}
        styles={{
          body: {
            maxHeight: isMobile ? 'calc(100vh - 130px)' : '75vh',
            overflow: 'hidden',
            padding: isMobile ? 8 : 24,
          },
        }}
      >
        {reportMinutesLoading && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin size="large" />
          </div>
        )}
        {!reportMinutesLoading && reportMeeting && !reportMinutes && (
          <Empty description="Không có dữ liệu biên bản" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
        {!reportMinutesLoading && reportMinutes && (
          <>
            <div style={{ overflowY: 'auto', overflowX: 'hidden', maxHeight: isMobile ? '64vh' : '60vh' }}>
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    transform: `scale(${reportPreviewScale})`,
                    transformOrigin: 'top center',
                    width: 794,
                  }}
                >
                  <MeetingMinutesPreview minutes={reportMinutes} reportRef={reportRef} />
                </div>
              </div>
            </div>
          </>
        )}
      </Modal>
    </MainLayout>
  );
}