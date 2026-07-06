'use client';

import React, { useEffect, useState } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import viVN from 'antd/locale/vi_VN';

/**
 * Bọc AntD ConfigProvider và chọn thuật toán sáng/tối theo class `.dark-theme`
 * trên <html>. Theme đổi runtime (không reload) nên phải theo dõi động:
 *  - MutationObserver quan sát class của <html>
 *  - lắng nghe event 'theme-changed' (do settings bắn ra)
 */
function readIsDark(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark-theme');
}

export default function ThemeConfigProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    const sync = () => setIsDark(readIsDark());
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    window.addEventListener('theme-changed', sync);

    return () => {
      observer.disconnect();
      window.removeEventListener('theme-changed', sync);
    };
  }, []);

  return (
    <ConfigProvider
      locale={viVN}
      wave={{ disabled: true }}
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#2563eb',
          borderRadius: 8,
          fontFamily:
            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
