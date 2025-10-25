# 🚀 How to Run ParkShare Locally

## Quick Start (Copy & Paste These Commands)

```bash
# 1. Make sure you're in the project directory
cd /path/to/calhack25

# 2. Install dependencies (first time only)
npm install

# 3. Start the development server
npm run dev
```

The app will start at: **http://localhost:5000**

---

## What Each Command Does

### `npm install`
- Installs all dependencies from package.json
- **Only run this once** (or after pulling new code that adds dependencies)

### `npm run dev`
- Starts the development server
- Watches for file changes and auto-reloads
- Runs on port 5000
- Press **Ctrl+C** to stop the server

---

## Available Commands

| Command | What It Does |
|---------|-------------|
| `npm run dev` | Start development server (with hot reload) |
| `npm run build` | Build for production |
| `npm run start` | Run production build |
| `npm run check` | Type-check TypeScript |
| `npm run db:push` | Push database schema (when using PostgreSQL) |

---

## After Pulling New Code

```bash
# 1. Pull latest code
git pull

# 2. Install any new dependencies (if package.json changed)
npm install

# 3. Start dev server
npm run dev
```

---

## Troubleshooting

### Port 5000 already in use?
```bash
# Kill whatever is using port 5000
lsof -ti:5000 | xargs kill -9

# Or change the port in .env
PORT=3000
```

### Module not found errors?
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## Development Workflow

1. **Open VS Code** in project folder
2. **Open Terminal** in VS Code (View → Terminal or `` Ctrl+` ``)
3. **Run:** `npm run dev`
4. **Open browser:** http://localhost:5000
5. **Edit code** - changes auto-reload!
6. **Stop server:** Press `Ctrl+C` in terminal

---

## Current Setup

- ✅ **Storage:** In-memory (no database needed!)
- ✅ **Port:** 5000
- ✅ **Hot Reload:** Enabled
- ✅ **TypeScript:** Enabled

**Data will reset when you restart the server** (use database later for persistence)
