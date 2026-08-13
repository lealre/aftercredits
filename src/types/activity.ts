/**
 * The group activity feed.
 *
 * Field names mirror the backend's DTOs in
 * internal/services/activity/types.go exactly. The feed deliberately does NOT
 * use the Page envelope the rest of the API uses: it is cursor-paginated by
 * `seq`, so page/size/total have no meaning here.
 */

export interface ActivityEvent {
  id: string;
  /** Total-ordered cursor key. Also the value POST /activity/read takes. */
  seq: number;
  groupId: string;
  groupName: string;
  actorId: string;
  /** The actor's name as it was when the event happened; renames don't propagate. */
  actorName: string;
  kind: ActivityKind | string;
  /** Null only for group-level events, which phase 1 does not emit yet. */
  titleId: string | null;
  titleName: string | null;
  /** Open map; the keys depend on the kind (note, previousNote, season, watched). */
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityFeed {
  /** Always an array — the backend returns [] rather than null when empty. */
  events: ActivityEvent[];
  /** Cursor for the next page; null when the log has been walked to its end. */
  nextBefore: number | null;
  hasMore: boolean;
}

export interface ActivityUnreadCount {
  unread: number;
}

/**
 * What POST /activity/stream-ticket answers with.
 *
 * EventSource cannot send an Authorization header, so the SSE endpoint
 * authenticates by a short-lived, single-use ticket minted through normal
 * Bearer auth instead. `expiresIn` is seconds, and comes from the server so a
 * client cannot assume a TTL the server does not honour.
 */
export interface ActivityStreamTicket {
  ticket: string;
  expiresIn: number;
}

/** The eleven kinds the backend emits (internal/activity/activity.go). */
export type ActivityKind =
  | 'title_added'
  | 'title_removed'
  | 'title_watched_changed'
  | 'rating_added'
  | 'rating_updated'
  | 'rating_deleted'
  | 'rating_season_deleted'
  | 'comment_added'
  | 'comment_updated'
  | 'comment_deleted'
  | 'comment_season_deleted';

/**
 * Thrown when the activity endpoints answer 404 — the backend is running with
 * ACTIVITY_FEED_ENABLED unset, so the feature is off and the UI renders nothing.
 * A distinct type so the hook can tell "switched off" from "broken".
 */
export class ActivityFeatureDisabledError extends Error {
  constructor() {
    super('The activity feed is disabled on this backend');
    this.name = 'ActivityFeatureDisabledError';
  }
}

/**
 * Thrown when the activity endpoints answer 401. Deliberately NOT routed
 * through authFetch's redirect-to-login handling: see activityFetch.
 */
export class ActivitySessionExpiredError extends Error {
  constructor() {
    super('The session expired while polling activity');
    this.name = 'ActivitySessionExpiredError';
  }
}
