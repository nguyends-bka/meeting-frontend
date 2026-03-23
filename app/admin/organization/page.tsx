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
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Avatar,
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
} from '@ant-design/icons';
import type { OrganizationUnitItem, OrganizationUnitUpsertRequest } from '@/dtos/organization.dto';
import { organizationApi } from '@/services/organization/organizationApi';

const { Title, Text, Link } = Typography;

type OrgUnit = {
  id: string;
  name: string;
  code: string;
  level: number;
  parentId: string | null;
  description: string;
  isActive: boolean;
  memberCount: number;
};

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

  const selectedUnit = useMemo(
    () => units.find((u) => u.id === selectedId) ?? null,
    [units, selectedId],
  );

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
          <div style={{ width: 32, height: 32, background: '#f0f5ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2f54eb' }}>
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
      title: <Text type="secondary" style={{ fontSize: 12 }}>CẤP</Text>,
      dataIndex: 'level',
      key: 'level',
      width: 100,
      align: 'center',
      render: (v: number) => <Tag bordered={false} style={{ borderRadius: 4, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>{`Cấp ${v}`}</Tag>,
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
      width: 140,
      align: 'right',
      render: (_v, record) => (
        <div className="action-buttons" style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
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
          <Tooltip title={record.isActive ? "Khóa" : "Mở khóa"}>
            <Button 
              type="text" 
              icon={record.isActive ? <DeleteOutlined /> : <CheckCircleOutlined />} 
              loading={togglingId === record.id}
              onClick={() => handleToggleStatus(record.id)} 
              className={`action-btn ${record.isActive ? 'delete-btn' : 'unlock-btn'}`} 
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

    message.success(payload.id ? 'Đã cập nhật đơn vị' : 'Đã thêm đơn vị');
    await loadUnits();
    setMode('list');
    setSelectedId(null);
  };

  return (
    <MainLayout>
      <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
        
        {/* LIST MODE */}
        {mode === 'list' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
               <Title level={3} style={{ margin: 0, color: '#1e293b' }}>Quản lý Cơ cấu tổ chức</Title>
            </div>
            
            <Card 
              bordered={false} 
              style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0' }}
              styles={{ body: { padding: '20px' } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <Input 
                  placeholder="Tìm kiếm đơn vị..." 
                  prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} 
                  style={{ width: 320, borderRadius: 8 }} 
                  size="large"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button
                  type="primary"
                  size="large"
                  icon={<PlusOutlined />}
                  style={{ borderRadius: 8 }}
                  onClick={() => {
                    setSelectedId(null);
                    setMode('form');
                  }}
                >
                  Thêm đơn vị
                </Button>
              </div>
              
              <Table 
                rowKey="id" 
                columns={columns} 
                dataSource={filteredUnits} 
                loading={loading}
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
            {/* Tiêu đề trang đưa ra ngoài Card để giống thiết kế Ảnh 1 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
               <Title level={3} style={{ margin: 0, color: '#1e293b' }}>
                 {selectedUnit ? 'Sửa thông tin Đơn vị' : 'Thêm mới Đơn vị'}
               </Title>
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
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
               <Title level={3} style={{ margin: 0, color: '#1e293b' }}>Chi tiết Đơn vị</Title>
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

      {/* CSS tùy chỉnh ẩn viền dọc bảng theo mẫu thiết kế & Hiệu ứng Hover Tool */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-table-row td {
          border-bottom: 1px solid #f0f0f0 !important;
        }
        .ant-table-wrapper .ant-table-container table > thead > tr:first-child > th:first-child {
          border-start-start-radius: 8px;
        }
        .ant-table-wrapper .ant-table-container table > thead > tr:first-child > th:last-child {
          border-start-end-radius: 8px;
        }
        .ant-table-thead > tr > th {
          background: #fafafa !important;
          border-bottom: 1px solid #f0f0f0 !important;
        }
        .ant-table-cell::before {
          display: none !important;
        }
        
        /* Hiệu ứng hiển thị Action Button khi Hover Row */
        .action-buttons {
          opacity: 0;
          transition: opacity 0.2s ease-in-out;
        }
        .custom-table-row:hover .action-buttons {
          opacity: 1;
        }
        .custom-table-row:hover {
          background-color: #f0f5ff !important;
        }
        
        /* Chỉnh màu cho từng loại nút khi hover */
        .action-btn {
          color: #94a3b8 !important; /* Xám nhạt mặc định */
          border-radius: 6px !important;
        }
        .action-btn.view-btn:hover {
          color: #2563eb !important; 
          background-color: #eff6ff !important;
        }
        .action-btn.edit-btn:hover {
          color: #d97706 !important; 
          background-color: #fffbeb !important;
        }
        .action-btn.delete-btn:hover {
          color: #dc2626 !important; 
          background-color: #fef2f2 !important;
        }
        .action-btn.unlock-btn:hover {
          color: #059669 !important; 
          background-color: #ecfdf5 !important;
        }
      `}} />
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
            Chọn Đơn vị Cấp {i}
          </Text>
          <Select
            value={parentPath[i] || undefined}
            onChange={(val) => handlePathSelect(i, val)}
            disabled={!isSelectable}
            placeholder={`-- Chọn Cấp ${i} --`}
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
      bordered={false} 
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
            <Form.Item label={<Text strong style={{ color: '#475569' }}>Cấp Tổ chức</Text>} name="level">
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
                  { label: 'Cấp 1', value: 1 },
                  { label: 'Cấp 2', value: 2 },
                  { label: 'Cấp 3', value: 3 },
                  { label: 'Cấp 4', value: 4 },
                  { label: 'Cấp 5', value: 5 },
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

  return (
    <>
      <Card 
        bordered={false} 
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
            bordered={false} 
            style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0', height: '100%' }}
          >
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5 }}>THÔNG TIN CHUNG</Text>
            
            <div style={{ marginTop: 24 }}>
               <Text type="secondary" style={{ fontSize: 13 }}>Cấp tổ chức</Text>
               <Title level={4} style={{ margin: '4px 0 20px 0', color: '#1e293b' }}>Cấp {unit.level}</Title>
            </div>

            <div style={{ marginBottom: 20 }}>
               <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Đơn vị trực thuộc (Cha)</Text>
               {parent ? (
                 <Space style={{ color: '#1890ff', cursor: 'pointer', fontWeight: 500 }}>
                   <ApartmentOutlined />
                   {parent.name}
                 </Space>
               ) : (
                 <Text strong style={{ color: '#475569' }}>-- Đơn vị gốc --</Text>
               )}
            </div>

            <div>
               <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Mô tả</Text>
               <Text style={{ color: '#475569' }}>{unit.description || 'Chưa có mô tả chức năng'}</Text>
            </div>
          </Card>
        </Col>

        {/* CỘT PHẢI */}
        <Col span={16}>
          {/* Card Đơn vị con */}
          <Card 
            bordered={false} 
            title={<Space><ApartmentOutlined style={{ color: '#60a5fa' }}/><Text strong style={{ color: '#334155' }}>Đơn vị trực thuộc ({children.length})</Text></Space>}
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
                         <div style={{ width: 36, height: 36, background: '#f0f5ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                           <ApartmentOutlined style={{ fontSize: 16 }} />
                         </div>
                         <div>
                            <Text strong style={{ display: 'block', color: '#334155' }}>{c.name}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>{c.code}</Text>
                         </div>
                      </Space>
                      <Tag bordered={false} style={{ borderRadius: 4, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
                        Cấp {c.level}
                      </Tag>
                    </div>
                    {index < children.length - 1 && <Divider style={{ margin: 0 }} />}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 2 Card thống kê */}
          <Row gutter={24}>
            <Col span={12}>
              <Card 
                bordered={false} 
                style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0', textAlign: 'center', height: '100%' }}
                styles={{ body: { padding: '32px 24px' } }}
              >
                 <div style={{ width: 56, height: 56, background: '#f0f5ff', color: '#6366f1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>
                    <TeamOutlined />
                 </div>
                 <Title level={2} style={{ margin: 0, color: '#0f172a' }}>{unit.memberCount}</Title>
                 <Text type="secondary" style={{ display: 'block', marginTop: 4, marginBottom: 24 }}>Nhân sự thuộc đơn vị</Text>
                 <Link style={{ fontWeight: 500, color: '#4f46e5' }}>Quản lý nhân sự &rarr;</Link>
              </Card>
            </Col>
            
            <Col span={12}>
              <Card 
                bordered={false} 
                style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0', textAlign: 'center', height: '100%' }}
                styles={{ body: { padding: '32px 24px' } }}
              >
                 <div style={{ width: 56, height: 56, background: '#fff1f2', color: '#e11d48', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>
                    <ApartmentOutlined />
                 </div>
                 <Title level={2} style={{ margin: 0, color: '#0f172a' }}>12</Title>
                 <Text type="secondary" style={{ display: 'block', marginTop: 4, marginBottom: 24 }}>Cuộc họp đã tổ chức</Text>
                 <Link style={{ fontWeight: 500, color: '#e11d48' }}>Xem danh sách họp &rarr;</Link>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
    </>
  );
}