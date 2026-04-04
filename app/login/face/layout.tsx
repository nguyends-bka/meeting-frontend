import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Xác thực khuôn mặt — BKMeeting',
};

export default function FaceLoginLayout({ children }: { children: ReactNode }) {
  return children;
}
