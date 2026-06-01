// Fixed virtual dimensions of the game/editor stage. The whole gameplay + editor
// view is rendered at this size and then uniformly scaled to fit the window
// (see useWindowScale in App.tsx). Menu screens (Home/Levels/Rankings) are NOT
// scaled — they are normal responsive pages.
export const CANVAS_WIDTH = 1150;
export const CANVAS_HEIGHT = 800;
