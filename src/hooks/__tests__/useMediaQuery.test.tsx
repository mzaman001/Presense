import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useMediaQuery } from "@/hooks/useMediaQuery";

// jsdom has no matchMedia. This fake keeps one MediaQueryList per query so a
// test can flip `matches` and fire "change", the way a browser does when the
// window is resized or a pointer is plugged in.
type Listener = (e: { matches: boolean }) => void;
const lists = new Map<
  string,
  {
    matches: boolean;
    listeners: Set<Listener>;
    add: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  }
>();

function setMatches(query: string, matches: boolean) {
  const list = lists.get(query)!;
  list.matches = matches;
  list.listeners.forEach((l) => l({ matches }));
}

function installMatchMedia(initial: Record<string, boolean>) {
  lists.clear();
  for (const [query, matches] of Object.entries(initial)) {
    const listeners = new Set<Listener>();
    lists.set(query, {
      matches,
      listeners,
      add: vi.fn((_: string, l: Listener) => listeners.add(l)),
      remove: vi.fn((_: string, l: Listener) => listeners.delete(l)),
    });
  }
  window.matchMedia = vi.fn((query: string) => {
    const list = lists.get(query);
    if (!list) throw new Error(`unexpected media query: ${query}`);
    return {
      get matches() {
        return list.matches;
      },
      media: query,
      addEventListener: list.add,
      removeEventListener: list.remove,
    } as unknown as MediaQueryList;
  });
}

describe("useMediaQuery", () => {
  const original = window.matchMedia;
  beforeEach(() =>
    installMatchMedia({
      "(min-width: 768px)": true,
      "(max-width: 400px)": false,
    }),
  );
  afterEach(() => {
    window.matchMedia = original;
  });

  it("returns whether the query matches right now", () => {
    expect(
      renderHook(() => useMediaQuery("(min-width: 768px)")).result.current,
    ).toBe(true);
    expect(
      renderHook(() => useMediaQuery("(max-width: 400px)")).result.current,
    ).toBe(false);
  });

  it("re-renders with the new value when the query starts or stops matching", () => {
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(true);

    act(() => setMatches("(min-width: 768px)", false));
    expect(result.current).toBe(false);

    act(() => setMatches("(min-width: 768px)", true));
    expect(result.current).toBe(true);
  });

  it("removes its change listener on unmount", () => {
    const { unmount } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    const list = lists.get("(min-width: 768px)")!;
    expect(list.listeners.size).toBe(1);

    unmount();

    expect(list.remove).toHaveBeenCalledWith("change", expect.any(Function));
    expect(list.listeners.size).toBe(0);
  });

  it("switches its subscription when the query changes", () => {
    const { result, rerender } = renderHook(({ q }) => useMediaQuery(q), {
      initialProps: { q: "(min-width: 768px)" },
    });
    expect(result.current).toBe(true);

    rerender({ q: "(max-width: 400px)" });

    expect(result.current).toBe(false);
    expect(lists.get("(min-width: 768px)")!.listeners.size).toBe(0);
    expect(lists.get("(max-width: 400px)")!.listeners.size).toBe(1);

    // Only the new query drives updates now.
    act(() => setMatches("(max-width: 400px)", true));
    expect(result.current).toBe(true);
  });

  it("renders false on the server, so hydration never mismatches", () => {
    // The query matches in this "browser", but server rendering must not
    // read window.matchMedia: it uses the server snapshot, which is false.
    function Probe() {
      return <span>{String(useMediaQuery("(min-width: 768px)"))}</span>;
    }
    const matchMedia = window.matchMedia as ReturnType<typeof vi.fn>;
    matchMedia.mockClear();

    expect(renderToString(<Probe />)).toBe("<span>false</span>");
    expect(matchMedia).not.toHaveBeenCalled();
  });
});
