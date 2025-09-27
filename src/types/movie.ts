export interface Movie {
  id: string;
  imdbId: string;
  title: string;
  year: string;
  poster: string;
  imdbRating: string;
  plot: string;
  genre: string;
  director: string;
  actors: string;
  renanRating?: number;
  renanComments?: string;
  brunaRating?: number;
  brunaComments?: string;
  addedDate: string;
}

export interface MovieRating {
  userId: 'renan' | 'bruna';
  rating: number;
  comments: string;
}