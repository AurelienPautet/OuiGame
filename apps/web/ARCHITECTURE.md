# OUI TANK - React Migration Architecture

## Overview

This document outlines the architecture for migrating OUI TANK from plain HTML/JS to React while keeping the game engine performant using vanilla JavaScript.

**Key Principle:** React handles UI (menus, modals, HUD), while the game loop runs independently via `requestAnimationFrame`.

> [!IMPORTANT] > **The `Public/` folder must remain untouched.** It serves as reference for the original implementation.
> All new React code goes in the `Client/` folder.

> **Note:** The app uses **popover modals** rather than page navigation. All screens overlay the main landing page with the canvas always present in the background.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         REACT LAYER                             │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    App.jsx                                 │ │
│  │  - Always renders LandingPage + Canvas backdrop            │ │
│  │  - Modal state management (which modal is open)            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              │                                  │
│     ┌────────────────────────┼────────────────────────┐        │
│     ▼                        ▼                        ▼        │
│  ┌──────────┐  ┌─────────────────────────┐  ┌──────────┐      │
│  │ Modals   │  │     LandingPage         │  │   HUD    │      │
│  │ (React)  │  │ (always visible behind) │  │ Overlay  │      │
│  ├──────────┤  └─────────────────────────┘  └──────────┘      │
│  │ Auth     │                                                  │
│  │ Rankings │           Canvas (backdrop)                      │
│  │ Lobby    │                │                                 │
│  │ Profile  │                │                                 │
│  │ Editor   │                ▼                                 │
│  └──────────┘  ┌─────────────────────────┐                    │
│                │     GameCanvas.jsx      │                    │
│                │    (useRef bridge)      │                    │
│                └───────────┬─────────────┘                    │
└────────────────────────────┼────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      VANILLA ENGINE                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    GameEngine.js                         │   │
│  │  • requestAnimationFrame loop (60fps)                   │   │
│  │  • Direct socket communication for game state           │   │
│  │  • Renderer, InputHandler, ParticleSystem               │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
Client/
├── src/
│   ├── index.css                    # DaisyUI "ouitank" theme ✅
│   ├── main.jsx                     # Entry point
│   ├── App.jsx                      # Root + modal state
│   │
│   ├── contexts/
│   │   ├── SocketContext.jsx        # Socket.io singleton
│   │   ├── AuthContext.jsx          # Login state
│   │   └── ModalContext.jsx         # Which modal is open
│   │
│   ├── components/
│   │   ├── landing/
│   │   │   ├── LandingPage.jsx      # Main home screen (always visible)
│   │   │   ├── TankVisualizer.jsx   # Tank preview + color picker
│   │   │   └── NameInput.jsx
│   │   │
│   │   ├── modals/                  # All use DaisyUI modal component
│   │   │   ├── AuthModal.jsx        # Login/Register
│   │   │   ├── ProfileModal.jsx
│   │   │   ├── RankingsModal.jsx
│   │   │   ├── RoomSelectorModal.jsx
│   │   │   ├── LevelSelectorModal.jsx
│   │   │   ├── MyLevelsModal.jsx
│   │   │   └── TankSelectModal.jsx
│   │   │
│   │   ├── editor/
│   │   │   └── LevelEditor.jsx      # Full-screen editor view
│   │   │
│   │   ├── game/
│   │   │   ├── GameCanvas.jsx       # useRef bridge to engine
│   │   │   ├── HUDOverlay.jsx       # Scores, player names
│   │   │   ├── PauseScreen.jsx
│   │   │   └── EndScreen.jsx
│   │   │
│   │   └── ui/
│   │       └── Toast.jsx            # Notifications
│   │
│   └── engine/                      # Pure vanilla JS (NO REACT)
│       ├── GameEngine.js            # Main loop + state
│       ├── Renderer.js              # Canvas drawing (from canvaStuff.js)
│       ├── InputHandler.js          # Keyboard/mouse
│       ├── ParticleSystem.js
│       └── SoundManager.js
│
├── public/
│   └── ressources/                  # Copy from Public/ressources
```

---

## Current → New File Mapping

| Current File                 | New Location                          | Notes                           |
| ---------------------------- | ------------------------------------- | ------------------------------- |
| `ui_js/auth.js`              | `modals/AuthModal.jsx`                | React component                 |
| `ui_js/rankings.js`          | `modals/RankingsModal.jsx`            | React + DaisyUI table           |
| `ui_js/room_selector.js`     | `modals/RoomSelectorModal.jsx`        | React component                 |
| `ui_js/level_selector.js`    | `modals/LevelSelectorModal.jsx`       | React component                 |
| `ui_js/my_level_selector.js` | `modals/MyLevelsModal.jsx`            | React component                 |
| `ui_js/profile.js`           | `modals/ProfileModal.jsx`             | React component                 |
| `ui_js/tankselectslider.js`  | `modals/TankSelectModal.jsx`          | React carousel                  |
| `ui_js/home_ui.js`           | `landing/LandingPage.jsx`             | Main layout                     |
| `ui_js/level_editor.js`      | `editor/LevelEditor.jsx`              | Hybrid React + Canvas           |
| `ui_js/toasts.js`            | `ui/Toast.jsx`                        | DaisyUI toast                   |
| `game_js/canvaStuff.js`      | `engine/Renderer.js`                  | Vanilla class                   |
| `game_js/particle_system.js` | `engine/ParticleSystem.js`            | Keep as-is                      |
| `game_js/sounds_system.js`   | `engine/SoundManager.js`              | Keep as-is                      |
| `client.js`                  | Split: `SocketContext` + `GameEngine` |                                 |
| `Shared/class/*`             | Keep in `Shared/`                     | Isomorphic (shared with server) |

---

## Modal Management Pattern

Since the app uses modals instead of pages, use a context for modal state:

```jsx
// contexts/ModalContext.jsx
const ModalContext = createContext();

export const ModalProvider = ({ children }) => {
  const [activeModal, setActiveModal] = useState(null);
  // Possible values: null, 'auth', 'profile', 'rankings',
  //                  'roomSelector', 'levelSelector', 'tankSelect', etc.

  const openModal = (modalName) => setActiveModal(modalName);
  const closeModal = () => setActiveModal(null);

  return (
    <ModalContext.Provider value={{ activeModal, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
};
```

```jsx
// App.jsx
function App() {
  const { activeModal } = useModal();

  return (
    <SocketProvider>
      <ModalProvider>
        {/* Always visible backdrop */}
        <LandingPage />
        <GameCanvas />

        {/* Modals render on top when active */}
        {activeModal === "auth" && <AuthModal />}
        {activeModal === "rankings" && <RankingsModal />}
        {activeModal === "roomSelector" && <RoomSelectorModal />}
        {/* ... etc */}
      </ModalProvider>
    </SocketProvider>
  );
}
```

---

## Data Flow

### UI Events (React → Engine)

```
User clicks "Play Solo"
    → React updates modal state
    → GameCanvas receives prop change
    → GameEngine.startGame() called
