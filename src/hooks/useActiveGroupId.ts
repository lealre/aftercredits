import { useSyncExternalStore } from 'react';
import { getGroupId, subscribeToGroupId } from '@/services/authService';

/**
 * Reactive read of the active group id.
 *
 * Reading `getGroupId()` inline during render silently pins a component to whatever
 * group was active when it last rendered: nothing re-renders on a group switch, so
 * query keys keep pointing at the old group while later `getGroupId()` calls (rating
 * and comment predicates) already see the new one, and the two disagree. Subscribing
 * here keeps every consumer on one consistent value.
 */
export const useActiveGroupId = (): string | null =>
  useSyncExternalStore(subscribeToGroupId, getGroupId, getGroupId);
