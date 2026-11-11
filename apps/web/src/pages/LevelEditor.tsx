import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useSocket,
  useAuth,
  useToast,
  useSettings,
  useGame,
} from "../contexts";
import { useSaveLevel, useLevel } from "../hooks/api";
import {
  Save,
  X,
  Trash2,
  Play,
  PencilRuler,
  Flag,
  CircleCheck,
  CircleAlert,
} from "lucide-react";
import { GameCanvas } from "../components/game";
import {
  IoTitle,
  Input,
  IconButton,
  SegmentedControl,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/primitives";
import { cn } from "../lib/cn";
import {
  paintField,
  drawBlocks,
  drawHole,
  drawHoles,
  drawFlag,
  drawTank,
} from "../engine/shapes";
import {
  BLOCKS,
  BOT_COLOR,
  drawFlagsAndBots,
  extractEntities,
} from "../engine/levelScene";
import { renderLevelThumbnailHex } from "../lib/levelThumbnail";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../constants/canvas";
import {
  CELL_SIZE,
  GRID_COLS,
  GRID_ROWS,
  TOTAL_CELLS,
} from "../constants/level";
// The editor renders its field / walls / holes through the SAME WebGL
// post-processor the game uses, so the preview matches gameplay exactly
// (animated scenery, bloom, depth-in-holes). Flags / bots / the placement ghost
// are drawn on a 2D overlay composited on top; on no-WebGL it all falls back to
// 2D, drawn with the same engine/shapes primitives.
import { tryCreatePostProcessor } from "../engine/PostProcessor";
import type { PostProcessor } from "../engine/PostProcessor";

// The editor keeps gameplay's light, foggy floor so the preview matches a real
// run — but on its own, a whole white board reads as a blank (almost
// transparent) page. The editor dials the floor back toward the solid field
// grey and lays a faint cell grid on the overlay: an actual work surface.
const EDITOR_FIELD_WHITEN = 0.15;
const EDITOR_GRID_COLOR = "rgba(43, 47, 54, 0.1)";
// Fraction of the work area the board fills (the rest is breathing room).
const BOARD_FIT_RATIO = 0.94;

// Draw the editable cell grid — only in the editor, and only under the
// flags/bots, so the markers stay readable.
function drawEditorGrid(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = EDITOR_GRID_COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = CELL_SIZE; x < CANVAS_WIDTH; x += CELL_SIZE) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_HEIGHT);
  }
  for (let y = CELL_SIZE; y < CANVAS_HEIGHT; y += CELL_SIZE) {
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_WIDTH, y);
  }
  ctx.stroke();
  ctx.restore();
}

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
  const { addToast, TOAST_TYPES } = useToast();
  const { settings } = useSettings();
  // `isPlaying` flips true while a test run is overlaid on the editor; quitting
  // the run flips it back, revealing the editor with its layout still intact.
  const { isPlaying, startTestGame } = useGame();

  // Interaction surface (mouse → grid), the 2D overlay (flags/bots/ghost, and
  // the full scene in the no-WebGL fallback), the WebGL output, and the shared
  // post-processor instance.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stageHostRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<HTMLCanvasElement | null>(null);
  const postRef = useRef<PostProcessor | null>(null);
  const [postActive, setPostActive] = useState(false);
  // Board footprint in virtual editor pixels: the --stage transform already
  // scales the whole editor, so fit the 1150×800 board inside the work area at
  // its own aspect ratio instead of hard-coding a size that clips on some
  // window shapes.
  const [stageSize, setStageSize] = useState({
    width: CANVAS_WIDTH / 1.25,
    height: CANVAS_HEIGHT / 1.25,
  });
  const [layout, setLayout] = useState<number[]>(createEmptyLayout);
  const [selectedBlock, setSelectedBlock] = useState(BLOCKS.WALL);
  const [mode, setMode] = useState("online"); // "online" or "solo"
  const [levelName, setLevelName] = useState("");
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [mouseButton, setMouseButton] = useState<number | null>(null);
  const [mouseGridPos, setMouseGridPos] = useState({ x: -1, y: -1 });
  const [onCanvas, setOnCanvas] = useState(false);
  const [saving, setSaving] = useState(false);
  // True once the creator has cleared the current layout in a test run. A solo
  // level can't be published until then, so a run is the one proof that the
  // level is actually beatable. Every edit revokes it (place/erase, clear,
  // mode switch, loading another level).
  const [cleared, setCleared] = useState(false);
  // Publishing a solo level without a clear opens this prompt instead of
  // silently saving: the creator is asked to play the level first.
  const [showClearPrompt, setShowClearPrompt] = useState(false);

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
      // A freshly loaded level has never been played in this session.
      setCleared(false);
    }
  }, [levelData]);

  useEffect(() => {
    if (saveLevelMutation.isSuccess) {
      setSaving(false);
      navigate("/creations");
    }
    if (saveLevelMutation.isError) {
      setSaving(false);
      // Log the raw error for debugging, but show the player a localized message
      // rather than leaking the server's English text.
      console.error("Save failed:", saveLevelMutation.error);
      addToast(
        TOAST_TYPES.ERROR,
        t("levelEditor.toast.title"),
        t("levelEditor.toast.failedSave")
      );
    }
  }, [
    saveLevelMutation.isSuccess,
    saveLevelMutation.isError,
    saveLevelMutation.error,
    navigate,
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
    post?.setFieldWhiten(EDITOR_FIELD_WHITEN);
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

  // Fit the board to the work area, preserving the 23:16 board ratio.
  useEffect(() => {
    const host = stageHostRef.current;
    if (!host) return;
    const update = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      // Leave a margin so the board reads as a framed work surface instead of
      // butting against the card's border.
      const scale =
        Math.min(w / CANVAS_WIDTH, h / CANVAS_HEIGHT) * BOARD_FIT_RATIO;
      setStageSize({
        width: Math.floor(CANVAS_WIDTH * scale),
        height: Math.floor(CANVAS_HEIGHT * scale),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

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
        drawHoles(ctx, holes);
      }
      drawEditorGrid(ctx);
      // Flags wave on their own clock so the preview feels alive even while
      // the palette/mouse are idle.
      drawFlagsAndBots(ctx, flags, bots, performance.now() / 1000);

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
          // Left click - place block. Any edit revokes an earlier clear: the
          // run only vouches for the exact layout that was played.
          setCleared(false);
          setLayout((prev) => {
            const newLayout = [...prev];
            newLayout[index] = selectedBlock;
            return newLayout;
          });
        } else if (button === 2) {
          // Right click - remove block
          setCleared(false);
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
    // The grid changes meaning with the mode (online strips bot spawns), so an
    // earlier clear no longer applies.
    setCleared(false);
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
      setCleared(false);
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

    // Publishing gate: saving makes the level public, so a solo level must have
    // been finished in a test run first. Online levels have no bots to defeat,
    // so they can't be "finished" this way and are exempt.
    if (mode === "solo" && !cleared) {
      setShowClearPrompt(true);
      return;
    }

    // Generate thumbnail (static 2D render of the whole level) and encode it as
    // the hex wire format the API stores.
    const hexData = renderLevelThumbnailHex(layout);
    if (hexData === null) return;

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

  // Return to the shared creations page.
  const handleClose = () => {
    navigate("/creations");
  };

  // Block selector items (shape-based — no sprites).
  const baseBlocks = [
    { id: BLOCKS.WALL, label: t("levelEditor.blocks.wall") },
    { id: BLOCKS.PLATFORM, label: t("levelEditor.blocks.platform") },
    { id: BLOCKS.HOLE, label: t("levelEditor.blocks.hole") },
    { id: BLOCKS.FLAG, label: t("levelEditor.blocks.spawn") },
  ];

  const botBlocks = [
    { id: BLOCKS.BOT_BROWN, label: t("levelEditor.blocks.botBrown") },
    { id: BLOCKS.BOT_GREY, label: t("levelEditor.blocks.botGrey") },
    { id: BLOCKS.BOT_TEAL, label: t("levelEditor.blocks.botTeal") },
    { id: BLOCKS.BOT_GREEN, label: t("levelEditor.blocks.botGreen") },
    { id: BLOCKS.BOT_YELLOW, label: t("levelEditor.blocks.botYellow") },
    { id: BLOCKS.BOT_PURPLE, label: t("levelEditor.blocks.botPurple") },
    { id: BLOCKS.BOT_MAGENTA, label: t("levelEditor.blocks.botMagenta") },
    { id: BLOCKS.BOT_WHITE, label: t("levelEditor.blocks.botWhite") },
    { id: BLOCKS.BOT_BLACK, label: t("levelEditor.blocks.botBlack") },
  ];

  const spawnCount = layout.filter((block) => block === BLOCKS.FLAG).length;

  // No `graph-paper` on the root: the menu shell already paints the field, and
  // a second grid inside the scaled stage starts at another origin (and at
  // another scale), so its lines drift against the shell's.
  return (
    <div className="relative w-full h-full text-ink flex flex-col p-4 gap-4">
      {/* Header — its own rounded card like the palette and the canvas, with a
          colour badge so the editor has an anchor instead of a white slab
          butting against the page edges. */}
      <div className="h-20 shrink-0 bg-white border-4 border-ink rounded-arcade shadow-arcade flex items-center justify-between gap-4 px-5">
        <div className="flex items-center gap-3 whitespace-nowrap">
          <span className="bg-yellow text-ink border-[3px] border-ink rounded-[11px] p-2">
            <PencilRuler size={22} strokeWidth={2.5} />
          </span>
          <IoTitle className="text-2xl shrink-0">
            {t("levelEditor.title")}
          </IoTitle>
        </div>

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

      {/* Body: two solid cards on the graph-paper desk, below the header card.
          No translucent surfaces — the board sits on a field-grey mat. */}
      <div className="flex-1 flex min-h-0 gap-4">
        {/* Block Palette */}
        <aside className="w-48 shrink-0 flex flex-col bg-white border-4 border-ink rounded-arcade shadow-arcade p-3 min-h-0">
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft text-center mb-3">
            {t("levelEditor.selectBlock")}
          </h2>

          {/* Two columns: the solo palette has 13 blocks and must stay inside
              the card (a single column used to spill over the footer). */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2 content-start">
              {[...baseBlocks, ...(mode === "solo" ? botBlocks : [])].map(
                (block) => (
                  <button
                    key={block.id}
                    onClick={() => setSelectedBlock(block.id)}
                    className={cn(
                      "aspect-square grid place-items-center rounded-[10px] border-[3px] bg-field transition-[transform,box-shadow,background-color] hover:-translate-y-0.5",
                      selectedBlock === block.id
                        ? "border-yellow ring-[3px] ring-yellow/60 bg-white shadow-[0_3px_0_var(--color-yellow-d)]"
                        : "border-ink shadow-[0_3px_0_rgba(0,0,0,0.18)] hover:bg-[#d4d8dc]"
                    )}
                    aria-pressed={selectedBlock === block.id}
                    title={block.label}
                  >
                    <BlockThumb type={block.id} size={38} />
                  </button>
                )
              )}
            </div>
          </div>
        </aside>

        {/* Canvas card. The interaction surface holds two stacked canvases at
            board resolution, scaled to the display footprint: the 2D overlay
            (texture source / fallback) and the WebGL output on top. */}
        <section className="flex-1 min-w-0 flex flex-col bg-white border-4 border-ink rounded-arcade shadow-arcade p-3 min-h-0">
          <div
            ref={stageHostRef}
            className="flex-1 min-h-0 grid place-items-center p-1 overflow-hidden"
          >
            <div
              ref={stageRef}
              data-hover-sound=""
              className="relative cursor-crosshair bg-field border-4 border-ink rounded-lg shadow-[0_6px_0_rgba(43,47,54,0.28)] overflow-hidden"
              style={{ width: stageSize.width, height: stageSize.height }}
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

          {/* Status rail — replaces the empty white strip. */}
          <div className="shrink-0 flex items-center justify-between gap-4 pt-2.5 px-0.5 text-[13px] font-semibold text-ink-soft">
            <div className="flex items-center gap-4 min-w-0">
              <span className="truncate">{t("levelEditor.hintPlace")}</span>
              <span className="truncate">{t("levelEditor.hintErase")}</span>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              {/* Solo levels only: online levels can't be cleared in a test run. */}
              {mode === "solo" && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5",
                    cleared ? "text-green-d" : "text-ink-soft"
                  )}
                >
                  {cleared ? (
                    <CircleCheck size={14} />
                  ) : (
                    <CircleAlert size={14} />
                  )}
                  {t(
                    cleared
                      ? "levelEditor.clearedHint"
                      : "levelEditor.clearFirstHint"
                  )}
                </span>
              )}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5",
                  spawnCount > 8 && "text-red-d"
                )}
              >
                <Flag size={14} />
                {t("levelEditor.spawnCount", { count: spawnCount })}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Publishing prompt: the creator tried to save a solo level they haven't
          finished yet. Offer to jump straight into the test run. */}
      <Dialog open={showClearPrompt} onOpenChange={setShowClearPrompt}>
        <DialogContent widthClassName="w-[min(92vw,460px)]">
          <DialogTitle className="text-xl font-extrabold mb-2">
            {t("levelEditor.clearPrompt.title")}
          </DialogTitle>
          <DialogDescription className="text-ink-soft text-sm mb-5">
            {t("levelEditor.clearPrompt.body")}
          </DialogDescription>
          <div className="flex justify-end gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowClearPrompt(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="green"
              size="sm"
              onClick={() => {
                setShowClearPrompt(false);
                handleTest();
              }}
            >
              <Play size={16} />
              {t("levelEditor.testLevel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test run: the full game overlaid on the editor (which stays mounted, so
          the layout survives). Quitting the run flips isPlaying back to false. */}
      {isPlaying && (
        <div className="absolute inset-0 z-50">
          <GameCanvas
            onTestResult={(result) => {
              // Only a win counts as finishing the level; a loss changes
              // nothing (the run can be retried from the end screen).
              if (result.result === "win") setCleared(true);
            }}
          />
        </div>
      )}
    </div>
  );
};
