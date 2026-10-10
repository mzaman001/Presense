// jest-dom's matchers (toBeInTheDocument, toHaveTextContent, …) for
// Vitest 5's types.
//
// Vitest 5 types assertions as Assertion<R, T> and no longer reads the
// global jest.Matchers interface. jest-dom (7.0.1, its newest) still
// declares the single-parameter Assertion<T>, so its matchers dropped out
// of the types although they still run (src/lib/__tests__/setup.ts
// registers them). This augments Vitest's Matchers<R, T>, the extension
// point Vitest documents for custom matchers. Delete it once jest-dom ships
// Vitest 5 types.
import "vitest";
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > extends TestingLibraryMatchers<unknown, R> {}
}
