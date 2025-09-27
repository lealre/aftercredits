import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  readonly?: boolean;
  size?: number;
}

export const StarRating = ({ rating, onRatingChange, readonly = false, size = 20 }: StarRatingProps) => {
  const handleClick = (value: number) => {
    if (!readonly && onRatingChange) {
      onRatingChange(value);
    }
  };

  const renderStar = (index: number) => {
    const value = index + 0.5;
    const nextValue = index + 1;
    const isHalfFilled = rating >= value && rating < nextValue;
    const isFilled = rating >= nextValue;
    
    return (
      <div key={index} className="relative inline-block">
        {/* Background star */}
        <Star
          size={size}
          className={`text-border ${readonly ? '' : 'cursor-pointer hover:text-movie-blue/50 transition-colors'}`}
          onClick={() => !readonly && handleClick(0)}
        />
        
        {/* Half fill */}
        {(isHalfFilled || isFilled) && (
          <div className="absolute inset-0 overflow-hidden" style={{ width: isHalfFilled ? '50%' : '100%' }}>
            <Star
              size={size}
              className={`text-movie-blue fill-movie-blue ${readonly ? '' : 'cursor-pointer hover:text-movie-blue-light'}`}
              onClick={() => !readonly && handleClick(isHalfFilled ? value : nextValue)}
            />
          </div>
        )}
        
        {/* Click areas for interactive stars */}
        {!readonly && (
          <>
            <div
              className="absolute inset-0 w-1/2 cursor-pointer"
              onClick={() => handleClick(value)}
            />
            <div
              className="absolute inset-0 left-1/2 w-1/2 cursor-pointer"
              onClick={() => handleClick(nextValue)}
            />
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex gap-1">
      {[0, 1, 2, 3, 4].map(renderStar)}
      {!readonly && (
        <span className="ml-2 text-sm text-muted-foreground">
          {rating > 0 ? rating : 'No rating'}
        </span>
      )}
    </div>
  );
};