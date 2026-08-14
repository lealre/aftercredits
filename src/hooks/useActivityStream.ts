import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  activityStreamUrl,
  fetchActivityFeed,
  fetchActivityStreamTicket,
  fetchActivityUnreadCount,
} from '@/services/backendService';
import {
  ActivityEvent,
  ActivityFeed,
  ActivityFeatureDisabledError,
  ActivitySessionExpiredError,
  ActivityUnreadCount,
} from '@/types/activity';

/**
 * Rows fetched per feed page — and the size of the snapshot each connection
 * takes.
 *
 * It lives here rather than in useActivityFeed because this module is what
 * seeds the feed's cache entry on connect, and the two must agree; a snapshot
 * of a different size than the panel's own query would make the first page
 * change length depending on which of them wrote it last.
 */
export const ACTIVITY_PAGE_SIZE = 15;

/**
 * The two cache entries the stream writes into.
 *
 * The stream deliberately does not own any state of its own: it pushes into
 * the same TanStack entries the phase 1 queries read, so the bell and the
 * panel update with no wiring between the hooks. Exported so useActivityFeed
 * keys its queries off exactly these and they cannot drift apart.
 */
export const ACTIVITY_UNREAD_COUNT_KEY = ['activity', 'unread-count'] as const;
export const ACTIVITY_FEED_FIRST_KEY = ['activity', 'feed', 'first'] as const;

/**
 * How many connection attempts may fail before we accept that streaming does
 * not work here and let polling take over.
 *
 * Three, not one: a single failure is a server restart, a laptop lid, or a
 * flaky minute of wifi, and dropping to polling for that would make the normal
 * path the exceptional one. Three consecutive failures — spread over the
 * backoff below, so several seconds of trying — is a proxy or a network that
 * genuinely will not carry a stream.
 */
const DEGRADED_AFTER_FAILURES = 3;

/** First reconnect delay; doubles per consecutive failure up to the cap. */
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

/**
 * How long a connection must stay up before it counts as working.
 *
 * Without this, "did it open?" would be the health test, and a proxy that
 * accepts a connection and cuts it a moment later would reset the failure
 * counter every time: no backoff, no degraded mode, and a ticket plus a
 * snapshot every second forever. A connection that flaps is a connection that
 * is failing, so only one that survives this long clears the counter.
 */
const STABLE_CONNECTION_MS = 5_000;

/** Newest first, the order the feed API returns and the panel renders. */
const bySeqDesc = (a: ActivityEvent, b: ActivityEvent) => b.seq - a.seq;

const parseEvent = (data: string): ActivityEvent | null => {
  try {
    return JSON.parse(data) as ActivityEvent;
  } catch {
    // A frame we cannot read is not worth ending a healthy stream over; the
    // next snapshot has the event anyway.
    return null;
  }
};

export interface ActivityStreamState {
  /**
   * A stream is open. While this is true the unread count must NOT poll —
   * pushes keep it current, and that is the point of the whole task.
   */
  live: boolean;
  /**
   * Streaming is not working here (repeated failures, or a backend without the
   * stream routes). The caller should fall back to phase 1 polling so the
   * feature degrades to slower rather than to nothing.
   */
  degraded: boolean;
  /**
   * The session expired. Nothing about activity will work again until the user
   * re-authenticates, so the stream stops for good rather than reconnecting
   * against a dead token.
   */
  unavailable: boolean;
}

/**
 * Live activity delivery over SSE.
 *
 * ## Lifecycle
 *
 * 1. **Mint a ticket** (`POST /activity/stream-ticket`, normal Bearer auth).
 *    EventSource cannot set an Authorization header, which is the entire
 *    reason tickets exist. Tickets are single-use with a short TTL, so every
 *    connect and every reconnect mints a fresh one — none is ever reused.
 * 2. **Open the EventSource** on `/activity/stream?ticket=…`.
 * 3. **On `open`, take the snapshot** — newest feed page + unread count — and
 *    merge it with anything pushed since, deduplicating by event id.
 *
 * The order is load-bearing. Reading *first* leaves a window where an event
 * lands after the read but before the stream exists and is lost with nothing
 * to notice it. Connecting first means every event is either in the snapshot
 * (committed before its query ran) or on the stream (committed after) —
 * nothing can fall between them. They can overlap, hence the dedupe.
 *
 * The same sequence runs on every reconnect, which is what replaces
 * `Last-Event-ID` replay: the backend has no replay path, on purpose.
 *
 * ## Reconnect
 *
 * EventSource reconnects on its own, and normally you let it. Here you cannot:
 * its retry re-requests the *same URL*, whose ticket was consumed by the
 * connection that just died, so every browser-driven retry is a guaranteed
 * 401. So on `error` we close the source — which guarantees there is never
 * more than one connection alive — and reconnect ourselves with a fresh ticket
 * on an exponential backoff. One loop, not two.
 *
 * ## Own events
 *
 * The backend's hub already drops events whose actor is the subscriber, with
 * the same predicate the feed query uses. So everything that arrives here is
 * both visible to this user and not their own: it counts as unread, and it is
 * worth announcing.
 *
 * @param enabled  false tears the stream down (logged out, feature off).
 * @param onEvent  called once per pushed event, for the toast. Held in a ref,
 *                 so an unstable callback does not reconnect the stream.
 */
