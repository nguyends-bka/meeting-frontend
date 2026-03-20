export type TranscriptFinalItem = {
  id: string;
  text: string;
  receivedAt: number;
  speaker: string | null;
};

export type TranscriptRoomState = {
  finalized: TranscriptFinalItem[];
  draftText: string | null;
  draftSpeaker: string | null;
  transcriptServiceReady: boolean;
};

const initial: TranscriptRoomState = {
  finalized: [],
  draftText: null,
  draftSpeaker: null,
  transcriptServiceReady: false,
};

function pickSpeaker(o: Record<string, unknown>): string | null {
  const candidates = [o.speaker, o.displayName, o.senderName, o.username, o.user];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function tryParsePartialFinal(
  trimmed: string,
): { type: 'partial' | 'final'; text: string; speaker: string | null } | null {
  try {
    const o = JSON.parse(trimmed) as Record<string, unknown>;
    const type = o.type;
    const text = o.text;
    if (type !== 'partial' && type !== 'final') return null;
    if (typeof text !== 'string') return null;
    return { type: type as 'partial' | 'final', text, speaker: pickSpeaker(o) };
  } catch {
    return null;
  }
}

export function applyTranscriptRaw(prev: TranscriptRoomState, raw: string): TranscriptRoomState {
  const trimmed = raw.trim();

  if (trimmed.startsWith('{')) {
    try {
      const o = JSON.parse(trimmed) as Record<string, unknown>;
      if (o.type === 'transcript_connected') {
        return {
          ...prev,
          transcriptServiceReady: o.status === 'ready',
        };
      }
      const parsed = tryParsePartialFinal(trimmed);
      if (parsed) {
        if (parsed.type === 'partial') {
          return { ...prev, draftText: parsed.text, draftSpeaker: parsed.speaker };
        }
        const text = parsed.text.trim();
        if (text) {
          return {
            finalized: [
              ...prev.finalized,
              {
                id: crypto.randomUUID(),
                text,
                receivedAt: Date.now(),
                speaker: parsed.speaker,
              },
            ],
            draftText: null,
            draftSpeaker: null,
            transcriptServiceReady: prev.transcriptServiceReady,
          };
        }
        return { ...prev, draftText: null, draftSpeaker: null };
      }
      return prev;
    } catch {
      /* plain */
    }
  }

  if (trimmed) {
    return {
      finalized: [
        ...prev.finalized,
        { id: crypto.randomUUID(), text: trimmed, receivedAt: Date.now(), speaker: null },
      ],
      draftText: null,
      draftSpeaker: null,
      transcriptServiceReady: prev.transcriptServiceReady,
    };
  }
  return { ...prev, draftText: null, draftSpeaker: null };
}

export function resetTranscriptState(): TranscriptRoomState {
  return { ...initial };
}
