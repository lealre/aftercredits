import { SearchTitle } from "@/types/movie";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Plus, Loader2, Film } from "lucide-react";

interface SearchResultsDropdownProps {
  results: SearchTitle[];
  loading?: boolean;
  existingTitleIds?: string[];
  onAdd: (id: string) => Promise<void>;
  addingId: string | null;
}

const typeLabel = (type: string): string => {
  if (type === "tvSeries" || type === "tvMiniSeries") return "TV Series";
  return "Movie";
};

const yearRange = (startYear: number, endYear?: number): string => {
  if (endYear != null && endYear !== startYear) {
    return `${startYear} – ${endYear}`;
  }
  return String(startYear);
};

export const SearchResultsDropdown = ({
  results,
  loading = false,
  existingTitleIds = [],
  onAdd,
  addingId,
}: SearchResultsDropdownProps) => {
  const handleAdd = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (existingTitleIds.includes(id)) return;
    onAdd(id);
  };

  return (
    <div className="absolute top-full left-0 right-0 z-50 mt-2 rounded-lg border border-border bg-movie-surface shadow-lg overflow-hidden max-h-[min(70vh,420px)] overflow-y-auto">
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-movie-blue" />
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <Film className="w-10 h-10 mb-2 opacity-50" />
          <p className="text-sm">No results found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-2">
          {results.map((item) => {
            const isInGroup = existingTitleIds.includes(item.id);
            const isAdding = addingId === item.id;
            return (
              <Card
                key={item.id}
                className="overflow-hidden bg-gradient-card border-border/50 hover:border-movie-blue/30 transition-all duration-300"
              >
                  <div className="flex gap-4 p-4">
                    <div className="aspect-[2/3] w-28 sm:w-32 flex-shrink-0 relative overflow-hidden rounded-md">
                      <img
                        src={item.primaryImage?.url ?? ""}
                        alt={item.primaryTitle}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder-movie.jpg";
                        }}
                      />
                      <div className="absolute top-2 left-2">
                        <Badge
                          variant="secondary"
                          className="bg-movie-surface/95 backdrop-blur-sm border-movie-blue/40 text-sm font-semibold px-2 py-0.5"
                        >
                          <Star className="w-4 h-4 mr-1 text-movie-blue" />
                          {item.rating?.aggregateRating?.toFixed(1) ?? "–"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h3 className="font-semibold text-base text-foreground line-clamp-2">
                        {item.primaryTitle}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {typeLabel(item.type)} •{" "}
                        {yearRange(item.startYear, item.endYear)}
                        {item.rating?.voteCount != null &&
                          item.rating.voteCount > 0 && (
                            <span className="ml-1">
                              • {item.rating.voteCount.toLocaleString()} votes
                            </span>
                          )}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        {isInGroup ? (
                          <span className="text-sm text-muted-foreground italic">
                            Already in group
                          </span>
                        ) : (
                          <div className="flex justify-start">
                            <Button
                              size="sm"
                              className="inline-flex items-center bg-movie-blue text-movie-blue-foreground hover:bg-movie-blue/90 rounded-md"
                              onClick={(e) => handleAdd(e, item.id)}
                              disabled={isAdding}
                            >
                              {isAdding ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Plus className="w-4 h-4" />
                              )}
                              <span className="ml-2">
                                {isAdding ? "Adding…" : "Add"}
                              </span>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
