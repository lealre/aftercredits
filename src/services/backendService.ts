import {
  Movie,
  User,
  UsersResponse,
  Rating,
  Comment,
  CommentsResponse,
  PaginatedResponse,
  PaginationParams,
  UserResponse,
  GroupResponse,
  SearchTitle,
  Episode,
  TitleNotInGroupError,
} from "@/types/movie";
import {
  getToken,
  getTokenOrRedirect,
  handleUnauthorized,
  getErrorMessage,
  getGroupId,
} from "./authService";
import {
  ActivityFeed,
  ActivityStreamTicket,
  ActivityUnreadCount,
  ActivityFeatureDisabledError,
  ActivitySessionExpiredError,
} from "@/types/activity";
import { normalizeNote } from "@/lib/rating";

const API_BASE_URL = "/api";

interface BackendSeason {
  season: string;
  episodeCount: number;
}

interface BackendReleaseDate {
  year: number;
  month: number;
  day: number;
}

interface BackendEpisodeRating {
  aggregateRating: number;
  voteCount: number;
}

interface BackendEpisodeImage {
  url: string;
  width: number;
  height: number;
}

interface BackendEpisode {
  id: string;
  title: string;
  season: string;
  episodeNumber: number;
  primaryImage?: BackendEpisodeImage;
  runtimeSeconds?: number;
  plot?: string;
  rating?: BackendEpisodeRating;
  releaseDate?: BackendReleaseDate;
}

interface BackendSeasonWatched {
  watched: boolean;
  watchedAt?: string;
  addedAt: string;
  updatedAt: string;
}

interface BackendMovie {
  id: string;
  primaryTitle: string;
  type: string;
  primaryImage: {
    url: string;
    width: number;
    height: number;
  };
  startYear: number;
  runtimeSeconds: number;
  genres: string[];
  rating: {
    aggregateRating: number;
    voteCount: number;
  };
  plot: string;
  directorsNames: string[];
  writersNames: string[];
  starsNames: string[];
  originCountries: string[];
  seasons?: BackendSeason[];
  episodes?: BackendEpisode[];
  seasonsWatched?: Record<string, BackendSeasonWatched>;
  groupRatings: Rating[] | null;
  watched: boolean;
  watchedAt?: string;
}

interface BackendPaginatedResponse {
  Page: number;
  Size: number;
  TotalPages: number;
  TotalResults: number;
  Content: BackendMovie[];
}

interface ErrorResponse {
  statusCode?: number;
  errorMessage?: string;
}

const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = getToken();
  if (!token) {
    // Only redirect if we're not already on the login page
    if (window.location.pathname !== '/login') {
      getTokenOrRedirect(); // This will redirect
    }
    throw new Error("Login required");
  }

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    try {
      const data = await response.json();
      const message = getErrorMessage(data) || "Session expired";
      // Only redirect if we haven't already redirected
      if (window.location.pathname !== '/login') {
        handleUnauthorized(message);
      }
      throw new Error("Session expired");
    } catch (err) {
      // Only redirect if we haven't already redirected
      if (window.location.pathname !== '/login') {
        handleUnauthorized("Session expired");
      }
      throw err instanceof Error ? err : new Error("Session expired");
    }
  }

  return response;
};

const mapBackendEpisode = (ep: BackendEpisode): Episode => ({
  id: ep.id,
  title: ep.title,
  season: ep.season,
  episodeNumber: ep.episodeNumber,
  primaryImage: ep.primaryImage ? {
    url: ep.primaryImage.url,
    width: ep.primaryImage.width,
    height: ep.primaryImage.height,
  } : undefined,
  runtimeSeconds: ep.runtimeSeconds,
  plot: ep.plot,
  rating: ep.rating ? {
    aggregateRating: ep.rating.aggregateRating,
    voteCount: ep.rating.voteCount,
  } : undefined,
  releaseDate: ep.releaseDate ? {
    year: ep.releaseDate.year,
    month: ep.releaseDate.month,
    day: ep.releaseDate.day,
  } : undefined,
});

