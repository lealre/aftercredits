import { useState } from 'react';
import { Bell, ExternalLink, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
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
 *
 * ## Why every control here is a DropdownMenuItem
 *
 * The rows used to be plain `<button>`s inside the menu, and that was the cause
 * of two separate bugs rather than one:
 *
 * 1. Radix's roving focus only walks its own items, so arrow keys did not move
 *    between rows — the list was mouse-only in practice.
 * 2. Radix's Content calls `preventDefault()` on Tab (react-menu keeps focus
 *    inside an open menu), so a non-item button in here is reachable by NO key
 *    at all. "Mark all as read" was in exactly that position.
 *
 * Using the menu's own item primitive fixes both at once and for free:
 * `Item` renders `role="menuitem"`, joins the roving focus group (ArrowUp /
 * ArrowDown / Home / End), joins typeahead, and focuses itself on pointer move.
 * The one behaviour we do not want — closing the panel on select — is the one
 * Radix lets you decline, by calling `preventDefault()` on the `onSelect`
 * event. So every control below is an Item, and each one decides for itself
 * whether selecting it should dismiss the panel.
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
    loadMore,
    isLoadingMore,
    markRead,
    markAllRead,
    isMarkingAllRead,
    reset,
  } = useActivityFeedPanel(open);

  if (unavailable) return null;

  /**
   * Opening the panel loads the feed and nothing else — deliberately.
   *
   * Marking things read on open would clear activity the user never actually
   * looked at. Read state only ever moves because of a click: on a row, or on
   * "mark all as read".
   */
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  /**
   * Selecting a row marks *that* row read and stays put.
   *
   * Per-event read state is what makes this honest: the click marks one row and
   * leaves its neighbours — older ones included — alone. The panel deliberately
   * does not close, so the user can keep reading down the list, which is the
   * whole point of the row being focusable.
   */
  const handleRowSelect = (selectEvent: Event, event: ActivityEvent) => {
    // Decline the menu's default "select dismisses the menu".
    selectEvent.preventDefault();
    markRead(event.id);
    // Keyboard selection and mouse hover both leave focus on the item already;
    // a touch tap does not (Radix only focuses on pointer move for a mouse).
    // Focusing explicitly makes "click a row, then carry on with the arrow
    // keys" work the same way however the row was reached.
    (selectEvent.currentTarget as HTMLElement | null)?.focus();
  };

  /**
   * The row's other action: go and look at the title.
   *
   * There is no per-title route in this app, so this does what selecting a
   * group on /groups does — switch the active group and show its watchlist,
   * which is where the title is. Unlike the row itself this one DOES dismiss
   * the panel (the default select behaviour), because it navigates away and a
   * menu left hanging over the new page would have to be dismissed by hand.
   *
   * It also marks the row read: opening something is at least as strong a
   * signal of having seen it as clicking it.
   */
  const openTitle = (event: ActivityEvent) => {
    markRead(event.id);
    saveGroupId(event.groupId);
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
        {/*
          Presentational: role="menu" wants menuitem / group / separator
          children, so this flex box says it is only here to place things.
        */}
        <div role="presentation" className="flex items-start justify-between gap-2">
          <DropdownMenuLabel className="font-normal min-w-0">
            <span className="block text-sm font-medium leading-none">Activity</span>
            <span className="block text-xs leading-none text-muted-foreground mt-1">
              What others in your groups have been up to
            </span>
          </DropdownMenuLabel>
          {/*
            Explicit, and the only bulk way read state moves. Disabled rather
            than hidden so the panel's header does not change shape as the count
            drops to zero. The badge updates on the click, not on the response —
            the mutation writes the new count optimistically.
          */}
          <DropdownMenuItem
            disabled={unread === 0 || isMarkingAllRead}
            onSelect={(selectEvent) => {
              // Keep the panel open: dismissing it would hide the rows the user
              // just chose to keep looking at.
              selectEvent.preventDefault();
              markAllRead();
            }}
            className="shrink-0 mt-1 mr-1 px-1.5 py-0.5 text-xs text-muted-foreground focus:bg-movie-surface-hover focus:text-foreground"
          >
            Mark all as read
          </DropdownMenuItem>
        </div>
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
          // A Group (role="group") rather than a bare div: it is a legal child
          // of role="menu", and unlike the focusable div this used to be it adds
          // no tab stop of its own — the items inside are what focus now, and
          // arrowing onto one scrolls it into view.
          <DropdownMenuGroup
            aria-label="Recent activity"
            className="max-h-80 overflow-y-auto scrollbar-subtle"
          >
            {events.map((event) => {
              // Unread is per event now: the row's own flag, never "the newest
              // N rows" inferred from a count and a list position.
              const unreadRow = !event.read;
              return (
                <div
                  key={event.id}
                  role="presentation"
                  className="flex items-stretch gap-1"
                >
                  <DropdownMenuItem
                    onSelect={(selectEvent) => handleRowSelect(selectEvent, event)}
                    aria-label={`${describeActivityText(event)}${unreadRow ? ' (unread)' : ''}`}
                    // Typeahead matches the sentence rather than the concatenated
                    // spans below, so typing a name jumps to that person's row.
                    textValue={describeActivityText(event)}
                    // NOT focus:bg-accent (the Item default): --accent is this
                    // theme's warm golden, paired with a near-black
                    // --accent-foreground the row's text does not adopt, so
                    // highlighting used to put light text on amber.
                    // --movie-surface-hover is the app's own surface token for
                    // exactly this, defined in both themes, so the foreground
                    // tokens below stay readable against it either way.
                    className="group min-w-0 flex-1 items-start gap-2 px-2 py-2 focus:bg-movie-surface-hover focus:text-foreground"
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
                            : // A read row is dimmed until it is highlighted,
                              // where it comes up to full contrast rather than
                              // staying grey on a lighter surface.
                              'text-muted-foreground group-focus:text-foreground'
                        }`}
                      >
                        {describeActivity(event).map((segment, i) =>
                          typeof segment === 'string' ? (
                            <span key={i}>{segment}</span>
                          ) : (
                            // The title is italic so it reads as a distinct thing
                            // inside the sentence, and takes no colour of its own:
                            // it inherits the row's, so a read row stays uniformly
                            // dimmed and a highlighted one comes up with the rest
                            // of the line. (This carried `text-movie-gold`, which
                            // no theme defines — see tailwind.config.ts — so it
                            // was already inheriting. Left inheriting on purpose:
                            // a golden italic would sit at roughly 2:1 against the
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
                  </DropdownMenuItem>

                  {/*
                    Its own item, not a button nested inside the row's item: a
                    menuitem must not contain another focusable element, and a
                    nested button would be reachable by mouse only — the very
                    bug this file just fixed. As a sibling item it sits in the
                    same roving focus group, so ArrowDown steps row → open →
                    next row and the affordance is keyboard-reachable.
                  */}
                  <DropdownMenuItem
                    onSelect={() => openTitle(event)}
                    aria-label={`Open ${event.titleName ? `${event.titleName} in ` : ''}${event.groupName}`}
                    className="shrink-0 self-center px-2 py-2 text-muted-foreground focus:bg-movie-surface-hover focus:text-foreground"
                  >
                    <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                  </DropdownMenuItem>
                </div>
              );
            })}

            {hasMore && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={isLoadingMore}
                  onSelect={(selectEvent) => {
                    // Keep the panel open while paging — the whole point is to
                    // read the rows that just arrived.
                    selectEvent.preventDefault();
                    loadMore();
                  }}
                  className="justify-center text-sm focus:bg-movie-surface-hover focus:text-foreground"
                >
                  {isLoadingMore ? 'Loading…' : 'Load more'}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
