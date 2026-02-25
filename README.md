# Bantō

A minimal, responsive kanban board for personal productivity. Perfect for homelab task management, project tracking, or simple todo lists.

![Bantō](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

### Core Functionality
- **Columns** — Create, rename, delete, and drag to reorder columns
- **Items** — Add items with title and notes, mark as complete with checkmark, delete
- **Drag & Drop** — Reorder items within columns or move between columns (desktop & mobile)
- **Inline Editing** — Click any text to edit; press `Enter` to save, `Shift+Enter` for new line
- **Undo & Redo** — Full action history with `‹` / `›` buttons, preserved across sessions
- **Completion Tracking** — Toggle checkmark (✔) to mark items complete with strikethrough styling

### Data & Persistence
- **Local Storage** — All data saved automatically to browser localStorage
- **History Management** — Complete undo/redo stack persisted between sessions
- **Export & Import** — Download board as JSON backup, restore from file across devices or browsers
- **No Backend Required** — 100% client-side, no server dependencies

### Design
- **Minimal & Clean** — Geometric design with Montserrat (logo) and Inter (body) fonts
- **Responsive Layout** — Horizontal scroll on mobile (≤768px) with touch drag support
- **Touch-Optimized** — Long-press drag for columns and items on mobile devices
- **Always-Visible Controls** — Action buttons (complete, delete) visible on touch devices

## How to Use

### Columns
Click **"add column"** on the right side of the board, type a name, and press `Enter` to create it. Click a column title to rename it. Hover over a column title and click **×** to delete it along with all its items.

### Reordering Columns
Drag a column by its title bar to reorder it. All items in the column move with it. A vertical line indicates where the column will be placed.

### Items
Click the **+** button at the bottom of any column to add a new item. Each item has a title and a notes section. Hover over an item and click **×** to delete it. Click **✔** to mark an item as complete.

### Drag & Drop Items
Drag items to reorder them within a column or move them between columns. A horizontal line shows where the item will land.

### Editing
Click on any column title, item title, or item notes to edit the text inline. Press `Enter` to save, or `Shift + Enter` to add a new line.

### Undo & Redo
Use the **‹** and **›** buttons in the top-right corner to undo or redo changes. The full action history is preserved across sessions.

### Export & Import
Use the **↓** button to download your board as a `.json` file. Use the **↑** button to restore a board from a previously exported file. Useful for backups or moving your board between devices or browsers.

## Deployment

### Docker + Caddy (Recommended)

The project includes a Dockerfile and docker-compose setup using Caddy as a lightweight web server.

#### Development
```bash
docker-compose up
```
Access at `http://localhost:8090`

#### Production (K3s/Kubernetes)
```bash
docker build --build-arg CADDYFILE=Caddyfile.prod -t banto:latest .
```

The production Caddyfile is configured for:
- Domain: `banto.erik-schuetze.dev`
- Automatic HTTPS via Caddy's built-in Let's Encrypt integration

### Static Hosting
Deploy the `site/` directory to any static host:
- Netlify, Vercel, GitHub Pages
- Nginx, Apache
- S3 + CloudFront

No build step required — pure HTML/CSS/JS.

## Project Structure

```
banto/
├── site/
│   ├── index.html          # Main HTML structure
│   ├── css/
│   │   └── style.css       # All styles, including mobile responsive
│   └── js/
│       └── app.js          # Vanilla JS logic (history, drag, persistence)
├── Caddyfile.dev           # Local development server config
├── Caddyfile.prod          # Production HTTPS config
├── dockerfile              # Caddy-based container image
└── docker-compose.yaml     # Local dev environment
```

## Technical Details

- **Frontend:** Vanilla HTML, CSS, JavaScript (no frameworks)
- **Fonts:** Google Fonts (Montserrat, Inter)
- **Storage:** Browser localStorage (board state + history)
- **Server:** Caddy (Docker) or any static file server
- **Mobile:** Touch event handlers with long-press detection (200ms)
- **Browser Support:** Modern browsers with ES6+ and localStorage

## Development

### Prerequisites
- Docker & Docker Compose (for containerized dev)
- OR any local web server (Python `http.server`, Node `http-server`, etc.)

### Local Development
```bash
# With Docker Compose
docker-compose up

# OR with Python
cd site && python3 -m http.server 8090

# OR with Node
cd site && npx http-server -p 8090
```

### File Watching
No build step needed. Edit files in `site/` and refresh the browser.

## License

MIT License — see LICENSE file for details.

Fonts:
- **Inter** by Rasmus Andersson (OFL 1.1)
- **Montserrat** by Julieta Ulanovsky (OFL 1.1)

## Author

**Erik Schütze**
- Blog: [erik-schuetze.dev/blog](https://erik-schuetze.dev/blog/)
- GitHub: [@Erik-Schuetze](https://github.com/Erik-Schuetze)

---

Built for homelabs, personal productivity, and anyone who wants a simple kanban without the bloat.

