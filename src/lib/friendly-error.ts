/**
 * One plain sentence for a failed request, for toasts and inline errors.
 * Supabase errors aren't Error objects, so `err.message` checks showed
 * "Unknown error", and where the message did get through it was database
 * wording (constraint and policy names). Details belong in the logs.
 */
export function friendlyError(err: unknown): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You're offline. Try again when you're back online.";
  }
  const { code, message } = (err ?? {}) as {
    code?: string;
    message?: string;
  };
  // fetch rejects with a TypeError when the network fails.
  if (
    err instanceof TypeError ||
    /failed to fetch|network/i.test(message ?? "")
  )
    return "Couldn't reach Presense. Check your connection and try again.";
  switch (code) {
    case "23505":
      return "That's already there.";
    case "42501":
    case "PGRST301":
      return "Your session may have ended. Reload the page and try again.";
    case "23514":
    case "22001":
    case "22P02":
      return "That didn't look right. Check it and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
