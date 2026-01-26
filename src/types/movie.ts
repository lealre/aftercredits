export interface Season {
  season: string;
  episodeCount: number;
}

export interface ReleaseDate {
  year: number;
  month: number;
  day: number;
}

export interface Episode {
  id: string;
  title: string;
  season: string;
  episodeNumber: number;
  releaseDate?: ReleaseDate;
}

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
  type: string;
  runtimeSeconds?: number;
  watched?: boolean;
  watchedAt?: string;
  addedDate: string;
  seasons?: Season[];
  episodes?: Episode[];
}

export interface Rating {
  id: string;
  titleId: string;
  userId: string;
  note: number;
  seasonsRatings?: Record<string, number>; // season number -> rating
  // comments field removed - now in separate endpoint
}

export interface RatingsResponse {
  ratings: Rating[];
}

export interface Comment {
  id: string;
  titleId: string;
  userId: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentsResponse {
  comments: Comment[];
}

export interface User {
  id: string;
  name?: string;
  username: string;
}

export interface UsersResponse {
  users: User[];
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
  orderBy?: string;
  ascending?: boolean;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  name?: string;
  avatarUrl?: string | null;
  groups?: string[];
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupResponse {
  id: string;
  name: string;
  ownerId: string;
  users: string[];
  titles: any[];
  createdAt: string;
  updatedAt: string;
}
