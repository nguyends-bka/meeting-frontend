import '@livekit/components-styles';
import 'antd/dist/reset.css';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { App as AntdApp, ConfigProvider } from 'antd';
import ThemeProvider from '@/components/ThemeProvider';

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
        <ConfigProvider wave={{ disabled: true }}>
        <AntdApp>
          <ThemeProvider>
            <AuthProvider>{children}</AuthProvider>
          </ThemeProvider>
        </AntdApp>
        </ConfigProvider>
      </body>
    </html>
  );
}
