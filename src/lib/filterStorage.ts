/**
 * Persistence for the watchlist's filter selection.
 *
 * Extracted from `FilterControls` because it was the only non-component export
 * in that file, which defeats React Fast Refresh for the whole module: a mixed
 * module cannot be hot-swapped, so editing the component forced a full reload.
 * Reading and writing localStorage was never a component's concern anyway.
 *
 * Every access is wrapped: localStorage throws outright in a private window and
 * in some embedded webviews, and a stored value can be malformed JSON from an
 * older shape of this app. A filter preference is a convenience, so failing to
 * read one must degrade to "no preference" rather than break the page.
 */

export type StoredFilters = {
  watchedFilter: string;
  orderBy?: string;
  ascending: boolean;
  titleType?: string;
};

const STORAGE_KEY = 'movieFilters';

export const saveFiltersToStorage = (filters: StoredFilters) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch (error) {
    console.error('Error saving filters to localStorage:', error);
  }
};

export const loadFiltersFromStorage = (): StoredFilters | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading filters from localStorage:', error);
  }
  return null;
};

export const clearFiltersFromStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing filters from localStorage:', error);
  }
};
