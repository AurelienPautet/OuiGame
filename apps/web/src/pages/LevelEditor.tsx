import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSocket, useAuth, useModal, MODALS } from "../contexts";
import { useSaveLevel, useLevel } from "../hooks/api";
import { Save, X, Trash2 } from "lucide-react";
import {
  IoTitle,
  Input,
  IconButton,
  SegmentedControl,
} from "../components/ui/primitives";
import { cn } from "../lib/cn";
import { palette } from "../theme/palette";
import { drawTank } from "../engine/tankShape";

// Constants matching the old level editor
const CANVAS_WIDTH = 920;
const CANVAS_HEIGHT = 640;
const GRID_COLS = 23;
const GRID_ROWS = 16;
const CELL_SIZE = 40;
const TOTAL_CELLS = GRID_COLS * GRID_ROWS; // 368

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
};

const INK = palette.ink;

// Bot block id → tank colour name (shared with the game palette).
const BOT_COLOR: Record<number, string> = {
  [BLOCKS.BOT_BLUE]: "blue",
  [BLOCKS.BOT_GREEN]: "green",
  [BLOCKS.BOT_ORANGE]: "orange",
  [BLOCKS.BOT_RED]: "red",
};

// Draw one editor cell as a flat arcade shape — the same visual language as the
// in-game Renderer, so the editor preview matches what you'll actually play.
function drawEditorBlock(
  ctx: CanvasRenderingContext2D,
  blockType: number,
  x: number,
  y: number,
  s: number
) {
  switch (blockType) {
    case BLOCKS.WALL:
    case BLOCKS.PLATFORM: {
      ctx.fillStyle = blockType === BLOCKS.WALL ? "#7d848e" : "#cbb287";
      ctx.fillRect(x, y, s, s);
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
      break;
    }
    case BLOCKS.HOLE: {
      ctx.beginPath();
      ctx.roundRect(x + 3, y + 3, s - 6, s - 6, 6);
      ctx.fillStyle = "#13161b";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#000";
      ctx.stroke();
      break;
    }
    case BLOCKS.FLAG: {
      // Spawn-point marker: a little yellow pennant on an ink pole.
      const px = x + s * 0.34;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px, y + s * 0.2);
      ctx.lineTo(px, y + s * 0.82);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px, y + s * 0.22);
      ctx.lineTo(x + s * 0.74, y + s * 0.36);
      ctx.lineTo(px, y + s * 0.5);
      ctx.closePath();
      ctx.fillStyle = palette.yellow;
      ctx.fill();
      ctx.stroke();
      break;
    }
    default: {
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const levelId = searchParams.get("id");

  const { isConnected } = useSocket()!;
  const { user } = useAuth();
  const { openModal } = useModal();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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
      alert(
        "Failed to save level: " +
          (saveLevelMutation.error?.message || "Unknown error")
      );
    }
  }, [
    saveLevelMutation.isSuccess,
    saveLevelMutation.isError,
    navigate,
    openModal,
  ]);

  // Draw block on canvas (shape-based, matches the in-game renderer).
  const drawBlock = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      blockType: number,
      x: number,
      y: number
    ) => {
      drawEditorBlock(ctx, blockType, x, y, CELL_SIZE);
    },
    []
  );

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animationId: number | undefined;

    const render = () => {
      // Graph-paper field — same light arcade backdrop as the game / menus.
      ctx.fillStyle = palette.field;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.strokeStyle = palette.fieldLine;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = 0; gx <= CANVAS_WIDTH; gx += CELL_SIZE) {
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, CANVAS_HEIGHT);
      }
      for (let gy = 0; gy <= CANVAS_HEIGHT; gy += CELL_SIZE) {
        ctx.moveTo(0, gy);
        ctx.lineTo(CANVAS_WIDTH, gy);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Draw all blocks
      for (let i = 0; i < layout.length; i++) {
        const block = layout[i];
        // i is bounded by layout.length, so block is always defined.
        if (block !== undefined && block >= 0) {
          const x = (i % GRID_COLS) * CELL_SIZE;
          const y = Math.floor(i / GRID_COLS) * CELL_SIZE;
          drawBlock(ctx, block, x, y);
        }
      }

      // Draw ghost preview
      if (onCanvas && mouseGridPos.x >= 0 && mouseGridPos.y >= 0) {
        ctx.globalAlpha = 0.5;
        drawBlock(
          ctx,
          selectedBlock,
          mouseGridPos.x * CELL_SIZE,
          mouseGridPos.y * CELL_SIZE
        );
        ctx.globalAlpha = 1.0;
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [layout, onCanvas, mouseGridPos, selectedBlock, drawBlock]);

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

  // Mouse event handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const gridX = Math.floor(mouseX / CELL_SIZE);
    const gridY = Math.floor(mouseY / CELL_SIZE);

    setMouseGridPos({ x: gridX, y: gridY });

    if (isMouseDown) {
      handleMouseAction(gridX, gridY, mouseButton);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const gridX = Math.floor(mouseX / CELL_SIZE);
    const gridY = Math.floor(mouseY / CELL_SIZE);

    setIsMouseDown(true);
    setMouseButton(e.button);
    setMouseGridPos({ x: gridX, y: gridY });
    handleMouseAction(gridX, gridY, e.button);
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
    setMouseButton(null);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
    if (window.confirm("Are you sure you want to clear the entire level?")) {
      setLayout(createEmptyLayout());
    }
  };

  // Save level
  const handleSave = () => {
    if (!user) {
      alert("Please log in to save levels");
      return;
    }

    // Validate spawn points
    const spawnCount = layout.filter((b) => b === BLOCKS.FLAG).length;
    if (spawnCount === 0) {
      alert("You need at least one spawn point (flag) for players!");
      return;
    }
    if (spawnCount > 8) {
      alert("You cannot have more than 8 spawn points!");
      return;
    }

    // Validate level name
    if (!levelName.trim()) {
      alert("Level name cannot be empty!");
      return;
    }
    if (levelName.length > 30) {
      alert("Level name cannot be longer than 30 characters!");
      return;
    }

    // Generate thumbnail
    const canvas = canvasRef.current;
    if (!canvas) return;
    const lowQuality = canvas.toDataURL("image/jpeg", 0.1);
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
    { id: BLOCKS.WALL, label: "Wall" },
    { id: BLOCKS.PLATFORM, label: "Platform" },
    { id: BLOCKS.HOLE, label: "Hole" },
    { id: BLOCKS.FLAG, label: "Spawn" },
  ];

  const botBlocks = [
    { id: BLOCKS.BOT_BLUE, label: "Blue Bot" },
    { id: BLOCKS.BOT_GREEN, label: "Green Bot" },
    { id: BLOCKS.BOT_ORANGE, label: "Orange Bot" },
    { id: BLOCKS.BOT_RED, label: "Red Bot" },
  ];

  return (
    <div className="w-full h-full graph-paper text-ink flex flex-col">
      {/* Header */}
      <div className="h-24 bg-white border-b-4 border-ink flex items-center justify-between gap-4 px-8">
        <IoTitle className="text-2xl shrink-0">EDITOR</IoTitle>

        {/* Mode Toggle */}
        <SegmentedControl<string>
          value={mode}
          onValueChange={handleModeChange}
          options={[
            { value: "online", label: "Online" },
            { value: "solo", label: "Solo" },
          ]}
          aria-label="Level mode"
        />

        {/* Level Name */}
        <Input
          className="max-w-xs"
          placeholder="Enter level name"
          value={levelName}
          onChange={(e) => setLevelName(e.target.value)}
          maxLength={30}
        />

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <IconButton onClick={handleClear} title="Clear Level">
            <Trash2 size={20} />
          </IconButton>
          <IconButton
            onClick={handleSave}
            disabled={saving || !isConnected}
            title="Save Level"
          >
            <Save size={20} className="text-green-d" />
          </IconButton>
          <IconButton onClick={handleClose} title="Close">
            <X size={20} className="text-red" />
          </IconButton>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Block Palette */}
        <div className="w-48 bg-white border-r-4 border-ink flex flex-col items-center py-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft mb-4">
            Select a block
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

        {/* Canvas Area */}
        <div className="flex-1 flex items-center justify-center graph-paper">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block cursor-crosshair border-4 border-ink rounded-lg shadow-arcade"
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              setOnCanvas(false);
              setIsMouseDown(false);
            }}
            onMouseEnter={() => setOnCanvas(true)}
            onContextMenu={handleContextMenu}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="h-16 bg-white border-t-4 border-ink" />
    </div>
  );
};
