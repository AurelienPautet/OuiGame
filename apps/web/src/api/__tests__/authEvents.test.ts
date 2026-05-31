import { describe, it, expect, vi } from "vitest";
import { onAuthChange, notifyAuthChange } from "../authEvents";

describe("authEvents bus", () => {
  it("notifies subscribers and stops after unsubscribe", () => {
    const handler = vi.fn();
    const unsubscribe = onAuthChange(handler);

    notifyAuthChange();
    expect(handler).toHaveBeenCalledTimes(1);

    notifyAuthChange();
    expect(handler).toHaveBeenCalledTimes(2);

    unsubscribe();
    notifyAuthChange();
    expect(handler).toHaveBeenCalledTimes(2); // no further calls
  });
});
