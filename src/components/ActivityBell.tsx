import { useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { saveGroupId } from '@/services/authService';
import { useActivityUnreadCount, useActivityFeedPanel } from '@/hooks/useActivityFeed';
import { activityTimeAgo, describeActivity, describeActivityText } from '@/lib/activityText';
import { ActivityEvent } from '@/types/activity';

/** Badge caps out rather than widening the bell for a big number. */
const BADGE_MAX = 9;

/**
 * The activity bell: an unread badge in the header, and a panel listing what
 * other members of your groups have been doing.
 *
 * Renders nothing at all when the backend has the feature switched off (its
 * routes 404) or the session has expired — a broken bell is worse than none.
 */
export const ActivityBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { unread, unavailable } = useActivityUnreadCount();
  const {
    events,
    isLoading,
    isError,
    hasMore,
    nextBefore,
    loadMore,
    isLoadingMore,
    markRead,
    markAllRead,
    canMarkAllRead,
    reset,
  } = useActivityFeedPanel(open);

  if (unavailable) return null;

  /**
   * Opening the panel loads the feed and nothing else — deliberately.
   *
   * Marking things read on open would clear activity the user never actually
   * looked at, and with a single watermark that loss is not recoverable. Read
   * state only ever moves because of a click: on a row, or on "mark all as
   * read".
   */
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  /**
   * Which rows are unread.
   *
   * The backend keeps one watermark per user rather than a flag per event, so
   * it reports only *how many* are unread. The feed is newest-first and the
   * count uses the same visibility rules, so the newest `unread` rows are
   * exactly the unread ones — no extra endpoint needed.
   */
  const isUnread = (index: number) => index < unread;

  /**
   * Clicking a row marks it read and opens it.
   *
   * With a watermark, marking event S read also marks everything older than S —
   * "read" is a boundary, not a set. Given the list is newest-first, clicking a
   * row means "I've seen this and everything below it", which is what the
   * ordering implies anyway.
   */
  const openEvent = (event: ActivityEvent) => {
    markRead(event.seq);
    // There is no per-title route in this app, so this does what selecting a
    // group on /groups does: switch the active group and show its watchlist.
    saveGroupId(event.groupId);
    setOpen(false);
    navigate('/watchlist');
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label={unread > 0 ? `Activity, ${unread} unread` : 'Activity'}
          className="relative h-10 w-10 rounded-full border-2 border-movie-blue/30 bg-movie-surface hover:bg-movie-surface/80 focus:outline-none focus:ring-2 focus:ring-movie-blue focus:ring-offset-2 p-0"
        >
          <Bell className="h-4 w-4 text-movie-gold" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-movie-blue text-movie-blue-foreground text-[0.65rem] font-semibold flex items-center justify-center border-2 border-movie-surface">
              {unread > BADGE_MAX ? `${BADGE_MAX}+` : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-80" align="end">
        <DropdownMenuLabel className="font-normal flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block text-sm font-medium leading-none">Activity</span>
            <span className="block text-xs leading-none text-muted-foreground mt-1">
              What others in your groups have been up to
            </span>
          </span>
          {/*
            Explicit, and the only bulk way read state moves. Disabled rather
            than hidden so the panel's header does not change shape as the count
            drops to zero. The badge updates on the click, not on the response —
            the mutation writes the new count optimistically.
          */}
          <button
            type="button"
            onClick={(event) => {
              // Keep the panel open: this is not a menu item, and dismissing it
              // would hide the rows the user just chose to keep looking at.
              event.preventDefault();
              markAllRead();
            }}
            disabled={unread === 0 || !canMarkAllRead}
            className="shrink-0 rounded-sm px-1 py-0.5 text-xs font-normal text-muted-foreground hover:text-foreground hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-movie-blue disabled:pointer-events-none disabled:opacity-40"
          >
            Mark all as read
          </button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        )}

        {!isLoading && isError && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Could not load activity right now.
          </p>
        )}

        {!isLoading && !isError && events.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing yet. When someone in your groups rates or comments on a film,
            it shows up here.
          </p>
        )}

        {events.length > 0 && (
          <div
            // Focusable, so the list can be scrolled with the arrow keys by
            // someone not using a pointer — a scrollable region only a mouse
            // can reach is not reachable.
            tabIndex={0}
            aria-label="Recent activity"
            className="max-h-80 overflow-y-auto scrollbar-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-movie-blue rounded-sm"
          >
            {events.map((event, index) => {
              const unreadRow = isUnread(index);
              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => openEvent(event)}
                  aria-label={`${describeActivityText(event)}${unreadRow ? ' (unread)' : ''}`}
                  // NOT hover:bg-accent: --accent is this theme's warm golden,
                  // paired with a near-black --accent-foreground the row's text
                  // does not adopt, so hovering used to put light text on amber.
                  // --movie-surface-hover is the app's own surface token for
                  // exactly this, and it is defined in both themes, so the
                  // foreground tokens below stay readable against it either way.
                  className="group w-full text-left flex items-start gap-2 px-2 py-2 rounded-sm hover:bg-movie-surface-hover focus:bg-movie-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-movie-blue"
                >
                  {/* The dot keeps its column on read rows too, so lines don't shift. */}
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      unreadRow ? 'bg-movie-blue' : 'bg-transparent'
                    }`}
                  />
                  <span className="min-w-0">
                    <span
                      className={`block text-sm leading-snug ${
                        unreadRow
                          ? 'text-foreground font-medium'
                          : // A read row is dimmed until it is hovered or
                            // focused, where it comes up to full contrast
                            // rather than staying grey on a lighter surface.
                            'text-muted-foreground group-hover:text-foreground group-focus:text-foreground'
                      }`}
                    >
                      {describeActivity(event).map((segment, i) =>
                        typeof segment === 'string' ? (
                          <span key={i}>{segment}</span>
                        ) : (
                          // The title is italic so it reads as a distinct thing
                          // inside the sentence, and takes no colour of its own:
                          // it inherits the row's, so a read row stays uniformly
                          // dimmed and a hovered one comes up with the rest of
                          // the line. (This carried `text-movie-gold`, which no
                          // theme defines — see tailwind.config.ts — so it was
                          // already inheriting. Left inheriting on purpose: a
                          // golden italic would sit at roughly 2:1 against the
                          // light theme's hover surface.)
                          <em key={i} className="italic">
                            {segment.title}
                          </em>
                        )
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {event.groupName} · {activityTimeAgo(event.createdAt)}
                    </span>
                  </span>
                </button>
              );
            })}

            {hasMore && nextBefore !== null && (
              <>
                <DropdownMenuSeparator />
                <Button
                  variant="ghost"
                  size="sm"
                  // Ghost's own hover is bg-accent too; same reasoning as the
                  // rows above, so the whole panel hovers consistently.
                  className="w-full hover:bg-movie-surface-hover hover:text-foreground"
                  disabled={isLoadingMore}
                  onClick={(e) => {
                    // Keep the panel open while paging.
                    e.preventDefault();
                    loadMore(nextBefore);
                  }}
                >
                  {isLoadingMore ? 'Loading…' : 'Show older'}
                </Button>
              </>
            )}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
