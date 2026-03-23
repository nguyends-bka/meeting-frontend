'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useConnectionState, useRoomContext } from '@livekit/components-react';
import { ConnectionState, RoomEvent } from 'livekit-client';
import { useAuth } from '@/lib/auth';
import { meetingApi } from '@/services/meeting/meetingApi';
import type { PollResponse } from '@/dtos/meeting.dto';
import {
  applyVoteMessage,
  applyVoteRaw,
  initialVoteState,
  type Poll,
  type SelectionMode,
  type VoteMessage,
  type VoteRoomState,
} from '@/lib/voteReducer';

export type { Poll } from '@/lib/voteReducer';

export const VOTE_DATA_TOPIC = 'bkmt-vote';

export type CreatePollDuration =
  | { kind: 'none' }
  | { kind: 'minutes'; minutes: number };

type VoteRoomContextValue = VoteRoomState & {
  createPoll: (
    title: string,
    options: string[],
    selectionMode: SelectionMode,
    duration: CreatePollDuration,
    publishNow?: boolean,
  ) => void;
  updateDraftPoll: (
    pollId: string,
    title: string,
    options: string[],
    selectionMode: SelectionMode,
    duration: CreatePollDuration,
  ) => Promise<boolean>;
  castVote: (pollId: string, optionIndices: number[]) => void;
  publishPoll: (pollId: string) => void;
  closePoll: (pollId: string) => void;
  localIdentity: string;
  localDisplayName: string;
};

const VoteRoomContext = createContext<VoteRoomContextValue | null>(null);

export function useVoteRoom(): VoteRoomContextValue {
  const ctx = useContext(VoteRoomContext);
  if (!ctx) {
    throw new Error('useVoteRoom must be used inside VoteRoomProvider');
  }
  return ctx;
}

