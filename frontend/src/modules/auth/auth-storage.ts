const ACCESS_TOKEN_STORAGE_KEY = "ims.accessToken";

// The only place in the app that touches storage for the access token.
// Only the opaque token string is ever kept here — never a password,
// passwordHash, or anything else from the login/me response.
export function getStoredAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredAccessToken(token: string): void {
  try {
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  } catch {
    // Storage can be unavailable (private browsing, quota, disabled
    // storage) — login still succeeds, it just won't survive a refresh.
  }
}

export function clearStoredAccessToken(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    // no-op — nothing to clean up if storage was never reachable.
  }
}
