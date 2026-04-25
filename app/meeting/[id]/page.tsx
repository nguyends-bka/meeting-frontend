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
import { startQueryConnection, stopQueryConnection } from '@/lib/realtime/queryWebSocket';
import { TranscriptRoomProvider, useTranscriptRoom } from '@/components/meeting/TranscriptRoomProvider';
import MeetingChatHistoryHydrator from '@/components/meeting/MeetingChatHistoryHydrator';
import { VoteRoomProvider } from '@/components/meeting/VoteRoomProvider';
import MeetingShellEnhancements from '@/components/meeting/MeetingShellEnhancements';
import MeetingUnifiedSidePanel from '@/components/meeting/MeetingUnifiedSidePanel';
import type { MeetingToolsTab } from '@/components/meeting/MeetingUnifiedSidePanel';
import type { MeetingRecordingDto } from '@/dtos/meeting.dto';
import '@livekit/components-styles';
import { App, Button, Modal, Typography } from 'antd';

type AudioSourceMode = 'real' | 'virtual';
const { Text } = Typography;

function normalizeLiveKitServerUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return trimmed;

  const stripRtcPath = (path: string) => {
    let normalized = path.replace(/\/+$/, '');
    normalized = normalized.replace(/\/rtc\/v1$/i, '');
    normalized = normalized.replace(/\/rtc$/i, '');
    return normalized || '/';
  };

  try {
    const parsed = new URL(trimmed);
    parsed.pathname = stripRtcPath(parsed.pathname);
    const next = parsed.toString().replace(/\/+$/, '');
    return next;
  } catch {
    return trimmed
      .replace(/\/+$/, '')
      .replace(/\/rtc\/v1$/i, '')
      .replace(/\/rtc$/i, '');
  }
}

function formatRecordingDuration(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

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
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

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
        onErrorRef.current(message);
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
  }, [enabled, room, wsUrl]);

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
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

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
      onErrorRef.current(message);
    }
  }, [enabled, preferredDeviceId, wsUrl]);

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

function LatestTranscriptStrip() {
  const { finalized, draftText } = useTranscriptRoom();
  const [transcriptEnabled, setTranscriptEnabled] = useState(true);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTranscriptAtRef = useRef<number>(0);
  const lastFinal = finalized.length > 0 ? finalized[finalized.length - 1] : null;
  const latest = (draftText && draftText.trim()) || lastFinal?.text || '';
  const latestTail = latest;
  const speaker = lastFinal?.speaker?.trim() || '';

  useEffect(() => {
    if (!lastFinal?.receivedAt) return;
    const ts = new Date(lastFinal.receivedAt).getTime();
    latestTranscriptAtRef.current = Number.isFinite(ts) ? ts : Date.now();
  }, [lastFinal?.receivedAt]);

  useEffect(() => {
    if (draftText?.trim()) {
      latestTranscriptAtRef.current = Date.now();
    }
  }, [draftText]);

  useEffect(() => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }

    if (!transcriptEnabled || !latestTail) {
      setOverlayVisible(false);
      return;
    }

    const now = Date.now();
    const ageMs = latestTranscriptAtRef.current ? now - latestTranscriptAtRef.current : 0;
    const remainingMs = Math.max(0, 10000 - ageMs);

    setOverlayVisible(remainingMs > 0);
    if (remainingMs > 0) {
      autoHideTimerRef.current = setTimeout(() => {
        setOverlayVisible(false);
        autoHideTimerRef.current = null;
      }, remainingMs);
    }

    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
    };
  }, [latestTail, lastFinal?.receivedAt, draftText, transcriptEnabled]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    const syncToBottom = () => {
      el.scrollTop = el.scrollHeight;
    };

    syncToBottom();
    const raf = window.requestAnimationFrame(syncToBottom);
    const ro = new ResizeObserver(syncToBottom);
    ro.observe(el);

    return () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [latestTail, speaker]);

  useEffect(() => {
    const onHide = () => {
      setTranscriptEnabled(false);
      setOverlayVisible(false);
    };
    window.addEventListener('bkmt-hide-latest-transcript', onHide);
    return () => {
      window.removeEventListener('bkmt-hide-latest-transcript', onHide);
    };
  }, []);

  useEffect(() => {
    const onToggle = () => setTranscriptEnabled((prev) => !prev);
    window.addEventListener('bkmt-toggle-latest-transcript', onToggle);
    return () => {
      window.removeEventListener('bkmt-toggle-latest-transcript', onToggle);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('bkmt-latest-transcript-state', {
        detail: {
          enabled: transcriptEnabled,
          hasContent: Boolean(latestTail),
        },
      }),
    );
  }, [transcriptEnabled, latestTail]);

  if (!transcriptEnabled || !overlayVisible || !latestTail) {
    return null;
  }
  return (
    <div className="meeting-latest-transcript-strip">
      <div className="meeting-latest-transcript-content">
        {speaker ? <span className="meeting-latest-transcript-speaker">{speaker}:</span> : null}
        <div ref={bodyRef} className="meeting-latest-transcript-body">
          {latestTail}
        </div>
      </div>
    </div>
  );
}

