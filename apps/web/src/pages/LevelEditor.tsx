import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useSocket,
  useAuth,
  useModal,
  useToast,
  useSettings,
  useGame,
  MODALS,
} from "../contexts";
import { useSaveLevel, useLevel } from "../hooks/api";
import { Save, X, Trash2, Play } from "lucide-react";
import { GameCanvas } from "../components/game";
import {
  IoTitle,
  Input,
  IconButton,
  SegmentedControl,
} from "../components/ui/primitives";
import { cn } from "../lib/cn";
import {
  paintField,
  drawBlocks,
  drawHole,
  drawFlag,
  drawTank,
} from "../engine/shapes";
// The editor renders its field / walls / holes through the SAME WebGL
// post-processor the game uses, so the preview matches gameplay exactly
// (animated scenery, bloom, depth-in-holes). Flags / bots / the placement ghost
// are drawn on a 2D overlay composited on top; on no-WebGL it all falls back to
// 2D, drawn with the same engine/shapes primitives.
import { tryCreatePostProcessor } from "../engine/PostProcessor";
import type { PostProcessor, EnvBlock, EnvHole } from "../engine/PostProcessor";

// Board resolution + cell size match the game exactly (1150×800, 50px cells),
// so the shared renderer treats the editor board identically. The canvases
// render at this resolution and are CSS-scaled down to the display footprint.
const CANVAS_WIDTH = 1150;
const CANVAS_HEIGHT = 800;
const GRID_COLS = 23;
const GRID_ROWS = 16;
const CELL_SIZE = 50;
const TOTAL_CELLS = GRID_COLS * GRID_ROWS; // 368
// On-screen size of the canvas (kept compact; the board scales to fit).
const DISPLAY_WIDTH = 920;
const DISPLAY_HEIGHT = 640;

// Block types
const BLOCKS = {
  EMPTY: -1,
  WALL: 1,
  PLATFORM: 2,
  FLAG: 3,
  HOLE: 4,
  BOT_BLUE: 11,
  BOT_GREEN: 12,
  BOT_ORANGE: 13,
  BOT_RED: 14,
  BOT_YELLOW: 15, // Miner (v2 bot system)
  BOT_PURPLE: 16, // Hunter (v2 bot system)
};

// Bot block id → tank colour name (shared with the game palette).
const BOT_COLOR: Record<number, string> = {
  [BLOCKS.BOT_BLUE]: "blue",
  [BLOCKS.BOT_GREEN]: "green",
  [BLOCKS.BOT_ORANGE]: "orange",
  [BLOCKS.BOT_RED]: "red",
  [BLOCKS.BOT_YELLOW]: "yellow",
  [BLOCKS.BOT_PURPLE]: "purple",
};

// Draw a single editor cell via the SHARED arcade primitives (engine/shapes) —
// the exact same code the in-game Renderer uses. Used for the ghost preview and
// the palette thumbnails (single cell, so no neighbour merging here).
function drawEditorBlock(
  ctx: CanvasRenderingContext2D,
  blockType: number,
  x: number,
  y: number,
  s: number
) {
  if (blockType === BLOCKS.WALL || blockType === BLOCKS.PLATFORM) {
    drawBlocks(ctx, [
      { position: { x, y }, size: { w: s, h: s }, type: blockType },
    ]);
  } else if (blockType === BLOCKS.HOLE) {
    drawHole(ctx, { position: { x, y }, size: { w: s, h: s } });
  } else if (blockType === BLOCKS.FLAG) {
    drawFlag(ctx, x, y, s);
  } else {
    const color = BOT_COLOR[blockType];
    if (color) {
      drawTank(ctx, {
        cx: x + s / 2,
        cy: y + s / 2,
        r: s * 0.4,
        bodyColor: color,
        turretColor: color,
        angle: -Math.PI / 2,
        isBot: true,
      });
    }
  }
}

interface EditorEntities {
  blocks: EnvBlock[];
  holes: EnvHole[];
  flags: { x: number; y: number }[];
  bots: { x: number; y: number; color: string }[];
}

