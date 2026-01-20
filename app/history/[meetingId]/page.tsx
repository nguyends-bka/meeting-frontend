'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { apiService } from '@/lib/api';
import Link from 'next/link';

export default function MeetingHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const meetingId = params.meetingId as string;

  const [meeting, setMeeting] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    if (isAuthenticated && meetingId) {
      loadHistory();
    }
  }, [meetingId, isAuthenticated, authLoading, router]);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiService.getMeetingHistory(meetingId);
      
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setHistory(result.data);
      }
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi tải lịch sử');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (duration: number | null | undefined) => {
    if (duration === null || duration === undefined) return 'Đang tham gia';
    const hours = Math.floor(duration / 60);
    const minutes = Math.round(duration % 60);
    
    if (hours > 0) {
      return `${hours} giờ ${minutes} phút`;
    }
    return `${minutes} phút`;
  };

  if (authLoading || loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Đang tải...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.logo}>BKMeeting</h1>
          <Link href="/" style={styles.backLink}>
            ← Quay lại trang chủ
          </Link>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Lịch sử tham gia cuộc họp</h2>
            <button
              onClick={loadHistory}
              style={styles.refreshBtn}
              title="Làm mới"
            >
              🔄 Làm mới
            </button>
          </div>

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          {history.length === 0 ? (
            <div style={styles.empty}>
              <p>Chưa có lịch sử tham gia nào cho cuộc họp này.</p>
            </div>
          ) : (
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    <th style={styles.tableHeader}>STT</th>
                    <th style={styles.tableHeader}>Tên người dùng</th>
                    <th style={styles.tableHeader}>Thời gian vào</th>
                    <th style={styles.tableHeader}>Thời gian ra</th>
                    <th style={styles.tableHeader}>Thời lượng</th>
                    <th style={styles.tableHeader}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry, index) => (
                    <tr key={entry.id} style={styles.tableRow}>
                      <td style={styles.tableCell}>{index + 1}</td>
                      <td style={styles.tableCell}>
                        <strong>{entry.username}</strong>
                      </td>
                      <td style={styles.tableCell}>
                        {new Date(entry.joinedAt).toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td style={styles.tableCell}>
                        {entry.leftAt
                          ? new Date(entry.leftAt).toLocaleString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                          : '-'}
                      </td>
                      <td style={styles.tableCell}>
                        {formatDuration(entry.duration)}
                      </td>
                      <td style={styles.tableCell}>
                        {entry.leftAt ? (
                          <span style={styles.statusBadgeCompleted}>Đã rời</span>
                        ) : (
                          <span style={styles.statusBadgeActive}>Đang tham gia</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={styles.summary}>
            <p>
              <strong>Tổng số lượt tham gia:</strong> {history.length}
            </p>
            <p>
              <strong>Đang tham gia:</strong>{' '}
              {history.filter((h) => !h.leftAt).length}
            </p>
            <p>
              <strong>Đã rời:</strong>{' '}
              {history.filter((h) => h.leftAt).length}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    padding: '20px 40px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#0070f3',
  },
  backLink: {
    padding: '8px 16px',
    backgroundColor: '#f0f0f0',
    color: '#333',
    textDecoration: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  },
  main: {
    maxWidth: '1200px',
    margin: '40px auto',
    padding: '0 20px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '30px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '600',
    color: '#333',
  },
  refreshBtn: {
    padding: '8px 16px',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  error: {
    padding: '12px',
    backgroundColor: '#fee',
    color: '#c33',
    borderRadius: '6px',
    marginBottom: '20px',
    fontSize: '14px',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#666',
    fontSize: '18px',
  },
  empty: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#999',
    fontSize: '16px',
  },
  tableContainer: {
    overflowX: 'auto',
    marginBottom: '20px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  },
  tableHeaderRow: {
    backgroundColor: '#f8f9fa',
    borderBottom: '2px solid #dee2e6',
  },
  tableHeader: {
    padding: '12px',
    textAlign: 'left',
    fontWeight: '600',
    color: '#495057',
    fontSize: '14px',
    borderBottom: '2px solid #dee2e6',
  },
  tableRow: {
    borderBottom: '1px solid #e9ecef',
    transition: 'background-color 0.2s',
  },
  tableCell: {
    padding: '12px',
    color: '#333',
    verticalAlign: 'middle',
  },
  statusBadgeActive: {
    display: 'inline-block',
    padding: '4px 12px',
    backgroundColor: '#28a745',
    color: 'white',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
  },
  statusBadgeCompleted: {
    display: 'inline-block',
    padding: '4px 12px',
    backgroundColor: '#6c757d',
    color: 'white',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
  },
  summary: {
    marginTop: '30px',
    padding: '20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
    border: '1px solid #dee2e6',
    display: 'flex',
    gap: '30px',
    flexWrap: 'wrap',
  },
};
