import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AdminLoginItem, AdminAuditItem } from "@ouigame/shared/api";

// The tab is a thin view over two paginated admin queries — fake both so the
// test exercises the rendering (status badges, actor/action/target cells)
// without a network or QueryClient.
const sampleLogins: AdminLoginItem[] = [
  {
    id: 1,
    username: "commander",
    ip: "10.0.0.1",
    status: "success",
    at: "2026-06-19T10:00:00.000Z",
  },
  {
    id: 2,
    username: "intruder",
    ip: "10.0.0.9",
    status: "failed",
    at: "2026-06-19T09:30:00.000Z",
  },
];
const sampleAudit: AdminAuditItem[] = [
  {
    id: 7,
    actorName: "commander",
    action: "promote_user",
    targetType: "user",
    targetId: 42,
    details: { isAdmin: true },
    at: "2026-06-19T08:00:00.000Z",
  },
  {
    id: 8,
    actorName: null,
    action: "purge_levels",
    targetType: null,
    targetId: null,
    details: null,
    at: "2026-06-19T07:00:00.000Z",
  },
];

vi.mock("../../../hooks/api", () => ({
  useAdminLogins: () => ({
    data: { logins: sampleLogins, total: 2, page: 1, pageSize: 25 },
    isLoading: false,
  }),
  useAdminAudit: () => ({
    data: { entries: sampleAudit, total: 1, page: 1, pageSize: 25 },
    isLoading: false,
  }),
}));

import { SecurityTab } from "../SecurityTab";

describe("SecurityTab", () => {
  it("renders login rows with status badges and switches to the audit log", () => {
    render(<SecurityTab />);

    // Logins section is the default — rows + their coloured status badges show.
    expect(screen.getByText("commander")).toBeTruthy();
    expect(screen.getByText("10.0.0.1")).toBeTruthy();

    const success = screen.getByText("success");
    expect(success.className).toContain("bg-green");
    const failed = screen.getByText("failed");
    expect(failed.className).toContain("bg-red");

    // Flip to the audit section and assert the action + target render.
    fireEvent.click(screen.getByRole("button", { name: "Audit" }));

    const action = screen.getByText("promote_user");
    expect(action.className).toContain("bg-purple");
    expect(screen.getByText("user #42")).toBeTruthy();
    // details JSON renders compactly.
    expect(screen.getByText('{"isAdmin":true}')).toBeTruthy();
  });

  it("falls back to 'system' for a null actor and shows an em dash for empty details", () => {
    render(<SecurityTab />);
    fireEvent.click(screen.getByRole("button", { name: "Audit" }));

    // The null-actor row renders the "system" fallback…
    expect(screen.getByText("system")).toBeTruthy();
    expect(screen.getByText("purge_levels")).toBeTruthy();
    // …with em-dash target and details (null targetType + null details).
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
