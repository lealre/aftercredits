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
} from "@/types/movie";
import {
  getToken,
  getTokenOrRedirect,
  handleUnauthorized,
  getErrorMessage,
  getGroupId,
} from "./authService";

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

interface BackendEpisode {
  id: string;
  title: string;
  season: string;
  episodeNumber: number;
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
    episodes: backendMovie.episodes?.map(ep => ({
      id: ep.id,
      title: ep.title,
      season: ep.season,
      episodeNumber: ep.episodeNumber,
      releaseDate: ep.releaseDate ? {
        year: ep.releaseDate.year,
        month: ep.releaseDate.month,
        day: ep.releaseDate.day,
      } : undefined,
    })),
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

export const fetchUsers = async (groupId: string): Promise<User[]> => {
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
    const body: { note: number; season?: number } = { note: ratingData.note };
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
  // Check if rating already exists for this user and movie
  // Note: We check by both userId and titleId to ensure we match the correct user's rating
  const existingRating = existingRatings.find(
    (rating) =>
      rating.titleId === ratingData.titleId &&
      rating.userId === ratingData.userId
  );

  if (existingRating) {
    // Update existing rating
    return updateRating(existingRating.id, {
      note: ratingData.note,
      season: ratingData.season,
    });
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
      note: ratingData.note,
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
export const fetchUserById = async (userId: string): Promise<UserResponse> => {
  try {
    const response = await authFetch(`${API_BASE_URL}/users/${userId}`);

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      const message = errorData.errorMessage || "Failed to fetch user";
      console.log("Error fetching user:", errorData);
      throw new Error(message);
    }

    const user: UserResponse = await response.json();
    return user;
  } catch (error) {
    console.error("Error fetching user:", error);
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
