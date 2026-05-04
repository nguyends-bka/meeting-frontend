'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Spin } from 'antd';
import { useAuth } from '@/lib/auth';
import MainLayout from '@/components/MainLayout';
import { useMeetingsPage } from './_shared/useMeetingsPage';
import { MeetingsListView } from './_shared/MeetingsListView';
import { MeetingDetailView } from './_shared/MeetingDetailView';
import { HistoryModal } from './_shared/modals/HistoryModal';
import { ReportModal } from './_shared/modals/ReportModal';
import { EditMeetingModal } from './_shared/modals/EditMeetingModal';
import { DocumentsModal } from './_shared/modals/DocumentsModal';
import { PollListModal } from './_shared/modals/PollListModal';
import { PollFormModal } from './_shared/modals/PollFormModal';
import { RecordingPlaybackModal } from './_shared/modals/RecordingPlaybackModal';

// Tải CSS tĩnh cho trang meetings
import './_shared/meetings.css';
import { App } from 'antd';

export default function MeetingsPage() {
  return (
    <React.Suspense fallback={<div style={{ minHeight: '50vh' }} />}>
      <MeetingsPageContent />
    </React.Suspense>
  );
}

function MeetingsPageContent() {
  const { user, isAuthenticated, loading: authLoading, isAdmin } = useAuth();
  const { message } = App.useApp();
  const state = useMeetingsPage(user, isAdmin);

  if (authLoading) return <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}><Spin size="large" /></div>;
  if (!isAuthenticated) return null;

  return (
    <MainLayout>
      <div className="dashboard-container">
        
        {!state.detailMeeting ? (
          <MeetingsListView
            statTotal={state.meetings.length}
            statUpcoming={state.meetingsWithStatus.filter((m: any) => m.computedStatus === 'upcoming').length}
            statLive={state.meetingsWithStatus.filter((m: any) => m.computedStatus === 'live').length}
            statDone={state.meetingsWithStatus.filter((m: any) => m.computedStatus === 'done').length}
            statNoShow={state.meetingsWithStatus.filter((m: any) => m.computedStatus === 'no_show').length}
            filterStatus={state.filterStatus}
            setFilterStatus={state.setFilterStatus}
            searchText={state.searchText}
            setSearchText={state.setSearchText}
            paginatedMeetings={state.paginatedMeetings}
            loadingMeetings={state.loadingMeetings}
            tablePage={state.tablePage}
            tablePageSize={state.tablePageSize}
            totalPages={state.totalPages}
            filteredMeetings={state.filteredMeetings}
            setTablePage={state.setTablePage}
            setTablePageSize={state.setTablePageSize}
            openDetailModal={state.setDetailMeeting}
            openHistoryModal={state.setHistoryMeeting}
            openEditMeetingModal={state.setEditMeetingModal}
            openPollListModal={state.setViewPollMeeting}
            user={user}
            router={state.router}
            isAdmin={isAdmin}
          />
        ) : (
          <MeetingDetailView
            detailMeeting={state.detailMeeting}
            setDetailMeeting={state.setDetailMeeting}
            user={user}
            isAdmin={isAdmin}
            router={state.router}
            message={message}
            openDocumentsModal={state.setDocumentsMeeting}
            openReportModal={state.setReportMeeting}
            openPollListModal={state.setViewPollMeeting}
            openHistoryModal={state.setHistoryMeeting}
            openEditMeetingModal={state.setEditMeetingModal}
            handleDeleteMeeting={state.handleDeleteMeeting}
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
        )}

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

      <EditMeetingModal
        meeting={state.editMeetingModal}
        onClose={() => state.setEditMeetingModal(null)}
        onSuccess={(updated) => {
          state.setMeetings((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
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
        pollId={null} // Cần quản lý edit form ID nếu sửa
        onClose={() => state.setPollModalMeeting(null)}
        user={user}
        onSuccess={() => {
          // Refresh list if needed
        }}
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