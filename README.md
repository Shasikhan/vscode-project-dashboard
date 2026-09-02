# Project Dashboard for VS Code

A modern, fast, and intuitive dashboard extension for Visual Studio Code to manage, color-code, categorize, and launch all your developer projects from a single unified hub.

---

## Features

- 📁 **Centralized Project Management**: Name your projects and easily select project folder paths using the native file dialog.
- ⚡ **Quick Switcher Palette (`Cmd+Alt+P` / `Ctrl+Alt+P`)**: Fast, keyboard-first switcher menu with fuzzy search, git branch preview, and direct launch actions.
- 🔍 **Auto-Detected Tech Stack (Zero-Config)**: Automatically detects and displays framework & language badges (React, Next.js, Vue, TypeScript, Rust, Python, Go, PHP, Docker, etc.).
- 🌿 **Git Status Detection**: Live git branch name, working tree dirty/clean status, uncommitted changes counter, and ahead/behind remote sync indicators directly on each project card.
- 🖥️ **Integrated Terminal & Finder Shortcuts**: Open an integrated terminal directly in the project directory or reveal the folder in Finder/File Explorer with one click.
- 🏷️ **Multi-Tagging & Categories**: Create custom categories and add multi-tag chips (e.g. `#Frontend`, `#API`, `#Client-A`) with full cross-filtering and search support.
- 🎨 **Color Coding**: Assign custom or preset accent colors to each project for instant visual identification.
- 🚀 **Quick Launching**: Open any project in the current window or launch it in a new VS Code window with one click.
- 🔍 **Search & Filter**: Real-time searching across project names, paths, descriptions, and category tags.
- ⭐ **Favorites & Pinning**: Pin your most critical projects to keep them pinned at the top.
- 🔄 **Sort & View Modes**: Switch between responsive Grid View and compact List View; sort by recently opened, alphabetical, or creation date.
- 📂 **Sidebar & Status Bar Integration**: Access your dashboard directly from the Activity Bar sidebar or via the status bar button `$(layout-dashboard) Projects`.
- 💾 **Import & Export**: Backup or sync your project list and categories across machines via standard JSON format.
- 🌗 **VS Code Theme Harmony**: Built to look gorgeous in both dark and light VS Code themes.

---

## How to Use

### 1. Launching the Dashboard

- **Command Palette**: Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) and run `Project Dashboard: Open Dashboard`.
- **Status Bar**: Click the `$(layout-dashboard) Projects` button in the status bar (right side).
- **Activity Bar**: Click the Project Dashboard icon in the activity bar sidebar.

### 2. Adding a Project

1. Click **New Project** in the dashboard header or sidebar.
2. Enter the project name and description.
3. Click **Browse** to choose the project folder on your disk.
4. Pick a color accent, custom tags, and select a category.
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

## Extension Settings

Configure these options in VS Code Settings (`Cmd+,` or `Ctrl+,`):

| Setting                                   | Default | Description                                                                          |
| :---------------------------------------- | :------ | :----------------------------------------------------------------------------------- |
| `projectDashboard.openOnStartupWhenEmpty` | `false` | Automatically opens Project Dashboard on launch when no folder or workspace is open. |
| `projectDashboard.showStatusBarItem`      | `true`  | Shows/hides the `$(layout-dashboard) Projects` status bar button on the right side. |

---

## 🤝 Contributing

Contributions are welcome! Please check out [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on local development, adding tech stack rules, and submitting pull requests.

---

## 📜 License

This project is open-source software licensed under the [MIT License](LICENSE.txt).
