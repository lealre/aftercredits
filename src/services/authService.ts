const API_BASE_URL = "/api";
const TOKEN_KEY = "access_token";
const LOGIN_DATA_KEY = "login_data";

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

export interface LoginSuccess extends LoginResponse {}

type ErrorResponse =
  | { statusCode?: number; errorMessage?: string };

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
      const errorBody: ErrorResponse = await response.json();
      message =
        (errorBody as any)?.errorMessage ||
        message;
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
  localStorage.setItem(LOGIN_DATA_KEY, JSON.stringify(data));
  localStorage.setItem(TOKEN_KEY, data.accessToken);
};

export const getToken = () => localStorage.getItem(TOKEN_KEY) ?? "";

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LOGIN_DATA_KEY);
};

export const getLoginData = (): LoginSuccess | undefined => {
  try {
    const stored = localStorage.getItem(LOGIN_DATA_KEY);
    if (!stored) return undefined;
    return JSON.parse(stored) as LoginSuccess;
  } catch {
    return undefined;
  }
};

