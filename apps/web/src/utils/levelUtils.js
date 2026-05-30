/**
 * Level utility functions
 * Helpers for parsing level data and extracting bot information
 */

// Bot color mapping (from legacy Room.bot_colors)
const BOT_COLORS = {
  1: "blue",
  2: "green",
  3: "orange",
  4: "red",
};

/**
 * Extract bot counts from level JSON data
 * Cell values > 10 indicate bot spawn points (bot type = value - 10)
 * @param {Array} levelJson - Level data array
 * @returns {Object} Object mapping bot type to count, e.g. { 1: 2, 2: 1, 3: 1, 4: 1 }
 */
export function extractBotCounts(levelJson) {
  if (!levelJson || !Array.isArray(levelJson)) return {};

  const counts = {};
  for (let i = 0; i < levelJson.length; i++) {
    const cellValue = levelJson[i];
    if (cellValue > 10) {
      const botType = cellValue - 10;
      counts[botType] = (counts[botType] || 0) + 1;
    }
  }
  return counts;
}

/**
 * Get color name for a bot type
 * @param {number} botType - Bot type (1-4)
 * @returns {string} Color name
 */
export function getBotColor(botType) {
  return BOT_COLORS[botType] || "blue";
}

/**
 * Convert hex string to data URL for image display
 * Based on legacy HexToJpeg function
 * @param {string} hex - Hex string from server (e.g. "ffd8ffe0...")
 * @returns {string} Data URL string
 */
export function hexToDataUrl(hex) {
  if (!hex || hex.length === 0) {
    return "ressources/image/minia/test.png"; // Fallback
  }

  try {
    // Convert hex string to binary string (matching legacy HexToJpeg)
    const binary = [];
    for (let i = 0; i < hex.length; i += 2) {
      binary.push(String.fromCharCode(parseInt(hex.substr(i, 2), 16)));
    }
    const base64 = btoa(binary.join(""));
    return `data:image/jpeg;base64,${base64}`;
  } catch (e) {
    console.error("Error converting hex to data URL:", e);
    return "ressources/image/minia/test.png";
  }
}
