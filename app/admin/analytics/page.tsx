'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import MainLayout from '@/components/MainLayout';
import { App, Typography, Segmented, Button, Empty, Spin } from 'antd';
import {
  BarChartOutlined, ReloadOutlined, VideoCameraOutlined, TeamOutlined,
  UserOutlined, PlayCircleOutlined, ClockCircleOutlined, PlaySquareOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminApi } from '@/services/admin/adminApi';
import type { AnalyticsResponse } from '@/dtos/admin.dto';
import './analytics.css';

const STATUS_META: Record<string, { label: string; color: string }> = {
  live: { label: 'Đang diễn ra', color: '#059669' },
  ended: { label: 'Đã kết thúc', color: '#475569' },
  upcoming: { label: 'Sắp tới', color: '#d97706' },
  no_show: { label: 'Không diễn ra', color: '#94a3b8' },
  noshow: { label: 'Không diễn ra', color: '#94a3b8' },
  cancelled: { label: 'Đã hủy', color: '#dc2626' },
};

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const { isAuthenticated, loading, isAdmin } = useAuth();
  const { message: messageApi } = App.useApp();

  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    } else if (!loading && !isAdmin) {
      router.push('/');
    }
  }, [isAuthenticated, loading, isAdmin, router]);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    const res = await adminApi.getAnalytics(days);
    setLoadingData(false);
    if (res.error) {
      messageApi.error(res.error);
      return;
    }
    if (res.data) setData(res.data);
  }, [days, messageApi]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) void loadData();
  }, [isAuthenticated, isAdmin, loadData]);

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;
  if (!isAuthenticated || !isAdmin) return null;

  const s = data?.summary;

  const kpis = [
    { key: 'meetings', label: 'Tổng cuộc họp', value: s?.totalMeetings ?? 0, icon: <VideoCameraOutlined />, color: '#2563eb', sub: `${s?.meetingsInRange ?? 0} trong ${days} ngày` },
    { key: 'live', label: 'Đang diễn ra', value: s?.liveMeetings ?? 0, icon: <PlayCircleOutlined />, color: '#059669' },
    { key: 'participants', label: 'Lượt tham gia', value: s?.totalParticipants ?? 0, icon: <TeamOutlined />, color: '#7c3aed' },
    { key: 'users', label: 'Người dùng', value: s?.totalUsers ?? 0, icon: <UserOutlined />, color: '#0891b2', sub: `+${s?.newUsersInRange ?? 0} mới` },
    { key: 'duration', label: 'Thời lượng TB', value: s ? `${s.avgDurationMinutes}′` : '0′', icon: <ClockCircleOutlined />, color: '#d97706' },
    { key: 'recordings', label: 'Bản ghi', value: s?.totalRecordings ?? 0, icon: <PlaySquareOutlined />, color: '#db2777' },
  ];

  return (
    <MainLayout>
      <div className="an-container">
        {/* HEADER */}
        <div className="an-head">
          <div>
            <Typography.Title level={4} className="an-title">
              <BarChartOutlined /> Thống kê & Phân tích
            </Typography.Title>
            <Typography.Text className="an-sub">
              Tổng quan hoạt động cuộc họp và người dùng trên toàn hệ thống
            </Typography.Text>
          </div>
          <div className="an-head-actions">
            <Segmented
              value={days}
              onChange={(v) => setDays(v as number)}
              options={[
                { label: '7 ngày', value: 7 },
                { label: '30 ngày', value: 30 },
                { label: '90 ngày', value: 90 },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loadingData} />
          </div>
        </div>

        {loadingData && !data ? (
          <div className="an-loading"><Spin size="large" /></div>
        ) : !data ? (
          <div className="an-card"><Empty description="Chưa có dữ liệu" /></div>
        ) : (
          <>
            {/* KPI */}
            <div className="an-kpi-grid">
              {kpis.map((k) => (
                <div className="an-kpi" key={k.key}>
                  <span className="an-kpi-icon" style={{ color: k.color, background: `${k.color}14` }}>{k.icon}</span>
                  <div className="an-kpi-body">
                    <div className="an-kpi-value">{k.value}</div>
                    <div className="an-kpi-label">{k.label}</div>
                    {k.sub && <div className="an-kpi-sub">{k.sub}</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* Biểu đồ đường: cuộc họp + user mới */}
            <div className="an-card">
              <div className="an-card-head">
                <h3 className="an-card-title">Xu hướng theo ngày</h3>
                <div className="an-legend">
                  <span className="an-legend-item"><i style={{ background: '#2563eb' }} /> Cuộc họp</span>
                  <span className="an-legend-item"><i style={{ background: '#0891b2' }} /> Người dùng mới</span>
                </div>
              </div>
              <TrendChart series={data.series} />
            </div>

            <div className="an-two-col">
              {/* Donut trạng thái */}
              <div className="an-card">
                <div className="an-card-head"><h3 className="an-card-title">Trạng thái cuộc họp</h3></div>
                <StatusDonut breakdown={data.statusBreakdown} total={s?.totalMeetings ?? 0} />
              </div>

              {/* Top host */}
              <div className="an-card">
                <div className="an-card-head"><h3 className="an-card-title">Top người tổ chức</h3></div>
                <TopHostsBars hosts={data.topHosts} />
              </div>
            </div>

            {/* Phân bố theo giờ */}
            <div className="an-card">
              <div className="an-card-head"><h3 className="an-card-title">Khung giờ tổ chức họp</h3></div>
              <HourHeatBars buckets={data.hourDistribution} />
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}

/* ── Biểu đồ đường (SVG thuần) ─────────────────────────────── */
function TrendChart({ series }: { series: AnalyticsResponse['series'] }) {
  const [hover, setHover] = useState<{ x: number; y: number; m: number; u: number; date: string } | null>(null);
  const W = 720, H = 200, pad = 28;

  const max = useMemo(() => {
    const vals = series.flatMap((p) => [p.meetings, p.newUsers]);
    return Math.max(...vals, 4);
  }, [series]);

  if (series.every((p) => p.meetings === 0 && p.newUsers === 0)) {
    return <div className="an-empty"><BarChartOutlined /><span>Chưa có hoạt động trong khoảng thời gian này</span></div>;
  }

  const innerW = W - pad * 2, innerH = H - pad * 2;
  const xFor = (i: number) => pad + (series.length <= 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
  const yFor = (v: number) => H - pad - (v / max) * innerH;

  const path = (key: 'meetings' | 'newUsers') =>
    series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p[key]).toFixed(1)}`).join(' ');

  const areaPath = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.meetings).toFixed(1)}`).join(' ')
    + ` L ${xFor(series.length - 1).toFixed(1)} ${H - pad} L ${xFor(0).toFixed(1)} ${H - pad} Z`;

  return (
    <div className="an-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="anArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((t) => (
          <line key={t} x1={pad} x2={W - pad} y1={pad + t * innerH} y2={pad + t * innerH}
            stroke="#e2e8f0" strokeWidth={1} strokeDasharray={t === 1 ? '0' : '4 4'} className="an-grid" />
        ))}
        <path d={areaPath} fill="url(#anArea)" />
        <path d={path('meetings')} fill="none" stroke="#2563eb" strokeWidth={2.5} />
        <path d={path('newUsers')} fill="none" stroke="#0891b2" strokeWidth={2.5} strokeDasharray="5 4" />
        {series.map((p, i) => (
          <rect key={i} x={xFor(i) - innerW / (series.length * 2)} y={pad} width={innerW / series.length} height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover({ x: xFor(i), y: yFor(p.meetings), m: p.meetings, u: p.newUsers, date: p.date })}
            onMouseLeave={() => setHover(null)} />
        ))}
        {hover && (
          <>
            <line x1={hover.x} x2={hover.x} y1={pad} y2={H - pad} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={hover.x} cy={hover.y} r={4} fill="#fff" stroke="#2563eb" strokeWidth={2.5} />
          </>
        )}
      </svg>
      {hover && (
        <div className="an-tooltip" style={{ left: `${(hover.x / W) * 100}%` }}>
          <div className="an-tt-date">{dayjs(hover.date).format('DD/MM/YYYY')}</div>
          <div><i style={{ background: '#2563eb' }} /> {hover.m} cuộc họp</div>
          <div><i style={{ background: '#0891b2' }} /> {hover.u} người dùng mới</div>
        </div>
      )}
    </div>
  );
}

/* ── Donut trạng thái (SVG) ────────────────────────────────── */
function StatusDonut({ breakdown, total }: { breakdown: AnalyticsResponse['statusBreakdown']; total: number }) {
  const items = breakdown.filter((b) => b.count > 0);
  if (total === 0 || items.length === 0) {
    return <div className="an-empty"><VideoCameraOutlined /><span>Chưa có cuộc họp</span></div>;
  }
  const R = 52, C = 2 * Math.PI * R;
  let offset = 0;
  const segs = items.map((b) => {
    const meta = STATUS_META[b.status] ?? { label: b.status, color: '#94a3b8' };
    const frac = b.count / total;
    const seg = { color: meta.color, label: meta.label, count: b.count, len: frac * C, off: offset };
    offset += frac * C;
    return seg;
  });

  return (
    <div className="an-donut-wrap">
      <svg viewBox="0 0 140 140" className="an-donut">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#eef2f7" strokeWidth={16} />
        {segs.map((sg, i) => (
          <circle key={i} cx="70" cy="70" r={R} fill="none" stroke={sg.color} strokeWidth={16}
            strokeDasharray={`${sg.len} ${C - sg.len}`} strokeDashoffset={-sg.off}
            transform="rotate(-90 70 70)" strokeLinecap="butt" />
        ))}
        <text x="70" y="66" textAnchor="middle" className="an-donut-num">{total}</text>
        <text x="70" y="84" textAnchor="middle" className="an-donut-lbl">cuộc họp</text>
      </svg>
      <div className="an-donut-legend">
        {segs.map((sg, i) => (
          <div className="an-dl-item" key={i}>
            <span className="an-dl-dot" style={{ background: sg.color }} />
            <span className="an-dl-label">{sg.label}</span>
            <span className="an-dl-count">{sg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Top host (bar ngang) ──────────────────────────────────── */
function TopHostsBars({ hosts }: { hosts: AnalyticsResponse['topHosts'] }) {
  if (hosts.length === 0) return <div className="an-empty"><UserOutlined /><span>Chưa có dữ liệu</span></div>;
  const max = Math.max(...hosts.map((h) => h.meetingCount), 1);
  return (
    <div className="an-hosts">
      {hosts.map((h, i) => (
        <div className="an-host-row" key={h.hostIdentity}>
          <span className="an-host-rank">#{i + 1}</span>
          <div className="an-host-main">
            <div className="an-host-name">{h.hostName}</div>
            <div className="an-host-bar-track">
              <div className="an-host-bar" style={{ width: `${(h.meetingCount / max) * 100}%` }} />
            </div>
          </div>
          <span className="an-host-count">{h.meetingCount}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Phân bố theo giờ (bar dọc) ────────────────────────────── */
function HourHeatBars({ buckets }: { buckets: AnalyticsResponse['hourDistribution'] }) {
  const max = Math.max(...buckets.map((b) => b.count), 1);
  if (buckets.every((b) => b.count === 0)) {
    return <div className="an-empty"><ClockCircleOutlined /><span>Chưa có dữ liệu</span></div>;
  }
  return (
    <div className="an-hours">
      {buckets.map((b) => (
        <div className="an-hour-col" key={b.hour} title={`${b.hour}:00 — ${b.count} cuộc họp`}>
          <div className="an-hour-bar-wrap">
            <div className="an-hour-bar" style={{ height: `${(b.count / max) * 100}%`, opacity: b.count === 0 ? 0.25 : 1 }} />
          </div>
          <span className="an-hour-label">{b.hour % 3 === 0 ? `${b.hour}h` : ''}</span>
        </div>
      ))}
    </div>
  );
}
