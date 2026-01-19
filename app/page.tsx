'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { apiService } from '@/lib/api';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [meetingId, setMeetingId] = useState('');
  const [joinPasscode, setJoinPasscode] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [hostName, setHostName] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState<{code: string; id: string; passcode: string} | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadMeetings();
      // Tự động điền HostName từ username
      if (user?.username && !hostName) {
        setHostName(user.username);
      }
    }
  }, [isAuthenticated, user]);

  const loadMeetings = async () => {
    setLoadingMeetings(true);
    const result = await apiService.getMeetings();
    if (result.data) {
      setMeetings(result.data);
    }
    setLoadingMeetings(false);
  };

  const createMeeting = async () => {
    if (!meetingTitle.trim()) {
      setError('Vui lòng nhập tiêu đề meeting');
      return;
    }
    
    // Sử dụng username làm HostName nếu không nhập
    const finalHostName = hostName.trim() || user?.username || 'Host';

    setError('');
    setCreating(true);

    const result = await apiService.createMeeting(meetingTitle, finalHostName);

    if (result.error) {
      setError(result.error);
      setCreating(false);
      return;
    }

    if (result.data) {
      // Lưu thông tin meeting vừa tạo để hiển thị code/link
      setCreatedMeeting({
        code: result.data.meetingCode,
        id: result.data.meetingId,
        passcode: result.data.passcode
      });
      // Reload danh sách meetings sau khi tạo thành công
      await loadMeetings();
      // Reset form
      setMeetingTitle('');
      setCreating(false);
      // Không redirect ngay, để user có thể copy link/code
    }
  };

  const copyMeetingLink = (meetingIdOrCode: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${baseUrl}/meeting/${meetingIdOrCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyMeetingCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const joinMeeting = async () => {
    if (!meetingId.trim()) {
      setError('Vui lòng nhập Meeting ID hoặc Code');
      return;
    }
    if (!joinPasscode.trim()) {
      setError('Vui lòng nhập passcode');
      return;
    }

    setError('');
    
    // Kiểm tra xem là UUID hay MeetingCode (6 ký tự)
    const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(meetingId.trim());
    
    let result;
    if (isGuid) {
      // Nếu là UUID, gửi MeetingId
      result = await apiService.joinMeeting(meetingId.trim(), joinPasscode.trim());
    } else {
      // Nếu là Code (6 ký tự), gửi MeetingCode
      result = await apiService.joinMeetingByCode(meetingId.trim().toUpperCase(), joinPasscode.trim());
    }

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.data) {
      router.push(`/meeting/${result.data.meetingId}`);
    }
  };

  if (loading) {
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
        <h1 style={styles.logo}>Meeting App</h1>
        <div style={styles.userInfo}>
          <span style={styles.username}>Xin chào, {user?.username}</span>
          <button onClick={logout} style={styles.logoutBtn}>
            Đăng xuất
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Tạo Meeting Mới</h2>
          
          {error && <div style={styles.error}>{error}</div>}

          {createdMeeting && (
            <div style={styles.successCard}>
              <h3 style={styles.successTitle}>✅ Cuộc họp đã được tạo!</h3>
              <div style={styles.codeSection}>
                <div style={styles.codeRow}>
                  <span style={styles.codeLabel}>Mã cuộc họp:</span>
                  <div style={styles.codeDisplay}>
                    <code style={styles.code}>{createdMeeting.code}</code>
                    <button
                      onClick={() => copyMeetingCode(createdMeeting.code)}
                      style={styles.copyBtn}
                      title="Copy mã"
                    >
                      {copied ? '✓' : '📋'}
                    </button>
                  </div>
                </div>
                <div style={styles.codeRow}>
                  <span style={styles.codeLabel}>Passcode:</span>
                  <div style={styles.codeDisplay}>
                    <code style={styles.code}>{createdMeeting.passcode}</code>
                    <button
                      onClick={() => copyMeetingCode(createdMeeting.passcode)}
                      style={styles.copyBtn}
                      title="Copy passcode"
                    >
                      {copied ? '✓' : '📋'}
                    </button>
                  </div>
                </div>
                <div style={styles.codeRow}>
                  <span style={styles.codeLabel}>Link chia sẻ:</span>
                  <div style={styles.codeDisplay}>
                    <input
                      type="text"
                      readOnly
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/meeting/${createdMeeting.id}`}
                      style={styles.linkInput}
                    />
                    <button
                      onClick={() => copyMeetingLink(createdMeeting.id)}
                      style={styles.copyBtn}
                      title="Copy link"
                    >
                      {copied ? '✓' : '📋'}
                    </button>
                  </div>
                </div>
              </div>
              <div style={styles.actionButtons}>
                <button
                  onClick={() => {
                    setCreatedMeeting(null);
                    router.push(`/meeting/${createdMeeting.id}`);
                  }}
                  style={styles.joinNowBtn}
                >
                  Tham gia ngay
                </button>
                <button
                  onClick={() => setCreatedMeeting(null)}
                  style={styles.closeBtn}
                >
                  Đóng
                </button>
              </div>
            </div>
          )}

          {!createdMeeting && (
            <div style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Tiêu đề Meeting</label>
                <input
                  type="text"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="Nhập tiêu đề meeting"
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>
                  Tên Host <span style={{ color: '#999', fontSize: '12px', fontWeight: 'normal' }}>(tùy chọn)</span>
                </label>
                <input
                  type="text"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder={`Mặc định: ${user?.username || 'Host'}`}
                  style={styles.input}
                />
              </div>

              <button
                onClick={createMeeting}
                disabled={creating}
                style={{
                  ...styles.button,
                  ...styles.primaryButton,
                  ...(creating ? styles.buttonDisabled : {}),
                }}
              >
                {creating ? 'Đang tạo...' : 'Tạo Meeting'}
              </button>
            </div>
          )}
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Tham Gia Meeting</h2>
          
          <div style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Meeting ID</label>
              <input
                type="text"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                placeholder="Nhập Meeting ID (UUID)"
                style={styles.input}
                onKeyPress={(e) => e.key === 'Enter' && joinMeeting()}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Passcode</label>
              <input
                type="text"
                value={joinPasscode}
                onChange={(e) => setJoinPasscode(e.target.value)}
                placeholder="Nhập passcode (6 chữ số)"
                style={styles.input}
                onKeyPress={(e) => e.key === 'Enter' && joinMeeting()}
                maxLength={6}
              />
            </div>

            <button
              onClick={joinMeeting}
              style={{
                ...styles.button,
                ...styles.secondaryButton,
              }}
            >
              Tham Gia
            </button>
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Cuộc họp của tôi</h2>
          
          {loadingMeetings ? (
            <div style={styles.loading}>Đang tải...</div>
          ) : meetings.length === 0 ? (
            <div style={styles.empty}>
              <p>Bạn chưa tạo cuộc họp nào.</p>
              <p style={{ fontSize: '14px', color: '#999', marginTop: '10px' }}>
                Tạo cuộc họp mới ở trên để bắt đầu.
              </p>
            </div>
          ) : (
            <div style={styles.meetingsList}>
              {meetings.map((meeting) => (
                <div key={meeting.id} style={styles.meetingItem}>
                  <div style={styles.meetingInfo}>
                    <h3 style={styles.meetingTitle}>{meeting.title}</h3>
                    <div style={styles.meetingMeta}>
                      <p style={{ margin: '4px 0' }}>
                        <strong>Mã:</strong> <code style={styles.inlineCode}>{meeting.meetingCode}</code>
                        <button
                          onClick={() => copyMeetingCode(meeting.meetingCode)}
                          style={styles.smallCopyBtn}
                          title="Copy mã"
                        >
                          📋
                        </button>
                      </p>
                      <p style={{ margin: '4px 0' }}>
                        <strong>Passcode:</strong> <code style={styles.inlineCode}>{meeting.passcode}</code>
                        <button
                          onClick={() => copyMeetingCode(meeting.passcode)}
                          style={styles.smallCopyBtn}
                          title="Copy passcode"
                        >
                          📋
                        </button>
                      </p>
                      <p style={{ margin: '4px 0', fontSize: '13px', color: '#666' }}>
                        Host: {meeting.hostName} •{' '}
                        {new Date(meeting.createdAt).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  </div>
                  <div style={styles.meetingActions}>
                    <button
                      onClick={() => copyMeetingLink(meeting.id)}
                      style={styles.copyLinkBtn}
                      title="Copy link"
                    >
                      {copied ? '✓ Đã copy' : '🔗 Copy link'}
                    </button>
                    <button
                      onClick={() => router.push(`/meeting/${meeting.id}`)}
                      style={styles.joinBtn}
                    >
                      Tham Gia
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
  },
  username: {
    fontSize: '14px',
    color: '#666',
  },
  logoutBtn: {
    padding: '8px 16px',
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  main: {
    maxWidth: '1200px',
    margin: '40px auto',
    padding: '0 20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '20px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '30px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  cardTitle: {
    margin: '0 0 20px 0',
    fontSize: '20px',
    fontWeight: '600',
    color: '#333',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#555',
  },
  input: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  button: {
    padding: '12px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  primaryButton: {
    backgroundColor: '#0070f3',
    color: 'white',
  },
  secondaryButton: {
    backgroundColor: '#28a745',
    color: 'white',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
  error: {
    padding: '12px',
    backgroundColor: '#fee',
    color: '#c33',
    borderRadius: '6px',
    marginBottom: '15px',
    fontSize: '14px',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#666',
  },
  empty: {
    textAlign: 'center',
    padding: '40px',
    color: '#999',
  },
  meetingsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  meetingItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px',
    backgroundColor: '#f9f9f9',
    borderRadius: '6px',
    border: '1px solid #eee',
  },
  meetingInfo: {
    flex: 1,
  },
  meetingTitle: {
    margin: '0 0 5px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#333',
  },
  meetingMeta: {
    margin: 0,
    fontSize: '14px',
    color: '#666',
  },
  joinBtn: {
    padding: '8px 16px',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  successCard: {
    backgroundColor: '#f0f9ff',
    border: '2px solid #0070f3',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
  },
  successTitle: {
    margin: '0 0 15px 0',
    fontSize: '18px',
    color: '#0070f3',
    fontWeight: '600',
  },
  codeSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    marginBottom: '20px',
  },
  codeRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  codeLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#555',
  },
  codeDisplay: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  code: {
    flex: 1,
    padding: '10px',
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '18px',
    fontWeight: 'bold',
    letterSpacing: '2px',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  linkInput: {
    flex: 1,
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: 'white',
  },
  copyBtn: {
    padding: '10px 15px',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    minWidth: '50px',
  },
  actionButtons: {
    display: 'flex',
    gap: '10px',
  },
  joinNowBtn: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  closeBtn: {
    padding: '12px 20px',
    backgroundColor: '#666',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  divider: {
    textAlign: 'center',
    margin: '15px 0',
    position: 'relative',
    color: '#999',
    fontSize: '14px',
  },
  hint: {
    fontSize: '12px',
    color: '#999',
    marginTop: '4px',
  },
  meetingActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'flex-end',
  },
  copyLinkBtn: {
    padding: '6px 12px',
    backgroundColor: '#f0f0f0',
    color: '#333',
    border: '1px solid #ddd',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    whiteSpace: 'nowrap',
  },
  smallCopyBtn: {
    padding: '2px 6px',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    marginLeft: '8px',
  },
  inlineCode: {
    backgroundColor: '#f5f5f5',
    padding: '2px 6px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#0070f3',
  },
};
