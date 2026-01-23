'use client';

import { useEffect } from 'react';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Lắng nghe thay đổi system preference khi theme là 'auto'
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleThemeChange = () => {
      try {
        const stored = localStorage.getItem('meeting_app_settings');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.theme === 'auto') {
            const prefersDark = mediaQuery.matches;
            const actualTheme = prefersDark ? 'dark' : 'light';
            applyTheme(actualTheme);
          }
        }
      } catch (e) {
        console.error('Error handling theme change:', e);
      }
    };

    mediaQuery.addEventListener('change', handleThemeChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange);
    };
  }, []);

  return <>{children}</>;
}

function applyTheme(actualTheme: string) {
  const html = document.documentElement;
  const body = document.body;
  
  // Xóa tất cả các class theme cũ
  html.classList.remove('light-theme', 'dark-theme', 'auto-theme');
  body.classList.remove('light-theme', 'dark-theme', 'auto-theme');
  
  // Áp dụng theme
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
}
