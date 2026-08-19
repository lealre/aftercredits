import { describe, expect, it } from 'vitest';
import {
  TITLE_SCOPE,
  deriveChanges,
  initialStagedState,
  seasonScope,
  stagedEditsReducer as reduce,
  type StagedState,
} from './stagedEdits';

const S1 = seasonScope('1');
const S2 = seasonScope('2');

describe('stagedEditsReducer', () => {
  it('records a value that differs from the baseline', () => {
    const next = reduce(initialStagedState, {
      type: 'stage', scope: TITLE_SCOPE, field: 'watched', value: true, baseline: false,
    });
    expect(next.drafts).toEqual({ [TITLE_SCOPE]: { watched: true } });
  });

  it('drops the field when the value returns to the baseline', () => {
    const staged = reduce(initialStagedState, {
      type: 'stage', scope: TITLE_SCOPE, field: 'watched', value: true, baseline: false,
    });
    const back = reduce(staged, {
      type: 'stage', scope: TITLE_SCOPE, field: 'watched', value: false, baseline: false,
    });
    expect(back.drafts).toEqual({});
  });

  it('keeps sibling fields in the same scope', () => {
    let s = reduce(initialStagedState, {
      type: 'stage', scope: TITLE_SCOPE, field: 'watched', value: true, baseline: false,
    });
    s = reduce(s, {
      type: 'stage', scope: TITLE_SCOPE, field: 'watchedAt', value: '2026-08-01', baseline: '',
    });
    expect(s.drafts[TITLE_SCOPE]).toEqual({ watched: true, watchedAt: '2026-08-01' });
  });

  it('keeps scopes independent', () => {
    let s = reduce(initialStagedState, {
      type: 'stage', scope: S1, field: 'rating', value: 8.5, baseline: null,
    });
    s = reduce(s, { type: 'stage', scope: S2, field: 'watched', value: true, baseline: false });
    expect(s.drafts).toEqual({ [S1]: { rating: 8.5 }, [S2]: { watched: true } });
  });

  it('stages a rating deletion as null', () => {
    const s = reduce(initialStagedState, {
      type: 'stageRatingDelete', scope: S1, hasExistingRating: true,
    });
    expect(s.drafts[S1]).toEqual({ rating: null });
  });

  it('ignores a rating deletion when there is no rating to delete', () => {
    const s = reduce(initialStagedState, {
      type: 'stageRatingDelete', scope: S1, hasExistingRating: false,
    });
    expect(s).toBe(initialStagedState);
  });

  it('unstages one field and leaves its siblings', () => {
    let s = reduce(initialStagedState, {
      type: 'stage', scope: TITLE_SCOPE, field: 'watched', value: true, baseline: false,
    });
    s = reduce(s, { type: 'stage', scope: TITLE_SCOPE, field: 'rating', value: 7, baseline: null });
    s = reduce(s, { type: 'unstage', scope: TITLE_SCOPE, field: 'rating' });
    expect(s.drafts[TITLE_SCOPE]).toEqual({ watched: true });
  });

  it('prunes the scope when its last field is unstaged', () => {
    let s = reduce(initialStagedState, {
      type: 'stage', scope: S1, field: 'rating', value: 7, baseline: null,
    });
    s = reduce(s, { type: 'unstage', scope: S1, field: 'rating' });
    expect(s.drafts).toEqual({});
  });

  it('drops succeeded fields and keeps failed ones staged', () => {
    let s = reduce(initialStagedState, {
      type: 'stage', scope: S1, field: 'watched', value: true, baseline: false,
    });
    s = reduce(s, { type: 'stage', scope: S2, field: 'rating', value: 9, baseline: null });
    s = reduce(s, {
      type: 'recordResults',
      succeeded: [{ scope: S1, field: 'watched' }],
      failed: [{ scope: S2, field: 'rating', message: 'note must have at most one decimal place' }],
    });
    expect(s.drafts).toEqual({ [S2]: { rating: 9 } });
    expect(s.failures).toEqual([
      { scope: S2, field: 'rating', message: 'note must have at most one decimal place' },
    ]);
  });

  it('clears a recorded failure when the field is re-staged', () => {
    const failed: StagedState = {
      drafts: { [S2]: { rating: 9 } },
      failures: [{ scope: S2, field: 'rating', message: 'boom' }],
    };
    const s = reduce(failed, { type: 'stage', scope: S2, field: 'rating', value: 8, baseline: null });
    expect(s.failures).toEqual([]);
    expect(s.drafts[S2]).toEqual({ rating: 8 });
  });

  it('keeps unrelated failures when one field is re-staged', () => {
    const failed: StagedState = {
      drafts: { [S1]: { watched: true }, [S2]: { rating: 9 } },
      failures: [
        { scope: S1, field: 'watched', message: 'a' },
        { scope: S2, field: 'rating', message: 'b' },
      ],
    };
    const s = reduce(failed, { type: 'stage', scope: S2, field: 'rating', value: 8, baseline: null });
    expect(s.failures).toEqual([{ scope: S1, field: 'watched', message: 'a' }]);
  });

  it('reset empties drafts and failures', () => {
    const dirty: StagedState = {
      drafts: { [S1]: { watched: true } },
      failures: [{ scope: S1, field: 'watched', message: 'x' }],
    };
    expect(reduce(dirty, { type: 'reset' })).toEqual(initialStagedState);
  });
});

describe('deriveChanges', () => {
  it('orders the title first, then seasons numerically, then fields', () => {
    const state: StagedState = {
      drafts: {
        [seasonScope('10')]: { rating: 6 },
        [seasonScope('2')]: { rating: 9, watched: true },
        [TITLE_SCOPE]: { watchedAt: '2026-08-01' },
      },
      failures: [],
    };
    expect(deriveChanges(state).map((c) => [c.scope, c.field])).toEqual([
      [TITLE_SCOPE, 'watchedAt'],
      [seasonScope('2'), 'watched'],
      [seasonScope('2'), 'rating'],
      [seasonScope('10'), 'rating'],
    ]);
  });

  it('labels every field in both directions', () => {
    const state: StagedState = {
      drafts: {
        [TITLE_SCOPE]: { watched: true, watchedAt: '2026-08-01', rating: 8.5 },
        [seasonScope('1')]: { watched: false, watchedAt: '', rating: null },
      },
      failures: [],
    };
    expect(deriveChanges(state).map((c) => c.label)).toEqual([
      'marked watched',
      'watched date 2026-08-01',
      'rating 8.5',
      'marked unwatched',
      'watched date cleared',
      'rating removed',
    ]);
  });

  it('labels scopes for humans', () => {
    const state: StagedState = {
      drafts: { [TITLE_SCOPE]: { watched: true }, [seasonScope('3')]: { watched: true } },
      failures: [],
    };
    expect(deriveChanges(state).map((c) => c.scopeLabel)).toEqual(['Movie', 'Season 3']);
  });

  it('attaches a failure to the change it belongs to', () => {
    const state: StagedState = {
      drafts: { [TITLE_SCOPE]: { watched: true, rating: 9 } },
      failures: [{ scope: TITLE_SCOPE, field: 'rating', message: 'boom' }],
    };
    const changes = deriveChanges(state);
    expect(changes.find((c) => c.field === 'watched')?.failure).toBeUndefined();
    expect(changes.find((c) => c.field === 'rating')?.failure).toBe('boom');
  });

  it('is empty for a clean state', () => {
    expect(deriveChanges(initialStagedState)).toEqual([]);
  });
});
