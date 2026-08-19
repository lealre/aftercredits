import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
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
import { planFlush, type FlushItem, type ScopeBaseline } from '@/lib/flushPlan';
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
 * One field failure per item field, for a settled outcome.
 *
 * `fields` is the whole point: an item's fields succeed or fail together as
 * one API call, but the caller needs per-field results to leave an unrelated
 * staged edit alone when its neighbour's save fails.
 */
const attribute = (
  item: FlushItem,
  outcome: PromiseSettledResult<unknown>,
): { succeeded: Array<{ scope: ScopeKey; field: StagedField }>; failed: FieldFailure[] } => {
  if (outcome.status === 'fulfilled') {
    return { succeeded: item.fields.map((field) => ({ scope: item.scope, field })), failed: [] };
  }
  const err = outcome.reason;
  const message =
    err instanceof Error && err.message ? err.message : 'Could not save this change. Please try again.';
  return {
    succeeded: [],
    failed: item.fields.map((field) => ({ scope: item.scope, field, message })),
  };
};

/**
 * Resolve which API call an item's `kind` maps to.
 *
 * `ratingDelete` needs the rating's id, which isn't in the plan (the plan is
 * pure and doesn't know about `Rating[]`) — it's looked up here by
 * `(userId, titleId, groupId)`, the same scoping `saveOrUpdateRating` already
 * uses, so a rating from a different group is never a match. A miss is a
 * settled failure, not a thrown error: the caller drives everything through
 * `allSettled`, and throwing here would take the rest of the batch down with it.
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
      const existing = ctx.ratings.find(
        (r) => r.userId === ctx.userId && r.titleId === ctx.titleId && r.groupId === ctx.groupId,
      );
      if (!existing) {
        return Promise.reject(new Error('This rating no longer exists. Reload and try again.'));
      }
      return item.season !== undefined
        ? deleteRatingSeason(existing.id, item.season)
        : deleteRating(existing.id);
    }
  }
};

/**
 * The impure shell around `stagedEditsReducer`: holds the draft for one
 * title's modal and turns it into API calls on demand.
 *
 * `groupId` is not part of `ScopeKey`, so a draft staged while looking at one
 * group would otherwise survive switching to another and flush against it —
 * a rating silently written into the wrong group. The reset effect below is
 * what prevents that; it fires on `groupId` changing, not on mount.
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

  // flush() is called from event handlers, well after the render that created
  // it — without this mirror it would close over whatever `state` was at the
  // last useCallback recompute, which planFlush would then flush stale.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const ratingsRef = useRef(ratings);
  useEffect(() => {
    ratingsRef.current = ratings;
  }, [ratings]);

  const baselinesRef = useRef(baselines);
  useEffect(() => {
    baselinesRef.current = baselines;
  }, [baselines]);

  // Skip the first render: this only guards against a *later* group switch
  // leaving a stale draft behind, not the initial mount.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    dispatch({ type: 'reset' });
  }, [groupId]);

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

  const flush = useCallback(async (): Promise<FlushResult> => {
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
        const result = attribute(item, outcomes[index]);
        succeeded.push(...result.succeeded);
        failed.push(...result.failed);
      });

      dispatch({ type: 'recordResults', succeeded, failed });
      return { ok: failed.length === 0, failed };
    } finally {
      setSaving(false);
    }
  }, [groupId, titleId, userId]);

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
