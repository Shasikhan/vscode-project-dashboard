import * as vscode from 'vscode';
import * as path from 'path';
import { StorageService } from '../services/storageService';
import { WebviewToHostMessage, Project, Category } from '../models/project';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private readonly _storageService: StorageService;

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel._panel.reveal(column);
      DashboardPanel.currentPanel._sendData();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'projectDashboard',
      'Project Dashboard',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media')
        ]
      }
    );

    DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri);
  }

  public static kill() {
    DashboardPanel.currentPanel?.dispose();
    DashboardPanel.currentPanel = undefined;
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._storageService = StorageService.getInstance();

    this._panel.iconPath = {
      light: vscode.Uri.joinPath(this._extensionUri, 'media', 'dashboard-icon.svg'),
      dark: vscode.Uri.joinPath(this._extensionUri, 'media', 'dashboard-icon.svg')
    };

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Listen to storage changes and push updates to webview
    this._disposables.push(
      this._storageService.onDidChangeData(data => {
        this._panel.webview.postMessage({
          command: 'setData',
          data
        });
      })
    );

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message: WebviewToHostMessage) => {
        await this._handleMessage(message);
      },
      null,
      this._disposables
    );
  }

  public dispose() {
    DashboardPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private async _sendData() {
    // 1. Send cached/base data immediately so UI renders in <2ms
    const immediateData = this._storageService.getData();
    this._panel.webview.postMessage({
      command: 'setData',
      data: immediateData
    });

    // 2. Enrich with Git status and Tech Stack detection in background
    this._storageService.getDataAsync().then(enrichedData => {
      this._panel.webview.postMessage({
        command: 'setData',
        data: enrichedData
      });
    }).catch(err => {
      console.error('Failed to enrich projects async:', err);
    });
  }

  private async _handleMessage(message: WebviewToHostMessage) {
    switch (message.command) {
      case 'getInitialData':
      case 'refreshGitStatus': {
        await this._sendData();
        break;
      }

      case 'pickFolder': {
        const options: vscode.OpenDialogOptions = {
          canSelectMany: false,
          canSelectFiles: false,
          canSelectFolders: true,
          openLabel: 'Select Project Folder'
        };

        const folderUri = await vscode.window.showOpenDialog(options);
        if (folderUri && folderUri[0]) {
          const selectedPath = folderUri[0].fsPath;
          const defaultName = path.basename(selectedPath);
          this._panel.webview.postMessage({
            command: 'folderPicked',
            path: selectedPath,
            name: defaultName,
            targetField: message.targetField
          });
        }
        break;
      }

      case 'openProject': {
        try {
          await this._storageService.recordProjectOpen(message.projectId);
          const uri = vscode.Uri.file(message.path);
          await vscode.commands.executeCommand('vscode.openFolder', uri, {
            forceNewWindow: message.newWindow
          });
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to open project: ${err?.message || err}`);
        }
        break;
      }

      case 'openTerminal': {
        try {
          const terminal = vscode.window.createTerminal({
            name: message.name || path.basename(message.path),
            cwd: message.path
          });
          terminal.show();
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to open terminal: ${err?.message || err}`);
        }
        break;
      }

      case 'revealInFinder': {
        try {
          const uri = vscode.Uri.file(message.path);
          await vscode.commands.executeCommand('revealFileInOS', uri);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to reveal folder: ${err?.message || err}`);
        }
        break;
      }

      case 'savePreferences': {
        await this._storageService.updatePreferences(message.preferences);
        break;
      }

      case 'saveProject': {
        await this._storageService.saveProject(message.project);
        vscode.window.showInformationMessage(`Project "${message.project.name}" saved!`);
        break;
      }

      case 'deleteProject': {
        const project = this._storageService.getData().projects.find(p => p.id === message.id);
        const confirm = await vscode.window.showWarningMessage(
          `Are you sure you want to remove "${project?.name || 'this project'}" from your dashboard? (Files on disk will NOT be deleted)`,
          { modal: true },
          'Remove Project'
        );
        if (confirm === 'Remove Project') {
          await this._storageService.deleteProject(message.id);
          vscode.window.showInformationMessage('Project removed from dashboard.');
        }
        break;
      }

      case 'toggleFavorite': {
        await this._storageService.toggleFavorite(message.id);
        break;
      }

      case 'saveCategory': {
        await this._storageService.saveCategory(message.category);
        vscode.window.showInformationMessage(`Category "${message.category.name}" saved!`);
        break;
      }

      case 'deleteCategory': {
        const category = this._storageService.getData().categories.find(c => c.id === message.id);
        const confirm = await vscode.window.showWarningMessage(
          `Delete category "${category?.name || 'this category'}"? Projects in this category will become Uncategorized.`,
          { modal: true },
          'Delete Category'
        );
        if (confirm === 'Delete Category') {
          await this._storageService.deleteCategory(message.id);
          vscode.window.showInformationMessage('Category deleted.');
        }
        break;
      }

      case 'reorderCategories': {
        await this._storageService.reorderCategories(message.categoryIds);
        break;
      }

      case 'exportData': {
        const json = await this._storageService.exportData();
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file('vscode-projects-backup.json'),
          filters: { 'JSON Files': ['json'] }
        });
        if (uri) {
          await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf8'));
          vscode.window.showInformationMessage('Project Dashboard data exported successfully!');
        }
        break;
      }

      case 'importData': {
        const uris = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters: { 'JSON Files': ['json'] },
          openLabel: 'Import JSON Backup'
        });
        if (uris && uris[0]) {
          const fileData = await vscode.workspace.fs.readFile(uris[0]);
          const content = Buffer.from(fileData).toString('utf8');
          const result = await this._storageService.importData(content);
          if (result.success) {
            vscode.window.showInformationMessage(result.message);
          } else {
            vscode.window.showErrorMessage(result.message);
          }
        }
        break;
      }

      case 'showNotification': {
        if (message.type === 'error') {
          vscode.window.showErrorMessage(message.message);
        } else if (message.type === 'warning') {
          vscode.window.showWarningMessage(message.message);
        } else {
          vscode.window.showInformationMessage(message.message);
        }
        break;
      }
    }
  }

  private _update() {
    this._panel.title = 'Project Dashboard';
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
  }

  public _getHtmlForWebview(webview: vscode.Webview): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'dashboard.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'dashboard.js')
    );

    const nonce = getNonce();
    const initialData = this._storageService.getData();
    const initialDataJson = JSON.stringify(initialData).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} https: data:;">
  <link rel="stylesheet" href="${styleUri}">
  <title>Project Dashboard</title>
</head>
<body class="dashboard-body">
  <div id="app" class="app-container">
    <!-- Top Header -->
    <header class="dashboard-header">
      <div class="header-left">
        <div class="logo-badge">
          <svg class="header-icon" viewBox="0 0 24 24" width="24" height="24">
            <defs>
              <linearGradient id="header-dash-blue" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#38bdf8"/>
                <stop offset="100%" stop-color="#2563eb"/>
              </linearGradient>
              <linearGradient id="header-dash-purple" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#a78bfa"/>
                <stop offset="100%" stop-color="#6366f1"/>
              </linearGradient>
            </defs>
            <rect x="3" y="3" width="7.5" height="9.5" rx="2" fill="url(#header-dash-blue)" />
            <rect x="13.5" y="3" width="7.5" height="5.5" rx="2" fill="url(#header-dash-purple)" />
            <rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2" fill="url(#header-dash-blue)" />
            <rect x="3" y="15.5" width="7.5" height="5.5" rx="2" fill="url(#header-dash-purple)" />
          </svg>
          <h1>Project Dashboard</h1>
        </div>
        <div class="stats-pills">
          <span class="pill" id="total-projects-pill">0 Projects</span>
          <span class="pill" id="total-categories-pill">0 Categories</span>
        </div>
      </div>

      <div class="header-actions">
        <button id="btn-refresh-data" class="secondary-button" title="Refresh Git Status & Projects">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Refresh
        </button>
        <button id="btn-export-data" class="secondary-button" title="Export Projects (JSON)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Export
        </button>
        <button id="btn-import-data" class="secondary-button" title="Import Projects (JSON)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          Import
        </button>
        <button id="btn-manage-categories" class="secondary-button">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></svg>
          Categories
        </button>
        <button id="btn-add-project" class="primary-button">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          New Project
        </button>
      </div>
    </header>

    <!-- Toolbar: Search, Filters & View Mode -->
    <section class="toolbar-section">
      <div class="search-box-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" id="project-search-input" placeholder="Search projects by name, path or tag..." autocomplete="off" />
        <button id="btn-clear-search" class="clear-search-btn" title="Clear Search" style="display: none;">&times;</button>
      </div>

      <div class="toolbar-controls">
        <div class="sort-select-wrapper">
          <label for="sort-select">Sort:</label>
          <select id="sort-select" class="custom-select">
            <option value="recent">Recently Opened</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="created-desc">Newest Added</option>
            <option value="created-asc">Oldest Added</option>
          </select>
        </div>

        <div class="view-toggles">
          <button id="view-mode-grid" class="icon-toggle-btn active" title="Grid View">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          </button>
          <button id="view-mode-list" class="icon-toggle-btn" title="List View">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
          </button>
        </div>
      </div>
    </section>

    <!-- Category Filter Bar -->
    <nav class="category-filter-bar" id="category-filter-bar">
      <!-- Category chips will be rendered here dynamically -->
    </nav>

    <!-- Main Content Area -->
    <main class="dashboard-content">
      <div id="projects-container" class="projects-grid">
        <!-- Project Cards will be rendered here -->
      </div>

      <!-- Empty State -->
      <div id="empty-state" class="empty-state-card" style="display: none;">
        <div class="empty-icon-circle">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <h3 id="empty-state-title">No Projects Found</h3>
        <p id="empty-state-desc">Get started by adding your first project to your dashboard.</p>
        <button id="btn-empty-add-project" class="primary-button">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Your First Project
        </button>
      </div>
    </main>
  </div>

  <!-- Project Modal (Add / Edit) -->
  <div id="project-modal" class="modal-backdrop" style="display: none;">
    <div class="modal-card">
      <div class="modal-header">
        <h2 id="modal-project-title">Add Project</h2>
        <button id="btn-close-project-modal" class="modal-close-btn">&times;</button>
      </div>

      <form id="project-form">
        <input type="hidden" id="form-project-id" />

        <div class="form-group">
          <label for="form-project-name">Project Name <span class="required">*</span></label>
          <input type="text" id="form-project-name" class="form-input" placeholder="e.g. My Next.js Web App" required />
        </div>

        <div class="form-group">
          <label for="form-project-path">Folder Path <span class="required">*</span></label>
          <div class="path-input-group">
            <input type="text" id="form-project-path" class="form-input" placeholder="/Users/username/projects/my-app" required />
            <button type="button" id="btn-browse-folder" class="secondary-button browse-btn" title="Browse Folder">
              Browse
            </button>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group flex-1">
            <label for="form-project-category">Category</label>
            <select id="form-project-category" class="form-select">
              <!-- Dynamically populated -->
            </select>
          </div>

          <div class="form-group flex-1">
            <label>Color Accent</label>
            <div class="color-picker-container">
              <div class="color-presets" id="color-presets">
                <!-- Preset color swatches -->
              </div>
              <div class="custom-color-wrapper">
                <input type="color" id="form-project-color" value="#3b82f6" title="Custom color picker" />
                <input type="text" id="form-project-color-hex" class="hex-input" value="#3B82F6" placeholder="#3B82F6" maxlength="7" spellcheck="false" autocomplete="off" />
              </div>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="form-project-tags">Tags (Optional, comma-separated)</label>
          <input type="text" id="form-project-tags" class="form-input" placeholder="e.g. Frontend, API, Client-A, WIP" />
        </div>

        <div class="form-group">
          <label for="form-project-description">Description (Optional)</label>
          <textarea id="form-project-description" class="form-textarea" rows="2" placeholder="Brief project summary..."></textarea>
        </div>

        <div class="form-group checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" id="form-project-favorite" />
            <span>Pin as Favorite</span>
          </label>
        </div>

        <div class="modal-footer">
          <button type="button" id="btn-cancel-project" class="secondary-button">Cancel</button>
          <button type="submit" id="btn-save-project" class="primary-button">Save Project</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Category Manager Modal -->
  <div id="category-modal" class="modal-backdrop" style="display: none;">
    <div class="modal-card">
      <div class="modal-header">
        <h2>Manage Categories</h2>
        <button id="btn-close-category-modal" class="modal-close-btn">&times;</button>
      </div>

      <div class="modal-body-scrollable">
        <form id="category-form" class="category-add-form">
          <input type="hidden" id="form-cat-id" />
          <div class="category-form-grid">
            <div class="form-group">
              <label for="form-cat-name">Category Name</label>
              <input type="text" id="form-cat-name" class="form-input" placeholder="e.g. Mobile Apps" required />
            </div>
            <div class="form-group">
              <label>Color</label>
              <div class="cat-color-row">
                <input type="color" id="form-cat-color" value="#3b82f6" title="Category color picker" />
                <input type="text" id="form-cat-color-hex" class="hex-input" value="#3B82F6" placeholder="#3B82F6" maxlength="7" spellcheck="false" autocomplete="off" />
                <button type="submit" id="btn-save-category" class="primary-button btn-small">Add Category</button>
                <button type="button" id="btn-cancel-cat-edit" class="secondary-button btn-small" style="display: none;">Cancel</button>
              </div>
            </div>
          </div>
        </form>

        <div class="categories-list-section">
          <h3>Existing Categories</h3>
          <div id="categories-manage-list" class="categories-manage-list">
            <!-- List of existing categories with edit/delete -->
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" id="btn-done-categories" class="primary-button">Done</button>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    window.INITIAL_DATA = ${initialDataJson};
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
