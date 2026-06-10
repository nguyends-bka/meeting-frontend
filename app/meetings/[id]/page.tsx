'use client';

import React from 'react';
import { Spin, Result, Button } from 'antd';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import MainLayout from '@/components/MainLayout';
import { useMeetingDetailPage } from '../_shared/useMeetingDetailPage';
import { MeetingDetailView } from '../_shared/MeetingDetailView';
import { HistoryModal } from '../_shared/modals/HistoryModal';
import { ReportModal } from '../_shared/modals/ReportModal';
import { SummaryReportModal } from '../_shared/modals/SummaryReportModal';
import { EditMeetingModal } from '../_shared/modals/EditMeetingModal';
import { DocumentsModal } from '../_shared/modals/DocumentsModal';
import { PollListModal } from '../_shared/modals/PollListModal';
import { PollFormModal } from '../_shared/modals/PollFormModal';
import { RecordingPlaybackModal } from '../_shared/modals/RecordingPlaybackModal';
import { App } from 'antd';

// Import CSS
import '../_shared/meetings.css';

export default function MeetingDetailPage() {
  return (
    <React.Suspense fallback={<div style={{ minHeight: '50vh' }} />}>
      <MeetingDetailPageContent />
    </React.Suspense>
  );
}

function MeetingDetailPageContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, isAdmin } = useAuth();
  const { message } = App.useApp();

  const meetingId = typeof params?.id === 'string' ? params.id : '';

  const state = useMeetingDetailPage(meetingId, user, isAdmin);

  if (authLoading || state.loadingDetail) {
    return (
      <div style={{ padding: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (state.error) {
    return (
      <MainLayout>
        <div style={{ padding: 48, background: '#fff', borderRadius: 8, marginTop: 24 }}>
          <Result
            status="warning"
            title="Không thể tải thông tin cuộc họp"
            subTitle={state.error}
            extra={
              <Button type="primary" onClick={() => router.push('/meetings')}>
                Quay lại danh sách
              </Button>
            }
          />
        </div>
      </MainLayout>
    );
  }

  if (!state.detailMeeting) {
    return (
      <MainLayout>
        <div style={{ padding: 48, background: '#fff', borderRadius: 8, marginTop: 24 }}>
          <Result
            status="404"
            title="Không tìm thấy cuộc họp"
            subTitle="Cuộc họp này không tồn tại hoặc đã bị xóa."
            extra={
              <Button type="primary" onClick={() => router.push('/meetings')}>
                Quay lại danh sách
              </Button>
            }
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="dashboard-container">
        <MeetingDetailView
          detailMeeting={state.detailMeeting}
          setDetailMeeting={() => router.push('/meetings')} // Khi bấm đóng/quay lại
          user={user}
          isAdmin={isAdmin}
          router={state.router}
          message={message}
          openDocumentsModal={state.setDocumentsMeeting}
          openReportModal={state.setReportMeeting}
          openSummaryReportModal={state.setSummaryReportMeeting}
          openPollListModal={state.setViewPollMeeting}
          openHistoryModal={state.setHistoryMeeting}
          openEditMeetingModal={state.setEditMeetingModal}
          handleDeleteMeeting={state.handleDeleteMeeting}
          handleCancelMeeting={state.handleCancelMeeting}
          meetingRecordings={state.meetingRecordings}
          meetingRecordingsLoading={state.meetingRecordingsLoading}
          openRecordingPlayback={(meetingId, r) => {
            state.setRecordingPlaybackTitle(`Bản ghi cuộc họp`);
            state.setRecordingPlaybackModalOpen(true);
          }}
          onDeleteMeetingRecording={state.onDeleteMeetingRecording}
          recordingDeletingId={state.recordingDeletingId}
          meetingInvitees={state.meetingInvitees}
          meetingCoHosts={state.meetingCoHosts}
          meetingInviteesLoading={state.meetingInviteesLoading}
          inviteUsernameInput={state.inviteUsernameInput}
          setInviteUsernameInput={state.setInviteUsernameInput}
          submitAddInvitee={state.submitAddInvitee}
          addingInvitee={state.addingInvitee}
          removeInviteeRow={state.removeInviteeRow}
          removingInviteeUsername={state.removingInviteeUsername}
          promoteInviteeToCoHost={state.promoteInviteeToCoHost}
          promotingInviteeUsername={state.promotingInviteeUsername}
          demoteCoHostToInvitee={state.demoteCoHostToInvitee}
          demotingCoHostUsername={state.demotingCoHostUsername}
          removeCoHostRow={state.removeCoHostRow}
          removingCoHostUserId={state.removingCoHostUserId}
        />
      </div>

      {/* --- MODALS --- */}
      <HistoryModal
        meeting={state.historyMeeting}
        onClose={() => state.setHistoryMeeting(null)}
        isAdmin={isAdmin}
      />

      <ReportModal
        meeting={state.reportMeeting}
        onClose={() => state.setReportMeeting(null)}
      />

      <SummaryReportModal
        meeting={state.summaryReportMeeting}
        onClose={() => state.setSummaryReportMeeting(null)}
      />

      <EditMeetingModal
        meeting={state.editMeetingModal}
        onClose={() => state.setEditMeetingModal(null)}
        onSuccess={(updated) => {
          state.setDetailMeeting((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
        }}
      />

      <DocumentsModal
        meeting={state.documentsMeeting}
        onClose={() => state.setDocumentsMeeting(null)}
        user={user}
      />

      <PollListModal
        meeting={state.viewPollMeeting}
        onClose={() => state.setViewPollMeeting(null)}
        user={user}
        openCreateForm={() => state.setPollModalMeeting(state.viewPollMeeting)}
        openEditForm={(poll) => state.setPollModalMeeting(state.viewPollMeeting)}
      />

      <PollFormModal
        meeting={state.pollModalMeeting}
        pollId={null}
        onClose={() => state.setPollModalMeeting(null)}
        user={user}
        onSuccess={() => {}}
      />

      <RecordingPlaybackModal
        open={state.recordingPlaybackModalOpen}
        onClose={() => {
          state.setRecordingPlaybackModalOpen(false);
          if (state.recordingPlaybackUrl) URL.revokeObjectURL(state.recordingPlaybackUrl);
          state.setRecordingPlaybackUrl(null);
        }}
        url={state.recordingPlaybackUrl}
        title={state.recordingPlaybackTitle}
      />
    </MainLayout>
  );
}
