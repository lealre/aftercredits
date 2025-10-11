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
  watched?: boolean;
  tags?: string[];
  addedDate: string;
}

export interface Rating {
  id: string;
  titleId: string;
  userId: string;
  note: number;
  comments: string;
}

export interface RatingsResponse {
  ratings: Rating[];
}

export interface User {
  id: string;
  name: string;
}

export interface UsersResponse {
  users: User[];
}

export interface MovieRating {
  userId: string;
  rating: number;
  comments: string;
}