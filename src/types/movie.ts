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
  groupId: string; // ratings are group-scoped: one user can rate the same title once per group
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
  groupId: string; // comments are group-scoped: the same user comments per group on a title
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
  titleType?: 'serie' | 'movie';
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
  description?: string;
  ownerId: string;
  users: string[];
  titles: any[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Thrown when GET /groups/{groupId}/titles/{titleId} answers 404.
 *
 * The backend gives one deliberately indistinguishable 404 for every way that
 * read can fail — unknown group, deleted group, caller not a member, unknown
 * title, title not in that group — so this means exactly "you cannot see that
 * title in that group" and nothing more precise. There is no message worth
 * showing either, which is why this carries none of the body.
 *
 * A distinct type because this 404 is an expected answer rather than a fault:
 * the activity feed links to titles that may have been removed since the event,
 * so the caller shows a toast instead of an error state.
 */
export class TitleNotInGroupError extends Error {
  constructor() {
    super('That title is not in that group');
    this.name = 'TitleNotInGroupError';
  }
}

/** Search result item from GET /titles/search */
export interface SearchTitle {
  id: string;
  type: string;
  primaryTitle: string;
  originalTitle: string;
  primaryImage: {
    url: string;
    width: number;
    height: number;
  };
  startYear: number;
  endYear?: number;
  rating: {
    aggregateRating: number;
    voteCount: number;
  };
}
