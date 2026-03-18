'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  VideoConference,
  PreJoin,
  useRoomContext,
} from '@livekit/components-react';
import type { LocalUserChoices } from '@livekit/components-core';
import { LocalAudioTrack } from 'livekit-client';
import { useAuth } from '@/lib/auth';
import { apiService } from '@/services/api';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { startVirtualMicReceiver } from '@/lib/virtualMicReceiver';
import '@livekit/components-styles';

type AudioSourceMode = 'real' | 'virtual';

function VirtualMicPublisher({
  enabled,
  wsUrl,
  onError,
}: {
  enabled: boolean;
  wsUrl: string;
  onError: (message: string) => void;
}) {
  const room = useRoomContext();
  const publishedTrackRef = useRef<LocalAudioTrack | null>(null);
  const stopReceiverRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    let mounted = true;

    const publishVirtualMic = async () => {
      if (!enabled) return;
      if (!room) return;
      if (publishedTrackRef.current) return;

      try {
        const receiver = await startVirtualMicReceiver(wsUrl);
        if (!mounted) {
          await receiver.stop();
          return;
        }

        const localAudioTrack = new LocalAudioTrack(receiver.track);
        await room.localParticipant.publishTrack(localAudioTrack);

        publishedTrackRef.current = localAudioTrack;
        stopReceiverRef.current = receiver.stop;
      } catch (error) {
        console.error('Virtual mic publish failed:', error);
        const message =
          error instanceof Error ? error.message : 'Không thể khởi tạo micro ảo';
        onError(message);
      }
    };

    void publishVirtualMic();

    return () => {
      mounted = false;

      const cleanup = async () => {
        try {
          if (publishedTrackRef.current) {
            await room.localParticipant.unpublishTrack(publishedTrackRef.current);
            publishedTrackRef.current.stop();
            publishedTrackRef.current = null;
          }
        } catch (error) {
          console.error('Failed to unpublish virtual mic track:', error);
        }

        try {
          if (stopReceiverRef.current) {
            await stopReceiverRef.current();
            stopReceiverRef.current = null;
          }
        } catch (error) {
          console.error('Failed to stop virtual mic receiver:', error);
        }
      };

      void cleanup();
    };
  }, [enabled, room, wsUrl, onError]);

  return null;
}

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
  const [joining, setJoining] = useState(false);
  const [noCamera, setNoCamera] = useState(false);
  const [noMic, setNoMic] = useState(false);
  const [deviceErrorResetKey, setDeviceErrorResetKey] = useState(0);

  const [audioSource, setAudioSource] = useState<AudioSourceMode>('real');
  const [virtualMicWsUrl, setVirtualMicWsUrl] = useState('ws://127.0.0.1:9001/audio');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (preJoinDone) return;

    let hadVideo = true;
    let hadAudio = true;

    const interval = setInterval(async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideo = devices.some((d) => d.kind === 'videoinput');
        const hasAudio = devices.some((d) => d.kind === 'audioinput');

        const lostVideo = hadVideo && !hasVideo;
        const lostAudio = hadAudio && !hasAudio;

        hadVideo = hasVideo;
        hadAudio = hasAudio;

        if (lostVideo || lostAudio) {
          setNoCamera(!hasVideo);
          // nếu đang chọn mic ảo thì không cần cảnh báo mất mic thật
          setNoMic(audioSource === 'real' ? !hasAudio : false);
          setDeviceErrorResetKey((k) => k + 1);
        } else {
          if (hasVideo) setNoCamera(false);
          if (hasAudio || audioSource === 'virtual') setNoMic(false);
        }
      } catch {
        setDeviceErrorResetKey((k) => k + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [preJoinDone, audioSource]);

  useEffect(() => {
    if (audioSource === 'virtual') {
      setNoMic(false);
    }
  }, [audioSource]);

  const handlePreJoinSubmit = useCallback(
    async (choices: LocalUserChoices) => {
      if (!meetingId || joining) return;

      setJoining(true);
      setError(null);

      let normalizedChoices = choices;

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideo = devices.some((d) => d.kind === 'videoinput');
        const hasAudio = devices.some((d) => d.kind === 'audioinput');

        const shouldUseRealMic = audioSource === 'real';

        if (!hasVideo || (shouldUseRealMic && !hasAudio)) {
          normalizedChoices = {
            ...choices,
            videoEnabled: hasVideo ? choices.videoEnabled : false,
            audioEnabled: shouldUseRealMic ? (hasAudio ? choices.audioEnabled : false) : false,
          };
        }

        if (audioSource === 'virtual') {
          normalizedChoices = {
            ...normalizedChoices,
            audioEnabled: false, // mic thật phải tắt để tránh LiveKit tự lấy hardware mic
          };
        }
      } catch {
        normalizedChoices = {
          ...choices,
          videoEnabled: false,
          audioEnabled: false,
        };
      }

      const result = await apiService.joinMeetingByLink(meetingId);

      if (result.error) {
        setError(result.error);
        setJoining(false);
        return;
      }

      if (result.data) {
        setUserChoices(normalizedChoices);
        setToken(result.data.token);
        setUrl(result.data.liveKitUrl);
        setParticipantId(result.data.participantId);
        setCurrentMeetingId(result.data.meetingId);
        setPreJoinDone(true);
        setJoining(false);
      }
    },
    [meetingId, joining, audioSource],
  );

  const handleError = useCallback((error: Error) => {
    const msg = error?.message ?? '';
    const name = error?.name ?? '';
    const isDeviceLost =
      name === 'NotFoundError' ||
      name === 'NotReadableError' ||
      /requested device not found|device not found|client initiated disconnect|could not start video source|could not start audio source/i.test(
        msg,
      );

    if (isDeviceLost) {
      console.warn('LiveKit: thiết bị mất kết nối, tham gia trong trạng thái mic/camera tắt:', error);
      return;
    }

    console.error('LiveKit room error:', error);
    setRoomError(error.message || 'Có lỗi xảy ra trong meeting room');
  }, []);

  const handleDisconnected = useCallback(async () => {
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
          <button onClick={() => setError(null)} style={styles.backButton}>
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

  if (!preJoinDone) {
    const showMicWarning = audioSource === 'real' && noMic;

    return (
      <div style={styles.container}>
        <div style={styles.preJoinWrapper} className="prejoin-no-username">
          
          {/* Giao diện chọn thiết bị mới */}
          <div style={styles.setupCard}>
            <h2 style={styles.cardTitle}>Cài đặt thiết bị</h2>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Nguồn Microphone</label>
              <select
                value={audioSource}
                onChange={(e) => setAudioSource(e.target.value as AudioSourceMode)}
                style={styles.select}
              >
                <option value="real">Microphone mặc định của máy</option>
                <option value="virtual">Microphone ảo (WS 9001)</option>
              </select>
            </div>

            {audioSource === 'virtual' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Địa chỉ WebSocket</label>
                <input
                  value={virtualMicWsUrl}
                  onChange={(e) => setVirtualMicWsUrl(e.target.value)}
                  style={styles.input}
                  placeholder="ws://127.0.0.1:9001/audio"
                />
                <span style={styles.hint}>
                  LiveKit sẽ không lấy mic thật mà sử dụng âm thanh từ kết nối này.
                </span>
              </div>
            )}
            
            {(noCamera || showMicWarning) && (
              <div style={styles.deviceWarning}>
                {noCamera && showMicWarning && 'Không tìm thấy camera và microphone. Vui lòng kiểm tra lại thiết bị!'}
                {noCamera && !showMicWarning && 'Không tìm thấy camera. Vui lòng kiểm tra lại thiết bị!'}
                {!noCamera && showMicWarning && 'Không tìm thấy microphone. Vui lòng kiểm tra lại thiết bị!'}
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            {joining && (
              <div style={styles.joiningOverlay}>
                <div style={styles.spinner}></div>
                <p style={styles.loadingText}>Đang tham gia cuộc họp...</p>
              </div>
            )}

            <PreJoin
              key={`prejoin-${audioSource}-${noCamera}-${showMicWarning}-${deviceErrorResetKey}`}
              onValidate={() => true}
              onSubmit={(choices) => void handlePreJoinSubmit(choices)}
              onError={async (err) => {
                const msg = err?.message ?? '';
                const name = err?.name ?? '';
                const isDeviceRelated =
                  name === 'NotFoundError' ||
                  name === 'NotReadableError' ||
                  name === 'OverconstrainedError' ||
                  /requested device not found|device not found|not found|ended|disconnect|not readable|track/i.test(msg);

                if (isDeviceRelated) {
                  try {
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const hasVideo = devices.some((d) => d.kind === 'videoinput');
                    const hasAudio = devices.some((d) => d.kind === 'audioinput');
                    setNoCamera(!hasVideo);
                    setNoMic(audioSource === 'real' ? !hasAudio : false);
                    setDeviceErrorResetKey((k) => k + 1);
                  } catch {
                    setNoCamera(true);
                    setNoMic(audioSource === 'real');
                    setDeviceErrorResetKey((k) => k + 1);
                  }
                } else {
                  console.error('PreJoin error:', err);
                }
              }}
              joinLabel="Tham gia cuộc họp"
              micLabel="Microphone"
              camLabel="Camera"
              persistUserChoices={false}
              defaults={{
                username: user?.username || 'user',
                videoEnabled: false,
                audioEnabled: false, 
              }}
            />
          </div>
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

  const useHardwareAudio = audioSource === 'real';

  const audioOptions = useHardwareAudio
    ? userChoices
      ? userChoices.audioEnabled
        ? userChoices.audioDeviceId
          ? { deviceId: { ideal: userChoices.audioDeviceId } }
          : true
        : false
      : true
    : false;

  const videoOptions = userChoices
    ? userChoices.videoEnabled
      ? userChoices.videoDeviceId
        ? { deviceId: { ideal: userChoices.videoDeviceId } }
        : true
      : false
    : true;

  return (
    <ErrorBoundary>
      <div
        style={{
          height: '100vh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
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
            {audioSource === 'virtual' && (
              <VirtualMicPublisher
                enabled={true}
                wsUrl={virtualMicWsUrl}
                onError={(message) => setRoomError(message)}
              />
            )}
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
    backgroundColor: '#f3f4f6', 
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
    maxWidth: '560px',
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
    whiteSpace: 'pre-wrap',
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
    maxWidth: '600px', 
    padding: '0 20px',
  },
  setupCard: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
    marginBottom: '20px',
  },
  cardTitle: {
    margin: '0 0 20px 0',
    fontSize: '18px',
    fontWeight: 600,
    color: '#111827',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
    marginBottom: '8px',
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    backgroundColor: '#f9fafb',
    fontSize: '15px',
    color: '#111827',
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    backgroundColor: '#f9fafb',
    fontSize: '15px',
    color: '#111827',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  hint: {
    display: 'block',
    marginTop: '6px',
    fontSize: '13px',
    color: '#6b7280',
  },
  deviceWarning: {
    marginTop: '16px',
    padding: '12px 16px',
    backgroundColor: '#fef3c7',
    border: '1px solid #fde68a',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#92400e',
    textAlign: 'center',
  },
  joiningOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    zIndex: 10,
    borderRadius: '16px', 
  },
};