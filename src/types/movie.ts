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
  watchedAt?: string;
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

export interface PaginatedResponse<T> {
  Page: number;
  Size: number;
  TotalPages: number;
  TotalResults: number;
  Content: T[];
}

export interface PaginationParams {
  page: number;
  size: number;
  watched?: boolean;
}