import { Movie } from '@/types/movie';

const API_BASE_URL = 'http://localhost:8080';

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

const mapBackendMovieToMovie = (backendMovie: BackendMovie, localData?: Partial<Movie>): Movie => {
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
    addedDate: localData?.addedDate || new Date().toISOString().split('T')[0],
    renanRating: localData?.renanRating,
    renanComments: localData?.renanComments,
    brunaRating: localData?.brunaRating,
    brunaComments: localData?.brunaComments,
    watched: localData?.watched || false,
    tags: localData?.tags || [],
  };
};

export const fetchMovies = async (localDataMap: Record<string, Partial<Movie>>): Promise<Movie[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/movies`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch movies from backend');
    }
    
    const data: BackendResponse = await response.json();
    
    return data.movies.map(movie => 
      mapBackendMovieToMovie(movie, localDataMap[movie.id])
    );
  } catch (error) {
    console.error('Error fetching movies:', error);
    throw error;
  }
};

export const addMovieToBackend = async (url: string): Promise<{ movie?: BackendMovie; error?: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/movies`, {
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
