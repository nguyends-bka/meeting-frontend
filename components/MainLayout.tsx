'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from 'antd';
import Sidebar from './Sidebar';

const { Content } = Layout;

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const isMobile = useMemo(() => {
    if (viewportWidth === null) return false;
    return viewportWidth < 768;
  }, [viewportWidth]);

  useEffect(() => {
    if (isMobile) setCollapsed(true);
  }, [isMobile]);

  const sidebarWidth = isMobile ? 0 : (collapsed ? 80 : 250);

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sidebar collapsed={collapsed} onCollapse={setCollapsed} isMobile={isMobile} />
      <Layout 
        style={{ 
          marginLeft: sidebarWidth,
          transition: 'margin-left 0.2s',
          height: '100vh',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <Content
          style={{
            margin: 0,
            padding: 0,
            height: '100%',
            overflow: 'auto',
            backgroundColor: '#f5f5f5',
            minWidth: 0,
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
