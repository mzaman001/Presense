import { redirect } from "next/navigation";

/**
 * Web Share Target (manifest `share_target`). Android's share sheet sends
 * title/text/url here as a GET form, which drops any query string in the
 * target itself, so this route adds `capture=1` and hands over to
 * CaptureShortcut, which opens Quick Capture with the shared text filled in.
 */
export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = new URLSearchParams({ capture: "1" });
  for (const key of ["title", "text", "url"]) {
    const value = params[key];
    if (typeof value === "string" && value.trim()) {
      next.set(key, value.slice(0, 2000));
    }
  }
  redirect(`/?${next.toString()}`);
}
