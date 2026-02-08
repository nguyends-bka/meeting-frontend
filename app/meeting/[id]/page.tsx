'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LiveKitRoom, VideoConference, PreJoin } from '@livekit/components-react';
import type { LocalUserChoices } from '@livekit/components-core';
import { useAuth } from '@/lib/auth';
import { apiService } from '@/services/api';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import '@livekit/components-styles';

export default function MeetingPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const meetingId = params.id as string;

  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [preJoinDone, setPreJoinDone] = useState(false);
  const [userChoices, setUserChoices] = useState<LocalUserChoices | null>(null);
  const [joining, setJoining] = useState(false); // Đang gọi API sau khi ấn Tham gia cuộc họp

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
  }, [authLoading, isAuthenticated, router]);

  const handlePreJoinSubmit = useCallback(
    async (choices: LocalUserChoices) => {
      if (!meetingId || joining) return;
      setJoining(true);
      setError(null);

      const result = await apiService.joinMeetingByLink(meetingId);

      if (result.error) {
        setError(result.error);
        setJoining(false);
        return;
      }

      if (result.data) {
        setUserChoices(choices);
        setToken(result.data.token);
        setUrl(result.data.liveKitUrl);
        setParticipantId(result.data.participantId);
        setCurrentMeetingId(result.data.meetingId);
        setPreJoinDone(true);
        setJoining(false);
      }
    },
    [meetingId, joining],
  );

  const handleError = useCallback((error: Error) => {
    console.error('LiveKit room error:', error);
    setRoomError(error.message || 'Có lỗi xảy ra trong meeting room');
  }, []);

  const handleDisconnected = useCallback(async () => {
    // Ghi lại lịch sử rời meeting
    // Gửi cả ParticipantId và MeetingId để backend có thể cập nhật tất cả active sessions
    if (participantId && currentMeetingId) {
      try {
        await apiService.leaveMeeting(participantId, currentMeetingId);
      } catch (error) {
        console.error('Failed to record leave:', error);
      }
    }
    router.push('/');
  }, [router, participantId, currentMeetingId]);

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Đang tải...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <h2 style={styles.errorTitle}>Lỗi kết nối</h2>
          <p style={styles.errorMessage}>{error}</p>
          <button
            onClick={() => setError(null)}
            style={styles.backButton}
          >
            Thử lại
          </button>
          <button
            onClick={() => router.push('/')}
            style={{ ...styles.backButton, marginLeft: '10px', backgroundColor: '#666' }}
          >
            Quay lại trang chủ
          </button>
        </div>
      </div>
    );
  }

  // Màn hình chọn thiết bị (Microphone, Camera) - chỉ khi ấn "Tham gia cuộc họp" mới gọi API join
  if (!preJoinDone) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.preJoinWrapper, position: 'relative' }} className="prejoin-no-username">
          {joining && (
            <div style={styles.joiningOverlay}>
              <div style={styles.spinner}></div>
              <p style={styles.loadingText}>Đang tham gia cuộc họp...</p>
            </div>
          )}
          <PreJoin
            onValidate={() => true}
            onSubmit={(choices) => void handlePreJoinSubmit(choices)}
            onError={(err) => console.error('PreJoin error:', err)}
            joinLabel="Tham gia cuộc họp"
            micLabel="Microphone"
            camLabel="Camera"
            persistUserChoices={true}
            defaults={{ username: user?.username || 'user' }}
          />
        </div>
      </div>
    );
  }

  if (!token || !url) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Đang chuẩn bị phòng họp...</p>
        </div>
      </div>
    );
  }

  if (roomError) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <h2 style={styles.errorTitle}>Lỗi Meeting Room</h2>
          <p style={styles.errorMessage}>{roomError}</p>
          <button
            onClick={() => {
              setRoomError(null);
              window.location.reload();
            }}
            style={styles.backButton}
          >
            Thử lại
          </button>
          <button
            onClick={() => router.push('/')}
            style={{ ...styles.backButton, marginLeft: '10px', backgroundColor: '#666' }}
          >
            Quay lại trang chủ
          </button>
        </div>
      </div>
    );
  }

  // Use 'ideal' instead of 'exact' for deviceId so deployed env (different device/browser)
  // can fall back to any available camera/mic and avoid OverconstrainedError.
  const audioOptions = userChoices
    ? userChoices.audioEnabled
      ? (userChoices.audioDeviceId ? { deviceId: { ideal: userChoices.audioDeviceId } } : true)
      : false
    : true;
  const videoOptions = userChoices
    ? userChoices.videoEnabled
      ? (userChoices.videoDeviceId ? { deviceId: { ideal: userChoices.videoDeviceId } } : true)
      : false
    : true;

  // Note: LiveKit may show internal warnings about camera placeholders
  // These are typically non-critical and don't affect functionality
  return (
    <ErrorBoundary>
      <div style={{
        height: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
    <div
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      data-lk-theme="default"
    >
    <LiveKitRoom
      token={token}
      serverUrl={url}
          connect={true}
          audio={audioOptions}
          video={videoOptions}
          options={{
            adaptiveStream: true,
            dynacast: true,
          }}
          onError={handleError}
          onDisconnected={handleDisconnected}
    >
      <VideoConference />
    </LiveKitRoom>
    </div>
      </div>
    </ErrorBoundary>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    textAlign: 'center',
  },
  spinner: {
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #0070f3',
    borderRadius: '50%',
    width: '50px',
    height: '50px',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 20px',
  },
  loadingText: {
    fontSize: '16px',
    color: '#666',
    margin: 0,
  },
  loading: {
    fontSize: '18px',
    color: '#666',
  },
  errorContainer: {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    textAlign: 'center',
    maxWidth: '500px',
  },
  errorTitle: {
    margin: '0 0 15px 0',
    fontSize: '24px',
    color: '#c33',
  },
  errorMessage: {
    margin: '0 0 25px 0',
    fontSize: '16px',
    color: '#666',
  },
  backButton: {
    padding: '12px 24px',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  preJoinWrapper: {
    width: '100%',
    maxWidth: '640px',
  },
  joiningOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    zIndex: 10,
    borderRadius: '8px',
  },
};
