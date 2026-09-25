import React from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ContextualTip } from "@/components/ui/ContextualTip";

beforeEach(() => localStorage.clear());

describe("ContextualTip", () => {
  it("is in the server HTML, so it paints before JavaScript runs", () => {
    const html = renderToString(
      <ContextualTip id="do" title="Sorted" description="By deadline." />,
    );
    expect(html).toContain('data-tip="do"');
    expect(html).toContain("By deadline.");
  });

  it("dismisses for good, after collapsing", () => {
    vi.useFakeTimers();
    render(<ContextualTip id="do" title="Sorted" description="By deadline." />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss tip" }));
    expect(localStorage.getItem("hide_tip_do")).toBe("true");
    expect(screen.getByRole("complementary")).toHaveClass("is-closing");
    act(() => vi.advanceTimersByTime(300));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("stays hidden once dismissed", () => {
    localStorage.setItem("hide_tip_do", "true");
    render(<ContextualTip id="do" title="Sorted" description="By deadline." />);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});
