/**
 * Identity of everything that changes WHICH titles a list shows, as opposed to
 * which slice of them. When it changes, the current page number stops meaning
 * anything and must go back to 1.
 *
 * Page and page size are deliberately absent: they select a slice of the same
 * result set, so changing them must not reset the page.
 */
export function listFilterKey(filters: {
  groupId: string | null | undefined;
  watched: boolean | undefined;
  titleType: string | undefined;
  orderBy: string | undefined;
  ascending: boolean | undefined;
}): string {
  return JSON.stringify([
    filters.groupId ?? null,
    filters.watched ?? null,
    filters.titleType ?? null,
    filters.orderBy ?? null,
    filters.ascending ?? null,
  ]);
}
