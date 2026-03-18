export type TranscriptFinalItem = {
  id: string;
  text: string;
  receivedAt: number;
};

export type TranscriptRoomState = {
  finalized: TranscriptFinalItem[];
  draftText: string | null;
  transcriptServiceReady: boolean;
};

const initial: TranscriptRoomState = {
  finalized: [],
  draftText: null,
  transcriptServiceReady: false,
};

function tryParsePartialFinal(
  trimmed: string,
): { type: 'partial' | 'final'; text: string } | null {
  try {
    const o = JSON.parse(trimmed) as Record<string, unknown>;
    const type = o.type;
    const text = o.text;
    if (type !== 'partial' && type !== 'final') return null;
    if (typeof text !== 'string') return null;
    return { type: type as 'partial' | 'final', text };
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
          return { ...prev, draftText: parsed.text };
        }
        const text = parsed.text.trim();
        if (text) {
          return {
            finalized: [
              ...prev.finalized,
              { id: crypto.randomUUID(), text, receivedAt: Date.now() },
            ],
            draftText: null,
            transcriptServiceReady: prev.transcriptServiceReady,
          };
        }
        return { ...prev, draftText: null };
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
        { id: crypto.randomUUID(), text: trimmed, receivedAt: Date.now() },
      ],
      draftText: null,
      transcriptServiceReady: prev.transcriptServiceReady,
    };
  }
  return { ...prev, draftText: null };
}

export function resetTranscriptState(): TranscriptRoomState {
  return { ...initial };
}