export function VoteRoomProvider({
  children,
  meetingId,
}: {
  children: React.ReactNode;
  /** GUID meeting — dùng để gọi API lưu biểu quyết vào DB */
  meetingId: string;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState(room);
  const { user } = useAuth();
  const [state, setState] = useState<VoteRoomState>(() => initialVoteState());

  const localIdentity = room.localParticipant.identity;
  /** Trùng với JWT (backend yêu cầu createdBy / voterIdentity khớp user đăng nhập) */
  const actorId = user?.id?.trim() || localIdentity;
  const localDisplayName =
    user?.fullName?.trim() ||
    room.localParticipant.name?.trim() ||
    localIdentity;

  useEffect(() => {
    if (connectionState === ConnectionState.Disconnected) {
      setState(initialVoteState());
    }
  }, [connectionState]);

  const publish = useCallback(
    (msg: VoteMessage) => {
      if (connectionState !== ConnectionState.Connected) return;
      try {
        void room.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify(msg)),
          { reliable: true, topic: VOTE_DATA_TOPIC },
        );
      } catch (e) {
        console.warn('Vote publishData failed:', e);
      }
    },
    [connectionState, room],
  );

  useEffect(() => {
    const onData = (
      payload: Uint8Array,
      _participant: { identity: string } | undefined,
      _kind: unknown,
      topic?: string,
    ) => {
      if (topic !== VOTE_DATA_TOPIC) return;
      let raw: string;
      try {
        raw = new TextDecoder().decode(payload);
      } catch {
        return;
      }
      setState((prev) => applyVoteRaw(prev, raw));
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  useEffect(() => {
    const mid = meetingId?.trim();
    if (!mid || connectionState !== ConnectionState.Connected) return;

    let cancelled = false;
    void (async () => {
      const res = await meetingApi.listPolls(mid);
      if (cancelled || res.error || !res.data) return;

      const next = res.data.reduce((acc, p: PollResponse) => {
        const createMsg: VoteMessage = {
          type: 'poll_create',
          pollId: p.pollId,
          title: p.title,
          options: p.options,
          createdBy: p.createdBy,
          createdByName: p.createdByName,
          createdAt: p.createdAt,
          selectionMode: p.selectionMode === 'multiple' ? 'multiple' : 'single',
          endAt: p.endAt ?? null,
          status: p.status === 'open' ? 'open' : 'draft',
        };
        let s = applyVoteMessage(acc, createMsg);
        for (const v of p.votes ?? []) {
          const voteMsg: VoteMessage = {
            type: 'poll_vote',
            pollId: p.pollId,
            optionIndices: v.optionIndices ?? [],
            voterIdentity: v.voterIdentity,
            voterName: v.voterName,
            at: v.at,
          };
          s = applyVoteMessage(s, voteMsg);
        }
        if (p.status === 'closed') {
          const closeMsg: VoteMessage = {
            type: 'poll_close',
            pollId: p.pollId,
            closedBy: p.closedBy ?? p.createdBy,
            at: p.closedAt ?? Date.now(),
          };
          s = applyVoteMessage(s, closeMsg);
        }
        return s;
      }, initialVoteState());

      setState((prev) => {
        const merged = { ...prev.polls };
        for (const [id, poll] of Object.entries(next.polls)) {
          const existing = merged[id];
          if (!existing) {
            merged[id] = poll;
            continue;
          }
          merged[id] = {
            ...existing,
            ...poll,
            votes: { ...existing.votes, ...poll.votes },
          };
        }
        return { polls: merged };
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [meetingId, connectionState]);

  const createPoll = useCallback(
    (
      title: string,
      options: string[],
      selectionMode: SelectionMode,
      duration: CreatePollDuration,
      publishNow = false,
    ) => {
      const trimmed = title.trim();
      const opts = options.map((o) => o.trim()).filter(Boolean);
      if (!trimmed || opts.length < 2) return;
      const createdAt = Date.now();
      let endAt: number | null = null;
      if (duration.kind === 'minutes') {
        const m = Math.max(1, Math.min(7 * 24 * 60, Math.floor(duration.minutes)));
        endAt = createdAt + m * 60 * 1000;
      }
      const pollId = crypto.randomUUID();
      const msg: VoteMessage = {
        type: 'poll_create',
        pollId,
        title: trimmed,
        options: opts.slice(0, 8),
        createdBy: actorId,
        createdByName: localDisplayName,
        createdAt,
        selectionMode,
        endAt,
        status: publishNow ? 'open' : 'draft',
      };
      setState((prev) => applyVoteRaw(prev, JSON.stringify(msg)));
      if (publishNow) {
        publish(msg);
      }

      const mid = meetingId?.trim();
      if (mid) {
        void (async () => {
          const res = await meetingApi.createPoll(mid, {
            pollId: msg.pollId,
            title: msg.title,
            options: msg.options,
            createdBy: msg.createdBy,
            createdByName: msg.createdByName,
            createdAt: msg.createdAt,
            selectionMode: msg.selectionMode,
            endAt: msg.endAt,
            status: publishNow ? 'open' : 'draft',
          });
          if (res.error) {
            console.warn('[Vote] Không lưu được biểu quyết lên DB:', res.error);
          }
        })();
      }
    },
    [actorId, localDisplayName, meetingId, publish],
  );

  const publishPoll = useCallback(
    (pollId: string) => {
      const current = state.polls[pollId];
      if (!current || current.status !== 'draft') return;
      const mid = meetingId?.trim();
      if (!mid) return;

      void (async () => {
        const res = await meetingApi.publishPoll(mid, pollId, {
          publishedBy: actorId,
          at: Date.now(),
        });
        if (res.error || !res.data) {
          console.warn('[Vote] Không công bố được biểu quyết:', res.error);
          return;
        }

        const p = res.data;
        const msg: VoteMessage = {
          type: 'poll_create',
          pollId: p.pollId,
          title: p.title,
          options: p.options,
          createdBy: p.createdBy,
          createdByName: p.createdByName,
          createdAt: p.createdAt,
          selectionMode: p.selectionMode === 'multiple' ? 'multiple' : 'single',
          endAt: p.endAt ?? null,
          status: 'open',
        };
        setState((prev) => applyVoteMessage(prev, msg));
        publish(msg);
      })();
    },
    [actorId, meetingId, publish, state.polls],
  );

  const updateDraftPoll = useCallback(
    (
      pollId: string,
      title: string,
      options: string[],
      selectionMode: SelectionMode,
      duration: CreatePollDuration,
    ): Promise<boolean> => {
      const current = state.polls[pollId];
      if (!current || current.status !== 'draft') return Promise.resolve(false);
      const trimmed = title.trim();
      const opts = options.map((o) => o.trim()).filter(Boolean);
      if (!trimmed || opts.length < 2) return Promise.resolve(false);
      const mid = meetingId?.trim();
      if (!mid) return Promise.resolve(false);

      let endAt: number | null = null;
      if (duration.kind === 'minutes') {
        const m = Math.max(1, Math.min(7 * 24 * 60, Math.floor(duration.minutes)));
        endAt = Date.now() + m * 60 * 1000;
      }

      return (async () => {
        const res = await meetingApi.updateDraftPoll(mid, pollId, {
          pollId,
          title: trimmed,
          options: opts.slice(0, 8),
          createdBy: actorId,
          createdByName: localDisplayName,
          createdAt: current.createdAt,
          selectionMode,
          endAt,
          status: 'draft',
        });
        if (res.error || !res.data) {
          console.warn('[Vote] Không cập nhật được biểu quyết nháp:', res.error);
          return false;
        }
        const p = res.data;
        setState((prev) =>
          applyVoteMessage(prev, {
            type: 'poll_create',
            pollId: p.pollId,
            title: p.title,
            options: p.options,
            createdBy: p.createdBy,
            createdByName: p.createdByName,
            createdAt: p.createdAt,
            selectionMode: p.selectionMode === 'multiple' ? 'multiple' : 'single',
            endAt: p.endAt ?? null,
            status: 'draft',
          }),
        );
        return true;
      })();
    },
    [actorId, localDisplayName, meetingId, state.polls],
  );

  const castVote = useCallback(
    (pollId: string, optionIndices: number[]) => {
      const msg: VoteMessage = {
        type: 'poll_vote',
        pollId,
        optionIndices,
        voterIdentity: actorId,
        voterName: localDisplayName,
        at: Date.now(),
      };
      setState((prev) => applyVoteRaw(prev, JSON.stringify(msg)));
      publish(msg);

      const mid = meetingId?.trim();
      if (mid) {
        void (async () => {
          const res = await meetingApi.votePoll(mid, pollId, {
            optionIndices: msg.optionIndices,
            voterIdentity: msg.voterIdentity,
            voterName: msg.voterName,
            at: msg.at,
          });
          if (res.error) {
            console.warn('[Vote] Không lưu được phiếu lên DB:', res.error);
          }
        })();
      }
    },
    [actorId, localDisplayName, meetingId, publish],
  );

  const closePoll = useCallback(
    (pollId: string) => {
      const msg: VoteMessage = {
        type: 'poll_close',
        pollId,
        closedBy: actorId,
        at: Date.now(),
      };
      setState((prev) => applyVoteRaw(prev, JSON.stringify(msg)));
      publish(msg);

      const mid = meetingId?.trim();
      if (mid) {
        void (async () => {
          const res = await meetingApi.closePoll(mid, pollId, {
            closedBy: msg.closedBy,
            at: msg.at,
          });
          if (res.error) {
            console.warn('[Vote] Không đóng biểu quyết trên DB:', res.error);
          }
        })();
      }
    },
    [actorId, meetingId, publish],
  );

  const value = useMemo<VoteRoomContextValue>(
    () => ({
      ...state,
      createPoll,
      updateDraftPoll,
      castVote,
      publishPoll,
      closePoll,
      localIdentity: actorId,
      localDisplayName,
    }),
    [
      state,
      createPoll,
      updateDraftPoll,
      castVote,
      publishPoll,
      closePoll,
      actorId,
      localDisplayName,
    ],
  );

  return (
    <VoteRoomContext.Provider value={value}>{children}</VoteRoomContext.Provider>
  );
}

export function pollCounts(poll: Poll): number[] {
  const counts = poll.options.map(() => 0);
  for (const v of Object.values(poll.votes)) {
    const legacy = v as { optionIndices?: number[]; optionIndex?: number };
    const indices =
      legacy.optionIndices?.length != null && legacy.optionIndices.length > 0
        ? legacy.optionIndices
        : typeof legacy.optionIndex === 'number'
          ? [legacy.optionIndex]
          : [];
    for (const idx of indices) {
      if (idx >= 0 && idx < counts.length) counts[idx] += 1;
    }
  }
  return counts;
}
