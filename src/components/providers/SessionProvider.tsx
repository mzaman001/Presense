"use client";

import { createContext, useContext } from "react";

/**
 * The authenticated user's id, published once by the app layout.
 *
 * Every client query needs `user_id` to scope its filter. Before this
 * provider each one called `supabase.auth.getUser()` first, and that call is
 * a network round trip to the Supabase auth server on every invocation — a
 * single navigation could spend three or four of them before any data was
 * requested.
 *
 * The id is safe to hand down from the server: `src/proxy.ts` validates the
 * JWT with `getUser()` on every matched request, and the app layout only
 * renders for a user that check accepted. Authorization itself never depends
 * on this value — row ownership is enforced by RLS (`users_own_*`, scoped
 * `TO authenticated` with `(select auth.uid()) = user_id`), so a tampered id
 * in the browser widens nothing; it only changes which rows the client asks
 * for, and Postgres still refuses anything the session does not own.
 */
export interface SessionUser {
  id: string;
  email: string;
}

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={user}>{children}</SessionContext.Provider>
  );
}

/** The current user's id and email, as validated on the server. */
export function useSessionUser(): SessionUser {
  const user = useContext(SessionContext);
  if (user === null) {
    throw new Error("useSessionUser must be used within a SessionProvider");
  }
  return user;
}

/**
 * The current user's id. Throws outside the app layout, which is deliberate:
 * a component that needs a user id but renders on a public route is a bug
 * that should surface in development rather than fetch an empty result set.
 */
export function useUserId(): string {
  return useSessionUser().id;
}
