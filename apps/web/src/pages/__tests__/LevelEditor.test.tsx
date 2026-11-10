import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "../../i18n";
import { GRID_COLS, CELL_SIZE, TOTAL_CELLS } from "../../constants/level";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../../constants/canvas";

// The editor's publish gate only needs the game-over outcome from a test run,
// so the whole GameCanvas is replaced by a button that reports a win.
const state = vi.hoisted(() => ({
  mutate: vi.fn(),
  addToast: vi.fn(),
  startTestGame: vi.fn(),
  level: null as null | {
    level_json: { data: number[] };
    level_name: string;
    level_type: string;
  },
}));

vi.mock("../../contexts", () => ({
  useSocket: () => ({ isConnected: true }),
  useAuth: () => ({ user: { username: "pilot" } }),
  useToast: () => ({
    addToast: state.addToast,
    TOAST_TYPES: { ERROR: "error", SUCCESS: "success" },
  }),
  useSettings: () => ({ settings: { effects: false } }),
  useGame: () => ({ isPlaying: true, startTestGame: state.startTestGame }),
}));
vi.mock("../../hooks/api", () => ({
  useSaveLevel: () => ({
    mutate: state.mutate,
    isSuccess: false,
    isError: false,
    error: null,
  }),
  useLevel: () => ({ data: state.level }),
}));
vi.mock("../../audio", () => ({
  ui: {
    click: vi.fn(),
    hover: vi.fn(),
    tab: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
  },
}));
vi.mock("../../components/game", () => ({
  GameCanvas: ({
    onTestResult,
  }: {
    onTestResult?: (result: { result: "win" | "lose" }) => void;
  }) => (
    <button onClick={() => onTestResult?.({ result: "win" })}>
      finish test run
    </button>
  ),
}));
vi.mock("../../engine/PostProcessor", () => ({
  tryCreatePostProcessor: () => null,
}));
vi.mock("../../lib/levelThumbnail", () => ({
  renderLevelThumbnailHex: () => "00",
}));

import { LevelEditor } from "../LevelEditor";

// A playable solo grid: empty cells plus one player spawn flag.
const layoutWithSpawn = () => {
  const layout: number[] = new Array(TOTAL_CELLS).fill(-1);
  layout[GRID_COLS + 1] = 3;
  return layout;
};

const setLevel = (type: "solo" | "online") => {
  state.level = {
    level_json: { data: layoutWithSpawn() },
    level_name: "Test level",
    level_type: type,
  };
};

const renderEditor = () =>
  render(
    <MemoryRouter initialEntries={["/editor?id=7"]}>
      <LevelEditor />
    </MemoryRouter>
  );

const clickSave = () => fireEvent.click(screen.getByTitle("Save Level"));
const clearPrompt = () => screen.getByRole("dialog");

beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  await i18n.changeLanguage("en");
});

describe("Level editor publishing gate", () => {
  it("prompts the creator to play a solo level before it can be published", () => {
    setLevel("solo");
    renderEditor();

    clickSave();
    expect(state.mutate).not.toHaveBeenCalled();
    const prompt = clearPrompt();
    expect(
      within(prompt).getByText(i18n.t("levelEditor.clearPrompt.title"))
    ).toBeTruthy();

    // The prompt offers the test run, which is how the level gets cleared.
    fireEvent.click(
      within(prompt).getByRole("button", { name: /test level/i })
    );
    expect(state.startTestGame).toHaveBeenCalledWith(layoutWithSpawn());

    fireEvent.click(screen.getByText("finish test run"));
    clickSave();

    expect(state.mutate).toHaveBeenCalledTimes(1);
    expect(state.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        levelName: "Test level",
        type: "solo",
        hexData: "00",
      })
    );
  });

  it("revokes the clearance once the layout is edited", () => {
    setLevel("solo");
    const { container } = renderEditor();

    fireEvent.click(screen.getByText("finish test run"));
    // Placing a block changes the layout, so the earlier run no longer vouches
    // for what would be published.
    const stage = container.querySelector(
      "[data-hover-sound]"
    ) as HTMLElement | null;
    if (!stage) throw new Error("editor stage not found");
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: CANVAS_WIDTH,
      bottom: CANVAS_HEIGHT,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.mouseDown(stage, {
      clientX: CELL_SIZE * 2,
      clientY: CELL_SIZE * 2,
      button: 0,
    });

    clickSave();
    expect(state.mutate).not.toHaveBeenCalled();
    expect(clearPrompt()).toBeTruthy();
  });

  it("lets online levels publish without a clear (they have no bots to finish)", () => {
    setLevel("online");
    renderEditor();

    clickSave();

    expect(state.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, type: "online" })
    );
  });
});
