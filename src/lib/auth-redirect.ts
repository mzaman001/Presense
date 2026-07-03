const DEFAULT_LOCAL_ORIGIN = "http://localhost:3000";

export function getAuthCallbackUrl(currentUrl: string, callbackPath = "/auth/callback") {
  try {
    const url = new URL(currentUrl);
    return new URL(callbackPath, url.origin).toString();
  } catch {
    return new URL(callbackPath, DEFAULT_LOCAL_ORIGIN).toString();
  }
}

