import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  base64UrlToBytes,
  disablePush,
  enablePush,
  sendTestPush,
  syncPush,
  VAPID_PUBLIC_KEY,
} from "@/lib/push";

type Sub = {
  endpoint: string;
  options: { applicationServerKey: ArrayBuffer | null };
  toJSON: () => { endpoint: string; keys: { p256dh: string; auth: string } };
  unsubscribe: ReturnType<typeof vi.fn>;
};

function makeSub(key: Uint8Array, endpoint = "https://push.example/abc"): Sub {
  return {
    endpoint,
    options: { applicationServerKey: key.slice().buffer },
    toJSON: () => ({ endpoint, keys: { p256dh: "p", auth: "a" } }),
    unsubscribe: vi.fn(async () => true),
  };
}

const ourKey = base64UrlToBytes(VAPID_PUBLIC_KEY);

describe("push subscription", () => {
  let current: Sub | null;
  const subscribe = vi.fn(async () => {
    current = makeSub(ourKey, "https://push.example/new");
    return current;
  });
  const rpc = vi.fn(async () => ({ error: null }));
  const eq = vi.fn(async () => ({ error: null }));
  const supabase = {
    rpc,
    from: vi.fn(() => ({ delete: () => ({ eq }) })),
  } as never;

  beforeEach(() => {
    current = null;
    subscribe.mockClear();
    rpc.mockClear();
    eq.mockClear();
    vi.stubGlobal("Notification", { permission: "granted" });
    vi.stubGlobal("PushManager", class {});
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: async () => ({
          pushManager: {
            getSubscription: async () => current,
            subscribe,
          },
        }),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: undefined,
    });
  });

  it("decodes the VAPID key to a 65-byte uncompressed P-256 point", () => {
    expect(ourKey).toHaveLength(65);
    expect(ourKey[0]).toBe(4);
  });

  it("subscribes and registers this device with its own origin", async () => {
    await expect(enablePush(supabase)).resolves.toBe("subscribed");
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: ourKey,
    });
    expect(rpc).toHaveBeenCalledWith("register_push_subscription", {
      p_endpoint: "https://push.example/new",
      p_p256dh: "p",
      p_auth: "a",
      p_origin: window.location.origin,
    });
  });

  it("keeps an existing subscription under the same key", async () => {
    current = makeSub(ourKey);
    await enablePush(supabase);
    expect(subscribe).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("replaces a subscription made under an old key", async () => {
    const old = makeSub(new Uint8Array(65).fill(7));
    current = old;
    await enablePush(supabase);
    expect(old.unsubscribe).toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("does nothing without notification permission", async () => {
    vi.stubGlobal("Notification", { permission: "default" });
    await expect(enablePush(supabase)).resolves.toBe("unavailable");
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("reports a failed registration", async () => {
    rpc.mockResolvedValueOnce({ error: { message: "nope" } } as never);
    await expect(enablePush(supabase)).resolves.toBe("failed");
  });

  it("removes this device's row before unsubscribing", async () => {
    const sub = makeSub(ourKey);
    current = sub;
    await expect(disablePush(supabase)).resolves.toBe("unsubscribed");
    expect(eq).toHaveBeenCalledWith("endpoint", sub.endpoint);
    expect(sub.unsubscribe).toHaveBeenCalled();
  });

  it("syncs to the Reminders setting", async () => {
    current = makeSub(ourKey);
    await syncPush(supabase, false);
    expect(eq).toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("sendTestPush", () => {
  const client = (result: unknown) =>
    ({ functions: { invoke: vi.fn(async () => result) } }) as never;

  it("reports how many devices it reached", async () => {
    await expect(
      sendTestPush(client({ data: { devices: 2, sent: 2 }, error: null })),
    ).resolves.toEqual({ ok: true, sent: 2 });
  });

  it("shows the server's own message, e.g. the cooldown", async () => {
    const error = {
      context: new Response(
        JSON.stringify({ error: "Wait a few seconds before sending another." }),
        { status: 429 },
      ),
    };
    await expect(sendTestPush(client({ data: null, error }))).resolves.toEqual({
      ok: false,
      message: "Wait a few seconds before sending another.",
    });
  });

  it("says when this account has no registered device", async () => {
    const r = await sendTestPush(
      client({ data: { devices: 0, sent: 0 }, error: null }),
    );
    expect(r.ok).toBe(false);
  });
});
