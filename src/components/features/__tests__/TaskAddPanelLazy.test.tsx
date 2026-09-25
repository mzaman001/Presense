import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const mounts = vi.hoisted(() => ({ count: 0 }));
vi.mock("next/dynamic", () => ({
  default: () =>
    function Panel({ isOpen }: { isOpen: boolean }) {
      mounts.count++;
      return <div data-testid="panel">{isOpen ? "open" : "closed"}</div>;
    },
}));

import { TaskAddPanel } from "@/components/features/TaskAddPanelLazy";

describe("TaskAddPanel (lazy)", () => {
  it("doesn't mount (or fetch) the panel until it first opens, then keeps it for the close animation", () => {
    const props = { onClose: () => {} };
    const { rerender, queryByTestId } = render(
      <TaskAddPanel isOpen={false} {...props} />,
    );
    expect(queryByTestId("panel")).toBeNull();
    expect(mounts.count).toBe(0);

    rerender(<TaskAddPanel isOpen={true} {...props} />);
    expect(queryByTestId("panel")).toHaveTextContent("open");

    rerender(<TaskAddPanel isOpen={false} {...props} />);
    expect(queryByTestId("panel")).toHaveTextContent("closed");
  });
});
