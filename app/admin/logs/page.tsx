'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import MainLayout from '@/components/MainLayout';
import { App, Input, Table, Typography, Pagination, Empty, Select, Button, Tooltip } from 'antd';
import {
  FileTextOutlined, SearchOutlined, ReloadOutlined, LoginOutlined,
  VideoCameraOutlined, SafetyCertificateOutlined, UserOutlined, GlobalOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminApi } from '@/services/admin/adminApi';
import type { AuditLog } from '@/dtos/admin.dto';
import '../admin.css';
import './logs.css';

const CATEGORY_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  Auth: { label: 'Xác thực', color: '#2563eb', icon: <LoginOutlined /> },
  Meeting: { label: 'Cuộc họp', color: '#059669', icon: <VideoCameraOutlined /> },
  Admin: { label: 'Quản trị', color: '#d97706', icon: <SafetyCertificateOutlined /> },
};

const SEVERITY_META: Record<string, { label: string; cls: string }> = {
  info: { label: 'Thông tin', cls: 'sev-info' },
  warning: { label: 'Cảnh báo', cls: 'sev-warning' },
  error: { label: 'Lỗi', cls: 'sev-error' },
};

const PAGE_SIZE = 20;

export default function AdminLogsPage() {
  const router = useRouter();
  const { isAuthenticated, loading, isAdmin } = useAuth();
  const { message: messageApi } = App.useApp();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [severity, setSeverity] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    } else if (!loading && !isAdmin) {
      router.push('/');
    }
  }, [isAuthenticated, loading, isAdmin, router]);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    const res = await adminApi.getAuditLogs({ page, pageSize: PAGE_SIZE, category, severity, search });
    setLoadingLogs(false);
    if (res.error) {
      messageApi.error(res.error);
      return;
    }
    if (res.data) {
      setLogs(res.data.items ?? []);
      setTotal(res.data.total ?? 0);
    }
  }, [page, category, severity, search, messageApi]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) void loadLogs();
  }, [isAuthenticated, isAdmin, loadLogs]);

  // Debounce ô tìm kiếm
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;
  if (!isAuthenticated || !isAdmin) return null;

  return (
    <MainLayout>
      <div className="admin-container">
        {/* HEADER */}
        <div className="admin-page-head">
          <div>
            <Typography.Title level={4} className="admin-page-title">
              <FileTextOutlined /> Nhật ký hệ thống
            </Typography.Title>
            <Typography.Text className="admin-page-sub">
              Theo dõi các hoạt động quan trọng: đăng nhập, tạo/hủy cuộc họp, thay đổi quyền và tài khoản
            </Typography.Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={() => void loadLogs()} loading={loadingLogs}>
            Tải lại
          </Button>
        </div>

        {/* TOOLBAR */}
        <div className="admin-toolbar">
          <Input
            className="admin-search"
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Tìm theo nội dung, người thực hiện, đối tượng..."
            allowClear
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ borderRadius: 10, height: 40 }}
          />
          <Select
            allowClear
            placeholder="Nhóm sự kiện"
            value={category}
            onChange={(v) => { setPage(1); setCategory(v); }}
            style={{ minWidth: 150, height: 40 }}
            options={[
              { value: 'Auth', label: 'Xác thực' },
              { value: 'Meeting', label: 'Cuộc họp' },
              { value: 'Admin', label: 'Quản trị' },
            ]}
          />
          <Select
            allowClear
            placeholder="Mức độ"
            value={severity}
            onChange={(v) => { setPage(1); setSeverity(v); }}
            style={{ minWidth: 130, height: 40 }}
            options={[
              { value: 'info', label: 'Thông tin' },
              { value: 'warning', label: 'Cảnh báo' },
              { value: 'error', label: 'Lỗi' },
            ]}
          />
        </div>

        {/* BẢNG */}
        <div className="admin-card" style={{ background: '#fff', overflow: 'hidden' }}>
          <Table<AuditLog>
            rowKey="id"
            dataSource={logs}
            loading={loadingLogs}
            pagination={false}
            scroll={{ x: 'max-content' }}
            className="admin-table logs-table"
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<span style={{ color: '#94a3b8' }}>Chưa có nhật ký nào</span>}
                  style={{ padding: '40px 0' }}
                />
              ),
            }}
            columns={[
              {
                title: 'Thời gian',
                key: 'at',
                width: 150,
                render: (_: unknown, r: AuditLog) => (
                  <div className="log-time">
                    <div className="log-time-main">{dayjs(r.at).format('HH:mm:ss')}</div>
                    <div className="log-time-date">{dayjs(r.at).format('DD/MM/YYYY')}</div>
                  </div>
                ),
              },
              {
                title: 'Nhóm',
                key: 'category',
                width: 130,
                render: (_: unknown, r: AuditLog) => {
                  const meta = CATEGORY_META[r.category];
                  return (
                    <span
                      className="log-cat"
                      style={{ color: meta?.color ?? '#64748b', background: `${meta?.color ?? '#64748b'}14` }}
                    >
                      {meta?.icon ?? <FileTextOutlined />} {meta?.label ?? r.category}
                    </span>
                  );
                },
              },
              {
                title: 'Nội dung',
                key: 'message',
                render: (_: unknown, r: AuditLog) => (
                  <div className="log-msg">
                    <div className="log-msg-text">{r.message}</div>
                    <div className="log-msg-meta">
                      <span className="log-actor">
                        <UserOutlined /> {r.actorName || 'Hệ thống'}
                      </span>
                      {r.ipAddress && (
                        <Tooltip title="Địa chỉ IP">
                          <span className="log-ip"><GlobalOutlined /> {r.ipAddress}</span>
                        </Tooltip>
                      )}
                      <code className="log-action">{r.action}</code>
                    </div>
                  </div>
                ),
              },
              {
                title: 'Mức độ',
                key: 'severity',
                width: 120,
                align: 'center',
                render: (_: unknown, r: AuditLog) => {
                  const meta = SEVERITY_META[r.severity] ?? SEVERITY_META.info;
                  return <span className={`log-sev ${meta.cls}`}>{meta.label}</span>;
                },
              },
            ]}
          />
          {total > 0 && (
            <div className="logs-pagination-bar">
              <Typography.Text style={{ color: '#64748b', fontSize: 13 }}>
                {(page - 1) * PAGE_SIZE + 1} – {Math.min(page * PAGE_SIZE, total)} trong số {total}
              </Typography.Text>
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={total}
                onChange={(p) => setPage(p)}
                showSizeChanger={false}
              />
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
