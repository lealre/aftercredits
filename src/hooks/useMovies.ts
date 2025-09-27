import { useState, useEffect } from 'react';
import { Movie } from '@/types/movie';

const STORAGE_KEY = 'movie-ratings-data';

export const useMovies = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setMovies(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading movies:', error);
      }
    }
  }, []);

  const saveMovies = (newMovies: Movie[]) => {
    setMovies(newMovies);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newMovies));
  };

  const addMovie = (movie: Movie) => {
    const newMovies = [...movies, movie];
    saveMovies(newMovies);
  };

  const updateMovie = (id: string, updates: Partial<Movie>) => {
    const newMovies = movies.map(movie => 
      movie.id === id ? { ...movie, ...updates } : movie
    );
    saveMovies(newMovies);
  };

  const deleteMovie = (id: string) => {
    const newMovies = movies.filter(movie => movie.id !== id);
    saveMovies(newMovies);
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