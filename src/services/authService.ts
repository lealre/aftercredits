const API_BASE_URL = "/api";
const TOKEN_KEY = "access_token";
const USER_ID_KEY = "user_id";
const GROUP_ID_KEY = "group_id";

export interface LoginRequest {
  username?: string;
  email?: string;
  password: string;
}

export interface LoginResponse {
  id: string;
  email: string;
  username: string;
  name?: string;
  avatarUrl?: string | null;
  groups: string[];
  lastLoginAt?: string | null;
  accessToken: string;
}

// An alias, not an extension: the success shape IS the login response.
// Declared as an empty `extends` it read as "more fields to come".
export type LoginSuccess = LoginResponse;

export interface NewUserRequest {
  username?: string;
  name?: string;
  email?: string;
  password: string;
}

export interface ErrorResponse {
  statusCode: number;
  errorMessage: string;
}

type ErrorResponseType =
  | { statusCode?: number; errorMessage?: string };

const redirectToLogin = (message?: string) => {
  const params = message ? `?error=${encodeURIComponent(message)}` : "";
  window.location.replace(`/login${params}`);
};

export const login = async (payload: LoginRequest): Promise<LoginSuccess> => {
  const { username, email, password } = payload;
  if (!username && !email) {
    throw new Error("Username or email is required");
  }

  const response = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      email,
      password,
    }),
  });

  if (!response.ok) {
    let message = "Login failed";
    try {
      const errorBody: unknown = await response.json();
      message = getErrorMessage(errorBody) || message;
    } catch {
      // ignore parse errors and use default message
    }
    throw new Error(message);
  }

  const data: LoginResponse = await response.json();
  if (!data?.accessToken) {
    throw new Error("Invalid login response");
  }

  return {
    ...data,
    lastLoginAt: data.lastLoginAt ?? null,
    avatarUrl: data.avatarUrl ?? null,
  };
};

export const saveLoginData = (data: LoginSuccess) => {
  localStorage.setItem(TOKEN_KEY, data.accessToken);
  localStorage.setItem(USER_ID_KEY, data.id);
  // Reset the active-group pointer for the new session: a user without groups
  // must not inherit the previous account's group_id.
  if (data.groups?.length) {
    localStorage.setItem(GROUP_ID_KEY, data.groups[0]);
  } else {
    localStorage.removeItem(GROUP_ID_KEY);
  }
  notifyGroupIdChanged();
};

export const getToken = () => localStorage.getItem(TOKEN_KEY) ?? "";

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(GROUP_ID_KEY);
  notifyGroupIdChanged();
};

export const getUserId = (): string | null => {
  return localStorage.getItem(USER_ID_KEY);
};

// localStorage is not reactive, but the active group now feeds query keys and the
// group term of every rating/comment predicate. Writes are broadcast so subscribers
// (see useActiveGroupId) re-render onto the new group instead of keeping the old one.
const groupIdListeners = new Set<() => void>();

const notifyGroupIdChanged = () => {
  groupIdListeners.forEach((listener) => listener());
};

export const subscribeToGroupId = (listener: () => void): (() => void) => {
  groupIdListeners.add(listener);
  return () => {
    groupIdListeners.delete(listener);
  };
};

export const saveGroupId = (groupId: string) => {
  localStorage.setItem(GROUP_ID_KEY, groupId);
  notifyGroupIdChanged();
};

export const getGroupId = (): string | null => {
  return localStorage.getItem(GROUP_ID_KEY);
};

export const clearGroupId = () => {
  localStorage.removeItem(GROUP_ID_KEY);
  notifyGroupIdChanged();
};

export const getTokenOrRedirect = () => {
  const token = getToken();
  if (!token) {
    redirectToLogin("Login required");
    return null;
  }
  return token;
};

export const handleUnauthorized = (message?: string) => {
  clearToken();
  redirectToLogin(message || "Session expired. Please log in again.");
};

/**
 * Pull a human-readable message out of an error body of unknown shape.
 *
 * Declared as returning `string` rather than inferring: every field read off
 * an unknown object is itself `unknown`, so inference would hand callers a
 * value they cannot assign to anything, and the previous `any` casts were
 * hiding that rather than solving it. The guard plus one index signature is
 * what makes the reads legitimate; `String()` is what makes the result usable
 * regardless of what the server actually put there.
 */
export const getErrorMessage = (data: unknown): string => {
  if (!data || typeof data !== "object") return "";
  const body = data as Record<string, unknown>;
  const message = body.errorMessage ?? body.ErrorMessage ?? body.error;
  return typeof message === "string" ? message : message ? String(message) : "";
};

export const createUser = async (payload: NewUserRequest): Promise<void> => {
  const { username, email, password, name } = payload;
  
  // Validation: either username or email must not be empty
  if (!username && !email) {
    throw new Error("Either username or email must be provided");
  }

  const response = await fetch(`${API_BASE_URL}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: username || undefined,
      email: email || undefined,
      password,
      name: name || undefined,
    }),
  });

  if (!response.ok) {
    let message = "Error creating user";
    
    // Handle 400 errors specifically
    if (response.status === 400) {
      try {
        const errorBody: ErrorResponse = await response.json();
        if (errorBody?.errorMessage) {
          message = errorBody.errorMessage;
        }
      } catch {
        // If parsing fails, use the generic fallback message
        message = "Error creating user";
      }
    } else {
      // For other errors, try to parse but fallback to generic message
      try {
        const errorBody: ErrorResponse = await response.json();
        if (errorBody?.errorMessage) {
          message = errorBody.errorMessage;
        }
      } catch {
        message = "Error creating user";
      }
    }
    
    throw new Error(message);
  }
};

