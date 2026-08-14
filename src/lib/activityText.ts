import { ActivityEvent } from '@/types/activity';

/**
 * One piece of a feed sentence. A plain string renders as-is; `{ title }`
 * renders as the title, which the UI styles differently (italic).
 */
export type ActivitySegment = string | { title: string };

/**
 * Every payload key this module reads, all of them optional.
 *
 * The payload is an open map whose keys depend on the kind, and rows already
 * stored keep whatever shape they had when they were written. So every read
 * below is guarded and every sentence has a form that works without the key:
 * a missing key drops a clause, it never renders "undefined".
 *
 * | key                 | type    | kinds                                  |
 * | ------------------- | ------- | -------------------------------------- |
 * | `season`            | number  | any kind scoped to one season          |
 * | `note`              | number  | rating_added, rating_updated           |
 * | `previousNote`      | number  | rating_updated                         |
 * | `watched`           | boolean | title_watched_changed                  |
 * | `previousWatched`   | boolean | title_watched_changed (new)            |
 * | `watchedAt`         | string  | title_watched_changed (new)            |
 * | `previousWatchedAt` | string  | title_watched_changed (new)            |
 *
 * `watchedAt`/`previousWatchedAt` are dates — either `YYYY-MM-DD` or a full
 * timestamp; both are accepted.
 */
const numberAt = (event: ActivityEvent, key: string): number | null => {
  const value = event.payload?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const booleanAt = (event: ActivityEvent, key: string): boolean | null => {
  const value = event.payload?.[key];
  return typeof value === 'boolean' ? value : null;
};

const stringAt = (event: ActivityEvent, key: string): string | null => {
  const value = event.payload?.[key];
  return typeof value === 'string' && value !== '' ? value : null;
};

/** A rating as it should appear in a sentence, or null when it is absent. */
const noteAt = (event: ActivityEvent, key: 'note' | 'previousNote'): string | null => {
  const value = numberAt(event, key);
  return value === null ? null : String(value);
};

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A date the way a sentence wants it, or null when it cannot be read.
 *
 * A bare `YYYY-MM-DD` is parsed as UTC midnight by `new Date`, which then
 * renders as the *previous* day everywhere west of Greenwich. A watch date is a
 * calendar date, not an instant, so build it in local time and it keeps the day
 * the user picked.
 */
const formatDate = (raw: string | null): string | null => {
  if (raw === null) return null;

  const parts = DATE_ONLY.exec(raw);
  const date = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : new Date(raw);

  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const titleOf = (event: ActivityEvent): ActivitySegment => ({
  title: event.titleName ?? 'a title',
});

/**
 * What the event is *about*: the title, or one season of it.
 *
 * The season belongs inside the subject ("season 3 of Breaking Bad") rather
 * than trailing the sentence as "(season 3)", which read as an afterthought and
 * left "rated Breaking Bad 8 (season 3)" ambiguous about what was rated.
 */
const subject = (event: ActivityEvent): ActivitySegment[] => {
  const season = numberAt(event, 'season');
  return season === null ? [titleOf(event)] : [`season ${season} of `, titleOf(event)];
};

/**
 * The watched sentence, driven entirely by the payload.
 *
 * Marking something watched and editing the date it was watched on are the same
 * backend event, told apart only by the payload: `previousWatched` says whether
 * it was already watched before this change, and `watchedAt`/`previousWatchedAt`
 * carry the date. An event stored before those keys existed has only `watched`,
 * and falls through to the plain "marked as watched" wording it always had.
 */
const watchedSentence = (event: ActivityEvent, who: string): ActivitySegment[] => {
  const what = subject(event);
  const watchedAt = stringAt(event, 'watchedAt');
  const shown = formatDate(watchedAt);

  if (booleanAt(event, 'watched') === false) {
    return [`${who} marked `, ...what, ' as not watched'];
  }

  // Already watched before this change, so the flag is not what moved: this is
  // an edit of the date. Only a payload carrying the new key reaches here.
  if (booleanAt(event, 'previousWatched') === true) {
    const previous = stringAt(event, 'previousWatchedAt');
    if (shown !== null && watchedAt !== previous) {
      return previous === null
        ? [`${who} set the watch date of `, ...what, ` to ${shown}`]
        : [`${who} changed the watch date of `, ...what, ` to ${shown}`];
    }
    // The date was cleared, or was not sent, or did not actually move. All
    // three are honestly described as an update, and none of them is worth
    // guessing about.
    return [`${who} updated the watch date of `, ...what];
  }

  return shown === null
    ? [`${who} marked `, ...what, ' as watched']
    : [`${who} marked `, ...what, ` as watched on ${shown}`];
};

/**
 * A feed line as segments, so the same sentence can be rendered as styled JSX
 * in the panel and as plain text in a toast without the two drifting apart.
 *
 * Pure and total: it reads nothing but the event, every kind has a branch, and
 * an unrecognised kind degrades to a readable fallback rather than throwing.
 * The backend can add kinds (group and member events are already planned) and
 * an older frontend must keep rendering the rest of the feed.
 */
export const describeActivity = (event: ActivityEvent): ActivitySegment[] => {
  const who = event.actorName;
  const what = subject(event);

  switch (event.kind) {
    // Adding and removing are title-level by construction, so they never carry
    // a season and deliberately do not go through `subject`.
    case 'title_added':
      return [`${who} added `, titleOf(event)];
    case 'title_removed':
      return [`${who} removed `, titleOf(event)];

    case 'title_watched_changed':
      return watchedSentence(event, who);

    case 'rating_added': {
      const note = noteAt(event, 'note');
      return note === null
        ? [`${who} rated `, ...what]
        : [`${who} rated `, ...what, ` with note ${note}`];
    }
    case 'rating_updated': {
      const from = noteAt(event, 'previousNote');
      const to = noteAt(event, 'note');
      if (to === null) return [`${who} changed their note on `, ...what];
      return from === null
        ? [`${who} changed their note on `, ...what, ` to ${to}`]
        : [`${who} changed their note on `, ...what, ` from ${from} to ${to}`];
    }
    case 'rating_deleted':
    case 'rating_season_deleted':
      // One branch for both: the season-scoped kind is the same sentence about
      // a narrower subject, and `subject` has already made that distinction.
      return [`${who} removed their note on `, ...what];

    case 'comment_added':
      return [`${who} commented on `, ...what];
    case 'comment_updated':
      return [`${who} edited their comment on `, ...what];
    case 'comment_deleted':
    case 'comment_season_deleted':
      return [`${who} deleted their comment on `, ...what];

    default:
      return [`${who} did something with `, titleOf(event)];
  }
};

/** The same sentence as a flat string, for toasts and aria labels. */
export const describeActivityText = (event: ActivityEvent): string =>
  describeActivity(event)
    .map((segment) => (typeof segment === 'string' ? segment : segment.title))
    .join('');

export const activityTimeAgo = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};
