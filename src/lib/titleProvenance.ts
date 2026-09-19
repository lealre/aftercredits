import type { TitleAuthor } from "@/types/movie";

/**
 * The lines shown when someone opens a title's provenance.
 *
 * Both halves are optional and independently so. A title added before the
 * backend recorded authorship has a date but no author; one whose date failed
 * to parse has neither. Returning null for "nothing to say" lets the caller
 * omit the affordance entirely rather than offer an empty panel.
 */
export type Provenance = {
  who: string | null;
  when: string | null;
};

/** One line of provenance: who did a thing, and when. */
export type ProvenanceLine = Provenance;

const formatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function titleProvenance(
  addedBy: TitleAuthor | null | undefined,
  addedDate: string | null | undefined,
): Provenance | null {
  const who = addedBy?.username?.trim() ? addedBy.username : null;

  let when: string | null = null;
  if (addedDate) {
    const parsed = new Date(addedDate);
    // An unparseable date yields NaN, which Intl renders as "Invalid Date".
    // Showing nothing is better than showing that.
    if (!Number.isNaN(parsed.getTime())) {
      when = formatter.format(parsed);
    }
  }

  if (!who && !when) return null;
  return { who, when };
}

/**
 * Who marked the title watched, and when.
 *
 * Deliberately the same shape as titleProvenance, because the caller renders
 * both identically. Kept as its own function rather than a flag so the two
 * cannot silently swap their wording — "added by" and "marked watched by" mean
 * different things, and watched is a fact about the GROUP rather than a claim
 * that one person saw it.
 */
export function watchedProvenance(
  markedBy: TitleAuthor | null | undefined,
  watchedAt: string | null | undefined,
): Provenance | null {
  return titleProvenance(markedBy, watchedAt);
}
