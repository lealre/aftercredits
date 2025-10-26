import { Movie, User, UsersResponse, Rating, RatingsResponse, PaginatedResponse, PaginationParams } from '@/types/movie';

const API_BASE_URL = '/api';

interface BackendMovie {
  id: string;
  primaryTitle: string;
  primaryImage: {
    url: string;
    width: number;
    height: number;
  };
  startYear: number;
  runtimeSeconds: number;
  genres: string[];
  rating: {
    aggregateRating: number;
    voteCount: number;
  };
  plot: string;
  directorsNames: string[];
  writersNames: string[];
  starsNames: string[];
  originCountries: string[];
  watched: boolean;
  watchedAt?: string;
}

interface BackendResponse {
  movies: BackendMovie[];
}

interface BackendPaginatedResponse {
  Page: number;
  Size: number;
  TotalPages: number;
  TotalResults: number;
  Content: BackendMovie[];
}

interface AddMovieResponse {
  error_message?: string;
  status_code?: string;
}

const mapBackendMovieToMovie = (backendMovie: BackendMovie): Movie => {
  return {
    id: backendMovie.id,
    imdbId: backendMovie.id,
    title: backendMovie.primaryTitle,
    year: backendMovie.startYear.toString(),
    poster: backendMovie.primaryImage.url,
    imdbRating: backendMovie.rating.aggregateRating.toString(),
    plot: backendMovie.plot,
    genre: backendMovie.genres.join(', '),
    director: backendMovie.directorsNames.join(', '),
    actors: backendMovie.starsNames.join(', '),
    addedDate: new Date().toISOString().split('T')[0],
    watched: backendMovie.watched,
    watchedAt: backendMovie.watchedAt,
  };
};

export const fetchMovies = async (paginationParams?: PaginationParams): Promise<PaginatedResponse<Movie>> => {
  try {
    let url = `${API_BASE_URL}/titles`;
    
    if (paginationParams) {
      const searchParams = new URLSearchParams({
        page: paginationParams.page.toString(),
        size: paginationParams.size.toString(),
      });
      url += `?${searchParams.toString()}`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Failed to fetch movies from backend');
    }
    
    const data: BackendPaginatedResponse = await response.json();
    
    return {
      Page: data.Page,
      Size: data.Size,
      TotalPages: data.TotalPages,
      TotalResults: data.TotalResults,
      Content: data.Content.map(movie => 
        mapBackendMovieToMovie(movie)
      ),
    };
  } catch (error) {
    console.error('Error fetching movies:', error);
    throw error;
  }
};

export const addMovieToBackend = async (url: string): Promise<{ movie?: BackendMovie; error?: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/titles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });
    
    if (!response.ok) {
      const errorData: AddMovieResponse = await response.json();
      return { error: errorData.error_message || 'Failed to add movie' };
    }
    
    const movie: BackendMovie = await response.json();
    return { movie };
  } catch (error) {
    console.error('Error adding movie:', error);
    throw error;
  }
};

export const fetchUsers = async (): Promise<User[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/users`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch users from backend');
    }
    
    const data: UsersResponse = await response.json();
    return data.users;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export const fetchRatings = async (titleId: string): Promise<Rating[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/titles/${titleId}/ratings`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch ratings from backend');
    }
    
    const data: RatingsResponse = await response.json();
    return data.ratings;
  } catch (error) {
    console.error('Error fetching ratings:', error);
    throw error;
  }
};

export const updateRating = async (ratingId: string, ratingData: {
  note: number;
  comments: string;
}): Promise<Rating> => {
  try {
    const response = await fetch(`${API_BASE_URL}/ratings/${ratingId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ratingData),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update rating');
    }
    
    const rating: Rating = await response.json();
    return rating;
  } catch (error) {
    console.error('Error updating rating:', error);
    throw error;
  }
};

export const saveOrUpdateRating = async (ratingData: {
  titleId: string;
  userId: string;
  note: number;
  comments: string;
}, existingRatings: Rating[]): Promise<Rating> => {
  // Check if rating already exists for this user and movie
  const existingRating = existingRatings.find(
    rating => rating.titleId === ratingData.titleId && rating.userId === ratingData.userId
  );

  if (existingRating) {
    // Update existing rating
    return updateRating(existingRating.id, {
      note: ratingData.note,
      comments: ratingData.comments,
    });
  } else {
    // Create new rating
    return saveRating(ratingData);
  }
};

export const saveRating = async (ratingData: {
  titleId: string;
  userId: string;
  note: number;
  comments: string;
}): Promise<Rating> => {
  try {
    const response = await fetch(`${API_BASE_URL}/ratings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ratingData),
    });
    
    if (!response.ok) {
      throw new Error('Failed to save rating');
    }
    
    const rating: Rating = await response.json();
    return rating;
  } catch (error) {
    console.error('Error saving rating:', error);
    throw error;
  }
};

export const updateMovieWatchedStatus = async (imdbId: string, watched: boolean, watchedAt?: string): Promise<void> => {
  try {
    const body: { watched: boolean; watchedAt?: string } = { watched };
    if (watchedAt) {
      body.watchedAt = watchedAt;
    }
    
    const response = await fetch(`${API_BASE_URL}/titles/${imdbId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update watched status');
    }
  } catch (error) {
    console.error('Error updating watched status:', error);
    throw error;
  }
};

export const deleteMovie = async (imdbId: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/titles/${imdbId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete movie');
    }
  } catch (error) {
    console.error('Error deleting movie:', error);
    throw error;
  }
};
