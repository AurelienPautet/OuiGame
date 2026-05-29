import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSocket, useAuth, useModal, MODALS } from "../contexts";
import { useSaveLevel, useLevel } from "../hooks/api";
import { Save, X, Trash2 } from "lucide-react";

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

// Initialize level layout with border walls
const createEmptyLayout = () => {
  const layout = new Array(TOTAL_CELLS).fill(BLOCKS.EMPTY);

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

// Load images helper
const loadImage = (src) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
};

export const LevelEditor = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const levelId = searchParams.get("id");

  const { isConnected } = useSocket();
  const { user } = useAuth();
  const { openModal } = useModal();

  const canvasRef = useRef(null);
  const [layout, setLayout] = useState(createEmptyLayout);
  const [selectedBlock, setSelectedBlock] = useState(BLOCKS.WALL);
  const [mode, setMode] = useState("online"); // "online" or "solo"
  const [levelName, setLevelName] = useState("");
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [mouseButton, setMouseButton] = useState(null);
  const [mouseGridPos, setMouseGridPos] = useState({ x: -1, y: -1 });
  const [onCanvas, setOnCanvas] = useState(false);
  const [images, setImages] = useState({});
  const [saving, setSaving] = useState(false);

  const theme = 6; // Default theme

  const saveLevelMutation = useSaveLevel();

  // Load images on mount
  useEffect(() => {
    const loadAllImages = async () => {
      const imgPaths = {
        block1: `ressources/image/block/Cube${theme}-1.png`,
        block2: `ressources/image/block/Cube${theme}-2.png`,
        flag: `ressources/image/block/flag.png`,
        hole: `ressources/image/block/hole.png`,
        bg: `ressources/image/bg${theme}.png`,
        body_blue: `ressources/image/tank_player/body_blue.png`,
        turret_blue: `ressources/image/tank_player/turret_blue.png`,
        body_green: `ressources/image/tank_player/body_green.png`,
        turret_green: `ressources/image/tank_player/turret_green.png`,
        body_orange: `ressources/image/tank_player/body_orange.png`,
        turret_orange: `ressources/image/tank_player/turret_orange.png`,
        body_red: `ressources/image/tank_player/body_red.png`,
        turret_red: `ressources/image/tank_player/turret_red.png`,
      };

      const loaded = {};
      for (const [key, src] of Object.entries(imgPaths)) {
        loaded[key] = await loadImage(src);
      }
      setImages(loaded);
    };

    loadAllImages();
  }, [theme]);

  const { data: levelData } = useLevel(levelId ? parseInt(levelId) : null);

  useEffect(() => {
    if (levelData) {
      setLayout(levelData.level_json?.data || createEmptyLayout());
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

  // Draw block on canvas
  const drawBlock = useCallback(
    (ctx, blockType, x, y) => {
      switch (blockType) {
        case BLOCKS.WALL:
          if (images.block1)
            ctx.drawImage(images.block1, x, y, CELL_SIZE, CELL_SIZE);
          break;
        case BLOCKS.PLATFORM:
          if (images.block2)
            ctx.drawImage(images.block2, x, y, CELL_SIZE, CELL_SIZE);
          break;
        case BLOCKS.FLAG:
          if (images.flag)
            ctx.drawImage(images.flag, x, y, CELL_SIZE, CELL_SIZE);
          break;
        case BLOCKS.HOLE:
          if (images.hole)
            ctx.drawImage(images.hole, x, y, CELL_SIZE, CELL_SIZE);
          break;
        case BLOCKS.BOT_BLUE:
          if (images.body_blue && images.turret_blue) {
            ctx.drawImage(images.body_blue, x, y, CELL_SIZE, CELL_SIZE);
            ctx.drawImage(images.turret_blue, x - 6, y + 3, CELL_SIZE, 25);
          }
          break;
        case BLOCKS.BOT_GREEN:
          if (images.body_green && images.turret_green) {
            ctx.drawImage(images.body_green, x, y, CELL_SIZE, CELL_SIZE);
            ctx.drawImage(images.turret_green, x - 6, y + 3, CELL_SIZE, 25);
          }
          break;
        case BLOCKS.BOT_ORANGE:
          if (images.body_orange && images.turret_orange) {
            ctx.drawImage(images.body_orange, x, y, CELL_SIZE, CELL_SIZE);
            ctx.drawImage(images.turret_orange, x - 6, y + 3, CELL_SIZE, 25);
          }
          break;
        case BLOCKS.BOT_RED:
          if (images.body_red && images.turret_red) {
            ctx.drawImage(images.body_red, x, y, CELL_SIZE, CELL_SIZE);
            ctx.drawImage(images.turret_red, x - 6, y + 3, CELL_SIZE, 25);
          }
          break;
      }
    },
    [images]
  );

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animationId;

    const render = () => {
      // Draw background
      if (images.bg) {
        ctx.drawImage(images.bg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } else {
        ctx.fillStyle = "#374151";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      // Draw all blocks
      for (let i = 0; i < layout.length; i++) {
        if (layout[i] >= 0) {
          const x = (i % GRID_COLS) * CELL_SIZE;
          const y = Math.floor(i / GRID_COLS) * CELL_SIZE;
          drawBlock(ctx, layout[i], x, y);
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
  }, [layout, images, onCanvas, mouseGridPos, selectedBlock, drawBlock]);

  // Handle mouse actions
  const handleMouseAction = useCallback(
    (gridX, gridY, button) => {
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
  const handleMouseMove = (e) => {
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

  const handleMouseDown = (e) => {
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

  const handleContextMenu = (e) => {
    e.preventDefault();
  };

  // Toggle mode handler
  const handleModeChange = (newMode) => {
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
    const lowQuality = canvas.toDataURL("image/jpeg", 0.1);
    const base64Data = lowQuality.split(",")[1];

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
      id: levelId ? parseInt(levelId) : null,
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

  // Block selector items
  const baseBlocks = [
    {
      id: BLOCKS.WALL,
      src: `ressources/image/block/Cube${theme}-1.png`,
      label: "Wall",
    },
    {
      id: BLOCKS.PLATFORM,
      src: `ressources/image/block/Cube${theme}-2.png`,
      label: "Platform",
    },
    { id: BLOCKS.HOLE, src: `ressources/image/block/hole.png`, label: "Hole" },
    {
      id: BLOCKS.FLAG,
      src: `ressources/image/block/flag.png`,
      label: "Spawn",
    },
  ];

  const botBlocks = [
    {
      id: BLOCKS.BOT_BLUE,
      body: `ressources/image/tank_player/body_blue.png`,
      turret: `ressources/image/tank_player/turret_blue.png`,
      label: "Blue Bot",
    },
    {
      id: BLOCKS.BOT_GREEN,
      body: `ressources/image/tank_player/body_green.png`,
      turret: `ressources/image/tank_player/turret_green.png`,
      label: "Green Bot",
    },
    {
      id: BLOCKS.BOT_ORANGE,
      body: `ressources/image/tank_player/body_orange.png`,
      turret: `ressources/image/tank_player/turret_orange.png`,
      label: "Orange Bot",
    },
    {
      id: BLOCKS.BOT_RED,
      body: `ressources/image/tank_player/body_red.png`,
      turret: `ressources/image/tank_player/turret_red.png`,
      label: "Red Bot",
    },
  ];

  return (
    <div className="w-full h-full bg-base-300 text-white flex flex-col">
      {/* Header */}
      <div className="h-24 bg-base-200 flex items-center justify-between px-8">
        <h1 className="text-xl font-bold">Level Editor</h1>

        {/* Mode Toggle */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="mode"
              className="radio radio-primary"
              checked={mode === "online"}
              onChange={() => handleModeChange("online")}
            />
            <span className="font-bold">Online</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="mode"
              className="radio radio-primary"
              checked={mode === "solo"}
              onChange={() => handleModeChange("solo")}
            />
            <span className="font-bold">Solo</span>
          </label>
        </div>

        {/* Level Name */}
        <div className="flex items-center gap-4">
          <span className="text-lg">Level Name:</span>
          <input
            type="text"
            className="input input-bordered bg-base-100"
            placeholder="Enter level name"
            value={levelName}
            onChange={(e) => setLevelName(e.target.value)}
            maxLength={30}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost btn-square"
            onClick={handleClear}
            title="Clear Level"
          >
            <Trash2 size={24} />
          </button>
          <button
            className={`btn btn-ghost btn-square ${saving ? "loading" : ""}`}
            onClick={handleSave}
            disabled={saving || !isConnected}
            title="Save Level"
          >
            {!saving && <Save size={24} className="text-primary" />}
          </button>
          <button
            className="btn btn-ghost btn-square"
            onClick={handleClose}
            title="Close"
          >
            <X size={24} className="text-error" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex bg-base-300">
        {/* Block Panel */}
        <div className="w-48 bg-base-200 flex flex-col items-center py-4">
          <h2 className="text-lg font-bold mb-4">Select a block:</h2>

          <div className="flex flex-col gap-2">
            {/* Base blocks */}
            {baseBlocks.map((block) => (
              <button
                key={block.id}
                onClick={() => setSelectedBlock(block.id)}
                className={`w-14 h-14 relative hover:scale-110 transition-transform ${
                  selectedBlock === block.id
                    ? "ring-2 ring-primary translate-x-2"
                    : ""
                }`}
                title={block.label}
              >
                <img
                  src={block.src}
                  alt={block.label}
                  className="w-full h-full object-contain"
                />
              </button>
            ))}

            {/* Bot blocks - only show in solo mode (for playing against AI bots) */}
            {mode === "solo" &&
              botBlocks.map((block) => (
                <button
                  key={block.id}
                  onClick={() => setSelectedBlock(block.id)}
                  className={`w-14 h-14 relative hover:scale-110 transition-transform ${
                    selectedBlock === block.id
                      ? "ring-2 ring-primary translate-x-2"
                      : ""
                  }`}
                  title={block.label}
                >
                  <img
                    src={block.body}
                    alt=""
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                  <img
                    src={block.turret}
                    alt=""
                    className="absolute top-1 -left-2 w-full h-2/3 object-contain"
                  />
                </button>
              ))}
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex items-center justify-center bg-base-100">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block cursor-crosshair"
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
      <div className="h-16 bg-base-200" />
    </div>
  );
};