const mapBackendMovieToMovie = (backendMovie: BackendMovie): Movie => {
  return {
    id: backendMovie.id,
    imdbId: backendMovie.id,
    title: backendMovie.primaryTitle,
    type: backendMovie.type,
    year: backendMovie.startYear.toString(),
    poster: backendMovie.primaryImage.url,
    imdbRating: backendMovie.rating.aggregateRating.toString(),
    plot: backendMovie.plot,
    genre: backendMovie.genres.join(", "),
    director: backendMovie.directorsNames.join(", "),
    actors: backendMovie.starsNames.join(", "),
    runtimeSeconds: backendMovie.runtimeSeconds,
    addedDate: new Date().toISOString().split("T")[0],
    watched: backendMovie.watched,
    watchedAt: backendMovie.watchedAt,
    seasons: backendMovie.seasons,
    seasonsWatched: backendMovie.seasonsWatched,
    episodes: backendMovie.episodes?.map(mapBackendEpisode),
  };
};

export const fetchMovies = async (
  groupId: string,
  paginationParams?: PaginationParams
): Promise<PaginatedResponse<Movie> & { ratingsMap: Record<string, Rating[]> }> => {
  try {
    let url = `${API_BASE_URL}/groups/${groupId}/titles`;

    if (paginationParams) {
      const searchParams = new URLSearchParams({
        page: paginationParams.page.toString(),
        size: paginationParams.size.toString(),
      });

      // Only add watched parameter if it's explicitly provided (true or false)
      if (paginationParams.watched !== undefined) {
        searchParams.append("watched", paginationParams.watched.toString());
      }

      if (paginationParams.orderBy) {
        searchParams.append("orderBy", paginationParams.orderBy);
      }

      if (paginationParams.ascending !== undefined) {
        searchParams.append("ascending", paginationParams.ascending.toString());
      }

      if (paginationParams.titleType) {
        searchParams.append("titleType", paginationParams.titleType);
      }

      url += `?${searchParams.toString()}`;
    }

    const response = await authFetch(url);

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      const message = errorData.errorMessage || "Failed to fetch movies from backend";
      console.error("Error fetching movies:", response.body);
      throw new Error(message);
    }

    const data: BackendPaginatedResponse = await response.json();

    // Build ratingsMap from embedded groupRatings
    const ratingsMap: Record<string, Rating[]> = {};
    data.Content.forEach((movie) => {
      if (movie.groupRatings && movie.groupRatings.length > 0) {
        ratingsMap[movie.id] = movie.groupRatings;
      } else {
        ratingsMap[movie.id] = [];
      }
    });

    return {
      Page: data.Page,
      Size: data.Size,
      TotalPages: data.TotalPages,
      TotalResults: data.TotalResults,
      Content: data.Content.map((movie) => mapBackendMovieToMovie(movie)),
      ratingsMap,
    };
  } catch (error) {
    console.error("Error fetching movies:", error);
    throw error;
  }
};

/**
 * One group's view of one title — the same object GET /groups/{id}/titles
 * returns inside its `Content`, unwrapped.
 *
 * It exists because that list is paginated: a client holding only a title id
 * (the activity feed, deep-linking a row to that title's modal) cannot count on
 * the entry being on whichever page the grid happens to be showing. The backend
 * builds it through the same assembly as the list, so the result is safe to
 * feed to anything that renders a list entry.
 *
 * ## Why authFetch and not activityFetch
 *
 * Both distinctions matter here:
 *
 * - This is a `/groups` route, served whether or not the backend runs with the
 *   activity feed switched on. Its 404 is a real, expected answer about one
 *   title — mapping it to ActivityFeatureDisabledError the way the activity
 *   routes do would be the "every 404 means the feature is off" bug all over
 *   again, and would hide the whole bell over one removed film.
 * - It is called from a click, not a background poll. activityFetch declines to
 *   redirect on 401 precisely because a poll must not eject a user mid-session;
 *   a 401 on something the user just asked for *should* land them on /login,
 *   which is what authFetch does.
 *
 * `groupRatings` is null rather than [] when the group has rated nothing, so it
 * is normalized to an array here — every consumer downstream takes a list.
 */
