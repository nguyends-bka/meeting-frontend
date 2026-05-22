'use client';

import React, { useEffect, Suspense } from 'react';
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
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useSearchParams } from 'next/navigation';

// New Dashboard Widgets
import AnalyticsChart from './_home/components/AnalyticsChart';

import './_home/home.css';

function HomePageContent() {
  const home = useHomePage();
  const { registerActions, clearActions } = useHeaderActions();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = React.useState<'timeline' | 'stats'>('timeline');

  // Register header action callbacks so AppHeader buttons work
  useEffect(() => {
    registerActions({
      onOpenJoin: home.openJoinModal,
      onOpenCreate: () => home.setCreateOpen(true),
    });
    return () => clearActions();
  }, [home.openJoinModal, home.setCreateOpen, registerActions, clearActions]);

  // Handle ?action=join or ?action=create from other pages
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'join') {
      home.openJoinModal();
      window.history.replaceState({}, '', '/');
    } else if (action === 'create') {
      home.setCreateOpen(true);
      window.history.replaceState({}, '', '/');
    }
  }, [searchParams]);

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
          padding: home.isNarrow ? 8 : home.isWideHome ? 28 : 24,
        }}
      >
        {/* Full-width Greeting Banner at the top */}
        <GreetingBanner
          user={home.user}
          pendingCount={home.pendingForYou}
          isNarrow={home.isNarrow}
        />

        <Row gutter={home.isNarrow ? [12, 12] : [24, 24]}>
          {/* Main Left Column (2/3 width on desktop) */}
          <Col xs={24} lg={15} xl={16}>
            {home.liveHighlight && (
              <HeroHighlight
                meeting={home.liveHighlight}
                onJoin={() => home.router.push(`/meeting/${home.liveHighlight!.id}`)}
                onDetail={() => home.setDetailMeeting(home.liveHighlight)}
                isNarrow={home.isNarrow}
              />
            )}

            {/* General Numerical Stats (show on left on desktop below HeroHighlight) */}
            {home.stats && (
              <div className="hide-on-mobile">
                <StatsOverview
                  stats={home.stats}
                  onRedirectHistory={() => home.router.push('/history')}
                />
              </div>
            )}

            {/* Meeting statistics chart (show on left on desktop) */}
            <div className="hide-on-mobile">
              <AnalyticsChart allMeetings={home.allMeetings} />
            </div>
          </Col>

          {/* Sidebar Right Column (1/3 width on desktop) */}
          <Col xs={24} lg={9} xl={8}>
            {home.isNarrow ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Segment Switcher only on Mobile */}
                <div style={{
                  display: 'flex',
                  background: '#f1f5f9',
                  padding: 3,
                  borderRadius: 12,
                  marginBottom: 4
                }}>
                  <button
                    onClick={() => setActiveTab('timeline')}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      borderRadius: 9,
                      border: 'none',
                      background: activeTab === 'timeline' ? '#ffffff' : 'transparent',
                      color: activeTab === 'timeline' ? '#2563eb' : '#64748b',
                      fontWeight: activeTab === 'timeline' ? 800 : 600,
                      fontSize: 12,
                      boxShadow: activeTab === 'timeline' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                  >
                    📅 Biểu lịch
                  </button>
                  <button
                    onClick={() => setActiveTab('stats')}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      borderRadius: 9,
                      border: 'none',
                      background: activeTab === 'stats' ? '#ffffff' : 'transparent',
                      color: activeTab === 'stats' ? '#2563eb' : '#64748b',
                      fontWeight: activeTab === 'stats' ? 800 : 600,
                      fontSize: 12,
                      boxShadow: activeTab === 'stats' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                  >
                    📊 Thống kê & Biểu đồ
                  </button>
                </div>

                {activeTab === 'timeline' ? (
                  <TodaySchedule
                    loading={home.loadingHome}
                    schedule={home.selectedDaySchedule}
                    onViewAll={() => home.router.push('/calendar')}
                    onJoin={home.joinMeetingDirectly}
                    onDetail={home.setDetailMeeting}
                    selectedDate={home.selectedDate}
                    onSelectDate={home.setSelectedDate}
                    isNarrow={home.isNarrow}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {home.stats && (
                      <StatsOverview
                        stats={home.stats}
                        onRedirectHistory={() => home.router.push('/history')}
                      />
                    )}
                    <AnalyticsChart allMeetings={home.allMeetings} />
                  </div>
                )}
              </div>
            ) : (
              /* Desktop Layout: Render Timeline natively */
              <TodaySchedule
                loading={home.loadingHome}
                schedule={home.selectedDaySchedule}
                onViewAll={() => home.router.push('/calendar')}
                onJoin={home.joinMeetingDirectly}
                onDetail={home.setDetailMeeting}
                selectedDate={home.selectedDate}
                onSelectDate={home.setSelectedDate}
                isNarrow={home.isNarrow}
              />
            )}
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

export default function HomePage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>Đang tải...</div>}>
      <HomePageContent />
    </Suspense>
  );
}