import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

// Every metric of every page view used to be posted: ~5 serverless calls and
// ~5 Sentry events per page load that nobody read. Only poor ones go now.

type Metric = { name: string; value: number; rating: string };
const metrics: Metric[] = [];

vi.mock("next/web-vitals", () => ({
  useReportWebVitals: (report: (m: Metric) => void) => {
    metrics.forEach(report);
  },
}));

import { WebVitalsReporter } from "@/components/layout/WebVitalsReporter";

describe("WebVitalsReporter", () => {
  const sendBeacon = vi.fn(() => true);

  beforeEach(() => {
    metrics.length = 0;
    sendBeacon.mockClear();
    Object.defineProperty(navigator, "sendBeacon", {
      value: sendBeacon,
      configurable: true,
    });
  });

  it("sends nothing when every vital is good or needs improvement", () => {
    metrics.push(
      { name: "LCP", value: 1800, rating: "good" },
      { name: "INP", value: 300, rating: "needs-improvement" },
    );
    render(<WebVitalsReporter />);
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("sends a poor vital", () => {
    metrics.push({ name: "LCP", value: 5200, rating: "poor" });
    render(<WebVitalsReporter />);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [, body] = sendBeacon.mock.calls[0] as unknown as [string, string];
    expect(JSON.parse(body)).toMatchObject({
      kind: "web-vital",
      name: "LCP",
      rating: "poor",
    });
  });
});
