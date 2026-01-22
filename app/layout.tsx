import '@livekit/components-styles';
import 'antd/dist/reset.css';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { App as AntdApp } from 'antd';

export const metadata = {
  title: 'BKMeeting',
  description: 'Hệ thống họp trực tuyến BKMeeting',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AntdApp>
          <AuthProvider>{children}</AuthProvider>
        </AntdApp>
      </body>
    </html>
  );
}
