import { Movie } from '@/types/movie';
import { v4 as uuidv4 } from 'uuid';

// Extract IMDB ID from various URL formats
export const extractImdbId = (url: string): string | null => {
  const patterns = [
    /imdb\.com\/title\/(tt\d+)/,
    /imdb\.com\/title\/(tt\d+)\//,
    /(tt\d+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// Fetch movie data from OMDB API (free alternative to IMDB API)
export const fetchMovieData = async (imdbId: string): Promise<Movie | null> => {
  try {
    // Using OMDB API with a demo key - in production, users should get their own key
    const apiKey = 'b9a9b5b5'; // Demo key with limited requests
    const response = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${apiKey}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch movie data');
    }
    
    const data = await response.json();
    
    if (data.Response === 'False') {
      throw new Error(data.Error || 'Movie not found');
    }
    
    return {
      id: uuidv4(),
      imdbId: data.imdbID,
      title: data.Title,
      year: data.Year,
      poster: data.Poster !== 'N/A' ? data.Poster : '/placeholder-movie.jpg',
      imdbRating: data.imdbRating !== 'N/A' ? data.imdbRating : 'N/A',
      plot: data.Plot !== 'N/A' ? data.Plot : 'No plot available',
      genre: data.Genre !== 'N/A' ? data.Genre : 'Unknown',
      director: data.Director !== 'N/A' ? data.Director : 'Unknown',
      actors: data.Actors !== 'N/A' ? data.Actors : 'Unknown',
      addedDate: new Date().toISOString().split('T')[0],
    };
  } catch (error) {
    console.error('Error fetching movie data:', error);
    return null;
  }
};

// Fallback for when API fails - create movie with basic info
export const createFallbackMovie = (imdbId: string, url: string): Movie => {
  return {
    id: uuidv4(),
    imdbId,
    title: 'Unknown Movie',
    year: 'Unknown',
    poster: '/placeholder-movie.jpg',
    imdbRating: 'N/A',
    plot: 'Movie data could not be fetched. Please add details manually.',
    genre: 'Unknown',
    director: 'Unknown',
    actors: 'Unknown',
    addedDate: new Date().toISOString().split('T')[0],
  };
};