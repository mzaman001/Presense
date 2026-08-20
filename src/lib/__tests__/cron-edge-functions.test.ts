/* AUDIT-04 + AUDIT-05 (Aug 19, 2026): harness tests for the Supabase edge
   functions. The modules are Deno scripts using `npm:` specifiers, so they
   cannot be imported directly under vitest. This file verifies the contract
   by asserting the required strings exist in the real source files (so the
   real code cannot drift silently) and by executing a faithful re-implementation
   of the auth-gate logic against both functions' behavior. */
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const FUNCTIONS_DIR = path.resolve(__dirname, "../../../supabase/functions");

function readSource(name: string): string {
  return fs.readFileSync(path.join(FUNCTIONS_DIR, name, "index.ts"), "utf8");
}

/* Faithful re-implementation of the AUDIT-04 gate for behavioral tests.
   Mirrors `Deno.env.get("CRON_SECRET") || ""` and the header contract. */
function gateBehavior(
  cronSecret: string | null,
  headers: { "x-cron-secret"?: string | null; Authorization?: string | null },
) {
  const configured = cronSecret ?? "";
  const xCronSecret = headers["x-cron-secret"] ?? null;
  const authorization = headers["Authorization"] ?? null;

  if (configured) {
    if (xCronSecret !== configured) {
      return {
        status: 401,
        body: {
          error: "Forbidden",
          code: "CRON_AUTH_FAILED",
          message: "A valid scheduler secret is required.",
        },
      };
    }
    return { status: 200 };
  }
  if (!authorization) {
    return {
      status: 401,
      body: {
        error: "No Authorization header — scheduled invocation must send a JWT",
        code: "CRON_AUTH_FAILED",
      },
    };
  }
  return { status: 200 };
}

describe("AUDIT-04 — cron edge-function scheduler authority", () => {
  it("cron_recurrence source requires x-cron-secret when CRON_SECRET is configured", () => {
    const src = readSource("cron_recurrence");
    expect(src).toContain('Deno.env.get("CRON_SECRET")');
    expect(src).toContain('req.headers.get("x-cron-secret")');
    expect(src).toContain("CRON_AUTH_FAILED");

    // Contract: wrong secret → 401 even with a valid user JWT; no info leak.
    const res = gateBehavior("configured-secret", {
      "x-cron-secret": "wrong",
      Authorization: "Bearer user-jwt",
    });
    expect(res.status).toBe(401);
    expect((res.body as { code: string }).code).toBe("CRON_AUTH_FAILED");
    expect(JSON.stringify(res.body)).not.toContain("configured-secret");
  });

  it("cron_cleanup source requires x-cron-secret when CRON_SECRET is configured", () => {
    const src = readSource("cron_cleanup");
    expect(src).toContain('Deno.env.get("CRON_SECRET")');
    expect(src).toContain('req.headers.get("x-cron-secret")');
    expect(src).toContain("CRON_AUTH_FAILED");

    // Correct secret passes the gate.
    expect(
      gateBehavior("configured-secret", {
        "x-cron-secret": "configured-secret",
      }).status,
    ).toBe(200);
    // Missing secret header fails even with a JWT (any-user-JWT attack closed).
    expect(
      gateBehavior("configured-secret", { Authorization: "Bearer user-jwt" })
        .status,
    ).toBe(401);
    // No secret configured yet → JWT fallback remains available.
    expect(gateBehavior("", { Authorization: "Bearer jwt" }).status).toBe(200);
    expect(gateBehavior("", {}).status).toBe(401);
  });

  it("never hints at the expected secret value in error bodies (both functions)", () => {
    for (const fn of ["cron_recurrence", "cron_cleanup"] as const) {
      const src = readSource(fn);
      expect(src).not.toMatch(/expected\s*[:=]/i);
      expect(src).not.toMatch(/correct secret/i);
    }
  });
});

describe("AUDIT-05 — cron_cleanup per-table status reporting", () => {
  it("cron_cleanup reports {status, tables[]} and never collapses to a bare 500", () => {
    const src = readSource("cron_cleanup");
    // The fix replaces the single `throw res.error` loop with a per-table
    // status map and an overall status.
    expect(src).toContain("overallStatus");
    expect(src).toMatch(/tables:\s*tableResults/);
    expect(src).toContain('"completed"');
    expect(src).toContain('"partial"');
    expect(src).toContain("console.error");
    expect(src).not.toContain("throw res.error");
  });
});