export default function MeetingPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { message } = App.useApp();
  const meetingId = params.id as string;
  const transcriptDisplayName =user?.fullName || user?.username || 'Current user'

  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [meetingTitle, setMeetingTitle] = useState<string>('Cuộc họp');
  const [meetingHostIdentity, setMeetingHostIdentity] = useState<string | null>(null);
  const [isMeetingHostJoin, setIsMeetingHostJoin] = useState(false);
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
  const [meetingChatOpen, setMeetingChatOpen] = useState(false);
  const [meetingChatUnread, setMeetingChatUnread] = useState(0);
  const [activeToolsTab, setActiveToolsTab] = useState<MeetingToolsTab>('chat');

  const toolsSideOpen = transcriptOpen || voteOpen || documentsOpen || meetingChatOpen;
  const meetingShellRef = useRef<HTMLDivElement>(null);
  const [hostLeaveModalOpen, setHostLeaveModalOpen] = useState(false);
  const [hostLeaveLoading, setHostLeaveLoading] = useState(false);
  const [recordings, setRecordings] = useState<MeetingRecordingDto[]>([]);
  const [recordingActionLoading, setRecordingActionLoading] = useState(false);
  const [recordingNowMs, setRecordingNowMs] = useState<number>(() => Date.now());

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
        setUrl(normalizeLiveKitServerUrl(result.data.liveKitUrl));
        setParticipantId(result.data.participantId);
        setCurrentMeetingId(result.data.meetingId);
        setMeetingTitle(result.data.title?.trim() || 'Cuộc họp');
        setMeetingHostIdentity(result.data.hostIdentity ?? null);
        setIsMeetingHostJoin(Boolean(result.data.isMeetingHost));
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

    const isTransientSignalIssue =
      /could not establish signal connection|websocket error during connection establishment|failed to fetch/i.test(
        msg,
      );

    if (isTransientSignalIssue) {
      // LiveKit may emit transient signal errors during reconnect. Avoid switching to a fatal error screen.
      console.warn('LiveKit: lỗi kết nối tín hiệu tạm thời, chờ reconnect:', error);
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

  // Start a local query WS bridge when meeting is joined so external callers
  // can POST queries to `ws://127.0.0.1:9001/query` and receive RAG responses.
  useEffect(() => {
    if (!preJoinDone) return;
    const mid = currentMeetingId ?? meetingId;
    if (!mid) return;

    startQueryConnection(mid);
    return () => {
      stopQueryConnection();
    };
  }, [preJoinDone, currentMeetingId, meetingId]);

  const isHost = Boolean(
    isMeetingHostJoin ||
      (normalizedHostIdentity &&
        (normalizedHostIdentity === normalizedUserId || normalizedHostIdentity === normalizedUsername)),
  );

  const canCreatePoll = Boolean(isHost || isPollManager);
  const activeRecording = recordings.find((r) => {
    const s = (r.status || '').toLowerCase();
    return s === 'starting' || s === 'active' || s === 'stopping';
  }) ?? null;
  const [optimisticStopAtMs, setOptimisticStopAtMs] = useState<number | null>(null);
  const lastRecordingIdRef = useRef<string | null>(null);
  useEffect(() => {
    const id = activeRecording?.id ?? null;
    if (id !== lastRecordingIdRef.current) {
      lastRecordingIdRef.current = id;
      setOptimisticStopAtMs(null);
    }
  }, [activeRecording?.id]);

  useEffect(() => {
    if (!activeRecording) return;
    setRecordingNowMs(Date.now());
    const timer = window.setInterval(() => {
      setRecordingNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [activeRecording]);

  const recordingElapsedLabel = (() => {
    if (!activeRecording?.startedAtUtc) return null;
    const startedAtMs = Date.parse(activeRecording.startedAtUtc);
    if (!Number.isFinite(startedAtMs)) return null;
    const endMs =
      optimisticStopAtMs ??
      (((activeRecording.status || '').toLowerCase() === 'stopping' ? recordingNowMs : null) as number | null) ??
      recordingNowMs;
    const elapsedSec = Math.max(0, Math.floor((endMs - startedAtMs) / 1000));
    return formatRecordingDuration(elapsedSec);
  })();

  const loadRecordings = useCallback(async () => {
    const mid = currentMeetingId ?? meetingId;
    if (!mid) return;

    const res = await meetingApi.listRecordings(mid);
    if (res.error || !res.data) {
      return;
    }
    setRecordings(res.data);
  }, [currentMeetingId, meetingId]);

  useEffect(() => {
    if (!preJoinDone) return;

    void loadRecordings();
    const timer = window.setInterval(() => {
      void loadRecordings();
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [preJoinDone, loadRecordings]);

  useEffect(() => {
    const mid = currentMeetingId ?? meetingId;
    if (!mid) return;
    let cancelled = false;

    void (async () => {
      const res = await meetingApi.getList();
      if (cancelled || res.error || !res.data) return;
      const found = res.data.find((x) => x.id === mid);
      if (!found?.title) return;
      setMeetingTitle(found.title);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentMeetingId, meetingId]);

  const handleStartRecording = useCallback(async () => {
    const mid = currentMeetingId ?? meetingId;
    if (!mid) return;

    setRecordingActionLoading(true);
    try {
      const res = await meetingApi.startRecording(mid);
      if (res.error || !res.data) {
        message.error(res.error || 'Không thể bắt đầu ghi hình');
        return;
      }
      setRecordings((prev) => [res.data!, ...prev.filter((x) => x.id !== res.data!.id)]);
      message.success('Đã bắt đầu ghi hình');
    } finally {
      setRecordingActionLoading(false);
    }
  }, [currentMeetingId, meetingId, message]);

  const handleStopRecording = useCallback(async () => {
    const mid = currentMeetingId ?? meetingId;
    if (!mid || !activeRecording) return;

    // Optimistic UI: freeze the timer immediately while we stop recording.
    setOptimisticStopAtMs(Date.now());
    setRecordingActionLoading(true);
    try {
      const res = await meetingApi.stopRecording(mid, activeRecording.id);
      if (res.error || !res.data) {
        setOptimisticStopAtMs(null);
        message.error(res.error || 'Không thể dừng ghi hình');
        return;
      }
      setRecordings((prev) => prev.map((x) => (x.id === res.data!.id ? res.data! : x)));
      message.success('Đã dừng ghi hình');
    } finally {
      setRecordingActionLoading(false);
    }
  }, [currentMeetingId, meetingId, activeRecording, message]);

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
        <div style={styles.preJoinWrapper} className="prejoin-no-username prejoin-shell">
          <style
            dangerouslySetInnerHTML={{
              __html: `
                .prejoin-shell .lk-prejoin {
                  background: #fff;
                  border: 1px solid #e5e7eb;
                  border-radius: 14px;
                  padding: 0;
                  overflow: hidden;
                  box-shadow: 0 2px 10px rgba(15,23,42,0.05);
                  height: 100%;
                  display: flex;
                  flex-direction: column;
                }
                .prejoin-shell .lk-video-preview {
                  border-radius: 12px 12px 0 0;
                  min-height: 0;
                  flex: 1 1 auto;
                  background: #05070b;
                }
                .prejoin-shell .lk-button-group {
                  padding: 10px 14px 6px;
                }
                .prejoin-shell .lk-button-group .lk-button {
                  min-height: 40px;
                  border-radius: 10px;
                }
                .prejoin-shell .lk-prejoin .lk-button.lk-button-primary {
                  margin: 8px 14px 12px;
                  width: calc(100% - 28px);
                  min-height: 46px;
                  border-radius: 12px;
                  font-size: 20px;
                  font-weight: 600;
                  background: #3b82f6;
                  border-color: #3b82f6;
                }
                .prejoin-shell .lk-prejoin .lk-button.lk-button-primary:hover {
                  background: #2563eb;
                  border-color: #2563eb;
                }
                @media (max-width: 860px) {
                  .prejoin-shell {
                    grid-template-columns: 1fr !important;
                    grid-template-rows: auto minmax(0, 1fr);
                  }
                  .prejoin-shell .lk-video-preview { min-height: 0; }
                  .prejoin-shell .lk-prejoin .lk-button.lk-button-primary {
                    font-size: 17px;
                  }
                }
              `,
            }}
          />
          <div style={{ position: 'relative', minHeight: 0 }}>
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
                username: user?.fullName?.trim() || user?.username || 'user',
                videoEnabled: false,
                audioEnabled: false,
              }}
            />
          </div>

          <div style={styles.setupCard}>
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
                  <div className="meeting-title-overlay" aria-live="polite">
                    <div className="meeting-title-text">{meetingTitle}</div>
                    {activeRecording ? (
                      <button
                        type="button"
                        className="meeting-recording-pill"
                        onClick={() => {
                          if (!isHost || recordingActionLoading) return;
                          void handleStopRecording();
                        }}
                        disabled={!isHost || recordingActionLoading}
                        title={isHost ? 'Dừng ghi hình' : 'Cuộc họp đang ghi hình'}
                      >
                        <span className="meeting-recording-dot" aria-hidden="true" />
                        <span>{`${recordingElapsedLabel ?? '00:00'} - Dừng ghi`}</span>
                      </button>
                    ) : null}
                  </div>

                  <MeetingChatHistoryHydrator />
                  <MeetingShellEnhancements
                    shellRef={meetingShellRef}
                    transcriptOpen={transcriptOpen}
                    setTranscriptOpen={setTranscriptOpen}
                    voteOpen={voteOpen}
                    setVoteOpen={setVoteOpen}
                    documentsOpen={documentsOpen}
                    setDocumentsOpen={setDocumentsOpen}
                    activeToolsTab={activeToolsTab}
                    setActiveToolsTab={setActiveToolsTab}
                    onChatVisibilityChange={setMeetingChatOpen}
                    onChatUnreadChange={setMeetingChatUnread}
                    canManageRecording={isHost}
                    recordingActive={Boolean(activeRecording)}
                    recordingBusy={recordingActionLoading}
                    onStartRecording={() => {
                      void handleStartRecording();
                    }}
                    onStopRecording={() => {
                      void handleStopRecording();
                    }}
                  />

                  {/** Documents side panel is rendered inside meeting-side-stack (no overlay) */}

                  <VideoConference />
                  <LatestTranscriptStrip />
                  <div className="meeting-side-stack">
                    <MeetingUnifiedSidePanel
                      shellRef={meetingShellRef}
                      visible={toolsSideOpen}
                      activeTab={activeToolsTab}
                      setActiveTab={setActiveToolsTab}
                      transcriptOpen={transcriptOpen}
                      setTranscriptOpen={setTranscriptOpen}
                      voteOpen={voteOpen}
                      setVoteOpen={setVoteOpen}
                      documentsOpen={documentsOpen}
                      setDocumentsOpen={setDocumentsOpen}
                      chatOpen={meetingChatOpen}
                      chatUnreadCount={meetingChatUnread}
                      canCreatePoll={canCreatePoll}
                      meetingId={currentMeetingId ?? meetingId}
                      canUpload={isHost}
                      currentUserName={transcriptDisplayName}
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
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    padding: '10px 16px',
    overflow: 'hidden',
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
    maxWidth: '1040px',
    height: 'calc(100vh - 20px)',
    maxHeight: 'calc(100vh - 20px)',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 320px',
    gap: '14px',
    alignItems: 'start',
  },
  setupCard: {
    backgroundColor: '#ffffff',
    padding: '14px 20px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    border: '1px solid #e5e7eb',
    alignSelf: 'start',
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: '700',
    margin: '0 0 16px 0',
    color: '#111827',
  },
  formGroup: {
    marginBottom: '0',
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