'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import {
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Divider,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ApartmentOutlined,
  ArrowLeftOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
  CheckCircleOutlined,
  StopOutlined,
  DeleteOutlined,
  LockOutlined,
  UnlockOutlined,
  ClusterOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { OrganizationUnitItem, OrganizationUnitUpsertRequest } from '@/dtos/organization.dto';
import { organizationApi } from '@/services/organization/organizationApi';
import './organization.css';

const { Title, Text } = Typography;

type OrgUnit = {
  id: string;
  name: string;
  code: string;
  level: number;
  parentId: string | null;
  description: string;
  isActive: boolean;
  memberCount: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
};

/** Tổng nhân sự của một đơn vị bao gồm toàn bộ cây con */
function countSubtreeMembers(units: OrgUnit[], rootId: string): number {
  const directChildren = units.filter((u) => u.parentId === rootId);
  return directChildren.reduce(
    (sum, c) => sum + c.memberCount + countSubtreeMembers(units, c.id),
    0,
  );
}

type FormUnit = {
  id?: string;
  name: string;
  code: string;
  level: number;
  parentId: string | null;
  description: string;
  isActive: boolean;
};

type ViewMode = 'list' | 'form' | 'detail';

function buildOrderedUnits(units: OrgUnit[], parentId: string | null = null): OrgUnit[] {
  return units
    .filter((u) => u.parentId === parentId)
    .flatMap((u) => [u, ...buildOrderedUnits(units, u.id)]);
}

