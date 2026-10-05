import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/useAppStore";
import { AppStoreSeed } from "@/components/providers/AppStoreSeed";

let renders = 0;
function Name() {
  renders++;
  return (
    <span>
      {useAppStore((s) => s.userSettings.display_name ?? "Presense User")}
    </span>
  );
}

afterEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("AppStoreSeed", () => {
  it("hydrates with the server's settings and renders once", async () => {
    const settings = { display_name: "Ada" };
    const tree = (
      <AppStoreSeed settings={settings}>
        <Name />
      </AppStoreSeed>
    );

    const html = renderToString(tree);
    expect(html).toContain("Ada");

    // A fresh page: the browser's store starts out empty.
    useAppStore.setState(useAppStore.getInitialState(), true);
    const container = document.createElement("div");
    container.innerHTML = html;
    renders = 0;
    const onRecoverableError = vi.fn();
    await act(async () => {
      hydrateRoot(container, tree, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe("Ada");
    expect(renders).toBe(1);
    expect(useAppStore.getState().userSettings).toBe(settings);
  });

  it("keeps settings the browser already has", () => {
    const current = { display_name: "Changed in Settings" };
    useAppStore.setState({ userSettings: current });
    renderToString(
      <AppStoreSeed settings={{ display_name: "Ada" }}>
        <Name />
      </AppStoreSeed>,
    );
    expect(useAppStore.getState().userSettings).toBe(current);
  });
});
