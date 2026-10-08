import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const captureException = vi.fn();
vi.mock("@/lib/sentry-client", () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}));

import { ModalErrorBoundary } from "../ModalErrorBoundary";

function Boom(): React.ReactElement {
  throw new Error("render failed");
}

describe("ModalErrorBoundary", () => {
  it("reports a crash inside the modal to Sentry, tagged with the modal", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ModalErrorBoundary modalName="Settings">
        <Boom />
      </ModalErrorBoundary>,
    );
    expect(
      screen.getByText(/problem loading the Settings/),
    ).toBeInTheDocument();
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "render failed" }),
      expect.objectContaining({ tags: { modal: "Settings" } }),
    );
  });
});
