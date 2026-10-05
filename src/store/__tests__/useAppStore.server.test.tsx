// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useAppStore } from "@/store/useAppStore";
import { AppStoreSeed } from "@/components/providers/AppStoreSeed";

function Name() {
  return (
    <span>
      {useAppStore((s) => s.userSettings.display_name ?? "Presense User")}
    </span>
  );
}

describe("AppStoreSeed on the server", () => {
  it("renders with the request's settings without writing the shared store", () => {
    // One module instance serves every request on the server: writing the
    // store there would show one user's settings to the next.
    const html = renderToString(
      <AppStoreSeed settings={{ display_name: "Ada" }}>
        <Name />
      </AppStoreSeed>,
    );
    expect(html).toContain("Ada");
    expect(useAppStore.getState().userSettings).toEqual({});
  });

  it("renders the store's defaults without a seed", () => {
    expect(renderToString(<Name />)).toContain("Presense User");
  });
});
