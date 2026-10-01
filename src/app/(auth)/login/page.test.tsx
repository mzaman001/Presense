import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "./page";

const mockSendMagicLink = vi.fn();
const mockVerifyEmailCode = vi.fn();

vi.mock("./actions", () => ({
  sendMagicLink: (...args: unknown[]) => mockSendMagicLink(...args),
  verifyEmailCode: (...args: unknown[]) => mockVerifyEmailCode(...args),
  startGoogleSignIn: vi.fn(),
}));

async function requestLink() {
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "user@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: /send sign-in link/i }));
  return screen.findByLabelText("Code from the email");
}

describe("LoginPage: signing in with the emailed code", () => {
  const assign = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMagicLink.mockResolvedValue({ error: null, message: "sent" });
    vi.stubGlobal("location", { ...window.location, assign });
  });

  it("offers a code field once the email is sent", async () => {
    const input = await requestLink();

    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    expect(input).toHaveAttribute("inputmode", "numeric");
  });

  it("signs in and opens the app when the code is right", async () => {
    mockVerifyEmailCode.mockResolvedValue({ error: null });
    const input = await requestLink();

    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in with code/i }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/onboarding"));
    const sent = mockVerifyEmailCode.mock.calls[0][0] as FormData;
    expect(sent.get("email")).toBe("user@example.com");
    expect(sent.get("code")).toBe("123456");
  });

  it("shows the error and stays put when the code is wrong", async () => {
    mockVerifyEmailCode.mockResolvedValue({ error: "That code is wrong." });
    const input = await requestLink();

    fireEvent.change(input, { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in with code/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That code is wrong.",
    );
    expect(assign).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /sign in with code/i }),
    ).toBeEnabled();
  });
});