export const useActivityStream = (
  enabled: boolean,
  onEvent?: (event: ActivityEvent) => void
): ActivityStreamState => {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || unavailable) return;

    // Everything below is scoped to this effect run. `cancelled` is checked
    // after every await and in every callback: an async continuation that
    // resolves after cleanup must not touch the cache or open a socket.
    let cancelled = false;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let stableTimer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    /** Events pushed between `open` and the snapshot landing. */
    let buffered: ActivityEvent[] = [];
    let awaitingSnapshot = false;
    /** Ids already folded in on this connection; guards a duplicate frame. */
    const seen = new Set<string>();

    const scheduleReconnect = () => {
      if (cancelled) return;

      failures += 1;
      if (failures >= DEGRADED_AFTER_FAILURES) setDegraded(true);

      const backoff = Math.min(
        RECONNECT_BASE_MS * 2 ** (failures - 1),
        RECONNECT_MAX_MS
      );
      // Jitter, so two tabs (or every client after a backend restart) do not
      // retry in lockstep.
      retryTimer = setTimeout(() => void connect(), backoff * (0.5 + Math.random()));
    };

    const drop = (es: EventSource) => {
      clearTimeout(stableTimer);
      es.close();
      if (source === es) source = null;
      setLive(false);
    };

    const applyEvent = (event: ActivityEvent) => {
      if (seen.has(event.id)) return;
      seen.add(event.id);

      // The panel's first page. When it is absent — the panel has not been
      // opened, or its entry was garbage collected — the updater bails and the
      // panel simply fetches when it opens.
      queryClient.setQueryData<ActivityFeed>(ACTIVITY_FEED_FIRST_KEY, (feed) => {
        if (!feed || feed.events.some((existing) => existing.id === event.id)) return feed;
        return { ...feed, events: [event, ...feed.events].sort(bySeqDesc) };
      });

      // Every pushed event is unread by construction (see the doc comment), so
      // the badge can be bumped without asking the server.
      queryClient.setQueryData<ActivityUnreadCount>(ACTIVITY_UNREAD_COUNT_KEY, (count) =>
        count ? { unread: count.unread + 1 } : count
      );

      onEventRef.current?.(event);
    };

    const takeSnapshot = async (es: EventSource) => {
      let feed: ActivityFeed;
      let count: ActivityUnreadCount;
      try {
        [feed, count] = await Promise.all([
          fetchActivityFeed({ limit: ACTIVITY_PAGE_SIZE }),
          fetchActivityUnreadCount(),
        ]);
      } catch (error) {
        if (cancelled || source !== es) return;
        if (error instanceof ActivitySessionExpiredError) {
          drop(es);
          setUnavailable(true);
          return;
        }
        // A stream with no snapshot behind it has no base to merge into, so
        // the connection is useless. Drop it and start over — the events it
        // would have carried are still in the log and the next snapshot has
        // them.
        drop(es);
        scheduleReconnect();
        return;
      }
      // A newer connection owns the cache by now; this snapshot is stale.
      if (cancelled || source !== es) return;

      const pushed = buffered;
      buffered = [];
      awaitingSnapshot = false;

      const inSnapshot = new Set(feed.events.map((event) => event.id));
      feed.events.forEach((event) => seen.add(event.id));

      // Pushed events the snapshot did not already contain. These are the only
      // ones the server's count has not counted yet.
      const extra = pushed.filter((event) => !inSnapshot.has(event.id));
      extra.forEach((event) => seen.add(event.id));

      queryClient.setQueryData<ActivityFeed>(ACTIVITY_FEED_FIRST_KEY, {
        ...feed,
        events: [...extra, ...feed.events].sort(bySeqDesc),
      });
      queryClient.setQueryData<ActivityUnreadCount>(ACTIVITY_UNREAD_COUNT_KEY, {
        unread: count.unread + extra.length,
      });
    };

    const connect = async () => {
      if (cancelled) return;

      let ticket: string;
      try {
        ticket = (await fetchActivityStreamTicket()).ticket;
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ActivitySessionExpiredError) {
          setUnavailable(true);
          return;
        }
        if (error instanceof ActivityFeatureDisabledError) {
          // 404: this backend has the feed but no stream routes (the feature
          // is off, or it predates phase 2). Retrying cannot help, but going
          // silent would leave a bell that never updates — so hand over to
          // polling permanently.
          setDegraded(true);
          return;
        }
        scheduleReconnect();
        return;
      }
      if (cancelled) return;

      const es = new EventSource(activityStreamUrl(ticket));
      source = es;

      es.addEventListener('open', () => {
        if (cancelled || source !== es) return;

        setLive(true);
        // Not cleared here: opening is not the same as working. A connection
        // that survives STABLE_CONNECTION_MS is.
        clearTimeout(stableTimer);
        stableTimer = setTimeout(() => {
          if (cancelled || source !== es) return;
          failures = 0;
          setDegraded(false);
        }, STABLE_CONNECTION_MS);

        seen.clear();
        buffered = [];
        awaitingSnapshot = true;
        void takeSnapshot(es);
      });

      // The frames are named `activity`, so onmessage would never fire.
      es.addEventListener('activity', (message) => {
        if (cancelled || source !== es) return;

        const event = parseEvent((message as MessageEvent<string>).data);
        if (!event) return;

        if (awaitingSnapshot) {
          // Merged when the snapshot lands, so it cannot be double-counted
          // against a count that may already include it. Announced now, since
          // it did arrive live.
          buffered.push(event);
          onEventRef.current?.(event);
          return;
        }
        applyEvent(event);
      });

      es.addEventListener('error', () => {
        if (cancelled || source !== es) return;
        // Do not leave the browser to retry: the ticket in this URL is spent,
        // so its retry would 401. Close, then reconnect with a fresh one.
        drop(es);
        scheduleReconnect();
      });
    };

    void connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      clearTimeout(stableTimer);
      // Without this the connection outlives the component and the backend
      // keeps a hub subscriber (and its channel) for a client nobody reads.
      source?.close();
      source = null;
      setLive(false);
    };
  }, [enabled, unavailable, queryClient]);

  return { live, degraded, unavailable };
};
