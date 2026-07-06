import '@livekit/components-styles';
import 'antd/dist/reset.css';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { App as AntdApp } from 'antd';
import ThemeProvider from '@/components/ThemeProvider';
import ThemeConfigProvider from '@/components/ThemeConfigProvider';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';

dayjs.locale('vi');

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const stored = localStorage.getItem('meeting_app_settings');
                  let theme = 'light';
                  if (stored) {
                    const parsed = JSON.parse(stored);
                    theme = parsed.theme || 'light';
                  }
                  
                  let actualTheme = theme;
                  if (theme === 'auto') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    actualTheme = prefersDark ? 'dark' : 'light';
                  }
                  
                  const html = document.documentElement;
                  const body = document.body;
                  if (!html) return;
                  if (body) {
                    if (actualTheme === 'dark') {
                      html.classList.add('dark-theme');
                      html.setAttribute('data-theme', 'dark');
                      body.classList.add('dark-theme');
                      body.style.backgroundColor = '#141414';
                      body.style.color = '#fff';
                    } else {
                      html.classList.add('light-theme');
                      html.setAttribute('data-theme', 'light');
                      body.classList.add('light-theme');
                      body.style.backgroundColor = '#f5f5f5';
                      body.style.color = '#000';
                    }
                  } else {
                    if (actualTheme === 'dark') {
                      html.classList.add('dark-theme');
                      html.setAttribute('data-theme', 'dark');
                    } else {
                      html.classList.add('light-theme');
                      html.setAttribute('data-theme', 'light');
                    }
                  }
                } catch (e) {
                  console.error('Error applying theme:', e);
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        <ThemeConfigProvider>
          <AntdApp>
            <ThemeProvider>
              <AuthProvider>{children}</AuthProvider>
            </ThemeProvider>
          </AntdApp>
        </ThemeConfigProvider>
      </body>
    </html>
  );
}