export default function OrganizationPage() {
  const { message } = App.useApp();
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [mode, setMode] = useState<ViewMode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const mapUnit = useCallback((x: OrganizationUnitItem): OrgUnit => ({
    id: x.id,
    name: x.name,
    code: x.code,
    level: x.level,
    parentId: x.parentId,
    description: x.description ?? '',
    isActive: x.isActive,
    memberCount: x.memberCount,
    createdAt: x.createdAt,
    updatedAt: x.updatedAt,
    createdBy: x.createdBy ?? null,
    updatedBy: x.updatedBy ?? null,
  }), []);

  const loadUnits = useCallback(async () => {
    setLoading(true);
    const res = await organizationApi.list();
    setLoading(false);
    if (res.error || !res.data) {
      message.error(res.error || 'Không tải được dữ liệu cơ cấu tổ chức');
      return;
    }
    setUnits(res.data.map(mapUnit));
  }, [mapUnit, message]);

  useEffect(() => {
    void loadUnits();
  }, [loadUnits]);

  const handleToggleStatus = async (id: string) => {
    const current = units.find((u) => u.id === id);
    if (!current) return;
    setTogglingId(id);
    const body: OrganizationUnitUpsertRequest = {
      name: current.name,
      code: current.code,
      level: current.level,
      parentId: current.parentId,
      description: current.description || null,
      isActive: !current.isActive,
    };
    const res = await organizationApi.update(id, body);
    setTogglingId(null);
    if (res.error) {
      message.error(res.error);
      return;
    }
    await loadUnits();
  };

  const handleDelete = (unit: OrgUnit) => {
    const childCount = units.filter((u) => u.parentId === unit.id).length;
    if (childCount > 0) {
      message.warning(`Không thể xóa "${unit.name}" vì còn ${childCount} đơn vị trực thuộc. Vui lòng xóa hoặc chuyển các đơn vị con trước.`);
      return;
    }
    Modal.confirm({
      title: 'Xác nhận xóa đơn vị',
      icon: <ExclamationCircleOutlined style={{ color: '#dc2626' }} />,
      content: (
        <span>
          Bạn có chắc chắn muốn xóa vĩnh viễn đơn vị <strong>{unit.name}</strong> ({unit.code})?
          {unit.memberCount > 0 && (
            <div style={{ marginTop: 8, color: '#b45309' }}>
              Đơn vị này đang có {unit.memberCount} nhân sự.
            </div>
          )}
          <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 13 }}>Hành động này không thể hoàn tác.</div>
        </span>
      ),
      okText: 'Xóa đơn vị',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        const res = await organizationApi.remove(unit.id);
        if (res.error) {
          message.error(res.error);
          return Promise.reject();
        }
        message.success(`Đã xóa đơn vị "${unit.name}"`);
        await loadUnits();
      },
    });
  };

  const selectedUnit = useMemo(
    () => units.find((u) => u.id === selectedId) ?? null,
    [units, selectedId],
  );

  const stats = useMemo(() => {
    const total = units.length;
    const active = units.filter((u) => u.isActive).length;
    const locked = total - active;
    const totalMembers = units.reduce((sum, u) => sum + u.memberCount, 0);
    return { total, active, locked, totalMembers };
  }, [units]);

  const orderedUnits = useMemo(() => buildOrderedUnits(units), [units]);

  const filteredUnits = useMemo(() => {
    if (!searchTerm) return orderedUnits;
    const lowerTerm = searchTerm.toLowerCase();
    return orderedUnits.filter(
      (u) => u.name.toLowerCase().includes(lowerTerm) || u.code.toLowerCase().includes(lowerTerm)
    );
  }, [orderedUnits, searchTerm]);

  const columns: ColumnsType<OrgUnit> = [
    {
      title: <Text type="secondary" style={{ fontSize: 12 }}>TÊN ĐƠN VỊ</Text>,
      dataIndex: 'name',
      key: 'name',
      render: (_v, record) => (
        <Space style={{ paddingLeft: (record.level - 1) * 32 }}>
          {record.level > 1 && (
            <div style={{ width: 16, borderBottom: '1px solid #d9d9d9', marginRight: 8 }}></div>
          )}
          <div className="org-unit-icon-box" style={{ width: 32, height: 32, background: '#f0f5ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2f54eb' }}>
            <ApartmentOutlined />
          </div>
          <Text strong={record.level === 1} style={{ fontSize: 14 }}>{record.name}</Text>
        </Space>
      ),
    },
    { 
      title: <Text type="secondary" style={{ fontSize: 12 }}>MÃ ĐƠN VỊ</Text>, 
      dataIndex: 'code', 
      key: 'code', 
      width: 150,
      render: (v) => <Text type="secondary">{v}</Text>
    },
    {
      title: <Text type="secondary" style={{ fontSize: 12 }}>LOẠI ĐƠN VỊ</Text>,
      dataIndex: 'level',
      key: 'level',
      width: 100,
      align: 'center',
      render: (v: number) => <Tag bordered={false} style={{ borderRadius: 4, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>{`Đơn vị cấp ${v}`}</Tag>,
    },
    {
      title: <Text type="secondary" style={{ fontSize: 12 }}>THÀNH VIÊN</Text>,
      dataIndex: 'memberCount',
      key: 'memberCount',
      width: 120,
      align: 'center',
      render: (v: number) => (
        <Space>
           <UserOutlined style={{ color: '#8c8c8c' }} />
           <Text>{v}</Text>
        </Space>
      )
    },
    {
      title: <Text type="secondary" style={{ fontSize: 12 }}>TRẠNG THÁI</Text>,
      dataIndex: 'isActive',
      key: 'isActive',
      width: 150,
      render: (v: boolean) =>
        v ? (
          <Tag color="success" style={{ borderRadius: 16, padding: '2px 10px', display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f6ffed', borderColor: '#b7eb8f', color: '#52c41a' }}>
            <CheckCircleOutlined style={{ fontSize: 12 }} /> Hoạt động
          </Tag>
        ) : (
          <Tag color="default" style={{ borderRadius: 16, padding: '2px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <StopOutlined style={{ fontSize: 12 }} /> Đã khóa
          </Tag>
        ),
    },
    {
      title: <Text type="secondary" style={{ fontSize: 12 }}>THAO TÁC</Text>,
      key: 'actions',
      width: 170,
      align: 'right',
      render: (_v, record) => (
        <div className="action-buttons">
          <Tooltip title="Chi tiết">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => { setSelectedId(record.id); setMode('detail'); }}
              className="action-btn view-btn"
            />
          </Tooltip>
          <Tooltip title="Sửa">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => { setSelectedId(record.id); setMode('form'); }}
              className="action-btn edit-btn"
            />
          </Tooltip>
          <Tooltip title={record.isActive ? "Khóa đơn vị" : "Mở khóa"}>
            <Button
              type="text"
              icon={record.isActive ? <LockOutlined /> : <UnlockOutlined />}
              loading={togglingId === record.id}
              onClick={() => handleToggleStatus(record.id)}
              className={`action-btn ${record.isActive ? 'lock-btn' : 'unlock-btn'}`}
            />
          </Tooltip>
          <Tooltip title="Xóa đơn vị">
            <Button
              type="text"
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
              className="action-btn remove-btn"
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  const handleSave = async (payload: FormUnit) => {
    setSaving(true);
    const body: OrganizationUnitUpsertRequest = {
      name: payload.name,
      code: payload.code,
      level: payload.level,
      parentId: payload.parentId,
      description: payload.description || null,
      isActive: payload.isActive,
    };

    const res = payload.id
      ? await organizationApi.update(payload.id, body)
      : await organizationApi.create(body);
    setSaving(false);

    if (res.error) {
      message.error(res.error);
      return;
    }

    await loadUnits();
    setMode('list');
    setSelectedId(null);
  };

  const statItems = [
    { label: 'Tổng đơn vị', value: stats.total, icon: <ClusterOutlined />, color: '#2563eb' },
    { label: 'Đang hoạt động', value: stats.active, icon: <CheckCircleOutlined />, color: '#059669' },
    { label: 'Đã khóa', value: stats.locked, icon: <LockOutlined />, color: '#64748b' },
    { label: 'Tổng nhân sự', value: stats.totalMembers, icon: <TeamOutlined />, color: '#7c3aed' },
  ];

  return (
    <MainLayout>
      <div className="org-container">

        {/* LIST MODE */}
        {mode === 'list' && (
          <>
            <div className="org-page-head">
              <div>
                <Title level={4} className="org-page-title">
                  <ApartmentOutlined /> Quản lý Cơ cấu tổ chức
                </Title>
                <Text className="org-page-sub">
                  Quản lý cây đơn vị, phân cấp trực thuộc và nhân sự của tổ chức
                </Text>
              </div>
              <Button
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                style={{ borderRadius: 10 }}
                onClick={() => {
                  setSelectedId(null);
                  setMode('form');
                }}
              >
                Thêm đơn vị
              </Button>
            </div>

            {/* THẺ THỐNG KÊ */}
            <Row gutter={[14, 14]} className="org-stat-row">
              {statItems.map((s) => (
                <Col xs={12} lg={6} key={s.label} style={{ display: 'flex' }}>
                  <div className="org-stat">
                    <span className="org-stat-icon" style={{ color: s.color, background: `${s.color}14` }}>
                      {s.icon}
                    </span>
                    <div>
                      <div className="org-stat-count">{s.value}</div>
                      <div className="org-stat-label">{s.label}</div>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>

            <Card
              variant="borderless"
              className="org-card"
              styles={{ body: { padding: '20px' } }}
            >
              <div style={{ marginBottom: 16 }}>
                <Input
                  placeholder="Tìm kiếm theo tên hoặc mã đơn vị..."
                  prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                  allowClear
                  style={{ maxWidth: 360, borderRadius: 10, height: 40 }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Table
                rowKey="id"
                className="org-table"
                columns={columns}
                dataSource={filteredUnits}
                loading={loading}
                scroll={{ x: 'max-content' }}
                locale={{
                  emptyText: (
                    <div className="org-empty-state">
                      {searchTerm ? 'Không tìm thấy đơn vị phù hợp' : 'Chưa có đơn vị nào'}
                    </div>
                  ),
                }}
                pagination={false}
                size="middle"
                rowClassName={() => 'custom-table-row'}
              />
            </Card>
          </>
        )}

        {/* FORM MODE */}
        {mode === 'form' && (
          <>
            <div className="org-page-head">
              <div>
                <Title level={4} className="org-page-title">
                  {selectedUnit ? 'Sửa thông tin đơn vị' : 'Thêm mới đơn vị'}
                </Title>
                <Text className="org-page-sub">
                  {selectedUnit ? 'Cập nhật thông tin và vị trí của đơn vị trong cây tổ chức' : 'Khai báo một đơn vị mới và gắn vào cây tổ chức'}
                </Text>
              </div>
            </div>
            {/* Thu hẹp kích thước Card form lại (680px) và căn giữa */}
            <div style={{ maxWidth: 680, margin: '0 auto' }}>
              <OrganizationForm
                units={units}
                initial={selectedUnit}
                onSave={handleSave}
                saving={saving}
                onCancel={() => setMode('list')}
              />
            </div>
          </>
        )}

        {/* DETAIL MODE */}
        {mode === 'detail' && selectedUnit && (
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
             <div className="org-page-head">
               <div>
                 <Title level={4} className="org-page-title">Chi tiết đơn vị</Title>
                 <Text className="org-page-sub">Thông tin chi tiết, phân cấp và nhân sự của đơn vị</Text>
               </div>
            </div>
            <OrganizationDetail
              unit={selectedUnit}
              allUnits={units}
              onBack={() => setMode('list')}
              onEdit={() => setMode('form')}
            />
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function OrganizationForm({
  units,
  initial,
  onSave,
  saving,
  onCancel,
}: {
  units: OrgUnit[];
  initial: OrgUnit | null;
  onSave: (payload: FormUnit) => Promise<void>;
  saving: boolean;
  onCancel: () => void;
}) {
  const [form] = Form.useForm<FormUnit>();
  const { message } = App.useApp();

  // Lấy giá trị level hiện tại từ Form để render linh hoạt
  const formLevel = Form.useWatch('level', form);
  const actualLevel = formLevel !== undefined ? formLevel : (initial?.level || 1);

  // State lưu trữ đường dẫn cha đã chọn
  const [parentPath, setParentPath] = useState<Record<number, string>>(() => {
    if (initial && initial.parentId) {
      const path: Record<number, string> = {};
      let currentId: string | null = initial.parentId;
      while (currentId) {
        const u = units.find(unit => unit.id === currentId);
        if (u) {
          path[u.level] = u.id;
          currentId = u.parentId;
        } else break;
      }
      return path;
    }
    return {};
  });

  // Xử lý khi chọn 1 cấp trong chuỗi dropdown
  const handlePathSelect = (level: number, selectedId: string | undefined) => {
    setParentPath(prev => {
      const newPath = { ...prev };
      if (selectedId) {
        newPath[level] = selectedId;
      } else {
        delete newPath[level];
      }
      // Xóa tất cả các cấp con bên dưới vì cha đã thay đổi
      for (let i = level + 1; i <= 5; i++) {
        delete newPath[i];
      }
      return newPath;
    });
  };

  // Render chuỗi dropdown chọn cha
  const renderParentSelectors = () => {
    if (actualLevel === 1) {
      return (
        <Select
          disabled
          placeholder="-- Là đơn vị cao nhất --"
          style={{ borderRadius: 6 }}
        />
      );
    }

    const selectors = [];
    for (let i = 1; i < actualLevel; i++) {
      let availableOptions: OrgUnit[] = [];
      if (i === 1) {
        availableOptions = units.filter(u => u.level === 1 && u.isActive && u.id !== initial?.id);
      } else {
        const parentIdForThisLevel = parentPath[i - 1];
        if (parentIdForThisLevel) {
          availableOptions = units.filter(u => u.level === i && u.parentId === parentIdForThisLevel && u.isActive && u.id !== initial?.id);
        }
      }

      // Dropdown chỉ được active nếu cấp cha của nó đã được chọn
      const isSelectable = i === 1 || !!parentPath[i - 1];

      selectors.push(
        <div key={i} style={{ marginBottom: i < actualLevel - 1 ? 12 : 0 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            Chọn Đơn vị Quản lý cấp {i}
          </Text>
          <Select
            value={parentPath[i] || undefined}
            onChange={(val) => handlePathSelect(i, val)}
            disabled={!isSelectable}
            placeholder={`-- Chọn Đơn vị cấp ${i} --`}
            style={{ width: '100%', borderRadius: 6 }}
            options={availableOptions.map(u => ({ label: u.name, value: u.id }))}
            allowClear
          />
        </div>
      );
    }
    
    return <div>{selectors}</div>;
  };

  // Hàm xử lý trước khi lưu
  const handleFinish = (values: FormUnit) => {
    const finalParentId = values.level === 1 ? null : parentPath[values.level - 1];
    
    if (values.level > 1 && !finalParentId) {
      message.error("Vui lòng chọn đầy đủ cấp cha tổ chức!");
      return;
    }

    onSave({
      ...values,
      id: initial?.id,
      parentId: finalParentId,
    });
  };

  return (
    <Card
      variant="borderless" 
      style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0' }}
      styles={{ body: { padding: '32px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, gap: 16 }}>
         <Button type="text" icon={<ArrowLeftOutlined style={{ color: '#8c8c8c' }} />} onClick={onCancel} />
         <Text strong style={{ fontSize: 16, color: '#334155' }}>
           {initial ? 'Cập nhật thông tin Đơn vị' : 'Điền thông tin Đơn vị mới'}
         </Text>
      </div>
      <Divider style={{ marginTop: 0, marginBottom: 24 }} />

      <Form
        form={form}
        layout="vertical"
        size="large"
        initialValues={
          initial ?? {
            name: '',
            code: '',
            level: 1,
            parentId: null,
            description: '',
            isActive: true,
          }
        }
        onFinish={handleFinish}
      >
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              label={<Text strong style={{ color: '#475569' }}>Tên Đơn vị</Text>}
              name="name"
              rules={[{ required: true, message: 'Vui lòng nhập tên đơn vị' }]}
            >
              <Input placeholder="VD: Phòng Hành chính" style={{ borderRadius: 6 }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label={<Text strong style={{ color: '#475569' }}>Mã Đơn vị</Text>}
              name="code"
              rules={[{ required: true, message: 'Vui lòng nhập mã đơn vị' }]}
            >
              <Input placeholder="VD: HCNS" style={{ borderRadius: 6 }} />
            </Form.Item>
          </Col>
          
          <Col span={12}>
            <Form.Item label={<Text strong style={{ color: '#475569' }}>Loại đơn vị</Text>} name="level">
              <Select
                style={{ borderRadius: 6 }}
                onChange={(val) => {
                  // Xóa phần chọn cha không hợp lệ khi hạ cấp tổ chức
                  setParentPath(prev => {
                    const newPath = { ...prev };
                    Object.keys(newPath).forEach(k => {
                      if (Number(k) >= val) delete newPath[Number(k)];
                    });
                    return newPath;
                  });
                }}
                options={[
                  { label: 'Đơn vị cấp 1', value: 1 },
                  { label: 'Đơn vị cấp 2', value: 2 },
                  { label: 'Đơn vị cấp 3', value: 3 },
                  { label: 'Đơn vị cấp 4', value: 4 },
                  { label: 'Đơn vị cấp 5', value: 5 },
                ]}
              />
            </Form.Item>
          </Col>
          
          <Col span={12}>
            <Form.Item
              label={<Text strong style={{ color: '#475569' }}>Đơn vị Trực thuộc (Cha)</Text>}
              required={actualLevel > 1}
            >
              {renderParentSelectors()}
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item label={<Text strong style={{ color: '#475569' }}>Mô tả chức năng</Text>} name="description">
              <Input.TextArea 
                rows={4} 
                placeholder="Mô tả ngắn gọn chức năng, nhiệm vụ của đơn vị này..."
                style={{ borderRadius: 6 }}
              />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item name="isActive" valuePropName="checked" style={{ marginBottom: 40 }}>
              <Space size="middle">
                <Switch />
                <Text style={{ color: '#334155' }}>Đang hoạt động</Text>
              </Space>
            </Form.Item>
          </Col>
        </Row>
        
        <Divider style={{ margin: '0 -32px 24px -32px', width: 'calc(100% + 64px)' }} />

        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button size="large" onClick={onCancel} style={{ borderRadius: 6, minWidth: 100 }}>Hủy bỏ</Button>
          <Button type="primary" size="large" htmlType="submit" loading={saving} style={{ borderRadius: 6, minWidth: 120 }}>
            {initial ? 'Lưu thay đổi' : 'Tạo Đơn vị'}
          </Button>
        </Space>
      </Form>
    </Card>
  );
}

function OrganizationDetail({
  unit,
  allUnits,
  onBack,
  onEdit,
}: {
  unit: OrgUnit;
  allUnits: OrgUnit[];
  onBack: () => void;
  onEdit: () => void;
}) {
  const parent = allUnits.find((u) => u.id === unit.parentId) ?? null;
  const children = allUnits.filter((u) => u.parentId === unit.id);
  const subtreeMembers = countSubtreeMembers(allUnits, unit.id);

  return (
    <>
      <Card
        variant="borderless" 
        style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0', marginBottom: 24 }}
        styles={{ body: { padding: '24px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <Button icon={<ArrowLeftOutlined style={{ color: '#8c8c8c' }} />} onClick={onBack} style={{ borderRadius: 6 }} />
            <div>
              <Space align="center" style={{ marginBottom: 4 }}>
                <Title level={4} style={{ margin: 0, color: '#1e293b' }}>{unit.name}</Title>
                {unit.isActive ? (
                  <Tag color="success" style={{ borderRadius: 12, padding: '0 8px', background: '#ecfdf5', borderColor: '#a7f3d0', color: '#059669', margin: 0 }}>Hoạt động</Tag>
                ) : (
                  <Tag color="default" style={{ borderRadius: 12, padding: '0 8px', margin: 0 }}>Đã khóa</Tag>
                )}
              </Space>
              <div style={{ color: '#64748b', fontSize: 13 }}>Mã: <Text strong style={{ color: '#475569' }}>{unit.code}</Text></div>
            </div>
          </div>
          <Button icon={<EditOutlined />} onClick={onEdit} style={{ borderRadius: 6 }}>
            Chỉnh sửa
          </Button>
        </div>
      </Card>

      <Row gutter={24}>
        {/* CỘT TRÁI - THÔNG TIN CHUNG */}
        <Col span={8}>
          <Card
            variant="borderless" 
            style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0', height: '100%' }}
          >
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5 }}>THÔNG TIN CHUNG</Text>
            
            <div style={{ marginTop: 24 }}>
               <Text type="secondary" style={{ fontSize: 13 }}>Loại đơn vị</Text>
               <Title level={4} style={{ margin: '4px 0 20px 0', color: '#1e293b' }}>{`Đơn vị cấp ${unit.level}`}</Title>
            </div>

            <div style={{ marginBottom: 20 }}>
               <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Đơn vị quản lý</Text>
               {parent ? (
                 <Space style={{ color: '#1890ff', cursor: 'pointer', fontWeight: 500 }}>
                   <ApartmentOutlined />
                   {parent.name}
                 </Space>
               ) : (
                 <Text strong style={{ color: '#475569' }}>Đơn vị gốc</Text>
               )}
            </div>

            {unit.description?.trim() ? (
              <div>
                <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Mô tả</Text>
                <Text style={{ color: '#475569' }}>{unit.description}</Text>
              </div>
            ) : null}
          </Card>
        </Col>

        {/* CỘT PHẢI */}
        <Col span={16}>
          {/* Card Đơn vị con */}
          <Card
            variant="borderless" 
            title={<Space><ApartmentOutlined style={{ color: '#60a5fa' }}/><Text strong style={{ color: '#334155' }}>Danh sách đơn vị trực thuộc ({children.length})</Text></Space>}
            style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0', marginBottom: 24 }}
            styles={{ body: { padding: '16px 24px' }, header: { borderBottom: '1px solid #f0f0f0' } }}
          >
            {children.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <Text type="secondary">Không có đơn vị trực thuộc</Text>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {children.map((c, index) => (
                  <div key={c.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
                      <Space size="middle">
                         <div className="org-unit-icon-box" style={{ width: 36, height: 36, background: '#f0f5ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                           <ApartmentOutlined style={{ fontSize: 16 }} />
                         </div>
                         <div>
                            <Text strong style={{ display: 'block', color: '#334155' }}>{c.name}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>{c.code}</Text>
                         </div>
                      </Space>
                      <Tag bordered={false} style={{ borderRadius: 4, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
                        {`Đơn vị cấp ${c.level}`}
                      </Tag>
                    </div>
                    {index < children.length - 1 && <Divider style={{ margin: 0 }} />}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 2 Card thống kê – số liệu thật từ dữ liệu tổ chức */}
          <Row gutter={24}>
            <Col span={12}>
              <Card
                variant="borderless"
                style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0', textAlign: 'center', height: '100%' }}
                styles={{ body: { padding: '32px 24px' } }}
              >
                 <div style={{ width: 56, height: 56, background: '#f0f5ff', color: '#6366f1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>
                    <TeamOutlined />
                 </div>
                 <Title level={2} style={{ margin: 0, color: '#0f172a' }}>{unit.memberCount}</Title>
                 <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>Nhân sự trực tiếp</Text>
                 {subtreeMembers > 0 && (
                   <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
                     {unit.memberCount + subtreeMembers} nhân sự tính cả đơn vị con
                   </Text>
                 )}
              </Card>
            </Col>

            <Col span={12}>
              <Card
                variant="borderless"
                style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0', textAlign: 'center', height: '100%' }}
                styles={{ body: { padding: '32px 24px' } }}
              >
                 <div style={{ width: 56, height: 56, background: '#ecfdf5', color: '#059669', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>
                    <ApartmentOutlined />
                 </div>
                 <Title level={2} style={{ margin: 0, color: '#0f172a' }}>{children.length}</Title>
                 <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>Đơn vị trực thuộc</Text>
                 {unit.updatedAt && (
                   <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
                     Cập nhật: {dayjs(unit.updatedAt).format('DD/MM/YYYY')}
                   </Text>
                 )}
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
    </>
  );
}