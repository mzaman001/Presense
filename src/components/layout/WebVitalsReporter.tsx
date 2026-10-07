"use client";

import { useReportWebVitals } from "next/web-vitals";

function sendTelemetry(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/telemetry", body);
    return;
  }

  fetch("/api/telemetry", {
    method: "POST",
    body,
    keepalive: true,
    headers: { "Content-Type": "application/json" },
  }).catch(() => {
    // Telemetry must never affect the product experience.
  });
}

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    // Only the ones worth acting on. Sending all of them meant ~5 serverless
    // calls and ~5 Sentry events per page view that nobody read.
    if (metric.rating !== "poor") return;
    sendTelemetry({
      kind: "web-vital",
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      path: window.location.pathname,
    });
  });

  return null;
}