export const fetchGroupTitle = async (
  groupId: string,
  titleId: string
): Promise<{ movie: Movie; ratings: Rating[] }> => {
  const response = await authFetch(
    `${API_BASE_URL}/groups/${encodeURIComponent(groupId)}/titles/${encodeURIComponent(titleId)}`
  );

  // Answered before the body is read: every 404 from this route carries the same
  // uninformative message by design, so there is nothing in it to surface.
  if (response.status === 404) {
    throw new TitleNotInGroupError();
  }

  if (!response.ok) {
    let message = "Failed to load the title";
    try {
      const errorData: ErrorResponse = await response.json();
      message = errorData.errorMessage || message;
    } catch {
      // A body that will not parse is not worth failing differently over.
    }
    console.error("Error fetching group title:", response.status, message);
    throw new Error(message);
  }

  const data: BackendMovie = await response.json();

  return {
    movie: mapBackendMovieToMovie(data),
    ratings: data.groupRatings ?? [],
  };
};

export const addMovieToBackend = async (
  groupId: string,
  url: string
): Promise<{ error?: string }> => {
  try {
    const response = await authFetch(`${API_BASE_URL}/groups/titles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, groupId }),
    });

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      const message = errorData.errorMessage || "Failed to add movie";
      console.log("Error adding movie:", errorData);
      return { error: message };
    }

    // Success - API returns just a string notification
    // Caller should refresh the movies list
    return {};
  } catch (error) {
    console.error("Error adding movie:", error);
    throw error;
  }
};

export const searchTitles = async (
  query: string,
  limit: number = 10
): Promise<SearchTitle[]> => {
  const encodedQuery = encodeURIComponent(query.trim());
  const url = `${API_BASE_URL}/titles/search?query=${encodedQuery}&limit=${limit}`;
  const response = await authFetch(url);
  if (!response.ok) {
    const errorData: ErrorResponse = await response.json();
    const message = errorData.errorMessage || "Failed to search titles";
    throw new Error(message);
  }
  return response.json();
};

export const fetchEpisodes = async (titleId: string): Promise<Episode[]> => {
  const response = await authFetch(`${API_BASE_URL}/titles/${titleId}/episodes`);
  if (!response.ok) {
    const errorData: ErrorResponse = await response.json();
    throw new Error(errorData.errorMessage || "Failed to fetch episodes");
  }
  const data: { episodes?: BackendEpisode[] } = await response.json();
  return (data.episodes ?? []).map(mapBackendEpisode);
};

/*
 * Returns UserResponse, not User.
 *
 * This was typed `Promise<User[]>`, and `User` has no `email` — while the
 * endpoint returns the full user object and `GroupMembersModal` reads
 * `member.email` off it. The result was three type errors that had been sitting
 * on main long enough to look like background noise, when what they were
 * actually reporting is that this signature described the wrong shape.
 * Verified against a live response: id, username, email, name, groups,
 * lastLoginAt, createdAt, updatedAt.
 */
export const fetchUsers = async (groupId: string): Promise<UserResponse[]> => {
  try {
    const response = await authFetch(`${API_BASE_URL}/groups/${groupId}/users`);

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      const message = errorData.errorMessage || "Failed to fetch users";
      console.log("Error fetching users:", errorData);
      throw new Error(message);
    }

    const data: UsersResponse = await response.json();
    return data.users;
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
};

export const updateRating = async (
  ratingId: string,
  ratingData: {
    note: number;
    season?: number;
  }
): Promise<Rating> => {
  try {
    // Normalized here as well as at the input, so no caller can put a note the
    // backend would 400 on (ErrNoteTooPrecise) onto the wire.
    const body: { note: number; season?: number } = { note: normalizeNote(ratingData.note) };
    if (ratingData.season !== undefined) {
      body.season = ratingData.season;
    }

    const response = await authFetch(`${API_BASE_URL}/ratings/${ratingId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      const message = errorData.errorMessage || "Failed to update rating";
      console.log("Error updating rating:", errorData);
      throw new Error(message);
    }

    const rating: Rating = await response.json();
    return rating;
  } catch (error) {
    console.error("Error updating rating:", error);
    throw error;
  }
};

export const saveOrUpdateRating = async (
  ratingData: {
    groupId: string;
    titleId: string;
    note: number;
    userId: string;
    season?: number;
  },
  existingRatings: Rating[]
): Promise<Rating> => {
  // Check if rating already exists for this user, movie and group
  // Note: We check by userId, titleId AND groupId because a rating is a fact about
  // (user, title, group): the same user can legitimately hold one rating per group for
  // the same title. Matching on (user, title) alone could pick another group's rating
  // and PATCH it, silently overwriting it. The server already scopes the list it returns,
  // but we assert the group here rather than depend on that.
  const existingRating = existingRatings.find(
    (rating) =>
      rating.titleId === ratingData.titleId &&
      rating.userId === ratingData.userId &&
      rating.groupId === ratingData.groupId
  );

  if (existingRating) {
    // For TV series with season, check if the season already exists in seasonsRatings
    if (ratingData.season !== undefined) {
      const seasonKey = String(ratingData.season);
      const seasonExists = existingRating.seasonsRatings && 
                         existingRating.seasonsRatings[seasonKey] !== undefined;
      
      if (seasonExists) {
        // Season exists, update it
        return updateRating(existingRating.id, {
          note: ratingData.note,
          season: ratingData.season,
        });
      } else {
        // Rating exists but season doesn't, add new season (use POST)
        return saveRating(ratingData);
      }
    } else {
      // For movies (no season), update existing rating
      return updateRating(existingRating.id, {
        note: ratingData.note,
        season: ratingData.season,
      });
    }
  } else {
    // Create new rating
    return saveRating(ratingData);
  }
};

export const saveRating = async (ratingData: {
  groupId: string;
  titleId: string;
  note: number;
  season?: number;
}): Promise<Rating> => {
  try {
    const body: { groupId: string; titleId: string; note: number; season?: number } = {
      groupId: ratingData.groupId,
      titleId: ratingData.titleId,
      // See updateRating: one decimal is a contract, enforced on every path out.
      note: normalizeNote(ratingData.note),
    };
    if (ratingData.season !== undefined) {
      body.season = ratingData.season;
    }
    
    const response = await authFetch(`${API_BASE_URL}/ratings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      const message = errorData.errorMessage || "Failed to save rating";
      console.log("Error saving rating:", errorData);
      throw new Error(message);
    }

    const rating: Rating = await response.json();
    return rating;
  } catch (error) {
    console.error("Error saving rating:", error);
    throw error;
  }
};

export const deleteRating = async (ratingId: string): Promise<void> => {
  try {
    const response = await authFetch(`${API_BASE_URL}/ratings/${ratingId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      const message = errorData.errorMessage || "Failed to delete rating";
      console.log("Error deleting rating:", errorData);
      throw new Error(message);
    }
  } catch (error) {
    console.error("Error deleting rating:", error);
    throw error;
  }
};

export const deleteRatingSeason = async (ratingId: string, season: number): Promise<void> => {
  try {
    const response = await authFetch(`${API_BASE_URL}/ratings/${ratingId}/seasons/${season}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      const message = errorData.errorMessage || "Failed to delete season rating";
      console.log("Error deleting season rating:", errorData);
      throw new Error(message);
    }
  } catch (error) {
    console.error("Error deleting season rating:", error);
    throw error;
  }
};

export const updateMovieWatchedStatus = async (
  groupId: string,
  titleId: string,
  watched: boolean,
  watchedAt: string,
  season?: number
): Promise<void> => {
  try {
    const body: { titleId: string; watched: boolean; watchedAt: string; season?: number } = { 
      titleId, 
      watched, 
      watchedAt 
    };
    if (!watched) {
      console.log('Setting watchedAt to empty string for title ID', titleId);
      body.watchedAt = '';
    }
    if (season !== undefined) {
      body.season = season;
    }

    const response = await authFetch(`${API_BASE_URL}/groups/${groupId}/titles`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      const message = errorData.errorMessage || "Failed to update watched status";
      console.log("Error updating watched status:", errorData);
      throw new Error(message);
    }
  } catch (error) {
    console.error("Error updating watched status:", error);
    throw error;
  }
};

export const deleteMovie = async (groupId: string, titleId: string): Promise<void> => {
  try {
    const response = await authFetch(`${API_BASE_URL}/groups/${groupId}/titles/${titleId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      const message = errorData.errorMessage || "Failed to delete movie";
      console.log("Error deleting movie:", errorData);
      throw new Error(message);
    }
  } catch (error) {
    console.error("Error deleting movie:", error);
    throw error;
  }
};

// Comments endpoints
export const fetchComments = async (groupId: string, titleId: string): Promise<Comment[]> => {
  try {
    const response = await authFetch(`${API_BASE_URL}/groups/${groupId}/titles/${titleId}/comments`);

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      const message = errorData.errorMessage || "Failed to fetch comments";
      console.log("Error fetching comments:", errorData);
      throw new Error(message);
    }

    const data: CommentsResponse = await response.json();
    return Array.isArray(data.comments) ? data.comments : [];
  } catch (error) {
    console.error("Error fetching comments:", error);
    throw error;
  }
};

export const createComment = async (
  groupId: string,
  titleId: string,
  comment: string,
  season?: number
): Promise<Comment> => {
  try {
    const body: { groupId: string; titleId: string; comment: string; season?: number } = {
      groupId,
      titleId,
      comment,
    };
    if (season !== undefined) {
      body.season = season;
    }
    
    const response = await authFetch(`${API_BASE_URL}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      const message = errorData.errorMessage || "Failed to create comment";
      console.log("Error creating comment:", errorData);
      throw new Error(message);
    }

    const commentData: Comment = await response.json();
    return commentData;
  } catch (error) {
    console.error("Error creating comment:", error);
    throw error;
  }
};

export const updateComment = async (
  groupId: string,
  titleId: string,
  commentId: string,
  comment: string,
  season?: number
): Promise<Comment> => {
  try {
    const body: { comment: string; season?: number } = { comment };
    if (season !== undefined) {
      body.season = season;
    }
    
    const response = await authFetch(`${API_BASE_URL}/groups/${groupId}/titles/${titleId}/comments/${commentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      const message = errorData.errorMessage || "Failed to update comment";
      console.log("Error updating comment:", errorData);
      throw new Error(message);
    }

    const commentData: Comment = await response.json();
    return commentData;
  } catch (error) {
    console.error("Error updating comment:", error);
    throw error;
  }
};

export const deleteComment = async (groupId: string, titleId: string, commentId: string): Promise<void> => {
  try {
    const response = await authFetch(`${API_BASE_URL}/groups/${groupId}/titles/${titleId}/comments/${commentId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      const message = errorData.errorMessage || "Failed to delete comment";
      console.log("Error deleting comment:", errorData);
      throw new Error(message);
    }
  } catch (error) {
    console.error("Error deleting comment:", error);
    throw error;
  }
};

// Delete a single season's comment for a TV series (keeps other seasons' comments intact)
export const deleteCommentSeason = async (
  groupId: string,
  titleId: string,
  commentId: string,
  season: number
): Promise<void> => {
  try {
    const response = await authFetch(
      `${API_BASE_URL}/groups/${groupId}/titles/${titleId}/comments/${commentId}/seasons/${season}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      const message = errorData.errorMessage || "Failed to delete season comment";
      console.log("Error deleting season comment:", errorData);
      throw new Error(message);
    }
  } catch (error) {
    console.error("Error deleting season comment:", error);
    throw error;
  }
};

// User endpoints
export const fetchMe = async (): Promise<UserResponse> => {
  try {
    const response = await authFetch(`${API_BASE_URL}/users/me`);
    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      const message = errorData.errorMessage || "Failed to fetch user";
      console.log("Error fetching current user:", errorData);
      throw new Error(message);
    }
    const user: UserResponse = await response.json();
    return user;
  } catch (error) {
    console.error("Error fetching current user:", error);
    throw error;
  }
};

// Group management endpoints
export interface Group {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  memberCount?: number;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
}

export interface UpdateGroupRequest {
  name?: string;
  description?: string;
}

export const fetchGroupById = async (groupId: string): Promise<GroupResponse> => {
  try {
    const response = await authFetch(`${API_BASE_URL}/groups/${groupId}`);

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      const message = errorData.errorMessage || "Failed to fetch group";
      console.log("Error fetching group:", errorData);
      throw new Error(message);
    }

    const group: GroupResponse = await response.json();
    return group;
  } catch (error) {
    console.error("Error fetching group:", error);
    throw error;
  }
};

export const fetchGroups = async (): Promise<Group[]> => {
  // TODO: Implement when GET /api/groups endpoint is available
  // For now, fetch individual groups using fetchGroupById
  throw new Error("Endpoint not yet implemented");
};

export const createGroup = async (groupData: CreateGroupRequest): Promise<Group> => {
  // TODO: Implement when POST /api/groups endpoint is available
  try {
    const response = await authFetch(`${API_BASE_URL}/groups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(groupData),
    });

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      const message = errorData.errorMessage || "Failed to create group";
      console.log("Error creating group:", errorData);
      throw new Error(message);
    }

    const group: Group = await response.json();
    return group;
  } catch (error) {
    console.error("Error creating group:", error);
    throw error;
  }
};

export const updateGroup = async (groupId: string, groupData: UpdateGroupRequest): Promise<Group> => {
  // TODO: Implement when PATCH /api/groups/{groupId} endpoint is available
  try {
    const response = await authFetch(`${API_BASE_URL}/groups/${groupId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(groupData),
    });

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      const message = errorData.errorMessage || "Failed to update group";
      console.log("Error updating group:", errorData);
      throw new Error(message);
    }

    const group: Group = await response.json();
    return group;
  } catch (error) {
    console.error("Error updating group:", error);
    throw error;
  }
};

