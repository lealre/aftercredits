import { describe, expect, it } from 'vitest';
import { TITLE_SCOPE, seasonScope, type StagedState } from './stagedEdits';
import {
  GENERIC_FLUSH_FAILURE_MESSAGE,
  attributeOutcome,
  findRatingToDelete,
  planFlush,
  planRatingDelete,
  type FlushItem,
  type ScopeBaseline,
} from './flushPlan';
import type { Rating } from '@/types/movie';

const S2 = seasonScope('2');
const baselines: Record<string, ScopeBaseline> = {
  [TITLE_SCOPE]: { watched: false, watchedAt: '' },
  [S2]: { watched: true, watchedAt: '2026-01-05' },
};

describe('planFlush', () => {
  it('sends the baseline watchedAt when only watched was staged', () => {
    const state: StagedState = { drafts: { [S2]: { watched: false } }, failures: [] };
    expect(planFlush(state, baselines)).toEqual([
      { kind: 'watched', scope: S2, season: 2, watched: false, watchedAt: '2026-01-05', fields: ['watched'] },
    ]);
  });

  it('sends the baseline watched when only watchedAt was staged', () => {
    const state: StagedState = { drafts: { [S2]: { watchedAt: '' } }, failures: [] };
    expect(planFlush(state, baselines)).toEqual([
      { kind: 'watched', scope: S2, season: 2, watched: true, watchedAt: '', fields: ['watchedAt'] },
    ]);
  });

  it('folds both watched fields into one call', () => {
    const state: StagedState = {
      drafts: { [TITLE_SCOPE]: { watched: true, watchedAt: '2026-08-01' } },
      failures: [],
    };
    const plan = planFlush(state, baselines);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toEqual({
      kind: 'watched', scope: TITLE_SCOPE, season: undefined,
      watched: true, watchedAt: '2026-08-01', fields: ['watched', 'watchedAt'],
    });
  });

  it('plans a rating upsert with a numeric season for a season scope', () => {
    const state: StagedState = { drafts: { [S2]: { rating: 9 } }, failures: [] };
    expect(planFlush(state, baselines)).toEqual([
      { kind: 'rating', scope: S2, season: 2, note: 9, fields: ['rating'] },
    ]);
  });

  it('plans a rating delete when the staged rating is null', () => {
    const state: StagedState = { drafts: { [TITLE_SCOPE]: { rating: null } }, failures: [] };
    expect(planFlush(state, baselines)).toEqual([
      { kind: 'ratingDelete', scope: TITLE_SCOPE, season: undefined, fields: ['rating'] },
    ]);
  });

  it('orders watched calls, then upserts, then deletes', () => {
    const state: StagedState = {
      drafts: {
        [seasonScope('3')]: { rating: null },
        [S2]: { rating: 9 },
        [TITLE_SCOPE]: { watched: true },
      },
      failures: [],
    };
    expect(planFlush(state, baselines).map((i) => i.kind)).toEqual([
      'watched', 'rating', 'ratingDelete',
    ]);
  });

  it('falls back to unwatched-and-undated for a scope with no baseline entry', () => {
    // The normal path, not an edge case: a season only gains a `seasonsWatched`
    // entry once it has been saved, so the first time one is marked watched
    // there is no baseline key for it at all.
    const state: StagedState = { drafts: { [seasonScope('7')]: { watched: true } }, failures: [] };
    expect(planFlush(state, baselines)).toEqual([
      {
        kind: 'watched', scope: seasonScope('7'), season: 7,
        watched: true, watchedAt: '', fields: ['watched'],
      },
    ]);
  });

  it('fills the unstaged half from that same fallback baseline', () => {
    const state: StagedState = {
      drafts: { [seasonScope('7')]: { watchedAt: '2026-08-01' } },
      failures: [],
    };
    expect(planFlush(state, baselines)).toEqual([
      {
        kind: 'watched', scope: seasonScope('7'), season: 7,
        watched: false, watchedAt: '2026-08-01', fields: ['watchedAt'],
      },
    ]);
  });

  it('plans nothing for a clean state', () => {
    expect(planFlush({ drafts: {}, failures: [] }, baselines)).toEqual([]);
  });
});

