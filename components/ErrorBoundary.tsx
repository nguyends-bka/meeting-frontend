'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // Lỗi LiveKit khi rời phòng (camera bật): placeholder không còn trong mảng → chuyển về trang chủ
    const msg = error?.message ?? '';
    if (msg.includes('Element not part of the array') || msg.includes('updatePages')) {
      window.location.href = '/';
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            padding: '20px',
            backgroundColor: '#f5f5f5',
          }}>
            <h2 style={{ color: '#c33', marginBottom: '15px' }}>
              Đã xảy ra lỗi
            </h2>
            <p style={{ color: '#666', marginBottom: '20px', textAlign: 'center' }}>
              {this.state.error?.message || 'Có lỗi không mong muốn xảy ra'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
                window.location.reload();
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Tải lại trang
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
