import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";

const { fakeSocket, startOnlineGame, addToast } = vi.hoisted(() => ({
  fakeSocket: { id: "s1", emit: vi.fn(), on: vi.fn(), off: vi.fn() },
  startOnlineGame: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock("../../../contexts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../contexts")>();
  return {
    ...actual,
    useSocket: () => ({ socket: fakeSocket }),
    useGame: () => ({ startOnlineGame }),
    useAuth: () => ({ user: { username: "alice" } }),
    useToast: () => ({ addToast }),
    useModal: () => ({
      closeModal: vi.fn(),
      openModal: vi.fn(),
      activeModal: null,
      modalData: null,
      isOpen: () => false,
    }),
  };
});

// The real LevelSelector drags in the levels query; a fake exposes exactly
// what the modal wires into it (filter props + the multi-select callback).
vi.mock("../../ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../ui")>();
  return {
    ...actual,
    LevelSelector: (props: {
      levelTypeOverride?: "solo" | "online";
      requireBotSpawns?: boolean;
      onMultiSelect?: (ids: number[]) => void;
    }) => (
      <button
        data-testid="fake-level-selector"
        data-type={props.levelTypeOverride}
        data-bots={String(props.requireBotSpawns)}
        onClick={() => props.onMultiSelect?.([7, 8])}
      >
        pick levels
      </button>
    ),
  };
});

import { renderWithProviders } from "../../../test/renderWithProviders";
import { CreateRoomModal } from "../CreateRoomModal";

beforeEach(() => {
  fakeSocket.emit.mockClear();
  addToast.mockClear();
});

function fillAndSelect() {
  fireEvent.change(screen.getByPlaceholderText(/room name/i), {
    target: { value: "Mardi Soir" },
  });
  fireEvent.click(screen.getByTestId("fake-level-selector"));
}

describe("CreateRoomModal", () => {
  it("creates a classic room with the trailing ffa mode arg", () => {
    renderWithProviders(<CreateRoomModal />);
    expect(screen.getByTestId("fake-level-selector").dataset.type).toBe(
      "online"
    );
    fillAndSelect();
    fireEvent.click(screen.getByRole("button", { name: /create room/i }));
    expect(fakeSocket.emit).toHaveBeenCalledWith(
      "new-room",
      "Mardi Soir",
      10,
      [7, 8],
      "alice",
      "ffa"
    );
  });

  it("co-op switches the level browser to solo levels with enemies and sends coop", () => {
    renderWithProviders(<CreateRoomModal />);
    fireEvent.click(screen.getByRole("button", { name: "Co-op" }));

    const selector = screen.getByTestId("fake-level-selector");
    expect(selector.dataset.type).toBe("solo");
    expect(selector.dataset.bots).toBe("true");
    expect(screen.getByText(/team up against the level's bots/i)).toBeTruthy();

    fillAndSelect();
    fireEvent.click(screen.getByRole("button", { name: /create room/i }));
    expect(fakeSocket.emit).toHaveBeenCalledWith(
      "new-room",
      "Mardi Soir",
      10,
      [7, 8],
      "alice",
      "coop"
    );
  });

  it("switching mode clears the selection (create disabled again)", () => {
    renderWithProviders(<CreateRoomModal />);
    fillAndSelect();
    const create = () =>
      screen.getByRole("button", { name: /create room/i }) as HTMLButtonElement;
    expect(create().disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Co-op" }));
    expect(create().disabled).toBe(true);
  });

  it("room_create_failed re-enables the form and toasts the reason", () => {
    renderWithProviders(<CreateRoomModal />);
    const failHandler = fakeSocket.on.mock.calls.find(
      ([event]) => event === "room_create_failed"
    )?.[1] as (reason: string) => void;
    expect(failHandler).toBeTypeOf("function");

    fillAndSelect();
    fireEvent.click(screen.getByRole("button", { name: /create room/i }));
    failHandler("no_bot_spawns");

    expect(addToast).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/couldn't create/i),
      expect.stringMatching(/at least one enemy/i)
    );
  });
});
