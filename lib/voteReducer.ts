export type SelectionMode = 'single' | 'multiple';

export type VoteEntry = {
  optionIndices: number[];
  voterName: string;
  at: number;
};

export type Poll = {
  id: string;
  title: string;
  options: string[];
  createdBy: string;
  createdByName: string;
  createdAt: number;
  status: 'draft' | 'open' | 'closed';
  /** Phiếu cũ có thể thiếu — mặc định single */
  selectionMode?: SelectionMode;
  /** null = không giới hạn thời gian */
  endAt?: number | null;
  votes: Record<string, VoteEntry>;
};

export type VoteRoomState = {
  polls: Record<string, Poll>;
};

export function initialVoteState(): VoteRoomState {
  return { polls: {} };
}

export type VoteMessage =
  | {
      type: 'poll_create';
      pollId: string;
      title: string;
      options: string[];
      createdBy: string;
      createdByName: string;
      createdAt: number;
      selectionMode: SelectionMode;
      endAt: number | null;
      status?: 'draft' | 'open';
    }
  | {
      type: 'poll_vote';
      pollId: string;
      optionIndices: number[];
      voterIdentity: string;
      voterName: string;
      at: number;
    }
  | {
      type: 'poll_close';
      pollId: string;
      closedBy: string;
      at: number;
    };

function normalizeOptions(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out = raw
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean);
  if (out.length < 2 || out.length > 8) return null;
  return out;
}

function normalizeIndices(
  raw: unknown,
  legacyOptionIndex: unknown,
): number[] | null {
  if (Array.isArray(raw)) {
    const nums = raw
      .map((x) => (typeof x === 'number' && Number.isFinite(x) ? Math.floor(x) : NaN))
      .filter((n) => !Number.isNaN(n));
    return [...new Set(nums)].sort((a, b) => a - b);
  }
  if (
    typeof legacyOptionIndex === 'number' &&
    Number.isFinite(legacyOptionIndex)
  ) {
    return [Math.floor(legacyOptionIndex)];
  }
  return null;
}

export function parseVoteMessage(raw: string): VoteMessage | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const o = JSON.parse(trimmed) as Record<string, unknown>;
    const type = o.type;
    if (type === 'poll_create') {
      const pollId = typeof o.pollId === 'string' ? o.pollId : '';
      const title = typeof o.title === 'string' ? o.title.trim() : '';
      const options = normalizeOptions(o.options);
      const createdBy = typeof o.createdBy === 'string' ? o.createdBy : '';
      const createdByName =
        typeof o.createdByName === 'string' ? o.createdByName.trim() : '';
      const createdAt =
        typeof o.createdAt === 'number' && Number.isFinite(o.createdAt)
          ? o.createdAt
          : Date.now();
      const selectionMode: SelectionMode =
        o.selectionMode === 'multiple' ? 'multiple' : 'single';
      const status: 'draft' | 'open' =
        o.status === 'draft' ? 'draft' : 'open';
      let endAt: number | null = null;
      if (o.endAt !== undefined && o.endAt !== null) {
        if (typeof o.endAt === 'number' && Number.isFinite(o.endAt)) {
          endAt = o.endAt;
        }
      }
      if (!pollId || !title || !options || !createdBy) return null;
      return {
        type: 'poll_create',
        pollId,
        title,
        options,
        createdBy,
        createdByName: createdByName || createdBy,
        createdAt,
        selectionMode,
        endAt,
        status,
      };
    }
    if (type === 'poll_vote') {
      const pollId = typeof o.pollId === 'string' ? o.pollId : '';
      const indices = normalizeIndices(o.optionIndices, o.optionIndex);
      const voterIdentity =
        typeof o.voterIdentity === 'string' ? o.voterIdentity : '';
      const voterName =
        typeof o.voterName === 'string' ? o.voterName.trim() : '';
      const at =
        typeof o.at === 'number' && Number.isFinite(o.at) ? o.at : Date.now();
      if (!pollId || !indices || indices.length === 0 || !voterIdentity) {
        return null;
      }
      return {
        type: 'poll_vote',
        pollId,
        optionIndices: indices,
        voterIdentity,
        voterName: voterName || voterIdentity,
        at,
      };
    }
    if (type === 'poll_close') {
      const pollId = typeof o.pollId === 'string' ? o.pollId : '';
      const closedBy = typeof o.closedBy === 'string' ? o.closedBy : '';
      const at =
        typeof o.at === 'number' && Number.isFinite(o.at) ? o.at : Date.now();
      if (!pollId || !closedBy) return null;
      return { type: 'poll_close', pollId, closedBy, at };
    }
    return null;
  } catch {
    return null;
  }
}

function validateIndices(
  p: Poll,
  indices: number[],
): number[] | null {
  const mode: SelectionMode = p.selectionMode ?? 'single';
  const uniq = [...new Set(indices)].filter(
    (i) => i >= 0 && i < p.options.length,
  );
  if (uniq.length === 0) return null;
  if (mode === 'single') {
    if (uniq.length !== 1) return null;
    return uniq;
  }
  return uniq.sort((a, b) => a - b);
}

export function isPollExpired(p: Poll, now = Date.now()): boolean {
  const end = p.endAt;
  return end != null && end !== undefined && now > end;
}

export function canVoteOnPoll(p: Poll, now = Date.now()): boolean {
  if (p.status !== 'open') return false;
  if (isPollExpired(p, now)) return false;
  return true;
}

export function applyVoteMessage(
  prev: VoteRoomState,
  msg: VoteMessage,
): VoteRoomState {
  if (msg.type === 'poll_create') {
    const existing = prev.polls[msg.pollId];
    const nextStatus = msg.status ?? 'open';
    if (existing) {
      return {
        polls: {
          ...prev.polls,
          [msg.pollId]: {
            ...existing,
            title: msg.title,
            options: msg.options,
            createdBy: msg.createdBy,
            createdByName: msg.createdByName,
            createdAt: msg.createdAt,
            selectionMode: msg.selectionMode,
            endAt: msg.endAt,
            status: nextStatus,
          },
        },
      };
    }
    return {
      polls: {
        ...prev.polls,
        [msg.pollId]: {
          id: msg.pollId,
          title: msg.title,
          options: msg.options,
          createdBy: msg.createdBy,
          createdByName: msg.createdByName,
          createdAt: msg.createdAt,
          status: nextStatus,
          selectionMode: msg.selectionMode,
          endAt: msg.endAt,
          votes: {},
        },
      },
    };
  }

  if (msg.type === 'poll_close') {
    const p = prev.polls[msg.pollId];
    if (!p || p.status === 'closed') return prev;
    if (msg.closedBy !== p.createdBy) return prev;
    return {
      polls: {
        ...prev.polls,
        [msg.pollId]: { ...p, status: 'closed' },
      },
    };
  }

  if (msg.type === 'poll_vote') {
    const p = prev.polls[msg.pollId];
    if (!p || p.status === 'closed') return prev;
    if (!canVoteOnPoll(p, msg.at)) return prev;

    const valid = validateIndices(p, msg.optionIndices);
    if (!valid) return prev;

    return {
      polls: {
        ...prev.polls,
        [msg.pollId]: {
          ...p,
          votes: {
            ...p.votes,
            [msg.voterIdentity]: {
              optionIndices: valid,
              voterName: msg.voterName,
              at: msg.at,
            },
          },
        },
      },
    };
  }

  return prev;
}

export function applyVoteRaw(prev: VoteRoomState, raw: string): VoteRoomState {
  const msg = parseVoteMessage(raw);
  if (!msg) return prev;
  return applyVoteMessage(prev, msg);
}
