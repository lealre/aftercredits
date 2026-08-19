/**
 * The draft behind the movie modal's single Save button.
 *
 * The invariant everything else depends on: `drafts` holds ONLY fields whose
 * value differs from the server baseline. Staging a value equal to the baseline
 * removes the field (and the scope, once empty), so toggling watched on and off
 * again leaves the state genuinely clean — Save re-disables and nothing is sent.
 * That is what makes the footer's change count and the flush payload the same
 * fact rather than two guesses at it.
 *
 * The baseline arrives IN THE ACTION rather than living in state. Server data
 * refreshes after every save, and a baseline held in state would go stale
 * against it; passing it per action keeps this a pure function of its inputs.
 */

/** A draft applies either to the title itself or to one season of it. */
export type ScopeKey = string;

export const TITLE_SCOPE: ScopeKey = 'title';
export const seasonScope = (season: string): ScopeKey => `season:${season}`;
export const isSeasonScope = (scope: ScopeKey): boolean => scope.startsWith('season:');
export const seasonOf = (scope: ScopeKey): string => scope.slice('season:'.length);

export type StagedField = 'watched' | 'watchedAt' | 'rating';

export type ScopeDraft = {
  watched?: boolean;
  watchedAt?: string;        // '' means cleared
  rating?: number | null;    // null means staged deletion
};

export type FieldFailure = {
  scope: ScopeKey;
  field: StagedField;
  message: string;
};

export type StagedState = {
  drafts: Record<ScopeKey, ScopeDraft>;
  failures: FieldFailure[];
};

export const initialStagedState: StagedState = { drafts: {}, failures: [] };

export type StagedAction =
  | { type: 'stage'; scope: ScopeKey; field: 'watched'; value: boolean; baseline: boolean }
  | { type: 'stage'; scope: ScopeKey; field: 'watchedAt'; value: string; baseline: string }
  | { type: 'stage'; scope: ScopeKey; field: 'rating'; value: number; baseline: number | null }
  | { type: 'stageRatingDelete'; scope: ScopeKey; hasExistingRating: boolean }
  | { type: 'unstage'; scope: ScopeKey; field: StagedField }
  | {
      type: 'recordResults';
      succeeded: Array<{ scope: ScopeKey; field: StagedField }>;
      failed: FieldFailure[];
    }
  | { type: 'reset' };

/** Remove one field, and the scope entry with it once nothing is left. */
const withoutField = (
  drafts: Record<ScopeKey, ScopeDraft>,
  scope: ScopeKey,
  field: StagedField,
): Record<ScopeKey, ScopeDraft> => {
  const draft = drafts[scope];
  if (!draft || !(field in draft)) return drafts;

  const { [field]: _removed, ...rest } = draft;
  const next = { ...drafts };
  if (Object.keys(rest).length === 0) {
    delete next[scope];
  } else {
    next[scope] = rest;
  }
  return next;
};

const clearFailure = (
  failures: FieldFailure[],
  scope: ScopeKey,
  field: StagedField,
): FieldFailure[] => {
  const kept = failures.filter((f) => !(f.scope === scope && f.field === field));
  return kept.length === failures.length ? failures : kept;
};

export const stagedEditsReducer = (state: StagedState, action: StagedAction): StagedState => {
  switch (action.type) {
    case 'stage': {
      const failures = clearFailure(state.failures, action.scope, action.field);
      if (action.value === action.baseline) {
        return { drafts: withoutField(state.drafts, action.scope, action.field), failures };
      }
      return {
        drafts: {
          ...state.drafts,
          [action.scope]: { ...state.drafts[action.scope], [action.field]: action.value },
        },
        failures,
      };
    }

    case 'stageRatingDelete': {
      // Nothing to delete is not an edit — leave the state identically alone so
      // a stray click cannot make the modal dirty.
      if (!action.hasExistingRating) return state;
      return {
        drafts: {
          ...state.drafts,
          [action.scope]: { ...state.drafts[action.scope], rating: null },
        },
        failures: clearFailure(state.failures, action.scope, 'rating'),
      };
    }

    case 'unstage':
      return {
        drafts: withoutField(state.drafts, action.scope, action.field),
        failures: clearFailure(state.failures, action.scope, action.field),
      };

    case 'recordResults': {
      let drafts = state.drafts;
      for (const { scope, field } of action.succeeded) {
        drafts = withoutField(drafts, scope, field);
      }
      return { drafts, failures: action.failed };
    }

    case 'reset':
      return initialStagedState;
  }
};
