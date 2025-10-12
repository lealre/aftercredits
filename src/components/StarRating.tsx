import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number; // 0-10 scale
  onRatingChange?: (rating: number) => void;
  readonly?: boolean;
  size?: number;
}

export const StarRating = ({ rating, onRatingChange, readonly = false, size = 20 }: StarRatingProps) => {
  // Convert 0-10 scale to 0-5 scale for display
  const displayRating = rating / 2;
  
  const handleClick = (value: number) => {
    if (!readonly && onRatingChange) {
      // Convert 0-5 scale back to 0-10 scale with 0.1 precision
      const newRating = Math.round(value * 2 * 10) / 10; // Round to nearest 0.1
      onRatingChange(Math.min(10, Math.max(0, newRating))); // Clamp between 0-10
    }
  };

  const renderStar = (index: number) => {
    const starStart = index;
    const starEnd = index + 1;
    const fillPercentage = Math.max(0, Math.min(1, displayRating - starStart));
    
    return (
      <div key={index} className="relative inline-block">
        {/* Background star */}
        <Star
          size={size}
          className={`text-border ${readonly ? '' : 'cursor-pointer hover:text-movie-blue/50 transition-colors'}`}
          onClick={() => !readonly && handleClick(0)}
        />
        
        {/* Proportional fill */}
        {fillPercentage > 0 && (
          <div className="absolute inset-0 overflow-hidden" style={{ width: `${fillPercentage * 100}%` }}>
            <Star
              size={size}
              className={`text-movie-blue fill-movie-blue ${readonly ? '' : 'cursor-pointer hover:text-movie-blue-light'}`}
              onClick={() => !readonly && handleClick(starStart + fillPercentage)}
            />
          </div>
        )}
        
        {/* Click areas for interactive stars */}
        {!readonly && (
          <>
            <div
              className="absolute inset-0 w-1/2 cursor-pointer"
              onClick={() => handleClick(starStart + 0.5)}
            />
            <div
              className="absolute inset-0 left-1/2 w-1/2 cursor-pointer"
              onClick={() => handleClick(starEnd)}
            />
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex gap-1 items-center">
      {[0, 1, 2, 3, 4].map(renderStar)}
      {!readonly && (
        <span className="ml-2 text-sm text-muted-foreground">
          {rating > 0 ? rating.toFixed(1) : '0.0'}
        </span>
      )}
    </div>
  );
};