"use client";

import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    logger.error("App error:", error);
  }, [error]);

  return (
    <html>
      <body style={{ background: "#0e0e10", color: "#e8e8ec", fontFamily: "Inter, system-ui, sans-serif", margin: 0 }}>
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{
            width: "100%", maxWidth: "420px", padding: "40px 32px",
            background: "rgba(255,255,255,0.04)",
            border: "0.5px solid rgba(255,255,255,0.1)",
            borderRadius: "20px",
            backdropFilter: "blur(24px)",
            textAlign: "center",
            boxShadow: "0 32px 64px rgba(0,0,0,0.5)"
          }}>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚠️</div>
            <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 600, letterSpacing: "-0.3px" }}>
              Something went wrong
            </h2>
            <p style={{ margin: "0 0 24px", fontSize: "14px", color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
              Presense hit an unexpected error. Your data is safe.
            </p>

            <button
              onClick={() => setShowDetails(!showDetails)}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: "12px", cursor: "pointer", textDecoration: "underline", marginBottom: "20px", display: "block", width: "100%" }}
            >
              {showDetails ? "Hide details" : "Show error details"}
            </button>

            {showDetails && (
              <div style={{ marginBottom: "20px", padding: "12px", borderRadius: "10px", background: "rgba(248,113,113,0.08)", border: "0.5px solid rgba(248,113,113,0.2)", textAlign: "left", overflowX: "auto", maxHeight: "140px", overflowY: "auto" }}>
                <p style={{ margin: 0, color: "#F87171", fontSize: "12px", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
                  {error.message || "Unknown error"}
                </p>
                {error.digest && <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,0.2)", fontSize: "11px" }}>Digest: {error.digest}</p>}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                onClick={() => window.location.href = "/"}
                style={{ flex: 1, padding: "10px 20px", borderRadius: "50px", background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.12)", color: "#e8e8ec", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}
              >
                Go Home
              </button>
              <button
                onClick={() => { reset(); window.location.reload(); }}
                style={{ flex: 1, padding: "10px 20px", borderRadius: "50px", background: "#E5B41E", border: "none", color: "#0e0e10", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
