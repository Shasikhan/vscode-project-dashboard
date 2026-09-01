# Project Dashboard for VS Code

A modern, fast, and intuitive dashboard extension for Visual Studio Code to manage, color-code, categorize, and launch all your developer projects from a single unified hub.

![Project Dashboard Icon](media/dashboard-icon.svg)

## Features

- 📁 **Centralized Project Management**: Name your projects and easily select project folder paths using the native file dialog.
- 🌿 **Git Status Detection**: Live git branch name, working tree dirty/clean status, uncommitted changes counter, and ahead/behind remote sync indicators directly on each project card.
- 🎨 **Color Coding**: Assign custom or preset accent colors to each project for instant visual identification.
- 🏷️ **Custom Categories**: Create, edit, and organize projects into categories (e.g. *Work*, *Personal*, *Open Source*, *Client Work*) with custom category badges.
- 🚀 **Quick Launching**: Open any project in the current window or launch it in a new VS Code window with one click.
- 🔍 **Search & Filter**: Real-time searching across project names, paths, descriptions, and category tags.
- ⭐ **Favorites & Pinning**: Pin your most critical projects to keep them pinned at the top.
- 🔄 **Sort & View Modes**: Switch between responsive Grid View and compact List View; sort by recently opened, alphabetical, or creation date.
- 📂 **Sidebar & Status Bar Integration**: Access your dashboard directly from the Activity Bar sidebar or via the status bar button `$(dashboard) Projects`.
- 💾 **Import & Export**: Backup or sync your project list and categories across machines via standard JSON format.
- 🌗 **VS Code Theme Harmony**: Built to look gorgeous in both dark and light VS Code themes.

---

## How to Use

### 1. Launching the Dashboard
- **Command Palette**: Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) and run `Project Dashboard: Open Dashboard`.
- **Status Bar**: Click the `$(dashboard) Projects` button in the bottom left status bar.
- **Activity Bar**: Click the Project Dashboard icon in the activity bar sidebar.

### 2. Adding a Project
1. Click **New Project** in the dashboard header or sidebar.
2. Enter the project name and description.
3. Click **Browse** to choose the project folder on your disk.
4. Pick a color accent and select a category.
5. Click **Save Project**.

> **Tip**: If you currently have a project folder open in VS Code, run `Project Dashboard: Add Current Folder as Project` to quickly add it with one step!

### 3. Managing Categories
1. Click **Categories** in the dashboard header.
2. Add new category names with custom colors.
3. Edit or delete existing categories as your workflow evolves.

### 4. Backing Up & Syncing
- Click **Export** to save a `.json` backup file of all your projects and categories.
- Click **Import** to load a previously saved `.json` file on any computer.

---

## Development & Debugging

1. Open this repository in VS Code:
   ```bash
   npm install
   npm run compile
   ```
2. Press `F5` to start a new VS Code Extension Development Host window.
3. In the new window, click the `Projects` status bar item or run `Project Dashboard: Open Dashboard`.