describe('attributeOutcome', () => {
  const watchedItem: FlushItem = {
    kind: 'watched',
    scope: TITLE_SCOPE,
    watched: true,
    watchedAt: '2026-08-01',
    fields: ['watched', 'watchedAt'],
  };

  it('fans a fulfilled outcome out across every field the item covers', () => {
    const result = attributeOutcome(watchedItem, { status: 'fulfilled', value: undefined });
    expect(result).toEqual({
      succeeded: [
        { scope: TITLE_SCOPE, field: 'watched' },
        { scope: TITLE_SCOPE, field: 'watchedAt' },
      ],
      failed: [],
    });
  });

  it('carries an Error rejection\'s own message onto every field', () => {
    const result = attributeOutcome(watchedItem, {
      status: 'rejected',
      reason: new Error('note must have at most one decimal place'),
    });
    expect(result).toEqual({
      succeeded: [],
      failed: [
        { scope: TITLE_SCOPE, field: 'watched', message: 'note must have at most one decimal place' },
        { scope: TITLE_SCOPE, field: 'watchedAt', message: 'note must have at most one decimal place' },
      ],
    });
  });

  it('falls back to the generic message when the Error has no message', () => {
    const result = attributeOutcome(
      { kind: 'rating', scope: TITLE_SCOPE, note: 9, fields: ['rating'] },
      { status: 'rejected', reason: new Error('') },
    );
    expect(result.failed).toEqual([
      { scope: TITLE_SCOPE, field: 'rating', message: GENERIC_FLUSH_FAILURE_MESSAGE },
    ]);
  });

  it('falls back to the generic message for a non-Error rejection', () => {
    const result = attributeOutcome(
      { kind: 'ratingDelete', scope: TITLE_SCOPE, fields: ['rating'] },
      { status: 'rejected', reason: 'network exploded' },
    );
    expect(result.failed).toEqual([
      { scope: TITLE_SCOPE, field: 'rating', message: GENERIC_FLUSH_FAILURE_MESSAGE },
    ]);
  });
});

describe('findRatingToDelete', () => {
  const rating = (overrides: Partial<Rating>): Rating => ({
    id: 'r1', titleId: 'tt1', userId: 'u1', groupId: 'g1', note: 8, ...overrides,
  });

  it('matches on (userId, titleId, groupId) together', () => {
    const target = rating({ id: 'r-target' });
    // One decoy per term, each sharing the other two with the target and each
    // listed before it: drop any single comparison from the predicate and
    // `find` returns a decoy instead of still passing on a one-row array.
    const found = findRatingToDelete(
      [
        rating({ id: 'r-other-user', userId: 'u2' }),
        rating({ id: 'r-other-title', titleId: 'tt2' }),
        rating({ id: 'r-other-group', groupId: 'g2' }),
        target,
      ],
      'u1',
      'tt1',
      'g1',
    );
    expect(found).toBe(target);
  });

  it('does not match the same user and title in a different group', () => {
    const otherGroup = rating({ id: 'r-other-group', groupId: 'g2' });
    const found = findRatingToDelete([otherGroup], 'u1', 'tt1', 'g1');
    expect(found).toBeUndefined();
  });
});

describe('planRatingDelete', () => {
  it('deletes one season when the item carries a season', () => {
    expect(planRatingDelete('r1', 2)).toEqual({ target: 'season', ratingId: 'r1', season: 2 });
  });

  it('deletes the whole rating row when there is no season', () => {
    expect(planRatingDelete('r1', undefined)).toEqual({ target: 'title', ratingId: 'r1' });
  });

  it('treats season 0 as a season rather than as absent', () => {
    expect(planRatingDelete('r1', 0)).toEqual({ target: 'season', ratingId: 'r1', season: 0 });
  });
});
