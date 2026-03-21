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
import {
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
  ) => void;
  castVote: (pollId: string, optionIndices: number[]) => void;
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

export function VoteRoomProvider({ children }: { children: React.ReactNode }) {
  const room = useRoomContext();
  const connectionState = useConnectionState(room);
  const { user } = useAuth();
  const [state, setState] = useState<VoteRoomState>(() => initialVoteState());

  const localIdentity = room.localParticipant.identity;
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

  const createPoll = useCallback(
    (
      title: string,
      options: string[],
      selectionMode: SelectionMode,
      duration: CreatePollDuration,
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
        createdBy: localIdentity,
        createdByName: localDisplayName,
        createdAt,
        selectionMode,
        endAt,
      };
      setState((prev) => applyVoteRaw(prev, JSON.stringify(msg)));
      publish(msg);
    },
    [localDisplayName, localIdentity, publish],
  );

  const castVote = useCallback(
    (pollId: string, optionIndices: number[]) => {
      const msg: VoteMessage = {
        type: 'poll_vote',
        pollId,
        optionIndices,
        voterIdentity: localIdentity,
        voterName: localDisplayName,
        at: Date.now(),
      };
      setState((prev) => applyVoteRaw(prev, JSON.stringify(msg)));
      publish(msg);
    },
    [localDisplayName, localIdentity, publish],
  );

  const closePoll = useCallback(
    (pollId: string) => {
      const msg: VoteMessage = {
        type: 'poll_close',
        pollId,
        closedBy: localIdentity,
        at: Date.now(),
      };
      setState((prev) => applyVoteRaw(prev, JSON.stringify(msg)));
      publish(msg);
    },
    [localIdentity, publish],
  );

  const value = useMemo<VoteRoomContextValue>(
    () => ({
      ...state,
      createPoll,
      castVote,
      closePoll,
      localIdentity,
      localDisplayName,
    }),
    [
      state,
      createPoll,
      castVote,
      closePoll,
      localIdentity,
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