export const deleteGroup = async (groupId: string): Promise<void> => {
  // TODO: Implement when DELETE /api/groups/{groupId} endpoint is available
  try {
    const response = await authFetch(`${API_BASE_URL}/groups/${groupId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      const message = errorData.errorMessage || "Failed to delete group";
      console.log("Error deleting group:", errorData);
      throw new Error(message);
    }
  } catch (error) {
    console.error("Error deleting group:", error);
    throw error;
  }
};

export const leaveGroup = async (groupId: string, userId: string): Promise<void> => {
  try {
    const response = await authFetch(`${API_BASE_URL}/groups/${groupId}/users/${userId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      let message = "Failed to leave group";
      try {
        const errorData: ErrorResponse = await response.json();
        message = errorData.errorMessage || message;
        console.log("Error leaving group:", errorData);
      } catch {
        // Non-JSON or empty error body; fall back to default message
      }
      throw new Error(message);
    }
  } catch (error) {
    console.error("Error leaving group:", error);
    throw error;
  }
};

export const inviteToGroup = async (groupId: string, email: string): Promise<void> => {
  // TODO: Implement when POST /api/groups/{groupId}/invite endpoint is available
  try {
    const response = await authFetch(`${API_BASE_URL}/groups/${groupId}/invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      const message = errorData.errorMessage || "Failed to invite user";
      console.log("Error inviting user:", errorData);
      throw new Error(message);
    }
  } catch (error) {
    console.error("Error inviting user:", error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

/**
 * Like authFetch, but it never redirects to /login.
 *
 * The activity feed is polled in the background, and authFetch turns any 401
 * into window.location.replace('/login'). A poll firing on a just-expired token
 * would therefore eject the user mid-session with no interaction from them —
 * possibly mid-form. This is the app's first background poller, so it is the
 * first place that matters.
 *
 * Instead the caller gets a typed error and the hook stops polling. The user
 * keeps whatever they were doing; the next request they actually initiate goes
 * through authFetch and redirects properly.
 */
const activityFetch = async (
  url: string,
  options: RequestInit = {},
  // Whether a 404 on this route means "the feature is switched off".
  //
  // True for every route whose only 404 is a missing route. NOT true for
  // POST /activity/events/{id}/read, which also answers 404 for an id that is
  // unknown, not visible to you, or your own action — reading that as "the
  // feature is off" would let one bad row silence the whole bell.
  { disabledOn404 = true }: { disabledOn404?: boolean } = {}
) => {
  const token = getToken();
  if (!token) throw new ActivitySessionExpiredError();

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) throw new ActivitySessionExpiredError();
  // The routes only exist when the backend runs with ACTIVITY_FEED_ENABLED.
  if (disabledOn404 && response.status === 404) throw new ActivityFeatureDisabledError();

  return response;
};

export const fetchActivityFeed = async (
  params: { limit?: number; before?: number } = {}
): Promise<ActivityFeed> => {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.before) query.set("before", String(params.before));

  const response = await activityFetch(`${API_BASE_URL}/activity?${query}`);
  if (!response.ok) throw new Error("Failed to load activity");
  return response.json();
};

export const fetchActivityUnreadCount = async (): Promise<ActivityUnreadCount> => {
  const response = await activityFetch(`${API_BASE_URL}/activity/unread-count`);
  if (!response.ok) throw new Error("Failed to load the unread count");
  return response.json();
};

/**
 * Mints a ticket for the SSE stream.
 *
 * Goes through activityFetch for the same reason the polls do: this runs in
 * the background, on connect and on every reconnect, and a 401 from it must
 * not throw the user at /login mid-session.
 *
 * The ticket is single-use with a short TTL, so a caller must mint a fresh one
 * per connection attempt and never cache one.
 */
export const fetchActivityStreamTicket = async (): Promise<ActivityStreamTicket> => {
  const response = await activityFetch(`${API_BASE_URL}/activity/stream-ticket`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to open the activity stream");
  return response.json();
};

/**
 * The URL EventSource connects to.
 *
 * The ticket travels in the query string because EventSource cannot set
 * headers — which is also why it is a ticket and not the JWT: a query string
 * ends up in access logs and browser history, and a ticket that leaks there is
 * already spent and expired.
 */
export const activityStreamUrl = (ticket: string): string =>
  `${API_BASE_URL}/activity/stream?ticket=${encodeURIComponent(ticket)}`;

/**
 * Mark exactly one event read.
 *
 * Read state is per event, so the row is named in the path and there is no
 * body: a request with no body cannot be half-decoded into the wrong event.
 * Idempotent — marking an already-read row read again is a 204.
 *
 * A 404 here means the id is unknown, not visible to this user, or their own
 * action. That is a bad row, not a switched-off feature, so it is deliberately
 * NOT mapped to ActivityFeatureDisabledError (which would hide the bell).
 */
export const markActivityEventRead = async (eventId: string): Promise<void> => {
  const response = await activityFetch(
    `${API_BASE_URL}/activity/events/${encodeURIComponent(eventId)}/read`,
    { method: "POST" },
    { disabledOn404: false }
  );
  if (!response.ok) throw new Error("Failed to mark activity as read");
};

/**
 * Clear the badge in one call. No body, idempotent, 204.
 *
 * Its only 404 is a missing route, so the default mapping applies.
 */
export const markAllActivityRead = async (): Promise<void> => {
  const response = await activityFetch(`${API_BASE_URL}/activity/read-all`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to mark all activity as read");
};
