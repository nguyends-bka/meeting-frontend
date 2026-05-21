'use client';

import React from 'react';
import MainLayout from '@/components/MainLayout';
import { Row, Col } from 'antd';
import { useHomePage } from './_home/useHomePage';
import GreetingBanner from './_home/components/GreetingBanner';
import StatsOverview from './_home/components/StatsOverview';
import HeroHighlight from './_home/components/HeroHighlight';
import TodaySchedule from './_home/components/TodaySchedule';
import CreateMeetingModal from './_home/components/CreateMeetingModal';
import JoinMeetingModal from './_home/components/JoinMeetingModal';
import MeetingDetailModal from './_home/components/MeetingDetailModal';
import MeetingHistoryModal from './_home/components/MeetingHistoryModal';
import './_home/home.css';

export default function HomePage() {
  const home = useHomePage();

  if (home.loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Đang tải...</div>;
  }
  
  if (!home.isAuthenticated) {
    return null;
  }

  return (
    <MainLayout>
      <div
        className="home-container"
        style={{
          maxWidth: home.isNarrow ? undefined : 'min(1720px, 100%)',
          padding: home.isNarrow ? 16 : home.isWideHome ? 28 : 24,
        }}
      >
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={24}>
            <GreetingBanner
              user={home.user}
              pendingCount={home.pendingForYou}
              onOpenJoin={home.openJoinModal}
              onOpenCreate={() => home.setCreateOpen(true)}
            />

            {home.stats && (
              <StatsOverview
                stats={home.stats}
                onRedirectHistory={() => home.router.push('/history')}
              />
            )}

            {home.liveHighlight && (
              <HeroHighlight
                meeting={home.liveHighlight}
                onJoin={() => home.router.push(`/meeting/${home.liveHighlight!.id}`)}
                onDetail={() => home.setDetailMeeting(home.liveHighlight)}
                isNarrow={home.isNarrow}
              />
            )}

            <TodaySchedule
              loading={home.loadingHome}
              schedule={home.todaySchedule}
              onViewAll={() => home.router.push('/meetings')}
            />
          </Col>
        </Row>
      </div>

      <CreateMeetingModal
        open={home.createOpen}
        creating={home.creating}
        createdMeeting={home.createdMeeting}
        form={home.createForm}
        estimatedDuration={home.estimatedDurationLabel}
        onCancel={home.closeCreateModal}
        onSubmit={home.onCreateMeeting}
        onCopy={home.copyText}
        buildLink={home.buildMeetingLink}
        onJoinCreated={(id) => {
          home.closeCreateModal();
          home.router.push(`/meeting/${id}`);
        }}
      />

      <JoinMeetingModal
        open={home.joinOpen}
        form={home.joinForm}
        onCancel={home.closeJoinModal}
        onSubmit={home.onJoinMeeting}
      />

      <MeetingDetailModal
        meeting={home.detailMeeting}
        onCancel={() => home.setDetailMeeting(null)}
        onCopy={home.copyText}
        buildLink={home.buildMeetingLink}
        onJoin={(id) => home.router.push(`/meeting/${id}`)}
      />

      <MeetingHistoryModal
        meeting={home.historyMeeting}
        items={home.historyItems}
        loading={home.historyLoading}
        exporting={home.exportingHistoryExcel}
        page={home.historyTablePage}
        pageSize={home.historyTablePageSize}
        onPageChange={home.handleHistoryPageChange}
        onRefresh={home.refreshHistory}
        onExport={home.exportHistoryToExcel}
        onCancel={home.closeHistoryModal}
      />
    </MainLayout>
  );
}