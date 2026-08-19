import {
  TITLE_SCOPE,
  compareScopes,
  isSeasonScope,
  seasonOf,
  type FieldFailure,
  type ScopeKey,
  type StagedField,
  type StagedState,
} from './stagedEdits';
import type { Rating } from '@/types/movie';

/** What the server currently holds for a scope, for the fields that travel together. */
export type ScopeBaseline = { watched: boolean; watchedAt: string };

export type FlushItem =
  | {
      kind: 'watched';
      scope: ScopeKey;
      season?: number;
      watched: boolean;
      watchedAt: string;
      fields: StagedField[];
    }
  | { kind: 'rating'; scope: ScopeKey; season?: number; note: number; fields: StagedField[] }
  | { kind: 'ratingDelete'; scope: ScopeKey; season?: number; fields: StagedField[] };

const seasonNumber = (scope: ScopeKey): number | undefined =>
  isSeasonScope(scope) ? Number(seasonOf(scope)) : undefined;

/**
 * Turn a draft into the ordered list of API calls that commits it.
 *
 * `watched` and `watchedAt` stage independently but the endpoint takes them
 * together, so a scope with either one staged produces ONE item carrying the
 * other's baseline value. `fields` records which staged fields an item covers,
 * so a result can be attributed back to them precisely — that is what lets a
 * failure stay staged while its neighbours clear.
 *
 * Ordering is watched calls, then rating upserts, then rating deletes: stable,
 * and deletes last so a failed upsert never leaves a scope with neither.
 */
export const planFlush = (
  state: StagedState,
  baselines: Record<ScopeKey, ScopeBaseline>,
): FlushItem[] => {
  const watchedItems: FlushItem[] = [];
  const upserts: FlushItem[] = [];
  const deletes: FlushItem[] = [];

  for (const scope of Object.keys(state.drafts).sort(compareScopes)) {
    const draft = state.drafts[scope];
    const season = seasonNumber(scope);
    const baseline = baselines[scope] ?? { watched: false, watchedAt: '' };

    const watchedFields: StagedField[] = [];
    if ('watched' in draft) watchedFields.push('watched');
    if ('watchedAt' in draft) watchedFields.push('watchedAt');

    if (watchedFields.length > 0) {
      watchedItems.push({
        kind: 'watched',
        scope,
        season,
        watched: draft.watched ?? baseline.watched,
        watchedAt: draft.watchedAt ?? baseline.watchedAt,
        fields: watchedFields,
      });
    }

    if ('rating' in draft) {
      if (draft.rating === null) {
        deletes.push({ kind: 'ratingDelete', scope, season, fields: ['rating'] });
      } else {
        upserts.push({ kind: 'rating', scope, season, note: draft.rating, fields: ['rating'] });
      }
    }
  }

  return [...watchedItems, ...upserts, ...deletes];
};

export const GENERIC_FLUSH_FAILURE_MESSAGE = 'Could not save this change. Please try again.';

export type FlushOutcome = {
  succeeded: Array<{ scope: ScopeKey; field: StagedField }>;
  failed: FieldFailure[];
};

/**
 * Turn one settled promise back into the fields it covers.
 *
 * An item's `fields` succeed or fail as a unit because they were sent as one
 * API call — a `watched` item covering both `watched` and `watchedAt` cannot
 * half-succeed. This is what lets one item's failure stay staged while an
 * unrelated item in the same flush clears normally.
 */
export const attributeOutcome = (
  item: FlushItem,
  outcome: PromiseSettledResult<unknown>,
): FlushOutcome => {
  if (outcome.status === 'fulfilled') {
    return { succeeded: item.fields.map((field) => ({ scope: item.scope, field })), failed: [] };
  }
  const err = outcome.reason;
  const message =
    err instanceof Error && err.message ? err.message : GENERIC_FLUSH_FAILURE_MESSAGE;
  return {
    succeeded: [],
    failed: item.fields.map((field) => ({ scope: item.scope, field, message })),
  };
};

/**
 * Find the rating a `ratingDelete` item removes.
 *
 * Matched on `(userId, titleId, groupId)` — the same scoping `saveOrUpdateRating`
 * uses — so a rating the same user holds on the same title in a *different*
 * group is never picked up and deleted by mistake.
 */
export const findRatingToDelete = (
  ratings: Rating[],
  userId: string,
  titleId: string,
  groupId: string,
): Rating | undefined =>
  ratings.find((r) => r.userId === userId && r.titleId === titleId && r.groupId === groupId);
