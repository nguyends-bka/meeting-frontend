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
import { LocalAudioTrack, RoomEvent, Track } from 'livekit-client';
import { useAuth } from '@/lib/auth';
import { apiService, meetingApi } from '@/services/api';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { startVirtualMicReceiver } from '@/lib/virtualMicReceiver';
import { startPhysicalMicWebSocket } from '@/lib/physicalMicWebSocket';
import TranscriptPanel from '@/components/TranscriptPanel';
import { TranscriptRoomProvider } from '@/components/TranscriptRoomProvider';
import MeetingChatHistoryHydrator from '@/components/MeetingChatHistoryHydrator';
import { VoteRoomProvider } from '@/components/VoteRoomProvider';
import VotePanel from '@/components/VotePanel';
import MeetingShellEnhancements from '@/components/MeetingShellEnhancements';
import MeetingDocumentsPanel from '@/components/MeetingDocumentsPanel';
import '@livekit/components-styles';
import { Button, Modal, Typography } from 'antd';

type AudioSourceMode = 'real' | 'virtual';
const { Text } = Typography;

function DisconnectButtonInterceptor({
  shellRef,
  enabled,
  onRequestDisconnect,
}: {
  shellRef: React.RefObject<HTMLDivElement | null>;
  enabled: boolean;
  onRequestDisconnect: () => void;
}) {
  const room = useRoomContext();

  useEffect(() => {
    if (!enabled) return;
    const shell = shellRef.current;
    if (!shell) return;

    const attach = () => {
      const btn = shell.querySelector('.lk-disconnect-button') as HTMLButtonElement | null;
      if (!btn) return null;

      const handler = (e: Event) => {
        // Nếu đã disconnected thì để mặc định.
        if (!room || room.state !== 'connected') return;
        e.preventDefault();
        e.stopPropagation();
        onRequestDisconnect();
      };

      btn.addEventListener('click', handler, true);
      return () => btn.removeEventListener('click', handler, true);
    };

    const detach = attach();
    if (detach) return detach;

    const obs = new MutationObserver(() => {
      const d = attach();
      if (d) {
        obs.disconnect();
      }
    });
    obs.observe(shell, { subtree: true, childList: true, attributes: true });
    return () => obs.disconnect();
  }, [enabled, onRequestDisconnect, room, shellRef]);

  return null;
}

function HostLeaveModal({
  open,
  loading,
  onCancel,
  onLeaveOnly,
  onEndForAll,
  onFinally,
  meetingId,
}: {
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onLeaveOnly: () => void;
  onEndForAll: () => void;
  onFinally: () => void;
  meetingId: string;
}) {
  const room = useRoomContext();

  const leaveOnly = async () => {
    if (!room) return;
    onLeaveOnly();
    try {
      room.disconnect();
    } finally {
      onFinally();
    }
  };

  const endForAll = async () => {
    if (!room) return;
    onEndForAll();
    try {
      await meetingApi.endMeeting(meetingId);
      room.disconnect();
    } finally {
      onFinally();
    }
  };

  return (
    <Modal open={open} onCancel={onCancel} footer={null} centered width={640} destroyOnHidden>
      <div style={{ padding: '8px 8px 0 8px' }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Kết thúc cuộc gọi hay chỉ rời khỏi cuộc gọi?
        </div>
        <Text type="secondary">
          Bạn có thể rời khỏi cuộc gọi này nếu không muốn kết thúc cuộc gọi này đối với tất cả mọi người
        </Text>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 18, flexWrap: 'wrap' }}>
          <Button type="link" disabled={loading} onClick={() => void leaveOnly()}>
            Chỉ rời khỏi cuộc gọi
          </Button>
          <Button type="link" disabled={loading} onClick={() => void endForAll()}>
            Kết thúc cuộc gọi này đối với tất cả mọi người
          </Button>
        </div>
      </div>
    </Modal>
  );
}

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

