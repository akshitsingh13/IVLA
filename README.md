# IVLA — Interactive Visual Learning Assistant

An intelligent, multi-page educational whiteboard application built for educators and learners. IVLA seamlessly combines natural drawing tools, multi-board management, local IndexedDB persistence, customizable patterned backgrounds, and multi-page PDF export with multimodal AI visual interpretation, Wikimedia Commons educational diagram discovery, and generative illustration.

---

## Table of Contents

- [Project Overview](#project-overview)
  - [Problem Statement](#problem-statement)
  - [Solution](#solution)
  - [Target Audience](#target-audience)
  - [Key Objectives](#key-objectives)
- [Features](#features)
  - [1. Whiteboard Dashboard & Local Persistence](#1-whiteboard-dashboard--local-persistence)
  - [2. Multi-Page Whiteboard Navigation](#2-multi-page-whiteboard-navigation)
  - [3. Per-Page Whiteboard Backgrounds](#3-per-page-whiteboard-backgrounds)
  - [4. Professional Drawing Tools & Layer Ordering](#4-professional-drawing-tools--layer-ordering)
  - [5. Shapes, Selection & Canvas Manipulation](#5-shapes-selection--canvas-manipulation)
  - [6. Multi-Page Vector PDF Export](#6-multi-page-vector-pdf-export)
  - [7. AI Circle Selection & Region Capture](#7-ai-circle-selection--region-capture)
  - [8. Multimodal Vision Reasoning (NVIDIA Nemotron)](#8-multimodal-vision-reasoning-nvidia-nemotron)
  - [9. Educational Conceptual Explanations](#9-educational-conceptual-explanations)
  - [10. Wikimedia Commons Educational Visual Discovery](#10-wikimedia-commons-educational-visual-discovery)
  - [11. Generative AI Illustrations (FLUX.2 & Pollinations)](#11-generative-ai-illustrations-flux2--pollinations)
  - [12. Resilience, Rate Limiting & Safety](#12-resilience-rate-limiting--safety)
- [Screenshots & User Interface](#screenshots--user-interface)
- [Technology Stack](#technology-stack)
  - [Frontend](#frontend)
  - [Backend](#backend)
  - [Storage & Persistence](#storage--persistence)
  - [External APIs & Services](#external-apis--services)
- [Project Architecture](#project-architecture)
  - [Architecture Flow Diagram](#architecture-flow-diagram)
  - [Component Communication](#component-communication)
- [Directory Structure](#directory-structure)
- [Prerequisites](#prerequisites)
- [Installation and Setup](#installation-and-setup)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Install Dependencies](#2-install-dependencies)
  - [3. Configure Environment Variables](#3-configure-environment-variables)
- [Running the Application](#running-the-application)
  - [Available Scripts](#available-scripts)
  - [Running Both Frontend and Backend](#running-both-frontend-and-backend)
  - [Running Services Independently](#running-services-independently)
  - [Building for Production](#building-for-production)
- [Environment Variables Reference](#environment-variables-reference)
- [API Documentation](#api-documentation)
- [User Guide](#user-guide)
  - [Managing Whiteboards](#managing-whiteboards)
  - [Working with Pages](#working-with-pages)
  - [Choosing Backgrounds](#choosing-backgrounds)
  - [Drawing, Erasing & Highlighting](#drawing-erasing--highlighting)
  - [Exporting to PDF](#exporting-to-pdf)
  - [Using the AI Circle & Visual Discovery](#using-the-ai-circle--visual-discovery)
- [Troubleshooting](#troubleshooting)
- [Future Improvements](#future-improvements)
- [License and Acknowledgements](#license-and-acknowledgements)

---

## Project Overview

### Problem Statement
During classroom instruction, tutoring, and technical presentations, educators frequently sketch diagrams, write formulas, and map out concepts on digital boards. When students encounter conceptual bottlenecks, instructors often face significant friction:
1. They must spend precious lesson minutes hand-drawing intricate anatomical, physical, or algorithmic diagrams.
2. They must leave the presentation to search search engines, sifting through low-quality, copyrighted, or distracting images.
3. Traditional single-page whiteboards quickly run out of room, forcing instructors to wipe previous working steps.
4. Lesson work is lost when the browser tab is closed or needs to be exported into clean handouts.

### Solution
**IVLA (Interactive Visual Learning Assistant)** unifies an educational digital whiteboard with automated visual retrieval and multimodal AI:
- **Educator Dashboard & Persistence**: Create, organize, and revisit lessons stored safely in browser-native IndexedDB.
- **Multi-Page Whiteboards**: Flip seamlessly between pages with live thumbnail strips, reordering, and independent per-page undo/redo histories.
- **Pedagogical Backgrounds**: Switch instantly between Plain White, Cream, Soft Blue, Soft Green, Chalkboard Dark, Math Grid, Ruled Paper with margins, or Dotted Bullet-grids on a per-page basis.
- **Classroom Drawing Suite**: Solid Pen, textured Pencil, and highlighter strokes that utilize `multiply` blend modes and behind-pen layer ordering to keep ink crisp.
- **Multi-Page PDF Export**: One-click vector PDF generation in A4/A3, Landscape/Portrait, with configurable page ranges and faithful background preservation.
- **AI Circle Selection**: Circle any hand-drawn sketch or formula; multimodal reasoning models interpret the concept and fetch verified, high-resolution **Wikimedia Commons** diagrams and pedagogical explanations ready to drop onto the board.

### Target Audience
- **K-12 & University Teachers**: Conducting interactive lectures on smartboards, tablets, or laptops.
- **Online Tutors & Coaches**: Delivering remote lessons with clean visual illustrations and downloadable lesson notes.
- **STEM Students & Self-Learners**: Whiteboarding derivations and study diagrams with immediate verification and visual reference.

### Key Objectives
- **Zero Lesson Interruption**: All discovery, drawing, and page navigation happen on the active canvas surface.
- **Privacy & Local Ownership**: Whiteboard data lives locally on your machine via IndexedDB; no cloud database or user account is required.
- **Responsible Open-Access Licensing**: All visual diagrams imported from Wikimedia Commons preserve their author attribution and Creative Commons licenses.
- **Graceful Offline Capability**: Whiteboard sketching, backgrounds, pages, local storage, PDF export, and Wikimedia discovery function without requiring paid AI API keys.

---

## Features

### 1. Whiteboard Dashboard & Local Persistence
- **Educator Dashboard**: Manage all your lesson whiteboards from a clean overview interface.
- **Whiteboard Actions**: Create new whiteboards, open existing sessions, inline-rename titles, and delete boards with safety confirmations.
- **Metadata & Previews**: Live preview thumbnails and relative timestamps ("Just now", "15m ago", "Yesterday").
- **Local IndexedDB Persistence**: Built on a native, zero-dependency IndexedDB storage engine (`ivla_db` with `whiteboards` store). Entire whiteboard states—including all pages, strokes, shapes, and backgrounds—persist across page refreshes and browser restarts.
- **Debounced Autosave**: Changes are batched and autosaved with an 800ms debounce following drawing commits. Autosave never fires during in-progress pointer movements, ensuring consistent 60 FPS drawing. Unsaved changes are automatically flushed when returning to the dashboard.

### 2. Multi-Page Whiteboard Navigation
- **Page Manager Dock**: Top-center pill control displaying `< Prev`, `Page X of Y`, `Next >`, and `+ New Page`.
- **Live Miniature Thumbnails**: Expandable visual drawer featuring real-time mini-canvas previews of every page's exact drawing contents and background.
- **Full Page Management**: Add blank pages, duplicate existing pages (deep-cloning all elements with unique identifiers), delete pages (safeguarded to ensure at least one page remains), and reorder pages up or down.
- **Strictly Isolated Undo / Redo**: Each page maintains its own independent 100-step history stack. Undoing or redoing actions on Page 2 will never modify, overwrite, or corrupt Page 1.

### 3. Per-Page Whiteboard Backgrounds
- **8 Tailored Styles**:
  - `White`: Clean, crisp default canvas.
  - `Cream`: Warm paper tone reducing eye fatigue during long lectures (`#fefcf3`).
  - `Light Blue`: Calm pastel blue backdrop (`#f0f7ff`).
  - `Light Green`: Soft chalkboard green tint (`#f0fdf4`).
  - `Dark`: Modern slate dark mode (`#1e293b`).
  - `Grid`: 32px math and coordinate engineering grid.
  - `Ruled`: 36px ruled notebook lines with a left-hand red margin line at 72px.
  - `Dotted`: 30px bullet-journal dot grid for geometry and freehand diagrams.
- **Independent Configuration**: Backgrounds are assigned per-page. Page 1 can be a coordinate grid, Page 2 ruled notebook paper, and Page 3 dark mode.
- **Seamless System Integration**: Selected backgrounds render accurately beneath drawings, appear inside live page thumbnails, are included in AI Circle region captures, and are preserved during PDF export.

### 4. Professional Drawing Tools & Layer Ordering
- **Solid Pen**: Quadratic midpoint curve smoothing with stylus pressure sensitivity for smooth, natural handwriting.
- **Textured Pencil**: Graphite opacity (~82%) with fine line profile for technical sketching and preliminary work.
- **Pedagogical Highlighter**: Semi-transparent strokes with `multiply` composite blending and round/chisel caps.
  - **Behind-Pen Layer Ordering**: Highlighter strokes render beneath solid pen ink and shapes, ensuring handwriting and text remain completely legible under highlighted areas.
  - **Highlighter Color Palette**: Vibrant neon swatches (Yellow `#facc15`, Green `#4ade80`, Cyan `#38bdf8`, Pink `#f472b6`, Orange `#fb923c`) and expanded thickness options (8px–48px).
- **Per-Tool Memory**: Stroke widths and colors are remembered independently per tool when toggling between Pen, Pencil, and Highlighter.

### 5. Shapes, Selection & Canvas Manipulation
- **Geometric Shapes**: Draw high-precision Rectangles, Ellipses, Straight Lines, and Directional Arrows.
- **Select & Transform Tool**: Bounding-box hit detection allows selecting any stroke, shape, text box, or inserted image to reposition or delete.
- **Targeted Eraser**: Distance-threshold hit testing erases intersected strokes and shapes. Each continuous eraser stroke compiles into a single undo step.
- **Rich Text & Image Elements**: Text boxes with multi-line layout and rescaled images can be positioned anywhere on the board.

### 6. Multi-Page Vector PDF Export
- **Client-Side Generation**: Uses `jspdf` to generate clean, high-resolution PDFs directly in the browser with zero backend dependency.
- **Configurable Page Scope**:
  - `All Pages`: Exports the entire multi-page whiteboard in sequence.
  - `Current Page`: Exports only the currently viewed page.
  - `Custom Range`: Supports syntax like `1-2, 4` to export select pages.
- **Paper Formats & Orientations**:
  - Formats: Standard A4 (`210 × 297 mm`) and Large A3 (`297 × 420 mm`).
  - Orientations: Landscape (recommended for whiteboards) and Portrait.
- **Visual Fidelity**: Faithful high-resolution rendering that preserves page backgrounds (colors, grids, ruled lines), drawings, shapes, images, and text with page-number footers.
- **Export Modal**: Accessible dialog featuring document title input, page count indicators, a progress track, and an animated spinner during multi-page compilation.

### 7. AI Circle Selection & Region Capture
- **Intuitive Freehand Lasso**: Circle any equation, diagram, or handwriting with animated marching-ants feedback.
- **Noise Masking**: Clamps region boundaries and clips surrounding board content to focus multimodal reasoning models strictly on the circled subject.
- **Background-Aware Capture**: Detects content against non-white or patterned backgrounds, preventing false "empty circle" rejections.

### 8. Multimodal Vision Reasoning (NVIDIA Nemotron)
- **Model**: `nvidia/nemotron-3.5-super-vl-120b-a12b`.
- **Reasoning Capabilities**: Accurately transcribes messy handwriting, chemical formulas, physics free-body diagrams, and math equations.
- **Structured Extraction**: Returns normalized JSON identifying the core concept, key search terms, grade suitability, and visual structure.

### 9. Educational Conceptual Explanations
- **Adaptive Grade Levels**: Configurable target audience (`auto`, `primary`, `middle`, `high`, `college`), persisted across sessions.
- **Pedagogical Structure**: Formulates concise concept definitions, real-world examples, and comprehension check questions.
- **One-Click Insert**: "Add to board" places the generated explanation directly on the active canvas as an editable, selectable text block.

### 10. Wikimedia Commons Educational Visual Discovery
- **Free, Public Knowledge Engine**: Communicates directly with the MediaWiki Action API without requiring API keys or user accounts.
- **Pedagogical Query Builder**: Synthesizes specific search queries targeting educational diagrams, schematics, and cross-sections.
- **Intelligent SVG/PNG Ranking**: Prioritizes high-resolution vector graphics and labeled illustrations over photos, coins, or statues.
- **Attribution & Licensing**: Displays author credits and license tags (`CC BY-SA 4.0`, `CC0`, `Public Domain`).
- **Board Insertion**: Inserts chosen Commons diagrams into the active page, scaling them appropriately alongside your drawings.

### 11. Generative AI Illustrations (FLUX.2 & Pollinations)
- **Creative Fallback**: Generates custom illustrations when rare or abstract concepts lack existing Wikimedia diagrams.
- **Dual-Provider Architecture**: Directs requests to NVIDIA FLUX.2 Klein 4B (`black-forest-labs/flux.2-klein-4b`) and automatically falls back to Pollinations AI if quotas are exceeded or credentials are absent.

### 12. Resilience, Rate Limiting & Safety
- **3-Request Concurrency Semaphore**: Prevents hammering external APIs during rapid interactions.
- **In-Flight Deduplication & LRU Cache**: Avoids duplicate outbound requests for identical circled regions.
- **Strict Outbound Budget**: Caps automatic retries to 4 calls per interaction to prevent runaway credit usage.
- **Session API Meter**: Tracks usage stats accessible via `/api/usage`.

---

## Screenshots & User Interface

```
+---------------------------------------------------------------------------------------+
|  IVLA                               [ < ] [ Page 1 of 3 (click to view) ] [ > ] [+ New]  |
|  [<- Dashboard]  Biology Lesson 1 [Edit]  (Saved)                                     |
+---------------------------------------------------------------------------------------+
|                                                                                       |
|      (Page 1: Ruled Paper)                 (Page 2: Math Grid)                        |
|   +-----------------------+             +-----------------------+                     |
|   |                       |             |       /\              |                     |
|   |  - Mitosis steps      |             |      /  \             |                     |
|   |  - Prophase diagram   |             |     /____\            |                     |
|   |                       |             |                       |                     |
|   +-----------------------+             +-----------------------+                     |
|                                                                                       |
+---------------------------------------------------------------------------------------+
|   [Select] [Pen] [Pencil] [Highlight] [Eraser] [Shape] [AI Circle] [Other] [Backdrop] [PDF] |
+---------------------------------------------------------------------------------------+
```

| Component | Location | Description |
| :--- | :--- | :--- |
| **Dashboard** | Full View | Lists all saved whiteboards with thumbnails, timestamps, search, and delete options. |
| **Top Navigation** | Top-Left | "Dashboard" return button, board title rename, and auto-save status indicator. |
| **Page Manager** | Top-Center | Navigation pill (`<`, `>`, `New Page`) and expandable page drawer with live previews. |
| **Canvas** | Center View | Infinite-feel 2D canvas with DPR scaling, background rendering, and drawing layers. |
| **Floating Toolbar** | Bottom-Center | Accessible pill dock housing Pen, Pencil, Highlighter, Shapes, AI Circle, Backdrop, and PDF Export. |
| **Capture Card** | Contextual | Dialog presenting multimodal interpretation, Wikimedia Commons diagrams, and explanations. |
| **PDF Modal** | Modal Overlay | Configure document title, page scope (All/Current/Range), format (A4/A3), and orientation. |

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
| :--- | :--- | :--- |
| **React** | `^18.3.1` | User interface, reactive state management, and component architecture. |
| **Vite** | `^5.4.11` | Build tooling, Hot Module Replacement (HMR), and API reverse proxy. |
| **HTML5 Canvas 2D** | Native DOM | 60 FPS drawing pipeline, quadratic curve smoothing, and composite masking. |
| **Pointer Events API** | Native DOM | Unified handling of stylus pressure sensitivity, touch, and mouse input. |
| **jsPDF** | `^4.2.1` | Client-side vector PDF document generation with multi-page support. |
| **Lucide React** | `^0.469.0` | Accessible vector icons for toolbar, dashboard, and modals. |

### Backend
| Technology | Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `>= 18.0.0` (Tested on `v24.16.0`) | Backend JavaScript runtime. |
| **Express** | `^4.21.2` | REST API routing and middleware management. |
| **CORS** | `^2.8.5` | Cross-Origin Resource Sharing middleware. |
| **express-rate-limit** | `^8.7.0` | IP-based request throttling on AI endpoints. |
| **dotenv** | `^18.0.1` | Environment variable loader from `server/.env`. |

### Storage & Persistence
| System | Technology | Scope |
| :--- | :--- | :--- |
| **Whiteboard Storage** | Native **IndexedDB** (`ivla_db`) | Full lesson storage: multi-page arrays, elements, backgrounds, and thumbnails. |
| **Lightweight Preferences** | `localStorage` | Active board ID, grade-level preference (`ivla-grade`). |
| **Server Cache** | In-Memory LRU (50 items) | In-process SHA-256 request deduplication and response caching. |

### External APIs & Services
| Service | Role | Authentication |
| :--- | :--- | :--- |
| **Wikimedia Commons API** | Search and retrieval of educational diagrams and schematics. | **None** (Free MediaWiki Action API). |
| **NVIDIA Cloud Functions / NIM** | Multimodal vision analysis (`nemotron-3.5-super-vl`) and FLUX.2 illustrations. | Bearer API Key (`NVIDIA_API_KEY`). |
| **Pollinations AI** | High-availability fallback image generator. | **None** (Free public GET API). |

---

## Project Architecture

### Architecture Flow Diagram

```mermaid
flowchart TD
    User([Teacher / Student]) -->|Interacts with UI| App[App.jsx - State Orchestrator]

    subgraph Client ["Client Application (Vite + React :5173)"]
        App --> Dashboard[Dashboard.jsx - Board Manager]
        App --> PageMgr[PageManager.jsx - Multi-Page Strip]
        App --> Canvas[WhiteboardCanvas.jsx - 2D Canvas]
        App --> ToolDock[Toolbar.jsx - Tools & Backgrounds]
        App --> ExportModal[ExportPdfModal.jsx - PDF Generator]

        Dashboard <-->|Read / Write Boards| IDB[(IndexedDB - ivla_db)]
        App -.->|Debounced Autosave (800ms)| IDB

        Canvas -->|Render Background| BgEngine[backgrounds.js]
        Canvas -->|Render Elements| Renderer[renderer.js]
        Canvas -->|Circle Content| LassoEngine[lasso.js]
        
        ExportModal -->|Offscreen Render with Bg| PDFEngine[pdfExport.js - jsPDF]
        
        LassoEngine -->|PNG Crop + Mask| Preview[CapturePreview.jsx]
        Preview -->|API Calls| ClientAPI[ivlaApi.js]
    end

    ClientAPI -->|Proxy /api/*| ExpressServer[Express Server :3001]

    subgraph Server ["Server Application (Node.js + Express)"]
        ExpressServer --> RateLimiter[Rate Limiter & In-Flight Dedup]
        RateLimiter --> TaskRouter{Endpoint Router}

        TaskRouter -->|/api/discover-*| TaskDiscover[discoverVisuals.js]
        TaskRouter -->|/api/interpret| TaskInterp[interpret.js]
        TaskRouter -->|/api/explain| TaskExplain[explain.js]
        TaskRouter -->|/api/image-*| TaskImage[generateImage.js]

        TaskDiscover --> WikiClient[wikimedia.js - Semaphore]
        TaskInterp --> NvidiaChat[nvidiaChat.js - Nemotron Vision]
        TaskExplain --> NvidiaChat
        TaskImage --> NvidiaImg[nvidiaImage.js - FLUX.2]
        NvidiaImg -.->|Fallback on error| Pollinations[pollinations.js]
    end

    subgraph External ["External Services"]
        WikiClient <-->|MediaWiki API| Wikimedia[(Wikimedia Commons)]
        NvidiaChat <-->|OpenAI-Compatible Payload| NVNIM[(NVIDIA NIM)]
        NvidiaImg <-->|Inference| NVFLUX[(NVIDIA FLUX)]
        Pollinations <-->|HTTP GET| PollProvider[(Pollinations AI)]
    end

    WikiClient -->|Ranked Diagrams| Preview
    TaskExplain -->|Markdown Explanation| Preview
```

### Component Communication
1. **Client to Server**: Frontend requests to `/api/*` are reverse-proxied by Vite (`vite.config.js`) to `http://localhost:3001`.
2. **Local Persistence**: All boards and pages are saved to the browser's native IndexedDB without any round-trip to an external database.
3. **Backend to Wikimedia**: The backend queries `commons.wikimedia.org/w/api.php` via a 3-request concurrency semaphore with User-Agent identification.
4. **Backend to NVIDIA NIM**: Vision crops are transmitted as base64 data URLs to `https://integrate.api.nvidia.com/v1/chat/completions`.

---

## Directory Structure

```
IVLA/
├── .env.example                     # Environment template for server configuration
├── package.json                     # Root scripts (npm run dev, build, install:all)
├── README.md                        # Project documentation
│
├── client/                          # Frontend React + Vite application
│   ├── index.html                   # HTML entry point with system fonts
│   ├── package.json                 # Frontend dependencies (React, jsPDF, Lucide)
│   ├── package-lock.json            # Locked client dependency tree
│   ├── vite.config.js               # Vite config with backend API proxy (/api -> :3001)
│   └── src/
│       ├── main.jsx                 # React root rendering
│       ├── App.jsx                  # Main application state, routing & autosave orchestrator
│       ├── App.css                  # UI styling, animations, responsive docks, and modals
│       ├── api/
│       │   └── ivlaApi.js           # Client API wrappers with error normalization
│       ├── board/
│       │   ├── elements.js          # Typed element factory, bounding boxes, text layout
│       │   ├── renderer.js          # Canvas 2D render pipeline, stroke smoothing & image cache
│       │   ├── backgrounds.js       # Background definitions (solid & patterns) & canvas renderers
│       │   ├── lasso.js             # Lasso polygon point capture & background-aware crop mask
│       │   ├── hitTest.js           # Hit testing for selection and targeted eraser
│       │   └── history.js           # 100-step isolated undo/redo history stack
│       ├── storage/
│       │   └── db.js                # Native IndexedDB wrapper (ivla_db) & thumbnail generator
│       ├── export/
│       │   └── pdfExport.js         # Multi-page jsPDF export pipeline & aspect ratio calculator
│       └── components/
│           ├── Dashboard.jsx        # Whiteboard management dashboard with previews and search
│           ├── PageManager.jsx      # Top page navigation dock & thumbnail drawer
│           ├── WhiteboardCanvas.jsx # Interactive canvas component with pointer handlers
│           ├── Toolbar.jsx          # Bottom floating tool dock, swatches, and backdrop picker
│           ├── ExportPdfModal.jsx   # PDF export dialog (page scope, formats, orientation)
│           ├── CapturePreview.jsx   # Contextual dialog card for AI actions
│           └── VisualDiscoveryPanel.jsx # Wikimedia Commons image results grid with insert buttons
│
└── server/                          # Backend Express application
    ├── index.js                     # Express server entry point & middleware initialization
    ├── package.json                 # Backend dependencies (Express, CORS, rate-limit, dotenv)
    ├── .env                         # Server environment variables (local only, not committed)
    ├── .env.example                 # Environment template
    ├── config/
    │   └── models.js                # AI model IDs & external endpoint URLs
    ├── prompts/
    │   ├── interpret.js             # Vision prompt for handwriting & diagram recognition
    │   ├── explain.js               # Pedagogical explanation prompt by grade level
    │   └── imagePrompt.js           # Visual description prompt generator
    ├── tasks/
    │   ├── interpret.js             # Vision interpretation execution
    │   ├── explain.js               # Explanation formulation task
    │   ├── buildWikimediaQuery.js   # Targeted educational query generator
    │   ├── discoverVisuals.js       # MediaWiki search and ranking coordinator
    │   ├── buildImagePrompt.js      # Prompt synthesizer for diffusion models
    │   └── generateImage.js         # FLUX.2 dispatcher with Pollinations fallback
    ├── providers/
    │   ├── wikimedia.js             # MediaWiki client, semaphore & SVG/PNG ranking heuristics
    │   ├── nvidiaChat.js            # NVIDIA OpenAI-compatible vision/text client
    │   ├── nvidiaImage.js           # NVIDIA FLUX image generation provider
    │   ├── pollinations.js          # Fallback image generation provider
    │   ├── withRetry.js             # Exponential backoff retry handler
    │   └── AiError.js               # Typed application error abstractions
    ├── lib/
    │   ├── cache.js                 # In-memory SHA-256 LRU cache (50 entries)
    │   ├── rateLimit.js             # IP-based request rate limiter
    │   ├── budget.js                # Per-click outbound call budget enforcer
    │   ├── usage.js                 # In-memory session API call counter
    │   └── validate.js              # Request payload validators
    └── scripts/                     # Probe validation & diagnostic scripts
        ├── probe-wikimedia-eval.js  # Live probe test for Wikimedia visual discovery
        ├── probe-parse-tolerant.js  # Unit probe test for tolerant JSON parsing
        └── probe-models.js          # NVIDIA model connectivity validator
```

---

## Prerequisites

- **Node.js**: `v18.0.0` or higher (verified on Node `v24.16.0`).
- **npm**: `v9.0.0` or higher (verified on npm `11.13.0`).
- **Modern Web Browser**: Chrome, Edge, Firefox, or Safari supporting HTML5 Canvas 2D, Pointer Events, and IndexedDB.
- **NVIDIA Developer API Key (Optional)**: Required only for multimodal vision interpretation and NVIDIA explanations/illustrations. Whiteboards, backgrounds, multi-page, local storage, PDF export, and Wikimedia visual search operate without an API key.

---

## Installation and Setup

### 1. Clone Repository
```bash
git clone https://github.com/akshitsingh13/IVLA.git
cd IVLA
```

### 2. Install Dependencies
Install root, client, and server dependencies in a single step using the root orchestrator:
```bash
npm run install:all
```
*(Alternatively, install manually in each folder: `npm install && npm install --prefix client && npm install --prefix server`)*.

### 3. Configure Environment Variables
Copy the environment template into `server/.env`:
```bash
cp .env.example server/.env
```
Open `server/.env` in your editor and configure your settings:
```env
PORT=3001
NVIDIA_API_KEY=nvapi-your-key-here
```
> [!NOTE]
> If you do not have an NVIDIA API key, leave `NVIDIA_API_KEY` empty. All whiteboard drawing, multi-page features, IndexedDB persistence, PDF export, and Wikimedia Commons searches will function normally.

---

## Running the Application

### Available Scripts

Inspect the exact scripts defined in the root and subpackages:

| Directory | Script Command | Description |
| :--- | :--- | :--- |
| **Root** | `npm start` | Concurrently launches backend Express (`:3001`) and frontend Vite (`:5173`). |
| **Root** | `npm run dev` | Alias for `npm start` (runs both servers concurrently). |
| **Root** | `npm run build` | Builds the client application for production (`client/dist`). |
| **Root** | `npm run install:all` | Installs dependencies across root, client, and server. |
| **Client** | `npm run dev --prefix client` | Runs Vite frontend development server on port `5173`. |
| **Client** | `npm run build --prefix client` | Compiles frontend production assets into `client/dist`. |
| **Client** | `npm run preview --prefix client` | Serves the production build locally for verification. |
| **Server** | `npm run dev --prefix server` | Runs the Express backend server on port `3001`. |
| **Server** | `npm run start --prefix server` | Starts the Express backend server (`node index.js`). |

### Running Both Frontend and Backend
From the repository root:
```bash
npm start
```
Open your browser to **`http://localhost:5173`**.

### Running Services Independently
In terminal 1 (Backend):
```bash
cd server
npm run dev
```
In terminal 2 (Frontend):
```bash
cd client
npm run dev
```

### Building for Production
To build the frontend client:
```bash
npm run build
```
Compiled production assets will be output to [`client/dist/`](file:///home/akshit/Documents/IVLA/client/dist).

---

## Environment Variables Reference

| Variable | Scope | Required? | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | `server/.env` | Optional | `3001` | Local port on which the Express server listens. |
| `NVIDIA_API_KEY` | `server/.env` | Optional | `""` | Bearer key for NVIDIA NIM (`nemotron-3.5-super-vl` and FLUX.2). |

---

## API Documentation

All server endpoints are exposed under `/api` and throttled by `express-rate-limit`:

| Method | Endpoint | Request Payload | Response / Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | None | `{ status: "ok", time, aiKeyConfigured: boolean }` |
| `GET` | `/api/usage` | None | `{ calls: number, sessionStarted: ISOString }` |
| `POST` | `/api/interpret` | `{ image: string (base64) }` | Vision interpretation of circled handwriting/diagrams into structured JSON concepts. |
| `POST` | `/api/explain` | `{ concept, text, gradeLevel }` | Formulates structured pedagogical explanation, real-world application, and quiz check. |
| `POST` | `/api/discover-from-image` | `{ image: string (base64) }` | Interprets drawing and searches Wikimedia Commons for ranked diagrams. |
| `POST` | `/api/discover-from-text` | `{ text: string, subject? }` | Searches Wikimedia Commons directly for diagrams matching text queries. |
| `POST` | `/api/image-from-image` | `{ image: string (base64) }` | Synthesizes custom illustration with FLUX.2 (Pollinations fallback). |
| `POST` | `/api/image-from-text` | `{ text: string }` | Generates illustration directly from a text description. |

---

## User Guide

### Managing Whiteboards
1. **Dashboard Overview**: Launching IVLA presents the **Dashboard** displaying all saved whiteboards with live thumbnail previews and relative modification dates.
2. **Create a Board**: Click **"New Whiteboard"** to create a blank multi-page lesson.
3. **Rename**: Click the pencil icon or title on any card (or the top header badge inside a board) to rename it.
4. **Delete**: Click the trash icon on a board card to permanently delete it after confirmation.
5. **Autosave**: Every stroke, shape, background, and page change is saved automatically to your browser's IndexedDB.

### Working with Pages
1. **Navigate**: Use `<` and `>` in the top-center pill dock to step through lesson pages.
2. **Open Drawer**: Click **"Page X of Y"** to open the live thumbnail drawer.
3. **Reorder**: Click the Up and Down arrows on any page card in the drawer to reorder pages.
4. **Duplicate**: Click the Copy icon to clone a page, including all its drawings and background.
5. **Delete**: Click the Trash icon on a page card to remove it (disabled if only one page remains).
6. **Isolated Undo**: Undo (`Ctrl+Z`) and Redo (`Ctrl+Y`) affect only the active page.

### Choosing Backgrounds
1. Click the **"Backdrop"** icon (palette symbol) in the floating bottom toolbar.
2. Select any background:
   - **Solid**: White, Cream, Soft Blue, Soft Green, or Dark.
   - **Patterns**: Math Grid, Ruled Paper (with margin line), or Dotted Grid.
3. The background updates for the **current page only** and is saved with that page.

### Drawing, Erasing & Highlighting
1. **Pen**: Solid ink with stylus pressure sensitivity.
2. **Pencil**: Graphite-textured stroke with ~82% opacity.
3. **Highlighter**: Translucent stroke with multiply blend mode. Highlighting over ink or diagrams keeps the lines sharp and clear beneath the color.
4. **Tools Memory**: Adjusting width or color swatches updates and remembers settings for that specific tool.
5. **Eraser**: Click or drag over any element to erase it. The entire stroke is undone in a single `Ctrl+Z` step.
6. **Shapes**: Select Rect, Ellipse, Line, or Arrow to draw clean geometric figures.

### Exporting to PDF
1. Click the **"PDF"** button in the floating bottom dock.
2. Select **Pages to Export**:
   - `All Pages`: Compiles the full lesson notebook.
   - `Current Page`: Exports only the active page.
   - `Custom Range`: Specify pages (e.g. `1, 3-5`).
3. Select **Page Size** (`A4` or `A3`) and **Orientation** (`Landscape` or `Portrait`).
4. Click **"Download PDF"**. The generator creates a vector PDF that includes each page's specific background pattern and drawing elements.

### Using the AI Circle & Visual Discovery
1. Click **"AI Circle"** in the toolbar.
2. Draw a loop around any sketch, equation, or handwritten phrase.
3. In the dialog card that appears beside your circle:
   - Click **"Find visual"**: Fetches high-resolution educational diagrams from Wikimedia Commons. Click **"Insert"** on any diagram to place it directly onto the board.
   - Click **"Explain"**: Formulates a pedagogical explanation adapted to your selected grade level. Click **"Add to board"** to insert the explanation as a selectable text block.

---

## Troubleshooting

### Port Conflicts
- **Symptom**: `Error: listen EADDRINUSE: address already in use :::3001`.
- **Solution**: Set `PORT=3002` in `server/.env`. Vite will automatically route requests to the new port.

### Missing or Invalid NVIDIA API Key
- **Symptom**: `API error: NVIDIA_API_KEY is not configured on the server`.
- **Solution**: You can continue using drawing tools, backgrounds, pages, local storage, PDF export, and Wikimedia Commons search without an API key. For AI vision interpretation, obtain a free developer key at [build.nvidia.com](https://build.nvidia.com) and add it to `server/.env`.

### Canvas Drawing / Touch Latency
- **Solution**: IVLA uses standard HTML5 2D Canvas with pointer capture and coalesced events (`getCoalescedEvents`) to eliminate lag and jagged curves. Ensure hardware acceleration is enabled in your browser settings.

### IndexedDB Storage Warnings / Private Browsing
- **Symptom**: Boards do not persist after closing browser.
- **Solution**: Private / Incognito browsing modes isolate or clear IndexedDB when windows close. Use standard browsing mode for persistent whiteboard storage.

### PDF Export Generation Timeout on Large Boards
- **Solution**: When exporting dozens of high-density pages simultaneously, keep the tab active. A progress bar will track each page as it renders offscreen.

---

## Future Improvements

- [ ] **Real-Time Collaboration**: Multi-user drawing and cursor presence via WebSocket rooms.
- [ ] **Canvas Zoom & Infinite Pan**: Viewport transformation matrix for boundless mind-mapping.
- [ ] **Audio Voice Notes**: Attach voice explanations to whiteboard pages.
- [ ] **Cloud Drive Export**: Direct sync with Google Drive, OneDrive, or Google Classroom.

---

## License and Acknowledgements

- **License**: MIT License. Open source and free for educational and commercial use.
- **Wikimedia Commons**: Educational visual media retrieved via the [MediaWiki Action API](https://commons.wikimedia.org/w/api.php) under Creative Commons licenses (`CC BY-SA`, `CC0`, `Public Domain`).
- **NVIDIA AI**: Multimodal reasoning powered by NVIDIA NIM foundation models.
- **Icons**: [Lucide Icons](https://lucide.dev/).