// Turn the flat layout array into board-space geometry: walls/platforms and
// holes feed the WebGL environment; flags/bots are 2D overlay markers.
function extractEntities(layout: number[]): EditorEntities {
  const cell = { w: CELL_SIZE, h: CELL_SIZE };
  const blocks: EnvBlock[] = [];
  const holes: EnvHole[] = [];
  const flags: { x: number; y: number }[] = [];
  const bots: { x: number; y: number; color: string }[] = [];
  for (let i = 0; i < layout.length; i++) {
    const block = layout[i];
    if (block === undefined || block < 0) continue;
    const x = (i % GRID_COLS) * CELL_SIZE;
    const y = Math.floor(i / GRID_COLS) * CELL_SIZE;
    if (block === BLOCKS.WALL || block === BLOCKS.PLATFORM) {
      blocks.push({ position: { x, y }, size: cell, type: block });
    } else if (block === BLOCKS.HOLE) {
      holes.push({ position: { x, y }, size: cell });
    } else if (block === BLOCKS.FLAG) {
      flags.push({ x, y });
    } else {
      const color = BOT_COLOR[block];
      if (color) bots.push({ x, y, color });
    }
  }
  return { blocks, holes, flags, bots };
}

// Draw the overlay markers (spawn flags + bot tanks) — same primitives the game
// uses for tanks, so they bloom/composite identically.
function drawFlagsAndBots(
  ctx: CanvasRenderingContext2D,
  flags: { x: number; y: number }[],
  bots: { x: number; y: number; color: string }[]
): void {
  flags.forEach((f) => drawFlag(ctx, f.x, f.y, CELL_SIZE));
  bots.forEach((b) =>
    drawTank(ctx, {
      cx: b.x + CELL_SIZE / 2,
      cy: b.y + CELL_SIZE / 2,
      r: CELL_SIZE * 0.4,
      bodyColor: b.color,
      turretColor: b.color,
      angle: -Math.PI / 2,
      isBot: true,
    })
  );
}

// Static 2D thumbnail of the whole level (no ghost / no animation) for the saved
// preview — decoupled from the GL canvas so it's stable and needs no readback.
function renderThumbnail(layout: number[]): string | null {
  const c = document.createElement("canvas");
  c.width = CANVAS_WIDTH;
  c.height = CANVAS_HEIGHT;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  paintField(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, CELL_SIZE);
  const { blocks, holes, flags, bots } = extractEntities(layout);
  drawBlocks(ctx, blocks);
  holes.forEach((h) => drawHole(ctx, h));
  drawFlagsAndBots(ctx, flags, bots);
  return c.toDataURL("image/jpeg", 0.1);
}

// Initialize level layout with border walls
const createEmptyLayout = (): number[] => {
  const layout: number[] = new Array(TOTAL_CELLS).fill(BLOCKS.EMPTY);

  for (let i = 0; i < TOTAL_CELLS; i++) {
    // Top row
    if (i < GRID_COLS) layout[i] = BLOCKS.WALL;
    // Bottom row
    else if (i >= TOTAL_CELLS - GRID_COLS) layout[i] = BLOCKS.WALL;
    // Left column
    else if (i % GRID_COLS === 0) layout[i] = BLOCKS.WALL;
    // Right column
    else if (i % GRID_COLS === GRID_COLS - 1) layout[i] = BLOCKS.WALL;
  }

  return layout;
};

// A palette thumbnail: renders a block/bot via the SAME drawEditorBlock used on
// the canvas, so the picker matches exactly what gets placed.
function BlockThumb({ type, size = 44 }: { type: number; size?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawEditorBlock(ctx, type, 0, 0, size);
  }, [type, size]);
  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}

