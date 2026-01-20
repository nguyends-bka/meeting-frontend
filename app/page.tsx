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
  const [isMobile, setIsMobile] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
      setShowCreateModal(false);
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
      setShowJoinModal(false);
      setMeetingId('');
      setJoinPasscode('');
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
        <h1 style={styles.logo}>BKMeeting</h1>
        <div style={styles.userInfo}>
          <span style={styles.username}>Xin chào, {user?.username}</span>
          <button onClick={logout} style={styles.logoutBtn}>
            Đăng xuất
          </button>
        </div>
      </header>

      <main style={styles.main}>
        {/* Action Buttons Section */}
        <div style={styles.actionSection}>
          <button
            onClick={() => setShowCreateModal(true)}
            style={styles.actionButtonPrimary}
          >
            <span style={styles.actionButtonIcon}>➕</span>
            <span style={styles.actionButtonText}>Tạo cuộc họp mới</span>
          </button>
          <button
            onClick={() => setShowJoinModal(true)}
            style={styles.actionButtonSecondary}
          >
            <span style={styles.actionButtonIcon}>🔗</span>
            <span style={styles.actionButtonText}>Tham gia cuộc họp</span>
          </button>
        </div>

        {/* Meetings Table Section */}
        <div style={styles.tableSection}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>Cuộc họp của tôi</h2>
              <span style={styles.meetingCount}>{meetings.length}</span>
            </div>
            
            {loadingMeetings ? (
              <div style={styles.loading}>
                <div style={styles.spinner}></div>
                <p>Đang tải...</p>
              </div>
            ) : meetings.length === 0 ? (
              <div style={styles.empty}>
                <div style={styles.emptyIcon}>📭</div>
                <p style={styles.emptyText}>Bạn chưa tạo cuộc họp nào.</p>
                <p style={styles.emptyHint}>
                  Nhấn nút "Tạo cuộc họp mới" ở trên để bắt đầu.
                </p>
              </div>
            ) : (
              <div style={styles.tableContainer}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={{...styles.tableHeader, textAlign: 'center', width: '80px'}}>STT</th>
                      <th style={styles.tableHeader}>Tên cuộc họp</th>
                      <th style={styles.tableHeader}>Ngày tạo</th>
                      <th style={styles.tableHeader}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meetings.map((meeting, index) => (
                      <>
                        <tr 
                          key={meeting.id} 
                          style={{
                            ...styles.tableRow,
                            ...(selectedMeeting === meeting.id ? styles.tableRowSelected : {}),
                            cursor: 'pointer',
                          }}
                          onClick={() => setSelectedMeeting(selectedMeeting === meeting.id ? null : meeting.id)}
                        >
                          <td style={{...styles.tableCell, textAlign: 'center', width: '80px'}}>
                            <strong>{index + 1}</strong>
                          </td>
                          <td style={styles.tableCell}>
                            <strong>{meeting.title}</strong>
                          </td>
                          <td style={styles.tableCell}>
                            {new Date(meeting.createdAt).toLocaleString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td style={styles.tableCell}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/meeting/${meeting.id}`);
                              }}
                              style={styles.tableJoinBtn}
                              title="Tham gia"
                            >
                              ▶️ Tham gia
                            </button>
                          </td>
                        </tr>
                        {selectedMeeting === meeting.id && (
                          <tr key={`${meeting.id}-detail`}>
                            <td colSpan={4} style={styles.detailCell}>
                              <div style={styles.meetingDetailCard}>
                                <div style={styles.detailHeader}>
                                  <h3 style={styles.detailTitle}>Chi tiết cuộc họp: {meeting.title}</h3>
                                  <button
                                    onClick={() => setSelectedMeeting(null)}
                                    style={styles.detailCloseBtn}
                                  >
                                    ×
                                  </button>
                                </div>
                                
                                <div style={styles.detailContent}>
                                  <div style={styles.detailRow}>
                                    <span style={styles.detailLabel}>Mã cuộc họp:</span>
                                    <div style={styles.detailValue}>
                                      <code style={styles.inlineCode}>{meeting.meetingCode}</code>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copyMeetingCode(meeting.meetingCode);
                                        }}
                                        style={styles.copyBtnSmall}
                                        title="Copy mã"
                                      >
                                        📋
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <div style={styles.detailRow}>
                                    <span style={styles.detailLabel}>Passcode:</span>
                                    <div style={styles.detailValue}>
                                      <code style={styles.inlineCode}>{meeting.passcode}</code>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copyMeetingCode(meeting.passcode);
                                        }}
                                        style={styles.copyBtnSmall}
                                        title="Copy passcode"
                                      >
                                        📋
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <div style={styles.detailRow}>
                                    <span style={styles.detailLabel}>Host:</span>
                                    <span style={styles.detailText}>{meeting.hostName}</span>
                                  </div>
                                  
                                  <div style={styles.detailRow}>
                                    <span style={styles.detailLabel}>Link chia sẻ:</span>
                                    <div style={styles.detailValue}>
                                      <input
                                        type="text"
                                        readOnly
                                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/meeting/${meeting.id}`}
                                        style={styles.linkInputSmall}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copyMeetingLink(meeting.id);
                                        }}
                                        style={styles.copyBtnSmall}
                                        title="Copy link"
                                      >
                                        📋
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                
                                <div style={styles.detailActions}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(`/history/${meeting.id}`);
                                    }}
                                    style={styles.detailActionBtn}
                                  >
                                    📊 Xem lịch sử
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Meeting Modal */}
      {showCreateModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Tạo cuộc họp mới</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                style={styles.modalCloseBtn}
              >
                ×
              </button>
            </div>
            
            {error && <div style={styles.error}>{error}</div>}

            {createdMeeting && (
              <div style={styles.successCard}>
                <div style={styles.successHeader}>
                  <span style={styles.successIcon}>✅</span>
                  <h3 style={styles.successTitle}>Cuộc họp đã được tạo!</h3>
                </div>
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
                      setShowCreateModal(false);
                      router.push(`/meeting/${createdMeeting.id}`);
                    }}
                    style={styles.joinNowBtn}
                  >
                    🚀 Tham gia ngay
                  </button>
                  <button
                    onClick={() => {
                      setCreatedMeeting(null);
                      setShowCreateModal(false);
                    }}
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
                  <label style={styles.label}>
                    <span style={styles.labelIcon}>📝</span>
                    Tiêu đề Meeting
                  </label>
                  <input
                    type="text"
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    placeholder="Nhập tiêu đề meeting"
                    style={styles.input}
                    onKeyPress={(e) => e.key === 'Enter' && createMeeting()}
                  />
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>
                    <span style={styles.labelIcon}>👤</span>
                    Tên Host <span style={{ color: '#999', fontSize: '12px', fontWeight: 'normal' }}>(tùy chọn)</span>
                  </label>
                  <input
                    type="text"
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    placeholder={`Mặc định: ${user?.username || 'Host'}`}
                    style={styles.input}
                    onKeyPress={(e) => e.key === 'Enter' && createMeeting()}
                  />
                </div>

                <div style={styles.modalActions}>
                  <button
                    onClick={createMeeting}
                    disabled={creating}
                    style={{
                      ...styles.button,
                      ...styles.primaryButton,
                      ...(creating ? styles.buttonDisabled : {}),
                    }}
                  >
                    {creating ? '⏳ Đang tạo...' : '➕ Tạo Meeting'}
                  </button>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    style={styles.cancelBtn}
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Join Meeting Modal */}
      {showJoinModal && (
        <div style={styles.modalOverlay} onClick={() => setShowJoinModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Tham gia cuộc họp</h2>
              <button
                onClick={() => setShowJoinModal(false)}
                style={styles.modalCloseBtn}
              >
                ×
              </button>
            </div>
            
            {error && <div style={styles.error}>{error}</div>}
            
            <div style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>
                  <span style={styles.labelIcon}>🔑</span>
                  Meeting ID hoặc Code
                </label>
                <input
                  type="text"
                  value={meetingId}
                  onChange={(e) => setMeetingId(e.target.value)}
                  placeholder="Nhập Meeting ID (UUID) hoặc Code (6 ký tự)"
                  style={styles.input}
                  onKeyPress={(e) => e.key === 'Enter' && joinMeeting()}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>
                  <span style={styles.labelIcon}>🔐</span>
                  Passcode
                </label>
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

              <div style={styles.modalActions}>
                <button
                  onClick={joinMeeting}
                  style={{
                    ...styles.button,
                    ...styles.secondaryButton,
                  }}
                >
                  ▶️ Tham Gia
                </button>
                <button
                  onClick={() => setShowJoinModal(false)}
                  style={styles.cancelBtn}
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
    maxWidth: '1400px',
    margin: '40px auto',
    padding: '0 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
  },
  actionSection: {
    display: 'flex',
    gap: '20px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  actionButtonPrimary: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 32px',
    background: 'linear-gradient(135deg, #0070f3 0%, #0051cc 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '18px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0, 112, 243, 0.3)',
    transition: 'all 0.2s',
    minWidth: '220px',
  },
  actionButtonSecondary: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 32px',
    background: 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '18px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(40, 167, 69, 0.3)',
    transition: 'all 0.2s',
    minWidth: '220px',
  },
  actionButtonIcon: {
    fontSize: '24px',
  },
  actionButtonText: {
    fontSize: '18px',
  },
  tableSection: {
    width: '100%',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '28px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    border: '1px solid #f0f0f0',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '2px solid #f5f5f5',
  },
  cardTitle: {
    margin: 0,
    fontSize: '22px',
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: '-0.5px',
  },
  cardIcon: {
    fontSize: '24px',
  },
  meetingCount: {
    backgroundColor: '#0070f3',
    color: 'white',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    minWidth: '28px',
    textAlign: 'center',
  },
  labelIcon: {
    marginRight: '6px',
    fontSize: '16px',
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
    padding: '14px 16px',
    border: '2px solid #e5e5e5',
    borderRadius: '8px',
    fontSize: '15px',
    outline: 'none',
    transition: 'all 0.2s',
    backgroundColor: '#fafafa',
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
    background: 'linear-gradient(135deg, #0070f3 0%, #0051cc 100%)',
    color: 'white',
    boxShadow: '0 4px 12px rgba(0, 112, 243, 0.3)',
  },
  secondaryButton: {
    background: 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)',
    color: 'white',
    boxShadow: '0 4px 12px rgba(40, 167, 69, 0.3)',
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
  spinner: {
    border: '3px solid #f3f3f3',
    borderTop: '3px solid #0070f3',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 16px',
  },
  loading: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#666',
  },
  empty: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px',
    opacity: 0.5,
  },
  emptyText: {
    fontSize: '16px',
    color: '#666',
    margin: '0 0 8px 0',
    fontWeight: '500',
  },
  emptyHint: {
    fontSize: '14px',
    color: '#999',
    margin: 0,
  },
  meetingsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  meetingItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '20px',
    backgroundColor: '#fafafa',
    borderRadius: '10px',
    border: '1px solid #e8e8e8',
    transition: 'all 0.2s',
    marginBottom: '12px',
  },
  meetingHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  meetingTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
  },
  meetingDate: {
    fontSize: '12px',
    color: '#999',
    backgroundColor: '#f0f0f0',
    padding: '4px 10px',
    borderRadius: '12px',
  },
  meetingMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '12px',
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #f0f0f0',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  metaLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#666',
    minWidth: '80px',
  },
  metaValue: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flex: 1,
  },
  metaText: {
    fontSize: '14px',
    color: '#333',
    fontWeight: '500',
  },
  joinBtn: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #0070f3 0%, #0051cc 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    boxShadow: '0 2px 8px rgba(0, 112, 243, 0.25)',
    flex: 1,
  },
  successCard: {
    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
    border: '2px solid #0070f3',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
  },
  successHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  },
  successIcon: {
    fontSize: '28px',
  },
  successTitle: {
    margin: 0,
    fontSize: '20px',
    color: '#0070f3',
    fontWeight: '700',
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
    flexDirection: 'row',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  copyLinkBtn: {
    padding: '10px 16px',
    backgroundColor: '#f8f9fa',
    color: '#495057',
    border: '1px solid #dee2e6',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s',
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
  historyBtn: {
    padding: '10px 16px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s',
    boxShadow: '0 2px 4px rgba(108, 117, 125, 0.2)',
  },
  tableContainer: {
    overflowX: 'auto',
    marginTop: '20px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
    backgroundColor: 'white',
  },
  tableHeaderRow: {
    backgroundColor: '#f8f9fa',
    borderBottom: '2px solid #dee2e6',
  },
  tableHeader: {
    padding: '16px',
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
  tableRowSelected: {
    backgroundColor: '#f0f9ff',
  },
  tableCell: {
    padding: '16px',
    color: '#333',
    verticalAlign: 'middle',
  },
  detailCell: {
    padding: '0',
    borderBottom: 'none',
  },
  codeCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  actionCell: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  tableActionBtn: {
    padding: '8px 12px',
    backgroundColor: '#f8f9fa',
    color: '#495057',
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'all 0.2s',
  },
  tableJoinBtn: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #0070f3 0%, #0051cc 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    boxShadow: '0 2px 8px rgba(0, 112, 243, 0.25)',
    whiteSpace: 'nowrap',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '30px',
    maxWidth: '500px',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '2px solid #f5f5f5',
  },
  modalTitle: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    fontSize: '32px',
    color: '#999',
    cursor: 'pointer',
    padding: 0,
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'all 0.2s',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
  },
  cancelBtn: {
    padding: '12px 24px',
    backgroundColor: '#f8f9fa',
    color: '#495057',
    border: '1px solid #dee2e6',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    flex: 1,
  },
  meetingDetailCard: {
    margin: '16px',
    padding: '24px',
    backgroundColor: '#f8f9fa',
    borderRadius: '12px',
    border: '2px solid #0070f3',
    boxShadow: '0 4px 12px rgba(0, 112, 243, 0.15)',
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '2px solid #dee2e6',
  },
  detailTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '700',
    color: '#1a1a1a',
  },
  detailCloseBtn: {
    background: 'none',
    border: 'none',
    fontSize: '28px',
    color: '#999',
    cursor: 'pointer',
    padding: 0,
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'all 0.2s',
  },
  detailContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '24px',
  },
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px',
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #e9ecef',
  },
  detailLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#666',
    minWidth: '120px',
  },
  detailValue: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
  },
  detailText: {
    fontSize: '14px',
    color: '#333',
    fontWeight: '500',
  },
  linkInputSmall: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '13px',
    backgroundColor: 'white',
  },
  copyBtnSmall: {
    padding: '8px 12px',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  detailActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  detailActionBtn: {
    padding: '12px 24px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  detailJoinBtn: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #0070f3 0%, #0051cc 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0, 112, 243, 0.25)',
    transition: 'all 0.2s',
  },
};
