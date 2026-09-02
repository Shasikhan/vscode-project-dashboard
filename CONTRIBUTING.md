# Contributing to Project Dashboard

Thank you for your interest in contributing to **Project Dashboard for VS Code**! We welcome contributions of all kinds: bug fixes, new features, tech stack detection rules, documentation improvements, and UI refinements.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v18.x` or higher
- **npm**: `v9.x` or higher
- **Visual Studio Code**: Latest stable version
- **Git**: Installed and available in PATH

### Setup Local Repository

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/Shasikhan/vscode-project-dashboard.git
   cd vscode-project-dashboard
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Open in VS Code**:
   ```bash
   code .
   ```

---

## 🛠️ Development Workflow

### Running & Debugging the Extension

1. Press **`F5`** (or go to `Run and Debug` in the sidebar and click **Run Extension**).
2. A new **Extension Development Host** window will open with the extension loaded.
3. Test your changes live in that window. You can reload the host window anytime using **`Cmd+R`** (macOS) or **`Ctrl+R`** (Windows/Linux).

### Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run compile` | Compiles TypeScript files and bundles with `esbuild` |
| `npm run watch` | Watches for source changes and automatically rebuilds |
| `npm run typecheck` | Runs TypeScript compiler checks (`tsc --noEmit`) |
| `npm run package` | Builds the production bundle |
| `npm run package-vsix` | Packages the extension into a local `.vsix` installer file |

---

## 📁 Codebase Architecture

```text
vscode-project-dashboard/
├── src/
│   ├── extension.ts           # Extension entry point, commands, status bar
│   ├── models/
│   │   └── project.ts         # TypeScript interfaces & types (Project, Category, GitInfo, etc.)
│   ├── services/
│   │   ├── storageService.ts  # Local state persistence (VS Code globalState)
│   │   ├── gitService.ts      # Non-blocking Git branch & dirty status detection
│   │   └── techStackService.ts# Auto-detection of frameworks & languages
│   └── views/
│       ├── dashboardPanel.ts  # Full-screen Dashboard Webview panel (tab)
│       └── sidebarProvider.ts # Sidebar Webview provider (Activity bar)
├── media/
│   ├── dashboard.js           # Webview frontend logic & event handlers
│   ├── dashboard.css          # Responsive styling & VS Code theme tokens
│   └── dashboard-icon.svg     # Extension vector icons
└── esbuild.js                 # Fast bundler configuration
```

---

## 💡 Adding New Tech Stack Detection Rules

Want to add detection for a new framework, language, or tool?

1. Open [`src/services/techStackService.ts`](src/services/techStackService.ts).
2. Add your rule to `TECH_RULES` with target filenames/extensions and corresponding icon/label:
   ```typescript
   {
     name: 'Svelte',
     files: ['svelte.config.js', 'svelte.config.ts'],
     extensions: ['.svelte'],
     icon: 'svelte',
     color: '#ff3e00'
   }
   ```
3. Run `npm run typecheck` to verify.

---

## 📤 Submitting a Pull Request

1. Create a feature branch:
   ```bash
   git checkout -b feature/my-cool-feature
   ```
2. Make your changes and make sure the code passes type checking:
   ```bash
   npm run typecheck
   ```
3. Commit your changes with clear, descriptive commit messages.
4. Push to your fork and submit a **Pull Request** targeting the `main` branch.
5. Provide a brief explanation of what was changed, added, or fixed in the PR description.

---

## 📜 License

By contributing to Project Dashboard, you agree that your contributions will be licensed under the [MIT License](LICENSE.txt).
