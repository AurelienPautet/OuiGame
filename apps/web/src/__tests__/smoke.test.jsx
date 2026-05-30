import { describe, it, expect } from "vitest";
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Tell React this is an act() environment so createRoot work flushes
// synchronously inside act() and without the "not configured to support act"
// warning.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Hello() {
  return <h1>OuiGame</h1>;
}

describe("web smoke", () => {
  it("has a jsdom document", () => {
    expect(typeof document).not.toBe("undefined");
  });

  it("renders a React component into the DOM", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    act(() => {
      createRoot(container).render(
        <StrictMode>
          <Hello />
        </StrictMode>
      );
    });
    // Assert on the flushed output: this proves the jsdom environment and the
    // @vitejs/plugin-react JSX transform actually rendered, not just that the
    // container is attached.
    expect(container.querySelector("h1")?.textContent).toBe("OuiGame");
  });
});
