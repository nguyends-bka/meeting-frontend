import '@livekit/components-styles';
import './globals.css';
import { AuthProvider } from '@/lib/auth';

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
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
