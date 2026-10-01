import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "./page";

const mockStartGoogleSignIn = vi.fn();

vi.mock("./actions", () => ({
  startGoogleSignIn: (...args: unknown[]) => mockStartGoogleSignIn(...args),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("offers Google as the only way to sign in", () => {
    render(<LoginPage />);

    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeEnabled();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it("explains a sign-in that failed at the callback", async () => {
    window.history.replaceState(null, "", "/login?error=auth_failed");
    render(<LoginPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign-in didn't complete. Please try again.",
    );
  });

  it("shows the error and re-enables the button when Google can't start", async () => {
    mockStartGoogleSignIn.mockResolvedValue({
      error: "Provider is not enabled",
    });
    render(<LoginPage />);

    const button = screen.getByRole("button", {
      name: /continue with google/i,
    });
    fireEvent.click(button);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Provider is not enabled",
    );
    await waitFor(() => expect(button).toBeEnabled());
  });
});
