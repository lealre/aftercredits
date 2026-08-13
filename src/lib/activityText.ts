import { ActivityEvent } from '@/types/activity';

/**
 * One piece of a feed sentence. A plain string renders as-is; `{ title }`
 * renders as the title, which the UI styles differently (italic).
 */
export type ActivitySegment = string | { title: string };

const season = (event: ActivityEvent): string => {
  const value = event.payload?.season;
  return typeof value === 'number' ? ` (season ${value})` : '';
};

const note = (event: ActivityEvent, key: 'note' | 'previousNote'): string => {
  const value = event.payload?.[key];
  return typeof value === 'number' ? String(value) : '?';
};

/**
 * A feed line as segments, so the same sentence can be rendered as styled JSX
 * in the panel and as plain text in a toast without the two drifting apart.
 *
 * An unrecognised kind degrades to a readable fallback rather than throwing:
 * the backend can add kinds (group and member events are already planned) and
 * an older frontend must keep rendering the rest of the feed.
 */
export const describeActivity = (event: ActivityEvent): ActivitySegment[] => {
  const who = event.actorName;
  const title = { title: event.titleName ?? 'a title' };

  switch (event.kind) {
    case 'title_added':
      return [`${who} added `, title];
    case 'title_removed':
      return [`${who} removed `, title];
    case 'title_watched_changed':
      return event.payload?.watched === false
        ? [`${who} marked `, title, ` as not watched${season(event)}`]
        : [`${who} marked `, title, ` as watched${season(event)}`];
    case 'rating_added':
      return [`${who} rated `, title, ` ${note(event, 'note')}${season(event)}`];
    case 'rating_updated':
      return [
        `${who} changed their rating of `,
        title,
        ` from ${note(event, 'previousNote')} to ${note(event, 'note')}${season(event)}`,
      ];
    case 'rating_deleted':
      return [`${who} removed their rating of `, title];
    case 'rating_season_deleted':
      return [`${who} removed their rating of `, title, season(event)];
    case 'comment_added':
      return [`${who} commented on `, title, season(event)];
    case 'comment_updated':
      return [`${who} edited their comment on `, title, season(event)];
    case 'comment_deleted':
      return [`${who} deleted their comment on `, title];
    case 'comment_season_deleted':
      return [`${who} deleted their comment on `, title, season(event)];
    default:
      return [`${who} did something with `, title];
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