```

### Game Events (Engine → React)

```
Player scores a kill
    → GameEngine receives socket 'tick'
    → Calls callback.onScoreUpdate(scores)
    → React HUDOverlay re-renders with new scores
```

### Socket Routing

| Event               | Handler             | Why                             |
| ------------------- | ------------------- | ------------------------------- |
| `tick` (60/sec)     | GameEngine directly | Performance - never touch React |
| `level_change`      | GameEngine          | Updates blocks/collision        |
| `id`, `id-fail`     | React via callback  | Updates UI state                |
| `rankings_response` | React directly      | UI only                         |
| `auth_*`            | React directly      | UI only                         |

---

## Migration Phases

### Phase 1: React Shell (No game changes)

- [ ] Set up React Router-less structure with modal management
- [ ] Create all modal components with DaisyUI styling
- [ ] Implement SocketContext and AuthContext
- [ ] Port landing page UI to React

### Phase 2: Game Engine Wrapper

- [ ] Create GameEngine class wrapping existing canvas code
- [ ] Create Renderer class from canvaStuff.js
- [ ] Create InputHandler class
- [ ] Connect via GameCanvas.jsx useRef bridge

### Phase 3: Socket Integration

- [ ] Split socket handlers: game-critical → Engine, UI → React
- [ ] Add callback system for Engine → React communication
- [ ] Migrate input sending to engine

### Phase 4: HUD & Overlays

- [ ] Create HUDOverlay (HTML, not canvas)
- [ ] Create PauseScreen, EndScreen as React
- [ ] Create Toast notifications with DaisyUI

### Phase 5: Level Editor

- [ ] Create hybrid LevelEditor.jsx
- [ ] Keep editor canvas rendering as vanilla
- [ ] React handles toolbar and block selection UI

---

## Component Responsibility Matrix

| Feature                           | React?          | Vanilla Engine?          |
| --------------------------------- | --------------- | ------------------------ |
| Landing page layout               | ✅              |                          |
| Tank visualizer                   | ✅              |                          |
| All modals (auth, rankings, etc.) | ✅              |                          |
| Level editor UI (toolbar)         | ✅              |                          |
| Level editor canvas               |                 | ✅                       |
| HUD (scores, names)               | ✅ HTML overlay |                          |
| Pause/End screens                 | ✅              |                          |
| Toast notifications               | ✅ DaisyUI      |                          |
| 60fps game rendering              |                 | ✅ requestAnimationFrame |
| Player movement                   |                 | ✅ Direct socket         |
| Bullet/mine physics               |                 | ✅                       |
| Particle effects                  |                 | ✅                       |
| Sound effects                     |                 | ✅                       |
