import { describe, expect, it } from 'vitest';
import { TITLE_SCOPE, seasonScope, type StagedState } from './stagedEdits';
import { planFlush, type ScopeBaseline } from './flushPlan';

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

  it('plans nothing for a clean state', () => {
    expect(planFlush({ drafts: {}, failures: [] }, baselines)).toEqual([]);
  });
});
