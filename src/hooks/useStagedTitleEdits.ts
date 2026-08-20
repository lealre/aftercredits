import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import {
  deriveChanges,
  initialStagedState,
  stagedEditsReducer,
  type Change,
  type FieldFailure,
  type ScopeDraft,
  type ScopeKey,
  type StagedField,
} from '@/lib/stagedEdits';
import {
  attributeOutcome,
  findRatingToDelete,
  planFlush,
  planRatingDelete,
  type FlushItem,
  type ScopeBaseline,
} from '@/lib/flushPlan';
import {
  deleteRating,
  deleteRatingSeason,
  saveOrUpdateRating,
  updateMovieWatchedStatus,
} from '@/services/backendService';
import type { Rating } from '@/types/movie';

type StageOverload = {
  (scope: ScopeKey, field: 'watched', value: boolean, baseline: boolean): void;
  (scope: ScopeKey, field: 'watchedAt', value: string, baseline: string): void;
  (scope: ScopeKey, field: 'rating', value: number, baseline: number | null): void;
};

type FlushResult = { ok: boolean; failed: FieldFailure[] };

/**
 * Resolve which API call an item's `kind` maps to.
 *
 * A miss on `ratingDelete` is a settled failure, not a thrown error: the
 * caller drives everything through `allSettled`, and throwing here would take
 * the rest of the batch down with it.
 *
 * The `default` branch is an exhaustiveness guard, not dead code. `strict` is
 * off in this project's tsconfig, so a missed case here would otherwise
 * compile, fall through, return `undefined`, and `Promise.allSettled` would
 * record that as *fulfilled* — `attributeOutcome` would then clear that item's
 * fields from the draft even though no request was ever sent. Assigning
 * `item` to a `never`-typed binding makes a future, unhandled `FlushItem`
 * kind a compile error instead of a silent lost write.
 */
const runItem = (
  item: FlushItem,
  ctx: { groupId: string; titleId: string; userId: string; ratings: Rating[] },
): Promise<unknown> => {
  switch (item.kind) {
    case 'watched':
      return updateMovieWatchedStatus(ctx.groupId, ctx.titleId, item.watched, item.watchedAt, item.season);

    case 'rating':
      return saveOrUpdateRating(
        { groupId: ctx.groupId, titleId: ctx.titleId, note: item.note, userId: ctx.userId, season: item.season },
        ctx.ratings,
      );

    case 'ratingDelete': {
      const existing = findRatingToDelete(ctx.ratings, ctx.userId, ctx.titleId, ctx.groupId);
      if (!existing) {
        return Promise.reject(new Error('This rating no longer exists. Reload and try again.'));
      }
      const call = planRatingDelete(existing.id, item.season);
      return call.target === 'season'
        ? deleteRatingSeason(call.ratingId, call.season)
        : deleteRating(call.ratingId);
    }

    default: {
      const _exhaustive: never = item;
      return Promise.reject(new Error('Unhandled flush item kind.'));
    }
  }
};

/**
 * The impure shell around `stagedEditsReducer`: holds the draft for one
 * title's modal and turns it into API calls on demand.
 *
 * `groupId` is not part of `ScopeKey`, so a draft staged while looking at one
 * group would otherwise survive switching to another and flush against it —
 * a rating silently written into the wrong group. The render-time reset
 * dispatch below is what prevents that; it fires on `groupId` changing, not on
 * mount. It is deliberately not an effect: an effect runs after commit, so
 * there would be one render in which `flush` still sees the old group's
 * draft.
 */
