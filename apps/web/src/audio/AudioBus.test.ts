import { describe, it, expect, vi, afterEach } from "vitest";
import { audioBus } from "./AudioBus";

afterEach(() => vi.restoreAllMocks());

describe("audioBus.unlockOnGesture", () => {
  it("resumes the context on the first gesture, then stops listening", () => {
    const resume = vi.spyOn(audioBus, "resume").mockImplementation(() => {});
    audioBus.unlockOnGesture();

    window.dispatchEvent(new Event("pointerdown"));
    expect(resume).toHaveBeenCalledTimes(1);

    // Further gestures must not resume again — the listeners removed themselves.
    window.dispatchEvent(new Event("keydown"));
    window.dispatchEvent(new Event("touchstart"));
    window.dispatchEvent(new Event("pointerdown"));
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("unlocks on a keypress, not just a pointer gesture", () => {
    const resume = vi.spyOn(audioBus, "resume").mockImplementation(() => {});
    audioBus.unlockOnGesture();

    window.dispatchEvent(new Event("keydown"));
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("teardown removes the listeners before any gesture fires", () => {
    const resume = vi.spyOn(audioBus, "resume").mockImplementation(() => {});
    const teardown = audioBus.unlockOnGesture();
    teardown();

    window.dispatchEvent(new Event("pointerdown"));
    expect(resume).not.toHaveBeenCalled();
  });
});
