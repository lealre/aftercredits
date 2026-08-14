/**
 * Rating notes are one-decimal values, and that is a contract, not a hint.
 *
 * The backend rejects any caller-supplied note with more than one decimal
 * (`ErrNoteTooPrecise`, 400). `step="0.1"` on a number input does not enforce
 * it — a browser only validates `step` on form submission, and typing `8.55`
 * into a free-standing input sails straight through `parseFloat`. So the UI has
 * to do the constraining itself, and this is the one function that does it.
 *
 * Note the asymmetry with the backend, which is deliberate on its side: it
 * *rounds* values it derives itself (a series' overall note is the mean of its
 * seasons, routinely not one decimal) and *rejects* values a caller typed.
 * Everything this app sends is the typed kind, so rounding here is what keeps
 * the user from ever seeing that rejection.
 */

/** Lowest and highest note the backend accepts (`ErrInvalidNoteValue`). */
export const MIN_NOTE = 0;
export const MAX_NOTE = 10;

/**
 * Round to one decimal place.
 *
 * `* 10` before rounding rather than `toFixed(1)`: toFixed returns a string,
 * and a string that has to be parsed back is one more place for a bad value to
 * appear. Values already at one decimal pass through unchanged (6.7 * 10 is
 * 67.00000000000001, which rounds to 67 and divides back to exactly 6.7).
 */
export const roundToOneDecimal = (note: number): number => Math.round(note * 10) / 10;

/**
 * The single gate every user-typed note passes through before it is shown or
 * sent: clamped into range, then rounded to one decimal.
 *
 * Total by construction — a non-finite input (NaN from a half-typed number,
 * Infinity from a pasted one) yields MIN_NOTE rather than propagating.
 */
export const normalizeNote = (note: number): number => {
  if (!Number.isFinite(note)) return MIN_NOTE;
  return roundToOneDecimal(Math.min(MAX_NOTE, Math.max(MIN_NOTE, note)));
};
