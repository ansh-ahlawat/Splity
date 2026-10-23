const ACCESS_TOKEN_KEY = 'splity_access_token';
const REFRESH_TOKEN_KEY = 'splity_refresh_token';
const USER_KEY = 'splity_user';

let accessTokenMemory: string | null = null;

try {
  accessTokenMemory = localStorage.getItem(ACCESS_TOKEN_KEY);
} catch {
  accessTokenMemory = null;
}

const DEFAULT_PROD_API = 'https://ihdzjbx00d.execute-api.ap-southeast-2.amazonaws.com';

const API_BASE: string =
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL)) ||
  (typeof window !== 'undefined' && (window.location.hostname.includes('amplifyapp.com') || window.location.hostname.includes('awsapprunner.com'))
    ? DEFAULT_PROD_API
    : '');

function resolveUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  if (!API_BASE) {
    return endpoint;
  }
  const cleanBase = API_BASE.replace(/\/+$/, '');
  const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${cleanBase}${cleanPath}`;
}

export function setAccessToken(token: string | null) {
  accessTokenMemory = token;
  try {
    if (token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  } catch {}
}

export function getAccessToken(): string | null {
  if (!accessTokenMemory) {
    try {
      accessTokenMemory = localStorage.getItem(ACCESS_TOKEN_KEY);
    } catch {}
  }
  return accessTokenMemory;
}

export function setRefreshToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {}
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredUser(user: any | null) {
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch {}
}

export function getStoredUser(): any | null {
  try {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  accessTokenMemory = null;
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {}
}

export function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const decoded = JSON.parse(jsonPayload);
    // Token is valid if expiration is at least 10 seconds in the future
    return typeof decoded.exp === 'number' && decoded.exp * 1000 > Date.now() + 10000;
  } catch {
    return false;
  }
}

async function safeParseJson(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await response.json().catch(() => ({}));
  }
  const text = await response.text();
  if (text.trim().startsWith('<')) {
    throw new Error(`Server returned HTML (${response.status}). Ensure API route exists on server.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

let refreshPromise: Promise<{ accessToken: string; user?: any; refreshToken?: string } | null> | null = null;

export async function refreshAuthTokens(): Promise<{ accessToken: string; user?: any; refreshToken?: string } | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  const currentRefreshToken = getRefreshToken();

  refreshPromise = (async () => {
    try {
      const res = await fetch(resolveUrl('/api/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: currentRefreshToken }),
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error(`Refresh returned status ${res.status}`);
      }

      const data = await safeParseJson(res);
      if (data.accessToken) {
        setAccessToken(data.accessToken);
        if (data.refreshToken) {
          setRefreshToken(data.refreshToken);
        }
        if (data.user) {
          setStoredUser(data.user);
        }
        return {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
        };
      }
      return null;
    } catch (err) {
      clearAuthSession();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  let token = getAccessToken();
  const isAuthEndpoint = endpoint.includes('/auth/');

  // If token is expired and refreshToken exists, proactively refresh before sending request
  if (!isAuthEndpoint && token && !isTokenValid(token) && getRefreshToken()) {
    const refreshed = await refreshAuthTokens();
    if (refreshed?.accessToken) {
      token = refreshed.accessToken;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const targetUrl = resolveUrl(endpoint);

  const response = await fetch(targetUrl, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && !isAuthEndpoint) {
    // Try to refresh token once with mutex
    const refreshed = await refreshAuthTokens();
    if (refreshed?.accessToken) {
      headers['Authorization'] = `Bearer ${refreshed.accessToken}`;

      const retryRes = await fetch(targetUrl, {
        ...options,
        headers,
        credentials: 'include',
      });
      if (!retryRes.ok) {
        const errData = await safeParseJson(retryRes);
        throw new Error(errData.error || `HTTP ${retryRes.status}`);
      }
      return await safeParseJson(retryRes);
    }
  }

  if (!response.ok) {
    const errorBody = await safeParseJson(response);
    throw new Error(errorBody.error || `Request failed with status ${response.status}`);
  }

  return await safeParseJson(response);
}
