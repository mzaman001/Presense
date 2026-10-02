import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  readSegments,
  SILENCE_MS,
  useSpeechCapture,
} from "@/hooks/useSpeechCapture";

type Result = { isFinal: boolean; 0: { transcript: string } };
const result = (transcript: string, isFinal = true): Result => ({
  isFinal,
  0: { transcript },
});

const instances: FakeRecognition[] = [];
class FakeRecognition {
  static available?: ReturnType<typeof vi.fn>;
  lang = "";
  continuous = false;
  interimResults = false;
  processLocally = false;
  phrases: unknown[] = [];
  onresult: ((e: { resultIndex: number; results: Result[] }) => void) | null =
    null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();
  constructor() {
    instances.push(this);
  }
}
class FakePhrase {
  constructor(
    public phrase: string,
    public boost: number,
  ) {}
}

const win = window as unknown as Record<string, unknown>;
function install({ available }: { available?: string } = {}) {
  FakeRecognition.available = available
    ? vi.fn().mockResolvedValue(available)
    : undefined;
  win.webkitSpeechRecognition = FakeRecognition;
}

afterEach(() => {
  delete win.webkitSpeechRecognition;
  delete win.SpeechRecognitionPhrase;
  instances.length = 0;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("readSegments", () => {
  it("keeps one string per pause", () => {
    expect(
      readSegments([result("buy milk "), result(" call  mom", false)]),
    ).toEqual(["buy milk", "call mom"]);
  });

  it("drops Android's restated results", () => {
    expect(
      readSegments([
        result("buy"),
        result("buy milk"),
        result("buy milk call mom", false),
      ]),
    ).toEqual(["buy milk call mom"]);
  });

  it("skips empty results", () => {
    expect(readSegments([result("  "), result("eggs")])).toEqual(["eggs"]);
  });
});

describe("useSpeechCapture", () => {
  it("reports every pause as its own segment", () => {
    install();
    const onSegments = vi.fn();
    const { result: hook } = renderHook(() => useSpeechCapture({ onSegments }));
    act(() => hook.current.start());
    act(() =>
      instances[0].onresult?.({
        resultIndex: 1,
        results: [result("buy milk"), result("call mom", false)],
      }),
    );
    expect(onSegments).toHaveBeenLastCalledWith(["buy milk", "call mom"]);
  });

  it("recognises on the device when the language is installed", async () => {
    install({ available: "available" });
    const { result: hook } = renderHook(() =>
      useSpeechCapture({ onSegments: vi.fn() }),
    );
    await waitFor(() =>
      expect(FakeRecognition.available).toHaveBeenCalledWith({
        langs: [navigator.language || "en-US"],
        processLocally: true,
      }),
    );
    await act(async () => {});
    act(() => hook.current.start());
    expect(instances[0].processLocally).toBe(true);
  });

  it("never asks for a download when the language isn't installed", async () => {
    install({ available: "downloadable" });
    const { result: hook } = renderHook(() =>
      useSpeechCapture({ onSegments: vi.fn() }),
    );
    await act(async () => {});
    act(() => hook.current.start());
    expect(instances[0].processLocally).toBe(false);
  });

  it("hints the user's words, and retries without them if refused", () => {
    install();
    win.SpeechRecognitionPhrase = FakePhrase;
    const { result: hook } = renderHook(() =>
      useSpeechCapture({ onSegments: vi.fn(), phrases: ["Work", "Health"] }),
    );
    act(() => hook.current.start());
    expect(instances[0].phrases).toEqual([
      new FakePhrase("Work", 3),
      new FakePhrase("Health", 3),
    ]);

    act(() => {
      instances[0].onerror?.({ error: "phrases-not-supported" });
      instances[0].onend?.();
    });
    expect(instances).toHaveLength(2);
    expect(instances[1].start).toHaveBeenCalled();
    expect(instances[1].phrases).toEqual([]);
    expect(hook.current.listening).toBe(true);
  });

  it("stops after a silence", () => {
    vi.useFakeTimers();
    install();
    const { result: hook } = renderHook(() =>
      useSpeechCapture({ onSegments: vi.fn() }),
    );
    act(() => hook.current.start());
    act(() => vi.advanceTimersByTime(SILENCE_MS - 1000));
    act(() =>
      instances[0].onresult?.({ resultIndex: 0, results: [result("eggs")] }),
    );
    act(() => vi.advanceTimersByTime(SILENCE_MS - 1000));
    expect(instances[0].stop).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(instances[0].stop).toHaveBeenCalled();
    expect(hook.current.listening).toBe(false);
  });

  it("is unsupported in an installed iPhone home-screen app", () => {
    install();
    vi.stubGlobal("navigator", {
      ...navigator,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      standalone: true,
    });
    const { result: hook } = renderHook(() =>
      useSpeechCapture({ onSegments: vi.fn() }),
    );
    expect(hook.current.supported).toBe(false);
  });

  it("is supported in iPhone Safari itself", () => {
    install();
    vi.stubGlobal("navigator", {
      ...navigator,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      standalone: false,
    });
    const { result: hook } = renderHook(() =>
      useSpeechCapture({ onSegments: vi.fn() }),
    );
    expect(hook.current.supported).toBe(true);
  });

  it("maps a blocked microphone to 'denied'", async () => {
    install();
    const onError = vi.fn();
    const { result: hook } = renderHook(() =>
      useSpeechCapture({ onSegments: vi.fn(), onError }),
    );
    act(() => hook.current.start());
    // No Permissions API in jsdom: assume the block is real.
    act(() => instances[0].onerror?.({ error: "not-allowed" }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("denied"));
  });

  it("is unsupported on a page that isn't secure (http on a LAN address)", () => {
    install();
    vi.stubGlobal("isSecureContext", false);
    const { result: hook } = renderHook(() =>
      useSpeechCapture({ onSegments: vi.fn() }),
    );
    expect(hook.current.supported).toBe(false);
  });

  it("is unsupported in Edge on Android, which has no speech service", () => {
    install();
    vi.stubGlobal("navigator", {
      ...navigator,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36 EdgA/140.0",
    });
    const { result: hook } = renderHook(() =>
      useSpeechCapture({ onSegments: vi.fn() }),
    );
    expect(hook.current.supported).toBe(false);
  });

  it.each([
    ["denied", "denied", true],
    ["prompt", "unavailable", false],
    ["granted", "unavailable", false],
  ] as const)(
    "on 'not-allowed' with the mic permission '%s', reports '%s'",
    async (state, expected, stillSupported) => {
      install();
      vi.stubGlobal("navigator", {
        ...navigator,
        permissions: { query: vi.fn().mockResolvedValue({ state }) },
      });
      const onError = vi.fn();
      const { result: hook } = renderHook(() =>
        useSpeechCapture({ onSegments: vi.fn(), onError }),
      );
      act(() => hook.current.start());
      await act(async () => {
        instances[0].onerror?.({ error: "not-allowed" });
        instances[0].onend?.();
      });
      await waitFor(() => expect(onError).toHaveBeenCalledWith(expected));
      expect(hook.current.supported).toBe(stillSupported);
    },
  );

  it("is unsupported in Brave, which ships the API with no speech service", () => {
    install();
    vi.stubGlobal("navigator", {
      ...navigator,
      brave: { isBrave: () => true },
    });
    const { result: hook } = renderHook(() =>
      useSpeechCapture({ onSegments: vi.fn() }),
    );
    expect(hook.current.supported).toBe(false);
  });

  it.each([
    ["service-not-allowed", false],
    ["language-not-supported", false],
    // Chrome says "network" when briefly offline; the mic comes back.
    ["network", true],
  ])(
    "reports '%s' as unavailable, not blocked (mic still shown: %s)",
    (code, stillSupported) => {
      install();
      const onError = vi.fn();
      const { result: hook } = renderHook(() =>
        useSpeechCapture({ onSegments: vi.fn(), onError }),
      );
      act(() => hook.current.start());
      act(() => {
        instances[0].onerror?.({ error: code });
        instances[0].onend?.();
      });
      expect(onError).toHaveBeenCalledWith("unavailable");
      expect(hook.current.supported).toBe(stillSupported);
    },
  );
});
