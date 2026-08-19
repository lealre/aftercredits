import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Change, ScopeKey } from '@/lib/stagedEdits';

interface StagedChangesSummaryProps {
  changes: Change[];
  visibleScope: ScopeKey;
  saving: boolean;
  onRetry: () => void;
}

/**
 * `changes` arrives sorted title-then-seasons, so same-scope entries are
 * already adjacent — this only folds them into display groups, it never
 * re-sorts. Grouping by scopeLabel (not scope) is safe because the two are
 * a 1:1 mapping (see `scopeLabel` in stagedEdits.ts).
 */
const groupByScope = (changes: Change[]): Array<{ scopeLabel: string; changes: Change[] }> => {
  const groups: Array<{ scopeLabel: string; changes: Change[] }> = [];
  for (const change of changes) {
    const current = groups[groups.length - 1];
    if (current && current.scopeLabel === change.scopeLabel) {
      current.changes.push(change);
    } else {
      groups.push({ scopeLabel: change.scopeLabel, changes: [change] });
    }
  }
  return groups;
};

export const StagedChangesSummary = ({
  changes,
  visibleScope,
  saving,
  onRetry,
}: StagedChangesSummaryProps) => {
  // A change on the scope already on screen has its own inline `•` marker
  // next to the field, so repeating it here would announce it twice. Once
  // ANY change is on a scope the user can't currently see, though, the full
  // set is shown — a partial list would be more confusing than none at all.
  const hasOffScreenChange = changes.some((change) => change.scope !== visibleScope);
  const failedChanges = changes.filter((change) => change.failure);

  if (!hasOffScreenChange && failedChanges.length === 0) return null;

  return (
    <div className="space-y-3">
      {hasOffScreenChange && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Pending changes
          </h4>
          <div className="max-h-32 overflow-y-auto scrollbar-subtle space-y-1 text-sm">
            {groupByScope(changes).map((group) => (
              <div key={group.scopeLabel} className="flex flex-wrap gap-x-1.5 min-w-0">
                <span className="shrink-0 font-medium text-foreground">{group.scopeLabel}</span>
                <span className="text-muted-foreground break-words min-w-0">
                  {group.changes.map((change) => change.label).join(', ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {failedChanges.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {failedChanges.length} of {changes.length} changes could not be saved
          </div>
          <div className="max-h-32 overflow-y-auto scrollbar-subtle space-y-1">
            {failedChanges.map((change) => (
              <p
                key={`${change.scope}:${change.field}`}
                className="text-xs text-destructive/90 break-words"
              >
                {change.scopeLabel} · {change.label} — {change.failure}
              </p>
            ))}
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={saving}
              className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Retry failed
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
