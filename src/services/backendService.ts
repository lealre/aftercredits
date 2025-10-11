import { Movie, User, UsersResponse, Rating, RatingsResponse } from '@/types/movie';

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
}

interface BackendResponse {
  movies: BackendMovie[];
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
    watched: false,
    tags: [],
  };
};

export const fetchMovies = async (): Promise<Movie[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/titles`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch movies from backend');
    }
    
    const data: BackendResponse = await response.json();
    
    return data.movies.map(movie => 
      mapBackendMovieToMovie(movie)
    );
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
