import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OnboardingWizard } from "@/app/onboarding/OnboardingWizard";

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace, prefetch: vi.fn() }),
}));

const db = vi.hoisted(() => ({
  upserts: [] as Record<string, unknown>[],
  fail: false,
}));
vi.mock("@/app/onboarding/actions", () => ({
  saveOnboardingSettings: async (patch: Record<string, unknown>) => {
    if (db.fail) return { ok: false, error: "offline" };
    db.upserts.push(patch);
    return { ok: true };
  },
}));

const initial = {
  name: "",
  colorMode: "system" as const,
  morning: "08:00",
  evening: "18:00",
  capacityMinutes: 240,
};

const renderWizard = () => render(<OnboardingWizard initial={initial} />);

const next = () =>
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));

beforeEach(() => {
  // jsdom has no matchMedia; the theme preview asks it about System mode.
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  localStorage.clear();
  sessionStorage.clear();
  db.upserts = [];
  db.fail = false;
  nav.replace.mockReset();
});

describe("OnboardingWizard", () => {
  it("requires a name", async () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    const field = await screen.findByRole("textbox", {
      name: "What should we call you?",
    });
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    fireEvent.change(field, { target: { value: "   " } });
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    fireEvent.change(field, { target: { value: "Sam" } });
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
  });

  it("saves each answer as given, then opens the first plan", async () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.change(
      await screen.findByRole("textbox", { name: "What should we call you?" }),
      { target: { value: " Sam Rivera " } },
    );
    next();

    fireEvent.click(await screen.findByRole("radio", { name: /Light/ }));
    next();

    await screen.findByRole("heading", {
      name: "When do you like to plan your day, Sam?",
    });
    next();
    await screen.findByRole("heading", {
      name: "When do you usually call it a day?",
    });
    next();

    fireEvent.click(await screen.findByRole("radio", { name: "6h" }));
    next();

    fireEvent.click(await screen.findByRole("button", { name: "Plan my day" }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/"));

    expect(db.upserts).toEqual([
      { display_name: "Sam Rivera" },
      { color_mode: "light" },
      // Exactly the time chosen: no hidden offset.
      { nudge_time: "08:00:00" },
      { shutdown_time: "18:00:00" },
      { daily_capacity_minutes: 360 },
      expect.objectContaining({ onboarding_complete: true }),
    ]);
    expect(localStorage.getItem("presense_first_run")).toBe("1");
    expect(localStorage.getItem("presense_color_mode")).toBe("light");
  });

  it("stays on the screen when a save fails", async () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.change(
      await screen.findByRole("textbox", { name: "What should we call you?" }),
      { target: { value: "Sam" } },
    );
    db.fail = true;
    next();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled(),
    );
    expect(
      screen.getByRole("heading", { name: "What should we call you?" }),
    ).toBeInTheDocument();
  });

  it("resumes the step a refresh left off on", async () => {
    sessionStorage.setItem("presense_onboarding_step", "6");
    renderWizard();
    expect(
      await screen.findByRole("heading", {
        name: "How much time do you usually have for your own things?",
      }),
    ).toBeInTheDocument();
  });

  it("can skip the first plan", async () => {
    sessionStorage.setItem("presense_onboarding_step", "7");
    renderWizard();
    fireEvent.click(
      await screen.findByRole("button", { name: "Skip for now" }),
    );
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/"));
    expect(localStorage.getItem("presense_first_run")).toBeNull();
    expect(db.upserts.at(-1)).toMatchObject({ onboarding_complete: true });
  });
});
