import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useLiveClock } from "@/lib/display-clock";
import { dateKeyIn } from "@/lib/zoned-date";

// 2026-10-05 20:30Z: the 5th in UTC, the 6th in Kolkata.
const serverClock = {
  timeZone: "UTC",
  now: Date.parse("2026-10-05T20:30:00Z"),
};

function Today({ zone }: { zone: () => string }) {
  const clock = useLiveClock(serverClock, zone);
  return <span>{dateKeyIn(new Date(clock.now), clock.timeZone)}</span>;
}

describe("useLiveClock", () => {
  it("doesn't re-render after hydration when nothing has changed", async () => {
    // Same zone on both sides and still the same minute as the server.
    vi.useFakeTimers({ now: serverClock.now + 5_000, toFake: ["Date"] });
    let renders = 0;
    function Count() {
      renders++;
      const clock = useLiveClock(serverClock, () => "UTC");
      return <span>{clock.now}</span>;
    }
    const html = renderToString(<Count />);
    const container = document.createElement("div");
    container.innerHTML = html;
    renders = 0;
    await act(async () => {
      hydrateRoot(container, <Count />);
    });
    expect(renders).toBe(1);
    expect(container.textContent).toBe(String(serverClock.now));
    vi.useRealTimers();
  });

  it("hydrates with the server's clock, then moves to the device's zone", async () => {
    vi.useFakeTimers({ now: serverClock.now, toFake: ["Date"] });
    const tree = <Today zone={() => "Asia/Kolkata"} />;
    const html = renderToString(tree);
    expect(html).toContain("2026-10-05");

    const container = document.createElement("div");
    container.innerHTML = html;
    const onRecoverableError = vi.fn();
    await act(async () => {
      hydrateRoot(container, tree, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe("2026-10-06");
    vi.useRealTimers();
  });
});
