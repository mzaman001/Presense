import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { Dropdown } from "@/components/ui/Dropdown";

const autoUpdateSpy = vi.fn();

vi.mock("@floating-ui/react", async () => {
  const actual =
    await vi.importActual<typeof import("@floating-ui/react")>(
      "@floating-ui/react",
    );
  return {
    ...actual,
    autoUpdate: (...args: Parameters<typeof actual.autoUpdate>) => {
      autoUpdateSpy(...args);
      return actual.autoUpdate(...args);
    },
  };
});

describe("Dropdown", () => {
  test("does not pass animationFrame:true to autoUpdate by default", () => {
    autoUpdateSpy.mockClear();
    render(<Dropdown value="a" onChange={() => {}} options={["a", "b"]} />);
    fireEvent.click(screen.getByRole("button"));
    expect(autoUpdateSpy).toHaveBeenCalled();
    const options = autoUpdateSpy.mock.calls[0][3];
    expect(options?.animationFrame).not.toBe(true);
  });

  test("passes animationFrame:true to autoUpdate when trackAnimatedAncestor is set", () => {
    autoUpdateSpy.mockClear();
    render(
      <Dropdown
        value="a"
        onChange={() => {}}
        options={["a", "b"]}
        trackAnimatedAncestor
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(autoUpdateSpy).toHaveBeenCalled();
    const options = autoUpdateSpy.mock.calls[0][3];
    expect(options?.animationFrame).toBe(true);
  });
});
