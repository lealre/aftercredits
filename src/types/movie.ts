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
}

export interface Rating {
  id: string;
  titleId: string;
  userId: string;
  note: number;
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
  name: string;
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