export const LevelEditor = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const levelId = searchParams.get("id");

  const { isConnected } = useSocket()!;
  const { user } = useAuth();
  const { openModal } = useModal();
  const { addToast, TOAST_TYPES } = useToast();
  const { settings } = useSettings();
  // `isPlaying` flips true while a test run is overlaid on the editor; quitting
  // the run flips it back, revealing the editor with its layout still intact.
  const { isPlaying, startTestGame } = useGame();

  // Interaction surface (mouse → grid), the 2D overlay (flags/bots/ghost, and
  // the full scene in the no-WebGL fallback), the WebGL output, and the shared
  // post-processor instance.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<HTMLCanvasElement | null>(null);
  const postRef = useRef<PostProcessor | null>(null);
  const [postActive, setPostActive] = useState(false);
  const [layout, setLayout] = useState<number[]>(createEmptyLayout);
  const [selectedBlock, setSelectedBlock] = useState(BLOCKS.WALL);
  const [mode, setMode] = useState("online"); // "online" or "solo"
  const [levelName, setLevelName] = useState("");
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [mouseButton, setMouseButton] = useState<number | null>(null);
  const [mouseGridPos, setMouseGridPos] = useState({ x: -1, y: -1 });
  const [onCanvas, setOnCanvas] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveLevelMutation = useSaveLevel();

  // 0 (falsy) keeps the query disabled (enabled: !!id) when there's no id.
  const { data: levelData } = useLevel(levelId ? parseInt(levelId) : 0);

  useEffect(() => {
    if (levelData) {
      // level_json is the stored `content` envelope: { data: number[] }.
      const levelJson = levelData.level_json as { data?: number[] } | undefined;
      setLayout(levelJson?.data || createEmptyLayout());
      setLevelName(levelData.level_name || "");
      setMode(levelData.level_type || "online");
    }
  }, [levelData]);

  useEffect(() => {
    if (saveLevelMutation.isSuccess) {
      setSaving(false);
      navigate("/");
      openModal(MODALS.MY_LEVELS);
    }
    if (saveLevelMutation.isError) {
      setSaving(false);
      console.error("Save failed:", saveLevelMutation.error);
      addToast(
        TOAST_TYPES.ERROR,
        t("levelEditor.toast.title"),
        t("levelEditor.toast.failedSave", {
          error: saveLevelMutation.error?.message || t("common.unknownError"),
        })
      );
    }
  }, [
    saveLevelMutation.isSuccess,
    saveLevelMutation.isError,
    saveLevelMutation.error,
    navigate,
    openModal,
    addToast,
    TOAST_TYPES,
    t,
  ]);

  // Spin up the shared WebGL post-processor against the GL canvas (same factory
  // the game uses). Falls back to plain 2D if WebGL is unavailable.
  useEffect(() => {
    if (!glRef.current) return;
    const post = tryCreatePostProcessor(
      glRef.current,
      CANVAS_WIDTH,
      CANVAS_HEIGHT
    );
    postRef.current = post;
    setPostActive(post !== null);
    return () => {
      post?.dispose();
      postRef.current = null;
    };
  }, []);

  // Keep the post-processor's effect toggles in sync with user settings.
  useEffect(() => {
    postRef.current?.setEffects(settings.effects);
  }, [settings.effects]);

  // Render loop. The overlay 2D canvas carries the flags/bots/placement ghost
  // (and the whole scene in the no-WebGL fallback); the post-processor draws the
  // animated field/walls/holes and composites the overlay over them — the exact
  // same rendering path as the live game.
  useEffect(() => {
    // While a test run is overlaid (isPlaying), the editor preview is fully
    // occluded — don't burn a second GL render loop behind it.
    if (isPlaying) return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    let animationId: number | undefined;

    const render = () => {
      const post = postRef.current;
      const { blocks, holes, flags, bots } = extractEntities(layout);

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      // Fallback only: the 2D overlay also draws the field + environment, since
      // there's no GL layer beneath it.
      if (!post) {
        paintField(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, CELL_SIZE);
        drawBlocks(ctx, blocks);
        holes.forEach((h) => drawHole(ctx, h));
      }
      drawFlagsAndBots(ctx, flags, bots);

      // Placement ghost.
      if (onCanvas && mouseGridPos.x >= 0 && mouseGridPos.y >= 0) {
        ctx.globalAlpha = 0.5;
        drawEditorBlock(
          ctx,
          selectedBlock,
          mouseGridPos.x * CELL_SIZE,
          mouseGridPos.y * CELL_SIZE,
          CELL_SIZE
        );
        ctx.globalAlpha = 1.0;
      }

      // GL path: composite the overlay over the animated environment.
      post?.render(overlay, blocks, holes);

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [layout, onCanvas, mouseGridPos, selectedBlock, postActive, isPlaying]);

  // Handle mouse actions
  const handleMouseAction = useCallback(
    (gridX: number, gridY: number, button: number | null) => {
      const index = gridY * GRID_COLS + gridX;

      // Check bounds - don't allow editing border cells
      if (
        gridX > 0 &&
        gridX < GRID_COLS - 1 &&
        gridY > 0 &&
        gridY < GRID_ROWS - 1
      ) {
        if (button === 0) {
          // Left click - place block
          setLayout((prev) => {
            const newLayout = [...prev];
            newLayout[index] = selectedBlock;
            return newLayout;
          });
        } else if (button === 2) {
          // Right click - remove block
          setLayout((prev) => {
            const newLayout = [...prev];
            newLayout[index] = BLOCKS.EMPTY;
            return newLayout;
          });
        }
      }
    },
    [selectedBlock]
  );

  // Pointer → grid cell, via the interaction surface (the board is scaled to
  // fit, so map through the element's display rect to the 1150×800 board).
  const gridFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return { gridX: -1, gridY: -1 };
    const rect = stage.getBoundingClientRect();
    const boardX = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const boardY = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
    return {
      gridX: Math.floor(boardX / CELL_SIZE),
      gridY: Math.floor(boardY / CELL_SIZE),
    };
  };

  // Mouse event handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { gridX, gridY } = gridFromEvent(e);
    setMouseGridPos({ x: gridX, y: gridY });
    if (isMouseDown) {
      handleMouseAction(gridX, gridY, mouseButton);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const { gridX, gridY } = gridFromEvent(e);
    setIsMouseDown(true);
    setMouseButton(e.button);
    setMouseGridPos({ x: gridX, y: gridY });
    handleMouseAction(gridX, gridY, e.button);
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
    setMouseButton(null);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Toggle mode handler
  const handleModeChange = (newMode: string) => {
    setMode(newMode);
    if (newMode === "online") {
      // Remove bot spawns when switching to online (players only, no bots)
      setLayout((prev) =>
        prev.map((block) => (block >= 10 ? BLOCKS.EMPTY : block))
      );
    }
    // When selecting a bot in online mode, reset to wall
    if (newMode === "online" && selectedBlock >= 10) {
      setSelectedBlock(BLOCKS.WALL);
    }
  };

  // Clear level with confirmation
  const handleClear = () => {
    if (window.confirm(t("levelEditor.confirmClear"))) {
      setLayout(createEmptyLayout());
    }
  };

  // Test the current (possibly unsaved) layout: play it in a throwaway solo run
  // overlaid on the editor. No login or save required — only a valid spawn count.
  const handleTest = () => {
    const spawnCount = layout.filter((b) => b === BLOCKS.FLAG).length;
    if (spawnCount === 0) {
      addToast(
        TOAST_TYPES.ERROR,
        t("levelEditor.toast.title"),
        t("levelEditor.toast.needSpawn")
      );
      return;
    }
    if (spawnCount > 8) {
      addToast(
        TOAST_TYPES.ERROR,
        t("levelEditor.toast.title"),
        t("levelEditor.toast.tooManySpawns")
      );
      return;
    }
    startTestGame(layout);
  };

  // Save level
  const handleSave = () => {
    if (!user) {
      addToast(
        TOAST_TYPES.ERROR,
        t("levelEditor.toast.title"),
        t("levelEditor.toast.loginToSave")
      );
      return;
    }

    // Validate spawn points
    const spawnCount = layout.filter((b) => b === BLOCKS.FLAG).length;
    if (spawnCount === 0) {
      addToast(
        TOAST_TYPES.ERROR,
        t("levelEditor.toast.title"),
        t("levelEditor.toast.needSpawn")
      );
      return;
    }
    if (spawnCount > 8) {
      addToast(
        TOAST_TYPES.ERROR,
        t("levelEditor.toast.title"),
        t("levelEditor.toast.tooManySpawns")
      );
      return;
    }

    // Validate level name
    if (!levelName.trim()) {
      addToast(
        TOAST_TYPES.ERROR,
        t("levelEditor.toast.title"),
        t("levelEditor.toast.nameEmpty")
      );
      return;
    }
    if (levelName.length > 30) {
      addToast(
        TOAST_TYPES.ERROR,
        t("levelEditor.toast.title"),
        t("levelEditor.toast.nameTooLong")
      );
      return;
    }

    // Generate thumbnail (static 2D render of the whole level).
    const lowQuality = renderThumbnail(layout);
    if (!lowQuality) return;
    const base64Data = lowQuality.split(",")[1];
    if (base64Data === undefined) return;

    // Convert base64 to hex (matching old implementation)
    const binary = atob(base64Data);
    let hexData = "";
    for (let i = 0; i < binary.length; i++) {
      hexData += binary.charCodeAt(i).toString(16).padStart(2, "0");
    }

    const levelData = { data: layout };
    const maxPlayers = spawnCount;

    setSaving(true);
    saveLevelMutation.mutate({
      ...(levelId ? { id: parseInt(levelId) } : {}),
      levelData,
      hexData,
      levelName,
      maxPlayers,
      type: mode,
    });
  };

  // Close editor - go back to My Levels modal
  const handleClose = () => {
    navigate("/");
    openModal(MODALS.MY_LEVELS);
  };

  // Block selector items (shape-based — no sprites).
  const baseBlocks = [
    { id: BLOCKS.WALL, label: t("levelEditor.blocks.wall") },
    { id: BLOCKS.PLATFORM, label: t("levelEditor.blocks.platform") },
    { id: BLOCKS.HOLE, label: t("levelEditor.blocks.hole") },
    { id: BLOCKS.FLAG, label: t("levelEditor.blocks.spawn") },
  ];

  const botBlocks = [
    { id: BLOCKS.BOT_BLUE, label: t("levelEditor.blocks.botBlue") },
    { id: BLOCKS.BOT_GREEN, label: t("levelEditor.blocks.botGreen") },
    { id: BLOCKS.BOT_ORANGE, label: t("levelEditor.blocks.botOrange") },
    { id: BLOCKS.BOT_RED, label: t("levelEditor.blocks.botRed") },
    { id: BLOCKS.BOT_YELLOW, label: t("levelEditor.blocks.botYellow") },
    { id: BLOCKS.BOT_PURPLE, label: t("levelEditor.blocks.botPurple") },
  ];

  return (
    <div className="relative w-full h-full graph-paper text-ink flex flex-col">
      {/* Header */}
      <div className="h-24 bg-white border-b-4 border-ink flex items-center justify-between gap-4 px-8">
        <IoTitle className="text-2xl shrink-0">
          {t("levelEditor.title")}
        </IoTitle>

        {/* Mode Toggle */}
        <SegmentedControl<string>
          value={mode}
          onValueChange={handleModeChange}
          options={[
            { value: "online", label: t("levelEditor.online") },
            { value: "solo", label: t("levelEditor.solo") },
          ]}
          aria-label="Level mode"
        />

        {/* Level Name */}
        <Input
          className="max-w-xs"
          placeholder={t("levelEditor.levelNamePlaceholder")}
          value={levelName}
          onChange={(e) => setLevelName(e.target.value)}
          maxLength={30}
        />

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <IconButton onClick={handleClear} title={t("levelEditor.clearLevel")}>
            <Trash2 size={20} />
          </IconButton>
          <IconButton onClick={handleTest} title={t("levelEditor.testLevel")}>
            <Play size={20} className="text-blue-d" />
          </IconButton>
          <IconButton
            onClick={handleSave}
            disabled={saving || !isConnected}
            title={t("levelEditor.saveLevel")}
          >
            <Save size={20} className="text-green-d" />
          </IconButton>
          <IconButton onClick={handleClose} title={t("common.close")}>
            <X size={20} className="text-red" />
          </IconButton>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Block Palette */}
        <div className="w-48 bg-white border-r-4 border-ink flex flex-col items-center py-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft mb-4">
            {t("levelEditor.selectBlock")}
          </h2>

          <div className="flex flex-col gap-2">
            {[...baseBlocks, ...(mode === "solo" ? botBlocks : [])].map(
              (block) => (
                <button
                  key={block.id}
                  onClick={() => setSelectedBlock(block.id)}
                  className={cn(
                    "size-14 grid place-items-center rounded-lg border-[3px] bg-field hover:scale-110 transition-transform",
                    selectedBlock === block.id
                      ? "border-yellow ring-2 ring-yellow/50"
                      : "border-ink"
                  )}
                  title={block.label}
                >
                  <BlockThumb type={block.id} />
                </button>
              )
            )}
          </div>
        </div>

        {/* Canvas Area. The interaction surface holds two stacked canvases at
            board resolution, scaled to the display footprint: the 2D overlay
            (texture source / fallback) and the WebGL output on top. */}
        <div className="flex-1 flex items-center justify-center graph-paper">
          <div
            ref={stageRef}
            className="relative cursor-crosshair border-4 border-ink rounded-lg shadow-arcade overflow-hidden"
            style={{ width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT }}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              setOnCanvas(false);
              setIsMouseDown(false);
            }}
            onMouseEnter={() => setOnCanvas(true)}
            onContextMenu={handleContextMenu}
          >
            <canvas
              ref={overlayRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="absolute inset-0 w-full h-full"
              style={postActive ? { visibility: "hidden" } : undefined}
            />
            <canvas
              ref={glRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="absolute inset-0 w-full h-full"
              style={postActive ? undefined : { display: "none" }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="h-16 bg-white border-t-4 border-ink" />

      {/* Test run: the full game overlaid on the editor (which stays mounted, so
          the layout survives). Quitting the run flips isPlaying back to false. */}
      {isPlaying && (
        <div className="absolute inset-0 z-50">
          <GameCanvas />
        </div>
      )}
    </div>
  );
};
