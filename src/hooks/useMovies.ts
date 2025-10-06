import { useState, useEffect } from 'react';
import { Movie } from '@/types/movie';
import { fetchMovies } from '@/services/backendService';

const LOCAL_DATA_KEY = 'movie-local-data';

interface LocalMovieData {
  renanRating?: number;
  renanComments?: string;
  brunaRating?: number;
  brunaComments?: string;
  watched?: boolean;
  tags?: string[];
  addedDate?: string;
}

export const useMovies = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [localDataMap, setLocalDataMap] = useState<Record<string, LocalMovieData>>({});

  useEffect(() => {
    const loadMovies = async () => {
      setLoading(true);
      try {
        // Load local data (ratings, comments, watched, tags)
        const savedLocalData = localStorage.getItem(LOCAL_DATA_KEY);
        const localData: Record<string, LocalMovieData> = savedLocalData 
          ? JSON.parse(savedLocalData) 
          : {};
        setLocalDataMap(localData);

        // Fetch movies from backend
        const fetchedMovies = await fetchMovies(localData);
        setMovies(fetchedMovies);
      } catch (error) {
        console.error('Error loading movies:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMovies();
  }, []);

  const saveLocalData = (data: Record<string, LocalMovieData>) => {
    localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(data));
    setLocalDataMap(data);
  };

  const addMovie = (movie: Movie) => {
    const newMovies = [...movies, movie];
    setMovies(newMovies);

    // Save local data for this movie
    const newLocalData = {
      ...localDataMap,
      [movie.id]: {
        renanRating: movie.renanRating,
        renanComments: movie.renanComments,
        brunaRating: movie.brunaRating,
        brunaComments: movie.brunaComments,
        watched: movie.watched,
        tags: movie.tags,
        addedDate: movie.addedDate,
      },
    };
    saveLocalData(newLocalData);
  };

  const updateMovie = (id: string, updates: Partial<Movie>) => {
    const newMovies = movies.map(movie => 
      movie.id === id ? { ...movie, ...updates } : movie
    );
    setMovies(newMovies);

    // Update local data
    const movie = newMovies.find(m => m.id === id);
    if (movie) {
      const newLocalData = {
        ...localDataMap,
        [id]: {
          renanRating: movie.renanRating,
          renanComments: movie.renanComments,
          brunaRating: movie.brunaRating,
          brunaComments: movie.brunaComments,
          watched: movie.watched,
          tags: movie.tags,
          addedDate: movie.addedDate,
        },
      };
      saveLocalData(newLocalData);
    }
  };

  const deleteMovie = (id: string) => {
    const newMovies = movies.filter(movie => movie.id !== id);
    setMovies(newMovies);

    // Remove from local data
    const newLocalData = { ...localDataMap };
    delete newLocalData[id];
    saveLocalData(newLocalData);
  };

  const exportToCSV = () => {
    const headers = [
      'Title',
      'Year',
      'IMDB Link',
      'IMDB Rating',
      'Renan Rating',
      'Renan Comments',
      'Bruna Rating',
      'Bruna Comments',
      'Watched',
      'Tags',
      'Genre',
      'Director',
      'Added Date'
    ];

    const csvData = movies.map(movie => [
      movie.title,
      movie.year,
      `https://www.imdb.com/title/${movie.imdbId}/`,
      movie.imdbRating,
      movie.renanRating || '',
      movie.renanComments || '',
      movie.brunaRating || '',
      movie.brunaComments || '',
      movie.watched ? 'Yes' : 'No',
      movie.tags ? movie.tags.join(';') : '',
      movie.genre,
      movie.director,
      movie.addedDate
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movie-ratings-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return {
    movies,
    loading,
    setLoading,
    addMovie,
    updateMovie,
    deleteMovie,
    exportToCSV,
  };
};