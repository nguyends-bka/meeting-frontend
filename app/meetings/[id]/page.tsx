'use client';

import React, { useEffect } from 'react';
import { Spin } from 'antd';
import { useParams, useRouter } from 'next/navigation';

export default function MeetingDetailPage() {
  const params = useParams<{ id?: string }>();
  const router = useRouter();

  useEffect(() => {
    const meetingId = typeof params?.id === 'string' ? params.id : '';
    if (!meetingId) {
      router.replace('/meetings');
      return;
    }
    router.replace(`/meetings?detailId=${encodeURIComponent(meetingId)}`);
  }, [params?.id, router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spin size="large" />
    </div>
  );
}
