function reportClientError(payload: {
  message: string;
  stack?: string;
  source?: string;
}) {
  const body = JSON.stringify({
    kind: "client-error",
    ...payload,
    path: window.location.pathname,
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/telemetry", body);
    return;
  }

  fetch("/api/telemetry", {
    method: "POST",
    body,
    keepalive: true,
    headers: { "Content-Type": "application/json" },
  }).catch(() => {});
}

window.addEventListener("error", (event) => {
  reportClientError({
    message: event.message || "Unhandled client error",
    stack: event.error instanceof Error ? event.error.stack : undefined,
    source: event.filename,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  reportClientError({
    message: reason instanceof Error ? reason.message : "Unhandled promise rejection",
    stack: reason instanceof Error ? reason.stack : undefined,
    source: "unhandledrejection",
  });
});

