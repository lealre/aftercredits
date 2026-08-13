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
    reset,
  } = useActivityFeedPanel(open);

  if (unavailable) return null;

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
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium leading-none">Activity</p>
          <p className="text-xs leading-none text-muted-foreground mt-1">
            What others in your groups have been up to
          </p>
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
          <div className="max-h-80 overflow-y-auto">
            {events.map((event, index) => {
              const unreadRow = isUnread(index);
              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => openEvent(event)}
                  aria-label={`${describeActivityText(event)}${unreadRow ? ' (unread)' : ''}`}
                  className="w-full text-left flex items-start gap-2 px-2 py-2 rounded-sm hover:bg-accent focus:bg-accent focus:outline-none"
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
                        unreadRow ? 'text-foreground font-medium' : 'text-muted-foreground'
                      }`}
                    >
                      {describeActivity(event).map((segment, i) =>
                        typeof segment === 'string' ? (
                          <span key={i}>{segment}</span>
                        ) : (
                          // The title is italic so it reads as a distinct thing
                          // inside the sentence. Its colour follows the row's
                          // read state rather than being fixed, so a read row
                          // stays uniformly dimmed.
                          <em
                            key={i}
                            className={`italic ${unreadRow ? 'text-movie-gold' : ''}`}
                          >
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
                  className="w-full"
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
