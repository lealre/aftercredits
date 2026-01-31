export interface Season {
  season: string;
  episodeCount: number;
}

export interface ReleaseDate {
  year: number;
  month: number;
  day: number;
}

export interface EpisodeRating {
  aggregateRating: number;
  voteCount: number;
}

export interface EpisodeImage {
  url: string;
  width: number;
  height: number;
}

export interface Episode {
  id: string;
  title: string;
  season: string;
  episodeNumber: number;
  primaryImage?: EpisodeImage;
  runtimeSeconds?: number;
  plot?: string;
  rating?: EpisodeRating;
  releaseDate?: ReleaseDate;
}

export interface SeasonWatched {
  watched: boolean;
  watchedAt?: string;
  // backend may include these; keep optional so movies/older payloads still work
  addedAt?: string;
  updatedAt?: string;
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
  seasonsWatched?: Record<string, SeasonWatched>; // season number -> watched info
}

export interface SeasonRating {
  rating: number;
  addedAt: string;
  updatedAt: string;
}

export interface Rating {
  id: string;
  titleId: string;
  userId: string;
  note: number;
  seasonsRatings?: Record<string, SeasonRating>; // season number -> SeasonRating
  // comments field removed - now in separate endpoint
}

export interface RatingsResponse {
  ratings: Rating[];
}

export interface SeasonComment {
  comment: string;
  addedAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  titleId: string;
  userId: string;
  comment?: string;
  seasonsComments?: Record<string, SeasonComment>; // season number -> SeasonComment
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
