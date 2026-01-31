import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalResults: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  loading?: boolean;
  orderBy?: string;
  ascending?: boolean;
}

// Helper function to get visible pages for pagination
const getVisiblePages = (currentPage: number, totalPages: number) => {
  const delta = 2;
  const range = [];
  const rangeWithDots = [];

  for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
    range.push(i);
  }

  if (currentPage - delta > 2) {
    rangeWithDots.push(1, '...');
  } else {
    rangeWithDots.push(1);
  }

  rangeWithDots.push(...range);

  if (currentPage + delta < totalPages - 1) {
    rangeWithDots.push('...', totalPages);
  } else if (totalPages > 1) {
    rangeWithDots.push(totalPages);
  }

  return rangeWithDots;
};

const sortOptions = [
  { value: 'primaryTitle', label: 'Title' },
  { value: 'imdbRating', label: 'IMDB Rating' },
  { value: 'startYear', label: 'Year' },
  { value: 'runtimeSeconds', label: 'Duration' },
  { value: 'addedAt', label: 'Added Date' },
  { value: 'watchedAt', label: 'Watched Date' },
];

// Pagination Summary Component (results count and page size selector)
export const PaginationSummary = ({
  currentPage,
  totalPages,
  totalResults,
  pageSize,
  onPageSizeChange,
  loading = false,
  orderBy,
  ascending,
}: Omit<PaginationProps, 'onPageChange'>) => {
  const startResult = (currentPage - 1) * pageSize + 1;
  const endResult = Math.min(currentPage * pageSize, totalResults);

  if (totalPages <= 1) {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between px-2 gap-3 sm:gap-4 w-full">
        <div className="flex items-center space-x-2">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Showing {totalResults} result{totalResults !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <p className="text-xs sm:text-sm text-muted-foreground">Show</p>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => onPageSizeChange(parseInt(value))}
            disabled={loading}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs sm:text-sm text-muted-foreground">per page</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-2 gap-3 sm:gap-4 w-full">
      <div className="flex items-center space-x-2">
        <p className="text-xs sm:text-sm text-muted-foreground">
          <span className="hidden sm:inline">Showing </span>
          {startResult}-{endResult} <span className="hidden sm:inline">of {totalResults} results</span>
          <span className="sm:hidden"> / {totalResults}</span>
          {orderBy && (
            <span className="text-muted-foreground">
              {' | Filtering by '}
              {sortOptions.find((opt) => opt.value === orderBy)?.label || orderBy} ({ascending ? 'Asc' : 'Desc'})
            </span>
          )}
        </p>
      </div>
      
      <div className="flex items-center space-x-2">
        <p className="text-xs sm:text-sm text-muted-foreground">Show</p>
        <Select
          value={pageSize.toString()}
          onValueChange={(value) => onPageSizeChange(parseInt(value))}
          disabled={loading}
        >
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs sm:text-sm text-muted-foreground">per page</p>
      </div>
    </div>
  );
};

// Pagination Navigation Component (page buttons)
export const PaginationNavigation = ({
  currentPage,
  totalPages,
  onPageChange,
  loading = false,
}: Pick<PaginationProps, 'currentPage' | 'totalPages' | 'onPageChange' | 'loading'>) => {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap px-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1 || loading}
        className="h-8 w-8 p-0"
      >
        <ChevronsLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || loading}
        className="h-8 w-8 p-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      {/* Show current page info on mobile, full pagination on desktop */}
      <div className="hidden sm:flex items-center space-x-1">
        {getVisiblePages(currentPage, totalPages).map((page, index) => (
          <div key={index}>
            {page === '...' ? (
              <span className="px-2 py-1 text-sm text-muted-foreground">...</span>
            ) : (
              <Button
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(page as number)}
                disabled={loading}
                className="h-8 w-8 p-0"
              >
                {page}
              </Button>
            )}
          </div>
        ))}
      </div>
      
      {/* Mobile: show current page number */}
      <div className="sm:hidden flex items-center">
        <span className="px-3 py-1 text-sm font-medium">
          {currentPage} / {totalPages}
        </span>
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || loading}
        className="h-8 w-8 p-0"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages || loading}
        className="h-8 w-8 p-0"
      >
        <ChevronsRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

// Main Pagination Component (kept for backward compatibility, but can be removed if not used elsewhere)
export const Pagination = ({
  currentPage,
  totalPages,
  totalResults,
  pageSize,
  onPageChange,
  onPageSizeChange,
  loading = false,
}: PaginationProps) => {
  return (
    <div className="flex flex-col gap-4 px-2 w-full">
      <PaginationSummary
        currentPage={currentPage}
        totalPages={totalPages}
        totalResults={totalResults}
        pageSize={pageSize}
        onPageSizeChange={onPageSizeChange}
        loading={loading}
      />
      <PaginationNavigation
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        loading={loading}
      />
    </div>
  );
};
