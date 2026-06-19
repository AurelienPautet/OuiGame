import { describe, it, expect } from "vitest";
import { humanizeLabel } from "../labels";

describe("humanizeLabel", () => {
  it("lowercases, splits separators, and capitalises only the first letter", () => {
    expect(humanizeLabel("LOGIN_FAILED_WRONG_PASSWORD")).toBe(
      "Login failed wrong password"
    );
    expect(humanizeLabel("SIGN_UP_SUCCESS")).toBe("Sign up success");
  });

  it("treats dots like underscores", () => {
    expect(humanizeLabel("LEVEL.UPDATE_STATUS")).toBe("Level update status");
    expect(humanizeLabel("USER.UPDATE_ADMIN")).toBe("User update admin");
  });

  it("collapses repeated separators and trims edges", () => {
    expect(humanizeLabel("__FOO..BAR__")).toBe("Foo bar");
  });

  it("handles a single token", () => {
    expect(humanizeLabel("success")).toBe("Success");
  });

  it("is null/empty-safe", () => {
    expect(humanizeLabel("")).toBe("");
    // Guards against a falsy value slipping through despite the string type.
    expect(humanizeLabel(undefined as unknown as string)).toBe("");
    expect(humanizeLabel("___")).toBe("");
  });
});
