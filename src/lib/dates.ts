/**
 * The one conversion between how the backend states a watched date and what a
 * date input will accept.
 *
 * `watched_at` is a `timestamptz`, so the API sends RFC 3339 —
 * `"2026-01-21T00:00:00Z"`. An `<input type="date">` accepts ONLY `yyyy-MM-dd`
 * and renders completely blank for anything else, with no error and no clue: a
 * title with a perfectly good watched date showed an empty box.
 *
 * Truncating the string rather than going through `Date` is deliberate. The
 * backend stores these at midnight UTC, so `new Date(v).getFullYear()` and
 * friends would shift the day backwards for every user west of UTC — the date
 * you saved would display as the day before. There is no time-of-day
 * information in a watched date to preserve, so the calendar date the server
 * sent is the calendar date to show.
 */

/** `yyyy-MM-dd`, the only shape `<input type="date">` will display. */
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalize a backend date to what a date input can show, or `''` when there
 * is nothing to show.
 *
 * Total by construction: an absent value, an empty string, or a string that is
 * not a recognisable date all yield `''` — an empty input rather than an input
 * silently refusing a value it was handed.
 */
export const toDateInputValue = (value?: string | null): string => {
  if (!value) return '';
  const datePart = value.slice(0, 10);
  return DATE_INPUT_PATTERN.test(datePart) ? datePart : '';
};
