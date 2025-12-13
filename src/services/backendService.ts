import {
  Movie,
  User,
  UsersResponse,
  Rating,
  Comment,
  CommentsResponse,
  PaginatedResponse,
  PaginationParams,
} from "@/types/movie";
import {
  getTokenOrRedirect,
  handleUnauthorized,
  getErrorMessage,
  getGroupId,
} from "./authService";

const API_BASE_URL = "/api";

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
  const token = getTokenOrRedirect();
  if (!token) {
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
      handleUnauthorized(message);
      throw new Error(message);
    } catch (err) {
      handleUnauthorized("Session expired");
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
  }
): Promise<Rating> => {
  try {
    const response = await authFetch(`${API_BASE_URL}/ratings/${ratingId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(ratingData),
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
}): Promise<Rating> => {
  try {
    const response = await authFetch(`${API_BASE_URL}/ratings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupId: ratingData.groupId,
        titleId: ratingData.titleId,
        note: ratingData.note,
      }),
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
  watchedAt: string
): Promise<void> => {
  try {
    const body: { titleId: string; watched: boolean; watchedAt: string } = { 
      titleId, 
      watched, 
      watchedAt 
    };
    if (!watched) {
      console.log('Setting watchedAt to empty string for title ID', titleId);
      body.watchedAt = '';
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
  comment: string
): Promise<Comment> => {
  try {
    const response = await authFetch(`${API_BASE_URL}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupId,
        titleId,
        comment,
      }),
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
  comment: string
): Promise<Comment> => {
  try {
    const response = await authFetch(`${API_BASE_URL}/groups/${groupId}/titles/${titleId}/comments/${commentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment }),
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

// Group management endpoints
// TODO: Implement these when backend endpoints are available

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

export const fetchGroups = async (): Promise<Group[]> => {
  // TODO: Implement when GET /api/groups endpoint is available
  // For now, groups are available from loginData
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