export const useStagedTitleEdits = (args: {
  groupId: string | null;
  titleId: string;
  userId: string | null;
  ratings: Rating[];
  baselines: Record<ScopeKey, ScopeBaseline>;
}) => {
  const { groupId, titleId, userId, ratings, baselines } = args;

  const [state, dispatch] = useReducer(stagedEditsReducer, initialStagedState);
  const [saving, setSaving] = useState(false);

  // `flush` reads every one of these through a ref, assigned right here during
  // render rather than in a passive effect. An effect runs after commit, so
  // between a commit and the effect — a handler that stages and then calls
  // `flush()` in the same tick, or a parent's layout/passive effect that runs
  // before this hook's — the ref would still hold the *previous* render's
  // value. Mirroring during render closes that window. All six are mirrored,
  // not just the draft: a stale `groupId` read here would pair the old group
  // with the current draft and flush into the wrong one, which is exactly the
  // bug this pattern exists to prevent.
  const stateRef = useRef(state);
  stateRef.current = state;

  const ratingsRef = useRef(ratings);
  ratingsRef.current = ratings;

  const baselinesRef = useRef(baselines);
  baselinesRef.current = baselines;

  const groupIdRef = useRef(groupId);
  groupIdRef.current = groupId;

  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const titleIdRef = useRef(titleId);
  titleIdRef.current = titleId;

  // Skip the first render: this only guards against a *later* group switch
  // leaving a stale draft behind, not the initial mount.
  const mountedGroupId = useRef(groupId);
  if (mountedGroupId.current !== groupId) {
    mountedGroupId.current = groupId;
    // A dispatch during render, not a follow-up effect: the change is
    // immediate and doesn't leave a one-render window where the stale draft
    // from the old group is still what `state` (and `flush`) sees.
    dispatch({ type: 'reset' });
  }

  const changes: Change[] = useMemo(() => deriveChanges(state), [state]);
  const changeCount = changes.length;
  const isDirty = changeCount > 0;

  const fieldValue = useCallback(
    (scope: ScopeKey, field: StagedField): ScopeDraft[StagedField] | undefined =>
      state.drafts[scope]?.[field],
    [state.drafts],
  );

  const isStaged = useCallback(
    (scope: ScopeKey, field: StagedField): boolean => state.drafts[scope]?.[field] !== undefined,
    [state.drafts],
  );

  const stage = useCallback((scope: ScopeKey, field: StagedField, value: unknown, baseline: unknown) => {
    dispatch({ type: 'stage', scope, field, value, baseline } as never);
  }, []) as StageOverload;

  const stageRatingDelete = useCallback((scope: ScopeKey, hasExistingRating: boolean) => {
    dispatch({ type: 'stageRatingDelete', scope, hasExistingRating });
  }, []);

  const unstage = useCallback((scope: ScopeKey, field: StagedField) => {
    dispatch({ type: 'unstage', scope, field });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'reset' });
  }, []);

  // Empty deps is deliberate: every value flush needs comes off a ref mirrored
  // during render (see above), so the function's identity never has to change
  // for it to see current data.
  const flush = useCallback(async (): Promise<FlushResult> => {
    const groupId = groupIdRef.current;
    const userId = userIdRef.current;
    const titleId = titleIdRef.current;

    if (!groupId || !userId) {
      return { ok: false, failed: [] };
    }

    setSaving(true);
    try {
      const items = planFlush(stateRef.current, baselinesRef.current);
      const outcomes = await Promise.allSettled(
        items.map((item) => runItem(item, { groupId, titleId, userId, ratings: ratingsRef.current })),
      );

      const succeeded: Array<{ scope: ScopeKey; field: StagedField }> = [];
      const failed: FieldFailure[] = [];
      items.forEach((item, index) => {
        const result = attributeOutcome(item, outcomes[index]);
        succeeded.push(...result.succeeded);
        failed.push(...result.failed);
      });

      dispatch({ type: 'recordResults', succeeded, failed });
      return { ok: failed.length === 0, failed };
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    draft: state.drafts,
    changes,
    changeCount,
    isDirty,
    failures: state.failures,
    saving,
    fieldValue,
    isStaged,
    stage,
    stageRatingDelete,
    unstage,
    reset,
    flush,
  };
};