function PhysicalMicForwarder({
  enabled,
  wsUrl,
  preferredDeviceId,
  onError,
}: {
  enabled: boolean;
  wsUrl: string;
  preferredDeviceId?: string | null;
  onError: (message: string) => void;
}) {
  const room = useRoomContext();

  // lưu stop function của session hiện tại
  const stopSenderRef = useRef<(() => Promise<void>) | null>(null);

  // đảm bảo stop xong mới được start
  const lifecycleRef = useRef<Promise<void> | null>(null);

  const stopSender = useCallback(async () => {
    if (!stopSenderRef.current) return;

    const stopPromise = stopSenderRef.current();
    lifecycleRef.current = stopPromise;

    try {
      await stopPromise;
    } catch (error) {
      console.error('Failed to stop physical mic sender:', error);
    } finally {
      stopSenderRef.current = null;
      lifecycleRef.current = null;
    }
  }, []);

  const startSender = useCallback(async () => {
    if (!enabled) return;

    // nếu đang stop thì đợi stop xong
    if (lifecycleRef.current) {
      await lifecycleRef.current;
    }

    // nếu đã có sender đang chạy thì không start lại
    if (stopSenderRef.current) return;

    try {
      const session = await startPhysicalMicWebSocket(
        wsUrl,
        preferredDeviceId,
      );

      stopSenderRef.current = session.stop;
    } catch (error) {
      console.error('Physical mic forward failed:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Không thể gửi âm thanh mic thật qua websocket';
      onError(message);
    }
  }, [enabled, onError, preferredDeviceId, wsUrl]);

  useEffect(() => {
    let mounted = true;

    const syncWithMicState = async () => {
      const micPublication = Array.from(
        room.localParticipant.trackPublications.values(),
      ).find((pub) => pub.source === Track.Source.Microphone);

      const micActive = Boolean(micPublication?.track) && !micPublication?.isMuted;

      if (!enabled || !micActive) {
        await stopSender();
        return;
      }

      if (mounted) {
        await startSender();
      }
    };

    void syncWithMicState();

    const handleLocalTrackPublished = async () => {
      await syncWithMicState();
    };

    const handleLocalTrackUnpublished = async () => {
      await syncWithMicState();
    };

    const handleTrackMuted = async () => {
      await syncWithMicState();
    };

    const handleTrackUnmuted = async () => {
      await syncWithMicState();
    };

    room.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
    room.on(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
    room.on(RoomEvent.TrackMuted, handleTrackMuted);
    room.on(RoomEvent.TrackUnmuted, handleTrackUnmuted);

    return () => {
      mounted = false;
      room.off(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
      room.off(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
      room.off(RoomEvent.TrackMuted, handleTrackMuted);
      room.off(RoomEvent.TrackUnmuted, handleTrackUnmuted);
      void stopSender();
    };
  }, [enabled, room, startSender, stopSender]);

  useEffect(() => {
    if (!enabled) {
      void stopSender();
    }
  }, [enabled, stopSender]);

  return null;
}

export default function MeetingPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const meetingId = params.id as string;
  const transcriptDisplayName =user?.fullName || user?.username || 'Current user'

  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [meetingHostIdentity, setMeetingHostIdentity] = useState<string | null>(null);
  const [isPollManager, setIsPollManager] = useState(false);
  const [preJoinDone, setPreJoinDone] = useState(false);
  const [userChoices, setUserChoices] = useState<LocalUserChoices | null>(null);
  const [joining, setJoining] = useState(false);
  const [noCamera, setNoCamera] = useState(false);
  const [noMic, setNoMic] = useState(false);
  const [deviceErrorResetKey, setDeviceErrorResetKey] = useState(0);

  const [audioSource, setAudioSource] = useState<AudioSourceMode>('real');
  const [virtualMicWsUrl, setVirtualMicWsUrl] = useState('ws://127.0.0.1:9001/audio');
  const [physicalMicWsUrl] = useState('ws://127.0.0.1:9001/audioPhisical');
  const [transcriptWsUrl] = useState('ws://127.0.0.1:9001/transcript');
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [voteOpen, setVoteOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const meetingShellRef = useRef<HTMLDivElement>(null);
  const [hostLeaveModalOpen, setHostLeaveModalOpen] = useState(false);
  const [hostLeaveLoading, setHostLeaveLoading] = useState(false);

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
            audioEnabled: false,
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
        setMeetingHostIdentity(result.data.hostIdentity ?? null);
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

  const normalizedHostIdentity = meetingHostIdentity?.trim().toLowerCase() ?? '';
  const normalizedUserId = user?.id?.trim().toLowerCase() ?? '';
  const normalizedUsername = user?.username?.trim().toLowerCase() ?? '';
  useEffect(() => {
    if (!preJoinDone) return;
    const mid = currentMeetingId;
    const username = user?.username?.trim().toLowerCase();
    if (!mid || !username) {
      setIsPollManager(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await meetingApi.listPollManagers(mid);
      if (cancelled || res.error || !res.data) {
        setIsPollManager(false);
        return;
      }
      const found = res.data.some((x) => x.username.trim().toLowerCase() === username);
      setIsPollManager(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [preJoinDone, currentMeetingId, user?.username]);

  const canCreatePoll = Boolean(
    (normalizedHostIdentity &&
      (normalizedHostIdentity === normalizedUserId ||
        normalizedHostIdentity === normalizedUsername)) ||
      isPollManager,
  );

  const isHost = Boolean(
    normalizedHostIdentity &&
      (normalizedHostIdentity === normalizedUserId || normalizedHostIdentity === normalizedUsername),
  );

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
            {isHost && (
              <>
                <DisconnectButtonInterceptor
                  shellRef={meetingShellRef}
                  enabled={true}
                  onRequestDisconnect={() => setHostLeaveModalOpen(true)}
                />
                <HostLeaveModal
                  open={hostLeaveModalOpen}
                  loading={hostLeaveLoading}
                  meetingId={currentMeetingId ?? meetingId}
                  onCancel={() => setHostLeaveModalOpen(false)}
                  onLeaveOnly={() => {
                    setHostLeaveLoading(true);
                    setHostLeaveModalOpen(false);
                  }}
                  onEndForAll={() => {
                    setHostLeaveLoading(true);
                    setHostLeaveModalOpen(false);
                  }}
                  onFinally={() => setHostLeaveLoading(false)}
                />
              </>
            )}

            {audioSource === 'virtual' && (
              <VirtualMicPublisher
                enabled={true}
                wsUrl={virtualMicWsUrl}
                onError={(message) => setRoomError(message)}
              />
            )}

            {audioSource === 'real' && (
              <PhysicalMicForwarder
                enabled={true}
                wsUrl={physicalMicWsUrl}
                preferredDeviceId={userChoices?.audioDeviceId ?? null}
                onError={(message) => setRoomError(message)}
              />
            )}

            <TranscriptRoomProvider wsUrl={transcriptWsUrl} meetingId={currentMeetingId ?? meetingId}>
              <VoteRoomProvider meetingId={currentMeetingId ?? meetingId}>
                <div
                  ref={meetingShellRef}
                  className="meeting-room-shell"
                  data-meeting-layout="neither"
                >
                  <MeetingChatHistoryHydrator />
                  <MeetingShellEnhancements
                    shellRef={meetingShellRef}
                    transcriptOpen={transcriptOpen}
                    setTranscriptOpen={setTranscriptOpen}
                    voteOpen={voteOpen}
                    setVoteOpen={setVoteOpen}
                    documentsOpen={documentsOpen}
                    setDocumentsOpen={setDocumentsOpen}
                  />

                  {/** Documents side panel is rendered inside meeting-side-stack (no overlay) */}

                  <VideoConference />
                  <div className="meeting-side-stack">
                    <TranscriptPanel currentUserName={transcriptDisplayName} onClose={() => setTranscriptOpen(false)} />
                    <VotePanel canCreatePoll={canCreatePoll} />
                    <MeetingDocumentsPanel
                      documentsOpen={documentsOpen}
                      meetingId={currentMeetingId ?? meetingId}
                      canUpload={isHost}
                      onClose={() => setDocumentsOpen(false)}
                    />
                  </div>
                </div>
              </VoteRoomProvider>
            </TranscriptRoomProvider>
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
    maxWidth: '760px',
  },
  setupCard: {
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    border: '1px solid #e5e7eb',
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: '700',
    margin: '0 0 16px 0',
    color: '#111827',
  },
  formGroup: {
    marginBottom: '16px',
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '8px',
    color: '#374151',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    backgroundColor: '#fff',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    backgroundColor: '#fff',
  },
  hint: {
    marginTop: '6px',
    fontSize: '12px',
    color: '#6b7280',
  },
  deviceWarning: {
    padding: '14px 20px',
    backgroundColor: '#fff8e6',
    border: '1px solid #f0c674',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#7d5a00',
    textAlign: 'center',
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