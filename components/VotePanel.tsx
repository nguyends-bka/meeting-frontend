'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useVoteRoom,
  pollCounts,
} from '@/components/VoteRoomProvider';
import {
  canVoteOnPoll,
  isPollExpired,
  type Poll,
} from '@/lib/voteReducer';

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function PollCountdown({ endAt }: { endAt: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      tick((t) => t + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [endAt]);
  const ms = endAt - Date.now();
  const done = ms <= 0;
  return (
    <span
      className={`meeting-vote-countdown ${done ? 'is-ended' : ''}`}
      title="Thời gian còn lại"
    >
      {done ? 'Hết hạn' : `Còn ${formatRemaining(ms)}`}
    </span>
  );
}

export default function VotePanel() {
  const {
    polls,
    createPoll,
    castVote,
    closePoll,
    localIdentity,
  } = useVoteRoom();

  const [title, setTitle] = useState('');
  const [optionInputs, setOptionInputs] = useState(['', '']);
  const [selectionMode, setSelectionMode] = useState<'single' | 'multiple'>(
    'single',
  );
  const [durationKind, setDurationKind] = useState<'none' | 'timed'>('none');
  const [durationMinutes, setDurationMinutes] = useState(5);

  /** Phiếu nhiều lựa chọn: bản nháp trước khi gửi */
  const [multiDraft, setMultiDraft] = useState<Record<string, number[]>>({});

  const [showCreateForm, setShowCreateForm] = useState(false);

  const list = useMemo(
    () => Object.values(polls).sort((a, b) => b.createdAt - a.createdAt),
    [polls],
  );

  const addOptionField = () => {
    if (optionInputs.length >= 8) return;
    setOptionInputs((o) => [...o, '']);
  };

  const setOptionAt = (i: number, v: string) => {
    setOptionInputs((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  };

  const resetCreateForm = useCallback(() => {
    setTitle('');
    setOptionInputs(['', '']);
    setSelectionMode('single');
    setDurationKind('none');
    setDurationMinutes(5);
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const opts = optionInputs.map((x) => x.trim()).filter(Boolean);
    createPoll(title, opts, selectionMode, {
      kind: durationKind === 'timed' ? 'minutes' : 'none',
      minutes:
        durationKind === 'timed'
          ? Math.max(1, Math.min(10080, durationMinutes))
          : 5,
    });
    resetCreateForm();
    setShowCreateForm(false);
  };

  const toggleMultiDraft = useCallback(
    (pollId: string, idx: number, mineIndices: number[] | undefined) => {
      setMultiDraft((d) => {
        const base = d[pollId] ?? mineIndices ?? [];
        const cur = new Set(base);
        if (cur.has(idx)) cur.delete(idx);
        else cur.add(idx);
        const arr = [...cur].sort((a, b) => a - b);
        return { ...d, [pollId]: arr };
      });
    },
    [],
  );

  return (
    <aside
      className={`meeting-vote-panel${showCreateForm ? ' meeting-vote-panel--creating' : ''}`}
    >
      <div className="meeting-vote-header">
        <span className="meeting-vote-header-title">Biểu quyết</span>
        {!showCreateForm && (
          <button
            type="button"
            className="meeting-vote-header-create-btn"
            onClick={() => setShowCreateForm(true)}
          >
            Tạo biểu quyết mới
          </button>
        )}
      </div>

      {showCreateForm && (
      <form className="meeting-vote-create" onSubmit={handleCreate}>
        <label className="meeting-vote-label">
          Nội dung
          <input
            className="meeting-vote-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Thông qua kế hoạch Q2?"
            maxLength={500}
            required
            autoComplete="off"
          />
        </label>

        <fieldset className="meeting-vote-fieldset">
          <legend className="meeting-vote-legend">Kiểu phiếu</legend>
          <label className="meeting-vote-radio-row">
            <input
              type="radio"
              name="vote-selection"
              checked={selectionMode === 'single'}
              onChange={() => setSelectionMode('single')}
            />
            Một lựa chọn
          </label>
          <label className="meeting-vote-radio-row">
            <input
              type="radio"
              name="vote-selection"
              checked={selectionMode === 'multiple'}
              onChange={() => setSelectionMode('multiple')}
            />
            Nhiều lựa chọn
          </label>
        </fieldset>

        <fieldset className="meeting-vote-fieldset">
          <legend className="meeting-vote-legend">Thời hạn</legend>
          <label className="meeting-vote-radio-row">
            <input
              type="radio"
              name="vote-duration"
              checked={durationKind === 'none'}
              onChange={() => setDurationKind('none')}
            />
            Không giới hạn thời gian
          </label>
          <label className="meeting-vote-radio-row meeting-vote-radio-row--inline">
            <input
              type="radio"
              name="vote-duration"
              checked={durationKind === 'timed'}
              onChange={() => setDurationKind('timed')}
            />
            Có thời hạn (phút)
            <input
              type="number"
              className="meeting-vote-input meeting-vote-input--narrow"
              min={1}
              max={10080}
              value={durationMinutes}
              disabled={durationKind !== 'timed'}
              onChange={(e) =>
                setDurationMinutes(
                  Math.max(1, Math.min(10080, Number(e.target.value) || 1)),
                )
              }
            />
          </label>
        </fieldset>

        <div className="meeting-vote-options-editor">
          <span className="meeting-vote-label-text">Lựa chọn (tối thiểu 2)</span>
          {optionInputs.map((opt, i) => (
            <input
              key={i}
              className="meeting-vote-input"
              value={opt}
              onChange={(e) => setOptionAt(i, e.target.value)}
              placeholder={`Phương án ${i + 1}`}
              autoComplete="off"
            />
          ))}
          {optionInputs.length < 8 && (
            <button
              type="button"
              className="meeting-vote-add-option"
              onClick={addOptionField}
            >
              + Thêm phương án
            </button>
          )}
        </div>
        <div className="meeting-vote-create-actions">
          <button
            type="button"
            className="meeting-vote-cancel-form"
            onClick={() => {
              resetCreateForm();
              setShowCreateForm(false);
            }}
          >
            Hủy
          </button>
          <button type="submit" className="meeting-vote-submit">
            Tạo phiếu
          </button>
        </div>
      </form>
      )}

      {!showCreateForm && (
        <div className="meeting-vote-list">
          {list.length === 0 ? (
            <div className="meeting-vote-empty">Chưa có phiếu biểu quyết.</div>
          ) : (
            list.map((poll) => (
              <PollCard
                key={poll.id}
                poll={poll}
                counts={pollCounts(poll)}
                mine={poll.votes[localIdentity]}
                canClose={
                  poll.status === 'open' && poll.createdBy === localIdentity
                }
                multiDraft={multiDraft[poll.id]}
                onToggleMultiDraft={toggleMultiDraft}
                onCastVote={castVote}
                onClosePoll={closePoll}
              />
            ))
          )}
        </div>
      )}
    </aside>
  );
}

function PollCard({
  poll,
  counts,
  mine,
  canClose,
  multiDraft,
  onToggleMultiDraft,
  onCastVote,
  onClosePoll,
}: {
  poll: Poll;
  counts: number[];
  mine: { optionIndices: number[]; voterName: string; at: number } | undefined;
  canClose: boolean;
  multiDraft: number[] | undefined;
  onToggleMultiDraft: (
    pollId: string,
    idx: number,
    mineIndices: number[] | undefined,
  ) => void;
  onCastVote: (pollId: string, optionIndices: number[]) => void;
  onClosePoll: (pollId: string) => void;
}) {
  const mode = poll.selectionMode ?? 'single';
  const expired = isPollExpired(poll);
  const canVote = canVoteOnPoll(poll);
  const disabled = !canVote;
  const selected = multiDraft ?? mine?.optionIndices ?? [];

  const mineSingleIdx =
    mine?.optionIndices?.[0] ??
    (mine as { optionIndex?: number } | undefined)?.optionIndex;

  const multiSelected = new Set(selected);

  return (
    <div
      className={`meeting-vote-card ${poll.status === 'closed' || expired ? 'is-closed' : ''}`}
    >
      <div className="meeting-vote-card-head">
        <strong className="meeting-vote-card-title">{poll.title}</strong>
        <span className="meeting-vote-card-meta">
          {poll.createdByName} ·{' '}
          {mode === 'multiple' ? 'Nhiều lựa chọn' : 'Một lựa chọn'}
          {' · '}
          {poll.status === 'closed'
            ? 'Đã đóng'
            : expired
              ? 'Hết hạn'
              : 'Đang mở'}
        </span>
        {poll.endAt != null && poll.endAt > 0 && (
          <div className="meeting-vote-card-timer">
            <PollCountdown endAt={poll.endAt} />
          </div>
        )}
      </div>

      {mode === 'single' ? (
        <ul className="meeting-vote-options">
          {poll.options.map((label, idx) => {
            const isSel = mineSingleIdx === idx;
            return (
              <li key={idx}>
                <button
                  type="button"
                  className={`meeting-vote-option-btn ${isSel ? 'is-selected' : ''}`}
                  disabled={disabled}
                  onClick={() => onCastVote(poll.id, [idx])}
                >
                  <span className="meeting-vote-option-label">{label}</span>
                  <span className="meeting-vote-option-count">{counts[idx]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          <ul className="meeting-vote-options meeting-vote-options--multi">
            {poll.options.map((label, idx) => {
              const isSel = multiSelected.has(idx);
              return (
                <li key={idx}>
                  <label
                    className={`meeting-vote-check-row ${isSel ? 'is-selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSel}
                      disabled={disabled}
                      onChange={() =>
                        onToggleMultiDraft(poll.id, idx, mine?.optionIndices)
                      }
                    />
                    <span className="meeting-vote-option-label">{label}</span>
                    <span className="meeting-vote-option-count">{counts[idx]}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="meeting-vote-submit-multi"
            disabled={disabled || selected.length === 0}
            onClick={() => onCastVote(poll.id, selected)}
          >
            Gửi phiếu
          </button>
        </>
      )}

      {canClose && !expired && (
        <button
          type="button"
          className="meeting-vote-close"
          onClick={() => onClosePoll(poll.id)}
        >
          Kết thúc biểu quyết
        </button>
      )}
    </div>
  );
}
